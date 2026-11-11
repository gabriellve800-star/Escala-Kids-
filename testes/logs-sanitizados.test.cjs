'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'../supabase/functions/kids-auth/index.ts'),'utf8');
test('todos os eventos de erro possuem request_id, etapa, campo e código sanitizados',()=>{
 const captures=[...src.matchAll(/console\.(?:warn|error)\(([\s\S]*?)\);/g)].map(m=>m[1]);
 assert.equal(captures.length,5,'Quantidade de pontos de log deve ser auditada');
 for(const entry of captures){
  for(const field of ['request_id','stage','field','code']){
   assert.match(entry,new RegExp('\\b'+field+'\\b'),'log sem '+field);
  }
  assert.doesNotMatch(entry,/\b(?:senha|telefone|email|nome|codigo|token|password|user_metadata)\s*:/i,
   'não registrar campos reais de formulário');
  assert.doesNotMatch(entry,/untrustedError\(|JSON\.stringify\(b\)|console\.[a-z]+\(\s*b\b/,
   'não registrar erro bruto ou corpo da requisição');
 }
});
test('código de erro externo tem caracteres e tamanho limitados antes do log',()=>{
 assert.match(src,/const safeErrorCode = .*replace\(\/\[\^a-z0-9_\]\/gi,''\)\.slice\(0,48\)/);
 assert.match(src,/code:safeErrorCode\(rollbackError\?\.code/);
});
test('createUser usa campo do mapeamento, não o nome/email do cadastro',()=>{
 assert.match(src,/const mapped = mapCreateUserError\(ae\)/);
 assert.match(src,/stage:'createUser',field:mapped\.field\|\|'geral',code/);
});
