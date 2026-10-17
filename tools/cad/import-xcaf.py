#!/usr/bin/env python3
"""Read STEP assembly identities and placements through OCCT XCAF.

Run with the project-local Python described in requirements-xcaf.txt. Output is
an engineering graph plus definition-local display meshes, not a mate solver.
No identity is inferred from names, mesh indices, or proximity.
"""
from __future__ import annotations

import argparse
from collections import Counter
import hashlib
import importlib.metadata
import json
import math
from pathlib import Path
import re
import struct
import sys

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[2]

from OCP import __version__ as occt_version
from OCP.Bnd import Bnd_Box
from OCP.BRep import BRep_Tool, BRep_Builder
from OCP.BRepBndLib import BRepBndLib
from OCP.BRepGProp import BRepGProp
from OCP.BRepMesh import BRepMesh_IncrementalMesh
from OCP.BRepTools import BRepTools
from OCP.IFSelect import IFSelect_RetDone
from OCP.GProp import GProp_GProps
from OCP.Interface import Interface_Static
from OCP.STEPCAFControl import STEPCAFControl_Reader
from OCP.STEPConstruct import STEPConstruct_Tool
from OCP.StepBasic import StepBasic_ProductDefinition
from OCP.StepRepr import StepRepr_NextAssemblyUsageOccurrence
from OCP.TCollection import TCollection_AsciiString, TCollection_ExtendedString
from OCP.TColStd import TColStd_SequenceOfAsciiString
from OCP.TDataStd import TDataStd_Name
from OCP.TDF import TDF_Label, TDF_LabelSequence, TDF_Tool
from OCP.TDocStd import TDocStd_Document
from OCP.TopAbs import TopAbs_FACE, TopAbs_REVERSED, TopAbs_SOLID
from OCP.TopExp import TopExp_Explorer
from OCP.TopLoc import TopLoc_Location
from OCP.TopoDS import TopoDS, TopoDS_Compound
from OCP.XCAFDoc import XCAFDoc_DocumentTool


def scoped_path(raw: str, *, must_exist: bool = False) -> Path:
    path = Path(raw)
    if not path.is_absolute():
        path = ROOT / path
    path = path.resolve(strict=must_exist)
    if not path.is_relative_to(ROOT):
        raise ValueError("All source and output paths must stay inside Mechanism Studio")
    return path


def label_entry(label: TDF_Label) -> str:
    value = TCollection_AsciiString()
    TDF_Tool.Entry_s(label, value)
    return value.ToCString()


def label_name(label: TDF_Label) -> str:
    attr = TDataStd_Name()
    return attr.Get().ToExtString() if label.FindAttribute(TDataStd_Name.GetID_s(), attr) else ""


def matrix(location: TopLoc_Location) -> list[float]:
    tr = location.Transformation()
    return [float(tr.Value(row, col)) if row < 4 else float(col == 4)
            for col in range(1, 5) for row in range(1, 5)]


IDENTITY = [1., 0., 0., 0., 0., 1., 0., 0., 0., 0., 1., 0., 0., 0., 0., 1.]


def multiply(a: list[float], b: list[float]) -> list[float]:
    return [sum(a[k * 4 + row] * b[col * 4 + k] for k in range(4))
            for col in range(4) for row in range(4)]


def entity_id(entity_ids, entity) -> str:
    # OCP's downcast wrappers cannot reliably round-trip a derived entity into
    # InterfaceModel.Number/IdentLabel in this pinned release. Resolve file
    # labels with OCCT's own exact NextNumberForLabel, then retain object keys.
    # This does not assume that file labels equal reader ranks.
    result = entity_ids.get(entity)
    if result is None:
        raise RuntimeError("STEP entity was not found by exact source label")
    return result


def product_metadata(entity_ids, definition) -> dict:
    product = definition.Formation().OfProduct()
    return {
        "productDefinitionEntity": entity_id(entity_ids, definition),
        "productEntity": entity_id(entity_ids, product),
        "productId": product.Id().ToCString(),
        "productName": product.Name().ToCString(),
    }


