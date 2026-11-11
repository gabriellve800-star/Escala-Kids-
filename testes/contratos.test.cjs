'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const b=fs.readFileSync(path.join(root,'supabase/functions/kids-auth/index.ts'),'utf8');
const f=fs.readFileSync(path.join(root,'app.js'),'utf8');
const cfg=fs.readFileSync(path.join(root,'config.js'),'utf8');
test('não há chave privilegiada no cliente',()=>{
 assert.doesNotMatch(cfg,/sb_secret_|SUPABASE_SERVICE_ROLE_KEY|service_role\s*:/);
 assert.doesNotMatch(f,/sb_secret_|SUPABASE_SERVICE_ROLE_KEY|service_role\s*:/);
});
test('convites, aprovações e gerência exigem permissão',()=>{
 assert.match(b,/case 'invite':\s*\{\s*const p = await actor\(req\); assertManager\(p\)/);
 assert.match(b,/case 'review':\s*\{\s*const p = await actor\(req\); assertManager\(p\)/);
 assert.match(b,/case 'manage':\s*\{\s*const p = await actor\(req\); assertAdmin\(p\)/);
});
test('apagar conta Auth em falha verifica erro do rollback',()=>{
 assert.match(b,/deleteUser\(created\.user\.id\)/);
 assert.match(b,/rollbackError|deleteError|cleanupError/,
   'FALHOU: código não verifica se deleteUser funcionou');
});
test('erros SQL livres não são copiados para logs',()=>{
 assert.doesNotMatch(b,/console\.(?:warn|error|log)\([^;]*message:\s*untrustedError\(e\)/,
    'FALHOU: erro SQL bruto pode carregar dados pessoais');
});
test('conta pendente não pode agir como gestor',()=>{
 assert.match(b,/pessoa\.status !== 'ativo'/);
 assert.match(f,/state\.profile\?\.status === 'ativo' && !state\.profile\.primeiro_acesso/);
});
