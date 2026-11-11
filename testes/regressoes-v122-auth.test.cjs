'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..');
const legacy=fs.readFileSync(path.join(root,'auditoria/rollback/kids-auth-v5-index.ts'),'utf8');
const modern=fs.readFileSync(path.join(root,'supabase/functions/kids-auth/index.ts'),'utf8');
const modernFrontend=fs.readFileSync(path.join(root,'app.js'),'utf8');
const legacyEmail=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const validatorSource=modernFrontend.match(/const emailValido = \(email\) => \{[\s\S]*?\n\};/);
assert(validatorSource,'validador novo ausente do app');
const emailValido=vm.runInNewContext(
  validatorSource[0].replace(/^const emailValido = /,'').replace(/;\s*$/,'')
);
test('RED v1.2.2: e-mail com emoji passava; GREEN QA: rejeitado',()=>{
 assert.match(legacy,/email\.length>254 \|\| !\/\^\[\^\\s@\]/);
 assert.equal(legacyEmail.test('ana@🙂.com'),true,'a regex antiga aceitava o emoji');
 assert.equal(emailValido('ana@🙂.com'),false,'nova regra deve bloquear emoji');
});
test('RED v1.2.2: local part >64 e pontos consecutivos; GREEN QA rejeita',()=>{
 for(const email of ['a'.repeat(65)+'@example.com','ana..teste@example.com']){
  assert.equal(legacyEmail.test(email),true,'regex antiga passa: '+email.length);
  assert.equal(emailValido(email),false,'regex nova rejeita: '+email.length);
 }
});
test('HTTP 400 original NÃO foi atribuído às correções: erro de convite continua 400',()=>{
 assert.match(legacy,/if \(!codigo\) return err\('Código inválido[^']+',400\)/);
 assert.match(modern,/if \(!codigo\) return err\('Código inválido[^']+',400\)/);
 assert.match(legacy,/if \(!valid\) return err\('Código inválido, expirado ou já utilizado\.',400\)/);
 assert.match(modern,/if \(!valid\) return err\('Código inválido, expirado ou já utilizado\.',400\)/);
});
test('v1.2.2 culpava e-mail em qualquer createUser; QA usa mapper separado',()=>{
 assert.match(legacy,/Não foi possível criar o acesso\. Verifique se já existe conta com este e-mail\./);
 assert.match(modern,/mapCreateUserError\(ae\)/);
});
test('createUser: email_exists mapeia 409 e aponta e-mail',async()=>{
 const {mapCreateUserError}=await import(pathToFileURL(path.join(root,'supabase/functions/kids-auth/auth-errors.mjs')).href);
 const r=mapCreateUserError({code:'email_exists',status:422});
 assert.equal(r.status,409);
 assert.equal(r.field,'email');
 assert.match(r.message,/já está cadastrado/i);
});
test('createUser: senha fraca mapeia 422 e NÃO culpa e-mail',async()=>{
 const {mapCreateUserError}=await import(pathToFileURL(path.join(root,'supabase/functions/kids-auth/auth-errors.mjs')).href);
 for(const code of ['weak_password','password_too_short']){
  const r=mapCreateUserError({code,status:422});
  assert.equal(r.status,422);assert.equal(r.field,'senha');
  assert.match(r.message,/senha/i);
  assert.doesNotMatch(r.message,/e-mail/i);
 }
});
test('createUser: erro inesperado e rate-limit não culpam e-mail',async()=>{
 const {mapCreateUserError}=await import(pathToFileURL(path.join(root,'supabase/functions/kids-auth/auth-errors.mjs')).href);
 const unexpected=mapCreateUserError({code:'unexpected_failure',status:500});
 assert.equal(unexpected.status,503);assert.equal(unexpected.field,null);
 assert.doesNotMatch(unexpected.message,/e-mail/i);
 const limited=mapCreateUserError({code:'over_request_rate_limit',status:429});
 assert.equal(limited.status,429);assert.equal(limited.field,null);
 assert.doesNotMatch(limited.message,/e-mail/i);
});
test('createUser: e-mail inválido não é descrito como duplicado',async()=>{
 const {mapCreateUserError}=await import(pathToFileURL(path.join(root,'supabase/functions/kids-auth/auth-errors.mjs')).href);
 for(const code of ['email_address_invalid','email_address_not_authorized']){
  const r=mapCreateUserError({code,status:422});
  assert.equal(r.field,'email');assert.equal(r.status,422);
  assert.doesNotMatch(r.message,/já cadastrado/i);
 }
});
