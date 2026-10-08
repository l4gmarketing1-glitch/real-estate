import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {setTimeout} from 'node:timers/promises';
import {createIntegration} from '../src/higgsfield.js';

// Usage: node video-tour/generate.js <assets-directory> <output-directory> [scene-id]
// Resume by retaining output-directory/requests.json; never rerun a paid submit blindly.
const [assetsArg,outputArg,selected] = process.argv.slice(2);
if(!assetsArg || !outputArg) throw Error('Provide assets and output directories');
const plan=JSON.parse(await readFile(new URL('./scenes.json',import.meta.url),'utf8'));
const scenes=selected ? plan.scenes.filter(s=>s.id===selected) : plan.scenes;
if(!scenes.length)throw Error('Unknown scene ID');
const assets=resolve(assetsArg), out=resolve(outputArg);
await mkdir(out,{recursive:true});
const readJson=async file=>{try{return JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code==='ENOENT')return {};throw e;}};
const requests=await readJson(`${out}/requests.json`);
const results=await readJson(`${out}/results.json`);
const api=await createIntegration();
for(const scene of scenes) {
  if(results[scene.id])continue;
  if(!requests[scene.id]) {
    const bytes=await readFile(resolve(assets,scene.file));
    const image_url=await api.upload(bytes,'image/jpeg');
    const response=await api.submit({model:plan.model,input:{...plan.parameters,image_url,prompt:scene.prompt}});
    if(!response.request_id)throw Error('No request ID returned; inspect account before submitting again');
    requests[scene.id]=response.request_id;
    await writeFile(`${out}/requests.json`,JSON.stringify(requests,null,2));
    console.log(`${scene.id}: submitted ${response.request_id}`);
  }
  const deadline=Date.now()+15*60*1000;
  let result;
  do {
    result=await api.status(requests[scene.id]);
    if(!['queued','in_progress'].includes(result.status))break;
    if(Date.now()>deadline)throw Error(`${scene.id}: still processing. Resume with saved requests.json`);
    await setTimeout(5000);
  } while(true);
  if(result.status!=='completed'||!result.video?.url)throw Error(`${scene.id}: ${result.status}`);
  const download=await fetch(result.video.url,{signal:AbortSignal.timeout(120000)});
  if(!download.ok)throw Error(`${scene.id}: download failed`);
  await writeFile(`${out}/${scene.id}.mp4`,Buffer.from(await download.arrayBuffer()));
  results[scene.id]={request_id:requests[scene.id],file:`${scene.id}.mp4`};
  await writeFile(`${out}/results.json`,JSON.stringify(results,null,2));
  console.log(`${scene.id}: downloaded; review before publication`);
}
