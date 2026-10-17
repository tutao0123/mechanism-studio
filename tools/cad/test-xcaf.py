#!/usr/bin/env python3
"""Importer regression fixtures: exact identities, repeated assemblies, placements.

The synthetic fixture tests importer correctness; it is never used or presented
as the external CAD example. All generated files stay in .test-output/cad-xcaf.
"""
import importlib.util
import math
from pathlib import Path
import re
import sys

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("studio_xcaf", ROOT / "tools/cad/import-xcaf.py")
backend = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backend)

from OCP.BRepPrimAPI import BRepPrimAPI_MakeCylinder
from OCP.BRep import BRep_Builder
from OCP.Poly import Poly_Triangulation, Poly_Triangle
from OCP.TopoDS import TopoDS_Face
from OCP.gp import gp_Ax1, gp_Dir, gp_Pnt, gp_Trsf, gp_Vec
from OCP.STEPCAFControl import STEPCAFControl_Writer
from OCP.TCollection import TCollection_ExtendedString
from OCP.TDataStd import TDataStd_Name
from OCP.TDocStd import TDocStd_Document
from OCP.TopLoc import TopLoc_Location
from OCP.XCAFDoc import XCAFDoc_DocumentTool


def close(actual, expected):
    assert len(actual) == len(expected)
    assert all(abs(a-b) < 1e-8 for a, b in zip(actual, expected)), (actual, expected)


def placement(x, y, z, angle=0):
    transform = gp_Trsf()
    transform.SetRotation(gp_Ax1(gp_Pnt(0, 0, 0), gp_Dir(0, 0, 1)), angle)
    transform.SetTranslationPart(gp_Vec(x, y, z))
    return TopLoc_Location(transform)


def fixture(path):
    document = TDocStd_Document(TCollection_ExtendedString("XCAF"))
    tool = XCAFDoc_DocumentTool.ShapeTool_s(document.Main())
    root, carrier = tool.NewShape(), tool.NewShape()
    screw = tool.AddShape(BRepPrimAPI_MakeCylinder(1, 4).Shape(), False)
    for label, name in [(root, "Fixture"), (carrier, "Repeated carrier"), (screw, "Shared screw")]:
        TDataStd_Name.Set_s(label, TCollection_ExtendedString(name))
    for x in [5, -5]:
        label = tool.AddComponent(carrier, screw, placement(x, 0, 0))
        TDataStd_Name.Set_s(label, TCollection_ExtendedString("Identical display name"))
    tool.AddComponent(root, carrier, placement(10, 20, 30, math.pi/2))
    tool.AddComponent(root, carrier, placement(40, 50, 60, -math.pi/2))
    tool.UpdateAssemblies()
    writer = STEPCAFControl_Writer()
    writer.SetNameMode(True)
    assert writer.Transfer(document)
    assert writer.Write(str(path)) == backend.IFSelect_RetDone


