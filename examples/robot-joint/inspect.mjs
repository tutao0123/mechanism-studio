import { BoxHelper, Raycaster, Vector2 } from 'three';

/** Local authored-part inspection. It adds no CAD joints or hidden source data. */
export function attachJointInspector(study) {
  if (document.body.classList.contains('capture')) return;
  const { viewer, index } = study, byId = new Map(index.parts.map(p => [p.id,p]));
  const details = document.createElement('details'); details.className = 'joint-inspector';
  const summary = document.createElement('summary'); summary.textContent = `Inspect ${index.parts.length} authored parts`; details.append(summary);
  const label = document.createElement('label'); label.textContent = 'Part ';
  const select = document.createElement('select'); select.setAttribute('aria-label','Authored assembly parts');
  const empty = document.createElement('option'); empty.value = ''; empty.textContent = 'Choose a part, or click the model'; select.append(empty);
  for (const assembly of index.assemblies) {
    const members = index.parts.filter(p => p.parentId === assembly.id); if (!members.length) continue;
    const group = document.createElement('optgroup'); group.label = assembly.name;
    for (const part of members) { const option = document.createElement('option'); option.value = part.id; option.textContent = part.name; group.append(option); }
    select.append(group);
  }
  label.append(select); details.append(label);
  const info = document.createElement('p'); info.setAttribute('role','status'); info.textContent = 'Pause the loop to inspect. Repeated parts share geometry but keep separate identities.'; details.append(info);
  const clear = document.createElement('button'); clear.type = 'button'; clear.textContent = 'Clear selection'; details.append(clear);
  document.querySelector('main').after(details);
  const style = document.createElement('style'); style.textContent = '.joint-inspector{margin:0 auto 32px;padding:14px 24px;max-width:1100px;border-top:1px solid #d8d8d2;font:15px/1.6 Georgia,serif}.joint-inspector summary{cursor:pointer}.joint-inspector label{display:block;margin-top:12px}.joint-inspector select{max-width:100%;padding:8px;border:1px solid #d8d8d2;background:white;color:#252525}.joint-inspector p{overflow-wrap:anywhere}'; document.head.append(style);
  let helper, selectedId = null, down;
  function choose(id) {
    study.pause(); selectedId = byId.has(id) ? id : null; select.value = selectedId ?? '';
    if (helper) { helper.removeFromParent(); helper.geometry.dispose(); helper.material.dispose(); helper = null; }
    const part = byId.get(selectedId);
    if (part) {
      details.open = true;
      helper = new BoxHelper(viewer.parts.get(part.id).node, 0x53594f); helper.raycast = () => {}; viewer.scene.add(helper);
      const count = index.parts.filter(p => p.definitionId === part.definitionId).length;
      info.textContent = `${part.name} · ${part.id} · ${count} occurrence${count === 1 ? '' : 's'} of this definition · ${index.assemblies.find(a => a.id === part.parentId).name}`;
    } else info.textContent = 'Select a named part in the assembly groups, or click visible geometry.';
    viewer.draw();
  }
  select.addEventListener('change', () => choose(select.value)); clear.addEventListener('click', () => choose(null));
  const canvas = viewer.renderer.domElement, ray = new Raycaster();
  canvas.addEventListener('pointerdown', event => { down = [event.clientX,event.clientY]; });
  canvas.addEventListener('pointerup', event => {
    if (!down || Math.hypot(event.clientX-down[0],event.clientY-down[1]) > 5) { down = null; return; } down = null;
    const box = canvas.getBoundingClientRect(); ray.setFromCamera(new Vector2((event.clientX-box.left)/box.width*2-1, -(event.clientY-box.top)/box.height*2+1), viewer.camera);
    const meshes = viewer.meshes.filter(m => { for (let p=m; p; p=p.parent) if (!p.visible) return false; return (m.material.opacity ?? 1) > .2; });
    const hit = ray.intersectObjects(meshes,false)[0]; choose(hit?.object.userData.selectionId);
  });
  // Capture-phase cleanup runs before the transport changes time/poses. It also
  // clears a paused restart immediately instead of leaving the last painted box.
  const clearOverlay = () => {
    if (helper) { helper.removeFromParent(); helper.geometry.dispose(); helper.material.dispose(); helper = null; }
    selectedId = null; select.value = '';
    info.textContent = 'Select a named part in the assembly groups, or click visible geometry.'; viewer.draw();
  };
  for (const id of ['play','pause','restart','sound','seek']) for (const event of ['click','input']) document.getElementById(id)?.addEventListener(event, clearOverlay, { capture:true });
  for (const name of ['seek','reset','play']) { const action=study[name]; study[name]=(...args)=>{clearOverlay();return action.apply(study,args);}; }
  return { select: choose, get selectedId() { return selectedId; } };
}
