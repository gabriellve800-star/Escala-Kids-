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

test('erros do cadastro geram ID de correlação sem dados pessoais',()=>{
 assert.match(b,/const requestId = crypto\.randomUUID\(\)/);
 assert.match(b,/request_id:requestId/);
 assert.match(b,/stage:'finalizar_cadastro'/);
 assert.doesNotMatch(b,/message:\s*untrustedError\(e\)/);
});
test('a interface foca o campo apontado pelo servidor sem apagar formulário',()=>{
 assert.match(f,/serverField=\['usuario','nome','email','telefone','senha','codigo'\]/);
 assert.match(f,/form\.querySelector\('\[name="'\+campos\[e\.field\]\+'"\]'\)\?\.focus\(\)/);
});
