'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const f=fs.readFileSync(path.join(root,'app.js'),'utf8');
const b=fs.readFileSync(path.join(root,'supabase/functions/kids-auth/index.ts'),'utf8');
const client=f.slice(f.indexOf('const cleanUsername ='),f.indexOf('const inviteLink ='));
const server=b.slice(b.indexOf('const usuarioValido ='),b.indexOf('async function lookupInvite'))
 .replace(/: unknown\b/g,'').replace(/: Record<string,unknown>/g,'');
assert(client.includes('function erroCadastroLocal'));
assert(server.includes('function erroCadastro'));
const A=vm.createContext({}),B=vm.createContext({});
vm.runInContext(client,A);vm.runInContext(server,B);
const baseline={usuario:'joaosilva',nome:'João da Silva',email:'joao@example.com',telefone:'(11) 98888-7777',senha:'Segura123!abc',codigo:'ABC-123'};
const map={usuario:'su',nome:'sn',email:'se',telefone:'sf',senha:'sp',codigo:'sc'};
const cases=[["válido",{},null],["usuário 3",{"usuario":"abc"},null],["usuário 26",{"usuario":"aaaaaaaaaaaaaaaaaaaaaaaaaa"},null],["usuário 2",{"usuario":"ab"},"usuario"],["usuário 27",{"usuario":"aaaaaaaaaaaaaaaaaaaaaaaaaaa"},"usuario"],["usuário número inicial",{"usuario":"1abc"},"usuario"],["usuário espaço",{"usuario":"ab cd"},"usuario"],["usuário acento",{"usuario":"joão"},"usuario"],["usuário emoji",{"usuario":"joao🙂"},"usuario"],["usuário ponto",{"usuario":"ana.maria"},null],["usuário underscore",{"usuario":"ana_maria-2"},null],["nome curto",{"nome":"Li"},"nome"],["nome mínimo",{"nome":"Ana"},null],["nome 120",{"nome":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"},null],["nome 121",{"nome":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"},"nome"],["nome acento",{"nome":"Érico Santos"},null],["nome emoji",{"nome":"Ana 🙂 Silva"},null],["email sem arroba",{"email":"nome.dominio.com"},"email"],["email sem TLD",{"email":"pessoa@example"},"email"],["email espaços",{"email":"pessoa @example.com"},"email"],["email 255",{"email":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa@example.com"},"email"],["telefone com DDD",{"telefone":"11988887777"},null],["telefone mais55",{"telefone":"+55 (11) 98888-7777"},null],["telefone dez",{"telefone":"1199999999"},null],["telefone nove",{"telefone":"119999999"},"telefone"],["telefone quinze",{"telefone":"123456789012345"},null],["telefone dezesseis",{"telefone":"1234567890123456"},"telefone"],["telefone plus no fim",{"telefone":"1199999999+"},"telefone"],["senha curta",{"senha":"Aa1!aaaaa"},"senha"],["senha 10",{"senha":"Aa1!aaaaaa"},null],["senha sem uppercase",{"senha":"abc12345!def"},"senha"],["senha sem lowercase",{"senha":"ABC12345!DEF"},"senha"],["senha sem numero",{"senha":"Abcdefgh!!"},"senha"],["senha sem símbolo",{"senha":"Abcdefgh123"},"senha"],["senha 128",{"senha":"Aa1!zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz"},null],["senha 129",{"senha":"Aa1!zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz"},"senha"],["código curto",{"codigo":"ABC-123"},null],["código sem hífen",{"codigo":"ABC123"},null],["código minúsculo",{"codigo":"abc-123"},null],["código inválido",{"codigo":"ABC-XYZ"},"codigo"],["código QR",{"codigo":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"},null],["código QR inválido",{"codigo":"zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz"},"codigo"]]
;
for(const [name,changes,expect] of cases){
 test('validação: '+name,()=>{
 const raw={...baseline,...changes};
 const input={usuario:String(raw.usuario).trim().toLowerCase(),
  nome:String(raw.nome).trim().replace(/\s+/g,' '),
  email:String(raw.email).trim().toLowerCase(),
  telefone:raw.telefone,senha:raw.senha,
  codigo:vm.runInContext('normalizeInvite('+JSON.stringify(raw.codigo)+')',A)};
 const a=vm.runInContext('erroCadastroLocal('+JSON.stringify(input)+')',A);
 const b=vm.runInContext('erroCadastro('+JSON.stringify(input)+')',B);
 assert.equal(a?.field||null,expect?map[expect]:null,'frontend');
 assert.equal(b?.field||null,expect,'backend');
 assert.equal(a?.message||null,b?.message||null,'mensagens');
 });
}
test('formulário preservado após erro',()=>{
 assert.match(f,/if\s*\(id==='signup'\s*&&\s*state\.auth==='signup'\s*&&\s*state\.inviteVerified\)/);
});
