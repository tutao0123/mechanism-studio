export const CAMERA_REVISION = 'gearbox-cinema-camera-1';
// Authored in metres, +Y up. Fixed poses, never fitted to a moving envelope.
const KEYS = [
  [0, [-.58,.28,.95], [.015,.02,0],34],
  [2, [-.43,.25,.85], [.02,.02,0],34],
  [5, [-.25,.28,.82], [.02,.025,0],35],
  [6.6, [-.32,.32,.93], [.025,.015,0],36],
  [8, [-.32,.20,.80], [.03,-.025,0],32],
  [10, [-.30,.12,.68], [.01,-.02,0],32],
  [12.1666666667, [-.15,.15,.56], [-.05,0,0],31],
  [13.35, [-.16,.105,.43], [-.055,.01,0],34],
  [14.65, [-.12,.08,.42], [-.055,.01,0],33],
  [15.75, [-.115,.08,.42], [-.055,.01,0],33],
  [17.1666666667, [-.22,.17,.68], [.025,-.02,0],34],
  [19, [-.38,.20,.80], [.03,-.02,0],32],
  [21.125, [-.45,.27,.91], [.02,.02,0],34],
  [22.6, [-.60,.30,1.02], [.02,.02,0],34],
  [24, [-.58,.28,.95], [.015,.02,0],34],
];
const values = KEYS.map(([t,p,target,fov]) => [t,...p,...target,fov]);
function tangent(i,j){
  if(i===0||i===values.length-1)return 0;
  return (values[i+1][j]-values[i-1][j])/(values[i+1][0]-values[i-1][0]);
}
export function cameraAt(time){
  if(!Number.isFinite(time)||time<0||time>24)throw new RangeError('Camera time must be within 0–24 seconds.');
  const i=Math.min(values.length-2,Math.max(0,values.findLastIndex(k=>k[0]<=time)));
  const a=values[i],b=values[i+1],dt=b[0]-a[0],u=(time-a[0])/dt;
  const h00=2*u**3-3*u*u+1,h10=u**3-2*u*u+u,h01=-2*u**3+3*u*u,h11=u**3-u*u;
  const result=Array.from({length:7},(_,n)=>{const j=n+1;return h00*a[j]+h10*dt*tangent(i,j)+h01*b[j]+h11*dt*tangent(i+1,j);});
  return {position:result.slice(0,3),target:result.slice(3,6),fov:result[6]};
}
