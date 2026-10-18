import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const packageJson=JSON.parse(readFileSync('package.json','utf8'));
const lock=JSON.parse(readFileSync('package-lock.json','utf8'));
let output='ABYSSAL TRACE — THIRD PARTY NOTICES\n\nOriginal provisional SVG and procedural evidence art, dialogue, and code created with OpenAI Codex for this project. No runtime AI.\n\n';
for(const [path,entry] of Object.entries(lock.packages)) {
  if(!path||!existsSync(path))continue;
  const info=JSON.parse(readFileSync(join(path,'package.json'),'utf8'));
  output+=`\n${'='.repeat(70)}\n${info.name} ${info.version}\nDeclared license: ${info.license??entry.license??'See package notice'}\n`;
  for(const file of readdirSync(path).filter(f=>/^(licen[cs]e|copying|ofl|notice)(\.|$)/i.test(f))) {
    try{output+=`\n${file}\n${readFileSync(join(path,file),'utf8')}\n`;}catch{}
  }
}
writeFileSync('public/THIRD_PARTY_NOTICES.txt',output);
for(const group of ['dependencies','devDependencies'])for(const name of Object.keys(packageJson[group]))packageJson[group][name]=JSON.parse(readFileSync(join('node_modules',name,'package.json'),'utf8')).version;
writeFileSync('package.json',JSON.stringify(packageJson,null,2)+'\n');
// Keep lock root dependency declarations consistent after pinning installed versions.
lock.packages[''].dependencies=packageJson.dependencies;lock.packages[''].devDependencies=packageJson.devDependencies;
writeFileSync('package-lock.json',JSON.stringify(lock,null,2)+'\n');
console.log('Bundled dependency notices and pinned installed versions.');
