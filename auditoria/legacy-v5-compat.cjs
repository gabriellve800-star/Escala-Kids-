'use strict';
// Prova de rollback: função v5 original sobre esquema QA atualizado; nenhuma credencial impressa.
// Suporte: workflow qa-legacy-v5-compat.yml, NÃO aponta à produção.
const assert=require('node:assert/strict');
const {randomBytes}=require('node:crypto');
const {createClient}=require('@supabase/supabase-js');
const ref=process.env.QA_SUPABASE_PROJECT_REF;
assert.equal(ref,'eofoeijyfpptcktiqeah','Bloqueio: não é o projeto Teste escala');
const url='https://'+ref+'.supabase.co';
const secret=process.env.QA_SUPABASE_SECRET_KEY||'';
const pub=process.env.QA_SUPABASE_PUBLISHABLE_KEY||'';
assert(secret.startsWith('sb_secret_')&&pub.startsWith('sb_publishable_'));
const svc=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
const origin='https://gabriellve800-star.github.io';
const fn=url+'/functions/v1/kids-auth';
const tag=String(process.env.GITHUB_RUN_ID||Date.now()).slice(-8);
const prefix='zz_teste_'+tag;
const pass=()=> 'Aa9!'+randomBytes(22).toString('base64url');
const credentials=(suffix)=>({usuario:(prefix+'_'+suffix).slice(0,26),nome:'Teste Automatizado Legacy',
  telefone:'(11) 98888-7777',email:prefix+'_'+suffix+'@example.com',senha:pass()});
