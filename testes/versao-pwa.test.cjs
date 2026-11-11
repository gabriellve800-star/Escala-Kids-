'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const worker=fs.readFileSync(path.join(root,'sw.js'),'utf8');
const cfg=fs.readFileSync(path.join(root,'config.js'),'utf8');
test('versão candidata é 1.2.3 no título, app e URL cacheada',()=>{
 assert.match(html,/<title>Escala Kids · v1\.2\.3<\/title>/);
 assert.match(html,/app\.js\?v=1\.2\.3/);
 assert.match(worker,/app\.js\?v=1\.2\.3/);
 assert.match(app,/data-app-version[^\n]+v1\.2\.3/);
 assert.doesNotMatch(worker,/validation-fix-122|1\.2\.2/);
});
test('cache da versão 1.2.3 elimina outros caches Escala Kids na ativação',()=>{
 assert.match(worker,/escala-kids-v1\.2\.3/);
 assert.match(worker,/keys\.filter\(key => key\.startsWith\('escala-kids-'\) && key !== CACHE\)/);
});
test('chave pública do site aponta apenas para projeto da produção; nenhuma chave de QA ou privilegiada',()=>{
 assert.match(cfg,/pntzfuxwkjreugxzovjj\.supabase\.co/);
 assert.doesNotMatch(cfg,/eofoeijyfpptcktiqeah|sb_secret_|service_role/i);
});
