import { BufferGeometry, Group, Line, LineBasicMaterial, Mesh, MeshBasicMaterial, SphereGeometry, Vector3 } from 'three';
import { SUPPORT_BEARINGS } from './spec.mjs';

/** Orientation ink only: no source parts, source transforms or mechanical
 * channels are created here. Each cue inherits its real occurrence's complete
 * displayed world matrix, including the ball's absolute material spin. */
export function createBearingCues({ viewer }) {
  const resources = [], bindings = [];
  const ink = new LineBasicMaterial({ color: 0x575a54, transparent: true, opacity: .72, depthTest: true, depthWrite: false });
  const dotInk = new MeshBasicMaterial({ color: 0x575a54, transparent: true, opacity: .72, depthTest: true, depthWrite: false });
  const line = (points, group) => {
    const geometry = new BufferGeometry().setFromPoints(points.map(p => new Vector3(...p)));
    const mark = new Line(geometry, ink); mark.raycast = () => {}; group.add(mark); resources.push(geometry);
  };
  const bind = id => {
    const source = viewer.parts.get(id);
    if (!source) throw new Error(`Missing bearing cue occurrence: ${id}`);
    const group = new Group(); group.name = `${id}/orientation-ink`; group.matrixAutoUpdate = false;
    group.visible = false; viewer.scene.add(group); bindings.push({ id, source, group }); return group;
  };
  const b = SUPPORT_BEARINGS.front;
  for (let i = 1; i <= b.balls; i++) {
    const group = bind(`pg:support-bearing-front-ball-${i}`), r = b.ballRadius * 1.008;
    // A front meridian plus a small surface dot make spin observable without
    // changing the spherical contact shape. Depth-tested back segments hide.
    line(Array.from({ length: 65 }, (_, k) => {
      const a = Math.PI * k / 64; return [r * Math.cos(a), 0, r * Math.sin(a)];
    }), group);
    const geometry = new SphereGeometry(b.ballRadius * .065, 10, 8);
    const dot = new Mesh(geometry, dotInk); dot.position.set(r * .65, 0, r * Math.sqrt(1 - .65 ** 2));
    dot.raycast = () => {}; group.add(dot); resources.push(geometry);
  }
  const inner = bind('pg:support-bearing-front-inner');
  line([[b.bore + .0005, 0, b.width / 2 + .00002], [b.innerShoulder - .0005, 0, b.width / 2 + .00002]], inner);
  const cage = bind('pg:support-bearing-front-cage');
  line([[b.pitch - .00055, 0, b.ballRadius + .0007], [b.pitch + .00055, 0, b.ballRadius + .0007]], cage);
  return {
    update({ state, manualCamera }) {
      const weight = state.progress['bearing-roll'] ?? 0;
      ink.opacity = dotInk.opacity = .72 * weight;
      for (const { source, group } of bindings) {
        group.visible = !manualCamera && weight > 1e-5;
        if (!group.visible) continue;
        source.node.updateWorldMatrix(true, false);
        group.matrix.copy(source.node.matrixWorld);
        group.matrixWorldNeedsUpdate = true;
      }
    },
    dispose() {
      for (const { group } of bindings) group.removeFromParent();
      resources.forEach(geometry => geometry.dispose()); ink.dispose(); dotInk.dispose();
    },
  };
}
