export const SPEC = Object.freeze({kind:'two-spool-turbofan',bodyLengthMM:960,fanRadiusMM:218,coreRadiusMM:128,lowSpeedDegrees:36,highSpeedDegrees:66});
export const ROTORS = Object.freeze({fan:'low','low-shaft':'low','lp-compressor-1':'low','lp-compressor-2':'low','lp-turbine-1':'low','lp-turbine-2':'low','high-shaft':'high','hp-compressor-1':'high','hp-compressor-2':'high','hp-compressor-3':'high','hp-compressor-4':'high','hp-turbine':'high'});
export const TERMS = Object.freeze({fan:['风扇','连接低压轴；气流在这里分成核心通道与外侧旁通通道。'],'low-shaft':['低压轴','穿过高压轴中心，将风扇、低压压气机和低压涡轮连接。'],'high-shaft':['高压空心轴','连接高压压气机与高压涡轮；它可以与低压轴以不同速度转动。'],combustor:['燃烧室','固定的环形燃烧室，位于压气机之后、涡轮之前；本例不计算燃烧或温度。'],nozzle:['尾喷管','将核心气流导出；示意几何不计算推力、流量或效率。'],'bypass-duct':['旁通通道','风扇外侧气流绕过核心，沿外涵道向后流动。']});
export function createState(){return {lowAngle:0,highAngle:0,playing:false,selectedPart:'fan',view:{camera:'overview',explode:0,cutaway:true}};}
export function mechanical(state,patch){
  const next={...state,...patch,view:{...state.view}};
  for(const key of ['lowAngle','highAngle'])if(!Number.isFinite(next[key])||next[key]<0||next[key]>360)throw new TypeError('轴角度必须在0–360度。');
  if(typeof next.playing!=='boolean')throw new TypeError('播放状态无效。');
  if(state.view.explode>0){next.playing=false;next.lowAngle=state.lowAngle;next.highAngle=state.highAngle;}return next;
}
export function observe(state,patch){
  const view={...state.view,...patch};
  if(!Number.isFinite(view.explode)||view.explode<0||view.explode>1)throw new TypeError('展开进度无效。');
  if(typeof view.cutaway!=='boolean')throw new TypeError('剖面状态无效。');
  if(!['overview','side','front','core','free'].includes(view.camera))throw new TypeError('观察视角无效。');
  return {...state,view,playing:view.explode>0?false:state.playing};
}
export function advance(state,seconds){
  if(!Number.isFinite(seconds)||seconds<0)throw new TypeError('时间增量无效。');
  if(!state.playing||state.view.explode>0)return state;
  return mechanical(state,{lowAngle:(state.lowAngle+seconds*SPEC.lowSpeedDegrees)%360,highAngle:(state.highAngle+seconds*SPEC.highSpeedDegrees)%360});
}
export function poses(state){return Object.fromEntries(Object.entries(ROTORS).map(([id,spool])=>[id,{rotationX:state[spool==='low'?'lowAngle':'highAngle']*Math.PI/180}]));}
export function bodyToGLTF(vector){if(!Array.isArray(vector)||vector.length!==3||!vector.every(Number.isFinite))throw new TypeError('机体坐标必须有三个有限值。');return [vector[0]*.001,vector[2]*.001,-vector[1]*.001];}
export function derived(state){return {lowAngle:state.lowAngle,highAngle:state.highAngle,lowSpoolParts:Object.keys(ROTORS).filter(id=>ROTORS[id]==='low'),highSpoolParts:Object.keys(ROTORS).filter(id=>ROTORS[id]==='high'),mechanicalSource:'prescribed-kinematics',forceOrThermodynamicSolver:false};}
export function explain(id){if(TERMS[id])return TERMS[id];if(id?.startsWith('lp-compressor'))return ['低压压气机转子','由低压轴带动；相邻静子保持固定。'];if(id?.startsWith('hp-compressor'))return ['高压压气机转子','由高压轴带动，与风扇所在低压轴相互独立。'];if(id?.includes('stator'))return ['固定导向静子','导向叶片固定在机匣上，旋转轴改变时它保持静止。'];if(id?.startsWith('lp-turbine'))return ['低压涡轮','通过低压轴带动风扇与低压压气机。'];if(id==='hp-turbine')return ['高压涡轮','通过高压轴带动高压压气机。'];return ['机匣与支承','固定的结构与展示件；剖视和展开只改变观察状态。'];}
