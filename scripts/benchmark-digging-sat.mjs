import {build} from 'esbuild';
import {execFileSync} from 'node:child_process';
import {relative} from 'node:path';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
import {cpus} from 'node:os';
import {Worker} from 'node:worker_threads';
const require=createRequire(import.meta.url);
const raw={name:'raw-runtime',setup(b){b.onResolve({filter:/\?raw$/},a=>({path:require.resolve(a.path.slice(0,-4)),namespace:'raw'}));b.onLoad({filter:/.*/,namespace:'raw'},a=>({contents:readFileSync(a.path,'utf8'),loader:'text'}));}};
const codes={};
const timeoutMs=Number(process.env.BENCH_TIMEOUT_MS??60000);
const results=[];
const record=result=>{results.push(result);console.log(JSON.stringify(result));if(process.env.BENCH_OUTPUT)writeFileSync(process.env.BENCH_OUTPUT,JSON.stringify({node:process.version,cpu:cpus()[0]?.model,baseline:'257a7e2',updated:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),timeoutMs,results},null,2));};
for(const version of ['before','after'])codes[version]=(await build({stdin:{contents:"export {digPuzzle} from './src/digging';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',write:false,plugins:version==='before'?[{name:'baseline',setup(b){b.onLoad({filter:/src[\\/].*\.ts$/},a=>({contents:execFileSync('git',['show','257a7e2:'+relative(process.cwd(),a.path).replaceAll('\\','/')],{encoding:'utf8'}),loader:'ts'}));}},raw]:[raw]})).outputFiles[0].text;
for(const mode of (process.env.BENCH_MODES?.split(',')??['sum','product']))for(const seed of (process.env.BENCH_SEEDS?.split(',').map(Number)??Array.from({length:10},(_,i)=>40+i)))for(const version of (process.env.BENCH_VERSIONS?.split(',')??(seed%2?['after','before']:['before','after'])))await new Promise(resolve=>{
 const worker=new Worker(codes[version]+`;{const {parentPort}=require('node:worker_threads');let seed=${seed};const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};const start=performance.now();const result=module.exports.digPuzzle('${mode}',undefined,random,undefined,'single',true);parentPort.postMessage({version:'${version}',mode:'${mode}',seed:${seed},ms:performance.now()-start,givens:result.dugClues.filter(x=>x!==null).length,clues:result.dugClues});}`,{eval:true});
 const timer=setTimeout(()=>{record({version,mode,seed,timeoutMs});worker.terminate()},timeoutMs);
 worker.on('message',m=>{clearTimeout(timer);record(m)});worker.on('error',e=>{record({version,mode,seed,error:String(e)});process.exitCode=1});worker.on('exit',()=>{clearTimeout(timer);resolve()});
});
