const $=id=>document.getElementById(id);
let config,api,cancelled=false;
const json=async response=>{const result=await response.json();if(!response.ok)throw new Error(result.error||`HTTP ${response.status}`);return result;};
const post=(path,body,contentType='application/json')=>fetch(`/__studio/${path}`,{method:'POST',headers:{'Content-Type':contentType,'X-Studio-Session':config.nonce},body}).then(json);
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function prepare(){
  config=await fetch('/__studio/config').then(json);
  const {film}=config;
  $('title').textContent=config.title;
  $('spec').textContent=`${film.duration} seconds · ${film.width} × ${film.height} · ${film.fps} fps · Original code music`;
  $('destination').textContent=config.outputDirectory; $('progress').max=film.frameCount;
  $('engine').src=film.renderPath;
  const deadline=performance.now()+60000;
  while(!$('engine').contentWindow?.[film.apiName]){if(performance.now()>deadline)throw new Error('Renderer did not initialize. Check the terminal and source preview.');await pause(100);}
  api=$('engine').contentWindow[film.apiName]; await api.ready; await api.start();
  $('opening').src=await api.frame(0); $('expanded').src=await api.frame(film.reviewTime); api.stop();
  await Promise.all([$('opening').decode(),$('expanded').decode()]);
  $('approved').disabled=false; $('status').textContent='Ready. Review both calibration frames, then confirm to generate.';
}
$('approved').onchange=()=>{$('generate').disabled=!$('approved').checked;};
$('cancel').onclick=()=>{cancelled=true;$('cancel').disabled=true;$('status').textContent='Finishing the current frame, then cancelling…';};
$('generate').onclick=async()=>{
  $('generate').disabled=true;$('approved').disabled=true;$('cancel').disabled=false;
  try{
    const {film}=config;await api.start();
    await post('start',JSON.stringify({reviewedCalibration:$('approved').checked,capture:api.snapshot()}));
    for(let i=0;i<film.frameCount;i++){
      if(cancelled){await post('cancel','{}');api.stop();$('status').textContent='Cancelled. Partial files are preserved. Start a new export command to retry.';return;}
      const url=await api.frame(i/film.fps);
      if(!url.startsWith('data:image/jpeg;base64,'))throw new Error('Renderer returned an unsupported frame.');
      const bytes=Uint8Array.from(atob(url.slice(url.indexOf(',')+1)),character=>character.charCodeAt(0));
      await post(`frame/${i}`,bytes,'image/jpeg');$('progress').value=i+1;
      if(i%15===0)$('status').textContent=`Composing ${i+1} / ${film.frameCount} frames. The timeline is sampled at fixed times.`;
    }
    api.stop();$('cancel').disabled=true;
    await post('finish','{}');
    for(;;){
      const state=await fetch('/__studio/status').then(json);
      const names={'checking-source':'Checking every source frame…',encoding:'Encoding MP4 and verifying audio…','checking-encoded':'Checking every decoded delivery frame…'};
      $('status').textContent=names[state.stage]||state.stage;
      if(state.stage==='failed')throw new Error(state.error);
      if(state.stage==='complete'){
        $('status').textContent=`Automatic checks passed. ${state.delivery.frames} frames · ${state.delivery.duration} seconds. Full playback and listening review are still required.`;
        $('video').src='/__studio/film.mp4';$('result').hidden=false;break;
      }
      await pause(1000);
    }
  }catch(error){try{api?.stop();}catch{}$('status').textContent=`Export stopped: ${error.message}\nFiles are preserved; start a new export command after resolving the problem.`;$('cancel').disabled=true;}
};
prepare().catch(error=>{$('status').textContent=`Cannot prepare export: ${error.message}`;});
