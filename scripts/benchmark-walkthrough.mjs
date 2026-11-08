// Run with node scripts/benchmark-walkthrough.mjs [baseline commit].
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { relative } from 'node:path';
import { Worker } from 'node:worker_threads';
const baseline = process.argv[2] ?? '79a3450';
const entries = "export {solveWalkthrough} from './src/walkthroughSolver'; export {verifyClues} from './src/lab'; export {generatePuzzle} from './src/puzzle';";
async function bundle(old) {
  return (await build({ stdin: { contents: entries, resolveDir: process.cwd() }, bundle:true,platform:'node',format:'cjs',write:false,
    plugins: old ? [{name:'baseline',setup(b){b.onLoad({filter:/src[\\/].*\.ts$/},args=>({contents:execFileSync('git',['show',baseline+':'+relative(process.cwd(),args.path).replaceAll('\\','/')],{encoding:'utf8'}),loader:'ts'}));}}] : [] })).outputFiles[0].text;
}
const versions = { before: await bundle(true), after: await bundle(false) };
const clues = '0,0,0,0,0,0,17,0,0,0,0,16,0,0,19,0,0,0,0,19,0,16,0,11,0,0,0,0,0,0,0,0,0,0,0,0,0,0,24,30,0,0,0,0,0,0,18,0,27,0,0,0,0,0,0,20,0,0,0,0,15,0,0,0,0,14,0,0,0,17,0,18,0,0,0,0,0,0,0,0,0'.split(',').map(n=>+n||null);
const solution = Array.from('432169875687523194591847362254631987378492651169758243713984526946215738825376419',Number);
for (const task of (process.env.BENCH_TASKS?.split(',') ?? ['full-sum','full-product','verify-sum','verify-product','sparse-shared','sparse-verify'])) for (const [version, code] of Object.entries(versions)) {
  await new Promise(resolve=>{
    const source=code+`;const {parentPort}=require('node:worker_threads');let seed=42;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};const api=module.exports;const mode='${task}'.endsWith('product')?'product':'sum';const puzzle=api.generatePuzzle(random,mode);const clues='${task}'.startsWith('sparse')?${JSON.stringify(clues)}:puzzle.clues;const start=performance.now();let first=null,logicalEnd=null;const options={completion:'${task}'==='sparse-shared'&&'${version}'==='after'?${JSON.stringify(solution)}:undefined,onStep:()=>{first??=performance.now()-start},onProgress:(n,m)=>{if(n)first??=performance.now()-start;if(m.startsWith('Logical techniques stalled'))logicalEnd??=performance.now()-start}};const result='${task}'.includes('verify')?api.verifyClues(clues,mode):api.solveWalkthrough(clues,mode,options);parentPort.postMessage({version:'${version}',task:'${task}',ms:performance.now()-start,first,logicalEnd,status:result.status??result.count,steps:result.steps?.length,search:result.searchSteps,heapMB:process.memoryUsage().heapUsed/1048576});`;
    const worker=new Worker(source,{eval:true});
    const timer=setTimeout(()=>{console.log(JSON.stringify({version,task,timeoutMs:10000}));worker.terminate();},10000);
    worker.on('message',m=>console.log(JSON.stringify(m)));
    worker.on('error',e=>{console.error(e);process.exitCode=1});
    worker.on('exit',()=>{clearTimeout(timer);resolve()});
  });
}
