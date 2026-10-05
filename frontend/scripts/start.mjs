import {cpSync,existsSync,mkdirSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const standalone=path.join(root,'.next/standalone');
if(!existsSync(path.join(standalone,'server.js')))throw new Error('Run npm run build first.');
mkdirSync(path.join(standalone,'.next'),{recursive:true});
cpSync(path.join(root,'.next/static'),path.join(standalone,'.next/static'),{recursive:true});
if(existsSync(path.join(root,'public')))cpSync(path.join(root,'public'),path.join(standalone,'public'),{recursive:true});
const envFile=path.join(root,'.env.local');
const child=spawn(process.execPath,[...(existsSync(envFile)?[`--env-file=${envFile}`]:[]),path.join(standalone,'server.js')],
  {cwd:root,stdio:'inherit',env:{...process.env,HOSTNAME:process.env.HOSTNAME||'127.0.0.1',PORT:process.env.PORT||'3000'}});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
child.on('exit',code=>process.exit(code??1));
