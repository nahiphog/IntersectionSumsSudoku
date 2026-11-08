// node scripts/benchmark-uniqueness.mjs [baseline commit]
import {build} from 'esbuild';
import {execFileSync} from 'node:child_process';
import {relative} from 'node:path';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const require=createRequire(import.meta.url);
const rawPlugin={name:'raw-runtime',setup(b){b.onResolve({filter:/\?raw$/},args=>({path:require.resolve(args.path.slice(0,-4)),namespace:'raw'}));b.onLoad({filter:/.*/,namespace:'raw'},args=>({contents:readFileSync(args.path,'utf8'),loader:'text'}));}};
import {Worker} from 'node:worker_threads';
const clues='0,0,0,0,0,0,17,0,0,0,0,16,0,0,19,0,0,0,0,19,0,16,0,11,0,0,0,0,0,0,0,0,0,0,0,0,0,0,24,30,0,0,0,0,0,0,18,0,27,0,0,0,0,0,0,20,0,0,0,0,15,0,0,0,0,14,0,0,0,17,0,18,0,0,0,0,0,0,0,0,0'.split(',').map(n=>+n||null);
for (const version of (process.env.BENCH_VERSIONS?.split(',') ?? ['before','after'])) {
  const code=(await build({stdin:{contents:version==='before'?"export {verifyClues as verify} from './src/lab';":"export {verifyWithSat as verify} from './src/satVerifier';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',write:false,
    plugins:version==='before'?[{name:'baseline',setup(b){b.onLoad({filter:/src[\\/].*\.ts$/},args=>({contents:execFileSync('git',['show',(process.argv[2]??'2aed0aa')+':'+relative(process.cwd(),args.path).replaceAll('\\','/')],{encoding:'utf8'}),loader:'ts'}));}}]:[rawPlugin]
  })).outputFiles[0].text;
  await new Promise(resolve=>{
    const worker=new Worker(code+`;{const {parentPort}=require('node:worker_threads');const start=performance.now();const result=module.exports.verify(${JSON.stringify(clues)},'sum',()=>parentPort.postMessage({version:'${version}',firstSolutionMs:performance.now()-start}));parentPort.postMessage({version:'${version}',totalMs:performance.now()-start,count:result.count,solutions:result.solutions});}`,{eval:true});
    const timeoutMs=version==='before'?60000:120000;
    const timer=setTimeout(()=>{console.log(JSON.stringify({version,timeoutMs}));worker.terminate();},timeoutMs);
    worker.on('message',m=>console.log(JSON.stringify(m)));
    worker.on('error',e=>{console.error(e);process.exitCode=1;});
    worker.on('exit',()=>{clearTimeout(timer);resolve();});
  });
}