def main():
    # A real native mesh-only face remains a source triangulation. It is not
    # dropped, reconstructed as analytic CAD, or given fabricated B-rep bounds.
    triangles = Poly_Triangulation(3, 1, False)
    for i, point in enumerate([gp_Pnt(2, 3, 4), gp_Pnt(5, 3, 4), gp_Pnt(2, 7, 4)], 1):
        triangles.SetNode(i, point)
    triangles.SetTriangle(1, Poly_Triangle(1, 2, 3))
    source_face = TopoDS_Face()
    BRep_Builder().MakeFace(source_face, triangles)
    source_fine = backend.shape_mesh(source_face, .05, .25)
    source_coarse = backend.shape_mesh(source_face, .4, .8)
    assert source_fine == source_coarse
    assert source_fine["representation"] == "source-triangulated"
    assert source_fine["brepBoundsMm"] is None
    assert source_fine["boundsEvidence"]["analytic"] == "unavailable"
    assert source_fine["sourceTriangulatedFaceCount"] == 1
    assert source_fine["faces"][0]["sourceTriangleCount"] == 1
    close(source_fine["boundsMm"]["min"], [2, 3, 4])
    close(source_fine["boundsMm"]["max"], [5, 7, 4])
    undefined_face = TopoDS_Face()
    BRep_Builder().MakeFace(undefined_face)
    try:
        backend.shape_mesh(undefined_face, .05, .25)
    except RuntimeError as error:
        assert "no retained triangulation" in str(error)
    else:
        raise AssertionError("A source face with neither analytic surface nor triangles was silently accepted")
    output = backend.scoped_path(".test-output/cad-xcaf")
    output.mkdir(parents=True, exist_ok=True)
    path = output / "repeated-assembly.step"
    fixture(path)
    fine = backend.import_step(path, .05, .25)
    coarse = backend.import_step(path, .4, .8)
    assert fine["statistics"]["definitionCount"] == 3
    assert fine["statistics"]["occurrenceCount"] == 7
    assert fine["statistics"]["sourceNauoCount"] == 4
    assert fine["statistics"]["leafOccurrences"] == 4
    assert fine["statistics"]["reusedLeafDefinitions"] == 1
    assert fine["meshWarnings"] == []
    assert [o["occurrence_id"] for o in fine["occurrences"]] == [o["occurrence_id"] for o in coarse["occurrences"]]
    assert [d["definition_id"] for d in fine["definitions"]] == [d["definition_id"] for d in coarse["definitions"]]
    leaves = [o for o in fine["occurrences"] if o["kind"] == "part"]
    assert len({o["definition_id"] for o in leaves}) == 1
    assert len({o["occurrence_id"] for o in leaves}) == 4
    # The same child NAUO is reused under two assembly occurrences. Full paths,
    # not just that child entity label, distinguish its four displayed instances.
    assert len({o["source"]["nauoEntity"] for o in leaves}) == 2
    actual_positions = sorted(tuple(round(v, 8) for v in o["worldMatrixMm"][12:15]) for o in leaves)
    assert actual_positions == sorted([(10., 25., 30.), (10., 15., 30.), (40., 45., 60.), (40., 55., 60.)])
    for leaf in leaves:
        close(leaf["localMatrixMm"][12:15], [5 if leaf["localMatrixMm"][12] > 0 else -5, 0, 0])
    definition = next(d for d in fine["definitions"] if d["kind"] == "part")
    assert definition["geometry"]["triangleCount"] > next(d for d in coarse["definitions"] if d["kind"] == "part")["geometry"]["triangleCount"]
    close(definition["geometry"]["brepBoundsMm"]["min"], [-1, -1, 0])
    close(definition["geometry"]["brepBoundsMm"]["max"], [1, 1, 4])
    # Non-sequential source labels, in reversed physical file order: never use
    # parser rank as source #entity identity.
    text = path.read_text(encoding="utf-8")
    text = re.sub(r"#(\d+)", lambda m: "#" + str(int(m[1])*3+1001), text)
    sections = text.split("DATA;", 1)
    body, end = sections[1].split("ENDSEC;", 1)
    records = re.findall(r"#\d+\s*=.*?;", body, re.S)
    renumbered = output / "renumbered.step"
    renumbered.write_text(sections[0] + "DATA;\n" + "\n".join(reversed(records)) + "\nENDSEC;" + end, encoding="utf-8")
    shuffled = backend.import_step(renumbered, .05, .25)
    assert shuffled["statistics"]["occurrenceCount"] == 7
    shuffled_positions = sorted(tuple(round(v, 8) for v in o["worldMatrixMm"][12:15]) for o in shuffled["occurrences"] if o["kind"] == "part")
    assert shuffled_positions == actual_positions
    for definition in shuffled["definitions"]:
        assert int(definition["source"]["productDefinitionEntity"][1:]) % 3 == 2
    for outside in [ROOT.parent, ROOT / ".." / "outside.json"]:
        try:
            backend.scoped_path(str(outside))
        except ValueError:
            pass
        else:
            raise AssertionError("Out-of-project path was accepted")
    external = output / "external-reference.step"
    external.write_text("ISO-10303-21; DATA; #1 = DOCUMENT_FILE ('outside'); ENDSEC; END-ISO-10303-21;", encoding="utf-8")
    try:
        backend.import_step(external, .05, .25)
    except ValueError:
        pass
    else:
        raise AssertionError("External-file references were accepted")
    print("XCAF regressions passed: repeated definition + repeated subassembly, exact entity labels, nested noncommuting placements, coarse/fine identity, local geometry, scoped paths")


if __name__ == "__main__":
    main()