def solid_count(shape) -> int:
    count, explorer = 0, TopExp_Explorer(shape, TopAbs_SOLID)
    while explorer.More():
        count += 1
        explorer.Next()
    return count


def shape_mesh(shape, linear: float, angular: float) -> dict:
    # AP242 can retain real source occurrences whose faces contain only an
    # embedded triangulation, without an analytic surface. Keep that source
    # mesh, and never fabricate analytic B-rep bounds for it.
    def triangle_signature(tri):
        digest = hashlib.sha256()
        for node in range(1, tri.NbNodes() + 1):
            point = tri.Node(node)
            digest.update(struct.pack("<3d", point.X(), point.Y(), point.Z()))
        for triangle in range(1, tri.NbTriangles() + 1):
            digest.update(struct.pack("<3i", *tri.Triangle(triangle).Get()))
        return digest.hexdigest()

    source_triangles = {}
    source_faces, source_face_index = TopExp_Explorer(shape, TopAbs_FACE), 0
    while source_faces.More():
        source_face_index += 1
        face = TopoDS.Face_s(source_faces.Current())
        if BRep_Tool.Surface_s(face) is None:
            tri = BRep_Tool.Triangulation_s(face, TopLoc_Location())
            if tri is None or not tri.NbTriangles():
                raise RuntimeError("A non-analytic source face has no retained triangulation; unsupported geometry is not dropped")
            source_triangles[source_face_index] = {
                "representation": "source-triangulated",
                "sourceTriangleCount": tri.NbTriangles(),
                "sourceNodeCount": tri.NbNodes(),
                "sourceTriangulationSHA256": triangle_signature(tri),
            }
        source_faces.Next()
    # Remove old cached meshes so a coarse import does not silently reuse fine
    # triangulation. Geometry is the referenced definition, never its occurrence.
    if len(source_triangles) != source_face_index:
        # Clean_s's default force=False preserves mesh-only faces. Pure source
        # triangulation needs no remeshing at either requested display setting.
        BRepTools.Clean_s(shape)
        mesher = BRepMesh_IncrementalMesh(shape, linear, False, angular, False)
        if not mesher.IsDone():
            raise RuntimeError("OCCT meshing did not complete")
    positions, normals, indices, faces = [], [], [], []
    explorer, face_index = TopExp_Explorer(shape, TopAbs_FACE), 0
    while explorer.More():
        face_index += 1
        face = TopoDS.Face_s(explorer.Current())
        location = TopLoc_Location()
        tri = BRep_Tool.Triangulation_s(face, location)
        source_triangle = source_triangles.get(face_index)
        if source_triangle and (tri is None or triangle_signature(tri) != source_triangle["sourceTriangulationSHA256"]):
            raise RuntimeError("Meshing changed or removed a retained source triangulation")
        recovery = None
        if tri is None:
            props = GProp_GProps()
            BRepGProp.SurfaceProperties_s(face, props, False, False)
            recovery = {"surfaceAreaMm2": props.Mass(), "attempts": [], "recovered": False,
                        "nominalLinearDeflectionMm": linear, "nominalAngularDeflectionRadians": angular}
            # Imported tolerances/sliver faces can mesh at coarse settings but
            # fail fine whole-shape meshing. Try the face independently, first
            # finer, then explicitly coarser. Preserve every actual setting.
            for retry_linear, retry_angular in [(linear * .5, angular * .5), (max(linear, .3), max(angular, .7))]:
                BRepTools.Clean_s(face)
                retry = BRepMesh_IncrementalMesh(face, retry_linear, False, retry_angular, False)
                location = TopLoc_Location()
                tri = BRep_Tool.Triangulation_s(face, location)
                recovery["attempts"].append({"linearDeflectionMm": retry_linear,
                    "angularDeflectionRadians": retry_angular, "mesherDone": retry.IsDone(),
                    "triangleCount": tri.NbTriangles() if tri is not None else 0})
                if tri is not None:
                    recovery.update({"status": "recovered-per-face", "recovered": True, "linearDeflectionMm": retry_linear,
                                     "angularDeflectionRadians": retry_angular})
                    break
            if tri is None:
                recovery["status"] = "unmeshed"
                faces.append({"faceIndex": face_index, "firstTriangle": len(indices) // 3,
                              "triangleCount": 0, **recovery})
                explorer.Next()
                continue
        if not tri.HasNormals():
            tri.ComputeNormals()
        reversed_face = face.Orientation() == TopAbs_REVERSED
        base, first_triangle = len(positions) // 3, len(indices) // 3
        transform = location.Transformation()
        for i in range(1, tri.NbNodes() + 1):
            point = tri.Node(i).Transformed(transform)
            normal = tri.Normal(i).Transformed(transform)
            sign = -1 if reversed_face else 1
            positions.extend([point.X(), point.Y(), point.Z()])
            normals.extend([sign * normal.X(), sign * normal.Y(), sign * normal.Z()])
        for i in range(1, tri.NbTriangles() + 1):
            a, b, c = tri.Triangle(i).Get()
            if reversed_face:
                b, c = c, b
            indices.extend([base + a - 1, base + b - 1, base + c - 1])
        faces.append({"faceIndex": face_index, "firstTriangle": first_triangle,
                      "triangleCount": tri.NbTriangles(), **(source_triangle or {}), **(recovery or {})})
        explorer.Next()
    if not indices:
        raise RuntimeError("Leaf definition has no face mesh; wire-only STEP is unsupported")
    bounds = {"min": [min(positions[i::3]) for i in range(3)],
              "max": [max(positions[i::3]) for i in range(3)]}
    brep_bounds = Bnd_Box()
    BRepBndLib.AddOptimal_s(shape, brep_bounds, False, False)
    analytic_bounds = None
    if not brep_bounds.IsVoid():
        values = brep_bounds.Get()
        analytic_bounds = {"min": list(values[:3]), "max": list(values[3:])}
    elif not source_triangles:
        raise RuntimeError("Analytic B-rep bounds are void without retained source triangulation; unsupported geometry is not dropped")
    representation = {}
    if source_triangles:
        source_only = len(source_triangles) == face_index
        representation = {
            "representation": "source-triangulated" if source_only else "mixed-brep-and-source-triangulation",
            "sourceTriangulatedFaceCount": len(source_triangles),
            "analyticFaceCount": face_index - len(source_triangles),
            "boundsEvidence": {
                "analytic": "unavailable" if analytic_bounds is None else "partial",
                "display": "actual retained/imported triangle positions",
                "note": "Source-triangulated faces have no analytic surface; triangle bounds are not exact B-rep measurement.",
            },
        }
    return {"positions": positions, "normals": normals, "indices": indices,
            "faces": faces, "boundsMm": bounds,
            "brepBoundsMm": analytic_bounds, **representation,
            "triangleCount": len(indices) // 3, "solidCount": solid_count(shape)}


def import_step(source: Path, linear: float, angular: float) -> dict:
    data = source.read_bytes()
    # XCAF can resolve external STEP files. This importer intentionally accepts
    # self-contained files only, before transfer can follow any external paths.
    text = data.decode("latin-1")
    if re.search(r"\b(?:DOCUMENT_FILE|EXTERNALLY_DEFINED_REPRESENTATION)\s*\(", text, re.I):
        raise ValueError("External-file STEP references are not enabled by this importer")
    source_sha = hashlib.sha256(data).hexdigest()
    prefix = source_sha[:12]
    reader = STEPCAFControl_Reader()
    reader.SetNameMode(True)
    reader.SetColorMode(False)
    reader.SetLayerMode(False)
    Interface_Static.SetCVal_s("xstep.cascade.unit", "MM")
    if reader.ReadFile(str(source)) != IFSelect_RetDone:
        raise RuntimeError("OCCT could not read STEP source")
    base_reader = reader.Reader()
    length_names, angle_names, solid_names = [TColStd_SequenceOfAsciiString() for _ in range(3)]
    base_reader.FileUnits(length_names, angle_names, solid_names)
    document = TDocStd_Document(TCollection_ExtendedString("XCAF"))
    if not reader.Transfer(document):
        raise RuntimeError("OCCT could not transfer STEP to XCAF")
    shape_tool = XCAFDoc_DocumentTool.ShapeTool_s(document.Main())
    step_model = base_reader.StepModel()
    entity_ids = {}
    source_ids = re.findall(r"#(\d+)\s*=\s*(?:PRODUCT_DEFINITION|PRODUCT|NEXT_ASSEMBLY_USAGE_OCCURRENCE)\s*\(", text, re.I)
    # Exact native label lookup must be retained: the pinned OCP downcast
    # wrappers do not round-trip into Number/IdentLabel (see entity_id). Begin
    # after the previous resolved rank to avoid rescanning a large ordered
    # model for every product/use label. If reader/source order differs, retry
    # from zero. No file-number/rank equality or ordering is assumed for IDs.
    previous_rank = 0
    for source_id in source_ids:
        source_label = f"#{source_id}"
        rank = step_model.NextNumberForLabel(source_label, previous_rank, True)
        if not rank and previous_rank:
            rank = step_model.NextNumberForLabel(source_label, 0, True)
        if not rank:
            raise RuntimeError(f"OCCT did not retain source label {source_label}")
        entity_ids[step_model.Value(rank)] = source_label
        previous_rank = rank
    construct_tool = STEPConstruct_Tool(base_reader.WS())
    label_map = reader.GetShapeLabelMap()
    component_sources, definition_sources, unmapped = {}, {}, []
    source_product_definitions = []

    def record_definition(label, pd):
        key, metadata = label_entry(label), product_metadata(entity_ids, pd)
        if key in definition_sources and definition_sources[key] != metadata:
            raise RuntimeError(f"OCCT label {key} represents conflicting STEP product definitions")
        definition_sources[key] = metadata

    for entity in entity_ids:
        if isinstance(entity, StepBasic_ProductDefinition):
            source_product_definitions.append(product_metadata(entity_ids, entity))
        if not isinstance(entity, StepRepr_NextAssemblyUsageOccurrence):
            continue
        instance = reader.FindInstance_s(entity, shape_tool, construct_tool, label_map)
        source_id = entity_id(entity_ids, entity)
        if instance.IsNull():
            unmapped.append(source_id)
            continue
        target = TDF_Label()
        if not shape_tool.GetReferredShape_s(instance, target):
            raise RuntimeError(f"STEP occurrence {source_id} did not resolve to a definition")
        key = label_entry(instance)
        if key in component_sources:
            raise RuntimeError(f"Multiple STEP occurrences resolved to one XCAF component {key}")
        component_sources[key] = {
            "nauoEntity": source_id, "occurrenceId": entity.Id().ToCString(),
            "parentDefinitionEntity": entity_id(entity_ids, entity.RelatingProductDefinition()),
            "childDefinitionEntity": entity_id(entity_ids, entity.RelatedProductDefinition()),
        }
        record_definition(instance.Father(), entity.RelatingProductDefinition())
        record_definition(target, entity.RelatedProductDefinition())
    if unmapped:
        raise RuntimeError(f"Source NAUO occurrences without XCAF mapping: {unmapped}")

    definitions, occurrences, labels_by_id, owned_geometry = {}, [], {}, {}
    source_assembly_definitions = {record["parentDefinitionEntity"] for record in component_sources.values()}
    generated_geometry_components = []
    roots_sequence = TDF_LabelSequence()
    shape_tool.GetFreeShapes(roots_sequence)

    def visit(label, parent_id: str | None, path: list[str], parent_world: list[float], active: set[str]):
        referred, target = shape_tool.IsReference_s(label), TDF_Label()
        if referred:
            if not shape_tool.GetReferredShape_s(label, target):
                raise RuntimeError("Unresolved XCAF shape reference")
        else:
            target = label
        target_key, component_key = label_entry(target), label_entry(label)
        if target_key in active:
            raise RuntimeError("Cyclic STEP assembly graph")
        source_meta = definition_sources.get(target_key)
        # Standalone parts lack an NAUO. Only exact unambiguous singleton source
        # definition is accepted; do not fall back to a source name match.
        if source_meta is None and roots_sequence.Length() == 1 and len(source_product_definitions) == 1:
            source_meta = source_product_definitions[0]
        if source_meta is None:
            raise RuntimeError(f"No exact STEP PRODUCT_DEFINITION mapping for XCAF label {target_key}")
        source_definition = source_meta["productDefinitionEntity"]
        definition_id = f"def-{prefix}-{source_definition[1:]}"
        # A compound product may be expanded by XCAF into synthetic SOLID
        # component labels. They are geometry fragments, not STEP occurrences.
        assembly = source_definition in source_assembly_definitions
        if definition_id not in definitions:
            definitions[definition_id] = {
                "definition_id": definition_id, "xcafLabel": target_key,
                "name": label_name(target), "kind": "assembly" if assembly else "part",
                "source": source_meta,
            }
            labels_by_id[definition_id] = target
        occurrence_source = component_sources.get(component_key)
        token = occurrence_source["nauoEntity"][1:] if occurrence_source else f"root-{source_definition[1:]}"
        occurrence_path = path + [token]
        occurrence_id = f"occ-{prefix}-{'-'.join(occurrence_path)}"
        # Definitions are null-located XCAF shapes. A component's location is
        # relative to its owning assembly definition. For a free non-reference
        # shape, its internal location is already part of definition geometry.
        local = matrix(shape_tool.GetLocation_s(label)) if referred else IDENTITY.copy()
        world = multiply(parent_world, local)
        record = {
            "occurrence_id": occurrence_id, "parent_id": parent_id,
            "definition_id": definition_id, "kind": "assembly" if assembly else "part",
            "name": label_name(label) or label_name(target),
            "source": {"xcafLabel": component_key, **(occurrence_source or {"nauoEntity": None, "occurrenceId": None})},
            "localMatrixMm": local, "worldMatrixMm": world, "children": [],
        }
        occurrences.append(record)
        if assembly:
            children = TDF_LabelSequence()
            shape_tool.GetComponents_s(target, children, False)
            for index in range(1, children.Length() + 1):
                child_label = children.Value(index)
                if label_entry(child_label) not in component_sources:
                    if definition_id not in owned_geometry:
                        owned_geometry[definition_id] = []
                    child_entry = label_entry(child_label)
                    if not any(item["xcafLabel"] == child_entry for item in owned_geometry[definition_id]):
                        owned_geometry[definition_id].append({"xcafLabel": child_entry, "shape": shape_tool.GetShape_s(child_label)})
                        generated_geometry_components.append({"ownerDefinitionId": definition_id, "xcafLabel": child_entry,
                            "meaning": "OCCT-generated geometry component; not a source PRODUCT_DEFINITION or NAUO"})
                    continue
                child_id = visit(child_label, occurrence_id, occurrence_path, world, active | {target_key})
                record["children"].append(child_id)
        return occurrence_id

    roots = [visit(roots_sequence.Value(i), None, [], IDENTITY, set())
             for i in range(1, roots_sequence.Length() + 1)]
    for definition_id, definition in definitions.items():
        if definition["kind"] == "part":
            definition["geometry"] = shape_mesh(shape_tool.GetShape_s(labels_by_id[definition_id]), linear, angular)
        elif definition_id in owned_geometry:
            compound, builder = TopoDS_Compound(), BRep_Builder()
            builder.MakeCompound(compound)
            for item in owned_geometry[definition_id]:
                builder.Add(compound, item["shape"])
            definition["geometry"] = shape_mesh(compound, linear, angular)
            definition["source"]["importerGeometryLabels"] = [item["xcafLabel"] for item in owned_geometry[definition_id]]
    mesh_warnings = [{"definition_id": d["definition_id"], "name": d["name"], **face}
                          for d in definitions.values() for face in d.get("geometry", {}).get("faces", [])
                          if face.get("status")]
    reuse = Counter(record["definition_id"] for record in occurrences if record["kind"] == "part")
    return {
        "schema": "mechanism-studio-xcaf-1", "sourceSHA256": source_sha,
        "importer": {"package": "cadquery-ocp", "version": importlib.metadata.version("cadquery-ocp"),
                     "occtVersion": occt_version, "assemblyReader": "STEPCAFControl_Reader",
                     "identityMapping": "STEPCAFControl_Reader.FindInstance -> XCAF component -> referred definition",
                     "linearDeflectionMm": linear, "angularDeflectionRadians": angular,
                     "relativeDeflection": False, "parallelMeshing": False},
        "units": {"sourceLengthNames": [length_names.Value(i).ToCString() for i in range(1, length_names.Length() + 1)],
                  "sourceAngleNames": [angle_names.Value(i).ToCString() for i in range(1, angle_names.Length() + 1)],
                  "importedLength": "mm", "matrices": "column-major, translation in mm",
                  "coordinateBasis": "native STEP axes"},
        "roots": roots, "definitions": list(definitions.values()), "occurrences": occurrences,
        "generatedGeometryComponents": generated_geometry_components,
        "meshWarnings": mesh_warnings,
        "statistics": {"definitionCount": len(definitions), "occurrenceCount": len(occurrences),
                       "leafOccurrences": sum(record["kind"] == "part" for record in occurrences),
                       "assemblyOccurrences": sum(record["kind"] == "assembly" for record in occurrences),
                       "sourceNauoCount": len(component_sources), "unmappedSourceOccurrences": len(unmapped),
                       "reusedLeafDefinitions": sum(count > 1 for count in reuse.values()),
                       "geometryBearingAssemblies": sum(d["kind"] == "assembly" and "geometry" in d for d in definitions.values()),
                       "unmeshedFaces": sum(face["status"] == "unmeshed" for face in mesh_warnings),
                       "recoveredMeshFaces": sum(face["status"] == "recovered-per-face" for face in mesh_warnings),
                       "sourceTriangulatedDefinitions": sum(bool(d.get("geometry", {}).get("sourceTriangulatedFaceCount")) for d in definitions.values()),
                       "sourceTriangulatedOccurrences": sum(bool(definitions[o["definition_id"]].get("geometry", {}).get("sourceTriangulatedFaceCount")) for o in occurrences),
                       "sourceTriangulatedFaces": sum(d.get("geometry", {}).get("sourceTriangulatedFaceCount", 0) for d in definitions.values()),
                       "uniqueTriangleCount": sum(d.get("geometry", {}).get("triangleCount", 0) for d in definitions.values())},
        "limitations": ["IDs are stable for this exact source hash and importer version; re-exported source may renumber entities.",
                        "Face indices identify imported definition topology only, not persistent native feature IDs.",
                        "No source mate recovery, constraints, physical simulation, exact section, or interference API is implemented.",
                        "Self-contained STEP files with exact NAUO mapping are accepted; external references are disabled."]
                        + (["Some source faces contain embedded triangulation without an analytic surface; their exact source identities and triangles are retained, but analytic B-rep bounds/measurement are unavailable for those faces."]
                           if any(d.get("geometry", {}).get("sourceTriangulatedFaceCount") for d in definitions.values()) else []),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True, help="STEP path inside project")
    parser.add_argument("--output", required=True, help="JSON path inside project")
    parser.add_argument("--linear-deflection", type=float, default=0.08, help="Absolute meshing deflection in millimetres")
    parser.add_argument("--angular-deflection", type=float, default=0.4, help="Meshing angle in radians")
    args = parser.parse_args()
    for value in [args.linear_deflection, args.angular_deflection]:
        if not math.isfinite(value) or value <= 0:
            parser.error("Meshing tolerances must be positive finite values")
    source = scoped_path(args.source, must_exist=True)
    if not source.is_file():
        parser.error("Source must be a regular file")
    output = scoped_path(args.output)
    result = import_step(source, args.linear_deflection, args.angular_deflection)
    output.parent.mkdir(parents=True, exist_ok=True)
    output = scoped_path(str(output))
    output.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":"), allow_nan=False) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(output.relative_to(ROOT)), "sourceSHA256": result["sourceSHA256"], **result["statistics"]}))


if __name__ == "__main__":
    main()
