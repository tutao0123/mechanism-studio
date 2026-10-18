/** Minimal renderer adapter, intentionally independent of Three.js imports.
 * Meshes/materials implement the usual clone(), color.set() and dispose() API.
 * Only owned cloned solid materials are updated: feature lines, source data,
 * visibility and transforms are never changed. */
export function createMeshColorLayer(meshes, { canApply = mesh => !mesh.userData?.selected } = {}) {
  const records = [];
  for (const mesh of meshes) {
    const original = mesh.material, source = Array.isArray(original) ? original : [original];
    const owned = source.map(material => material?.color && typeof material.clone === 'function' ? material.clone() : material);
    const material = Array.isArray(original) ? owned : owned[0];
    mesh.material = material;
    records.push({ mesh, id: mesh.userData?.selectionId, original, material, owned, source });
  }
  let disposed = false;
  return {
    apply(assignments) {
      if (disposed) return;
      for (const record of records) {
        // A selection/inspection layer may temporarily replace the solid. Do not
        // overwrite its material or its colour; reapply on its next owned frame.
        if (record.mesh.material !== record.material || !canApply(record.mesh)) continue;
        const sample = assignments.get(record.id);
        if (!sample) continue;
        for (const material of record.owned) if (material?.color) material.color.set(sample.color);
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const record of records) {
        if (record.mesh.material === record.material) record.mesh.material = record.original;
        for (let i = 0; i < record.owned.length; i++) if (record.owned[i] !== record.source[i]) record.owned[i].dispose?.();
      }
    },
  };
}

/** Optional presentation fades for already-owned viewer materials. Source nodes,
 * geometry, transforms and semantic hierarchy remain untouched. Feature edges
 * fade with their solid so a context silhouette cannot linger at full strength. */
export function createMeshVisibilityLayer(meshes) {
  const records = meshes.map(mesh => {
    const objects = [mesh, ...mesh.children.filter(child => child.userData?.isLineArt)];
    const materials = objects.flatMap(object => (Array.isArray(object.material) ? object.material : [object.material])
      .filter(Boolean).map(material => ({ material, opacity: material.opacity, transparent: material.transparent,
        depthWrite: material.depthWrite })));
    return { mesh, id: mesh.userData?.selectionId, materials, visible: mesh.visible };
  });
  return {
    apply(opacityForId) {
      for (const record of records) {
        const opacity = opacityForId(record.id);
        if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1) throw new RangeError('Presentation opacity must be between zero and one.');
        record.mesh.visible = opacity > .0001;
        for (const entry of record.materials) {
          const transparent = entry.transparent || opacity < .9999;
          if (entry.material.transparent !== transparent) { entry.material.transparent = transparent; entry.material.needsUpdate = true; }
          entry.material.opacity = entry.opacity * opacity;
          // Keep the solid's depth surface while its colour fades. Otherwise
          // dozens of hidden bearing/edge layers bleed through as a wire cloud.
          // Feature lines keep their original depthWrite=false policy.
          entry.material.depthWrite = entry.depthWrite;
        }
      }
    },
    restore() {
      for (const record of records) {
        record.mesh.visible = record.visible;
        for (const entry of record.materials) {
          Object.assign(entry.material, { opacity: entry.opacity, transparent: entry.transparent, depthWrite: entry.depthWrite });
          entry.material.needsUpdate = true;
        }
      }
    },
  };
}
