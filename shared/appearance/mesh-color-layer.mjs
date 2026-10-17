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