const checked=(data,error,where)=>{if(error)throw new Error(where+': '+(error.code||'unknown'));return data};
const run=(action,b={},token)=>{
 const headers={'Content-Type':'application/json',Origin:origin,apikey:pub};
 if(token)headers.Authorization='Bearer '+token;
 return fetch(fn,{method:'POST',headers,body:JSON.stringify({action,...b}),signal:AbortSignal.timeout(30000)})
  .then(async response=>{
    let body={};try{body=await response.json()}catch{}
    return {status:response.status,body};
  });
};
async function all(){
 let a=[];
 for(let page=1;page<=10;page++){
  const {data,error}=await svc.auth.admin.listUsers({page,perPage:100});
  checked(data,error,'lista Auth');a.push(...data.users);if(data.users.length<100)break;
 }
 return a;
}
async function cleanup(){
 // Identificar EXATAMENTE as contas deste run, mais seus convites. Nunca excluir pessoas reais.
 const users=(await all()).filter(u=>u.email?.startsWith(prefix+'_'));
 const ids=users.map(u=>u.id);
 if(ids.length){
  checked(null,(await svc.from('auditoria').delete().in('quem',ids)).error,'auditoria por quem');
  checked(null,(await svc.from('auditoria').delete().in('alvo',ids)).error,'auditoria por alvo');
  const admins=await svc.from('perfis').select('id').in('id',ids).eq('perfil','administrador');
  checked(admins.data,admins.error,'admin QA');
  const aid=(admins.data||[]).map(p=>p.id);
  if(aid.length) checked(null,(await svc.from('convites').delete().in('criado_por',aid)).error,'convites do QA');
  checked(null,(await svc.from('funcoes_pessoa').delete().in('pessoa_id',ids)).error,'funcoes QA');
  checked(null,(await svc.from('perfis').delete().in('id',ids)).error,'perfis QA');
  for(const u of users) checked(null,(await svc.auth.admin.deleteUser(u.id)).error,'deleteAuth');
 }
 checked(null,(await svc.rpc('qa_limpar_limites')).error,'limites QA');
 assert.equal((await all()).filter(u=>u.email?.startsWith(prefix+'_')).length,0,'Auth não zerou');
 for(const name of ['perfis','convites','auditoria','funcoes_pessoa']){
   const col=name==='funcoes_pessoa'?'pessoa_id':'id';
   const {error,count}=await svc.from(name).select(col,{count:'exact',head:true});
   checked(null,error,'residuos '+name);
   assert.equal(count,0,'QA resíduo '+name);
 }
 const {data:zero,error:ze}=await svc.rpc('qa_limpar_limites');
 checked(zero,ze,'limites QA zero');assert.equal(zero,0);
 console.log('V5_ROLLBACK_QA_CLEAN_ZERO Auth=0 perfis=0 convites=0 auditoria=0 funcoes=0 limites=0');
}
async function testLegacy(){
 const base=(await all()).length;
 assert.equal(base,0,'QA deve estar vazio, exceto testes próprios — abortar');
 const admin=credentials('admin');
 const {data:u,error:ae}=await svc.auth.admin.createUser({email:admin.email,password:admin.senha,email_confirm:true});
 checked(u,ae,'admin Auth');assert(u.user?.id);
 checked(null,(await svc.from('perfis').insert({id:u.user.id,usuario:admin.usuario,nome:admin.nome,
 perfil:'administrador',status:'ativo',primeiro_acesso:false,pode_aprovar:false})).error,'admin perfil');
 const loginClient=createClient(url,pub,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:auth,error:loginError}=await loginClient.auth.signInWithPassword({email:admin.email,password:admin.senha});
 checked(auth,loginError,'login admin QA');
 const jwt=auth.session?.access_token;assert(jwt);
 const inv=await run('invite',{dias:7,usos:1},jwt);
 assert.equal(inv.status,200,'emissão v5 de convite');
 assert.match(inv.body.codigo,/^[a-f0-9]{64}$/);
 assert.match(inv.body.codigo_curto,/^[A-Z]{3}-\d{3}$/);
 assert.equal((await run('check_invite',{codigo:inv.body.codigo})).status,200,'QR v5');
 assert.equal((await run('check_invite',{codigo:inv.body.codigo_curto})).status,200,'curto v5');
 const person=credentials('aprovado');
 const reg=await run('register',{...person,codigo:inv.body.codigo});
 assert.equal(reg.status,201,'cadastro v5 falhou HTTP '+reg.status);
 assert.equal(reg.body.status,'pendente');
 const {data:profile,error:pe}=await svc.from('perfis').select('id,status').eq('usuario',person.usuario).single();
 checked(profile,pe,'perfil pendente v5');assert.equal(profile.status,'pendente');
 const {data:uses,error:ue}=await svc.from('convites').select('usos').eq('id',inv.body.id).single();
 checked(uses,ue,'convite consumo v5');assert.equal(uses.usos,1);
 const {data:audit,error:audErr}=await svc.from('auditoria').select('id').eq('alvo',profile.id).eq('acao','cadastro_pendente');
 checked(audit,audErr,'auditoria v5');assert.equal(audit.length,1);
 const approved=await run('review',{id:profile.id,aprovar:true,perfil:'voluntario',funcoes:['professor'],pode_aprovar:false},jwt);
 assert.equal(approved.status,200,'aprovação v5 HTTP '+approved.status);
 const {data:active,error:actErr}=await svc.from('perfis').select('status,perfil').eq('id',profile.id).single();
 checked(active,actErr,'perfil ativo v5');assert.equal(active.status,'ativo');
 const logged=await run('login',{usuario:person.usuario,senha:person.senha});
 assert.equal(logged.status,200,'login v5 HTTP '+logged.status);
 assert(logged.body.access_token&&logged.body.refresh_token);
 const {data:allPeople,error:readErr}=await createClient(url,pub,
   {global:{headers:{Authorization:'Bearer '+logged.body.access_token}},
    auth:{persistSession:false,autoRefreshToken:false}})
   .from('perfis').select('usuario');
 checked(allPeople,readErr,'RLS v5');assert.equal(allPeople.length,1);assert.equal(allPeople[0].usuario,person.usuario);
 console.log('V5_ROLLBACK_QA_PASS invite QR+codigo; register 201 pendente; audit; review; login 200; RLS');
}
(async()=>{
 let failed=false;
 if(process.argv[2]==='cleanup'){
  try{await cleanup()}catch(e){console.error('QA_LEGACY_CLEANUP_FAIL '+String(e.message));process.exitCode=1}
  return;
 }
 try{await testLegacy()}
 catch(e){failed=true;console.error('QA_LEGACY_V5_FAIL '+String(e.message).replace(/zz_teste_[a-z0-9_]+/gi,'[qa_user]'))}
 finally{try{await cleanup()}catch(e){failed=true;console.error('QA_LEGACY_CLEAN_FAIL '+String(e.message))}}
 if(failed)process.exitCode=1;
})();
