'use strict';
// Exclusivo do projeto Supabase QA. Nenhum valor de senha, token ou convite é impresso.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { createClient } = require('@supabase/supabase-js');
const path = require('node:path');
const mode=process.argv[2];
const filepath=path.resolve(process.cwd(),'.qa-state.json');
const production='pntzfuxwkjreugxzovjj';
const ref=process.env.QA_SUPABASE_PROJECT_REF || '';
const url='https://'+ref+'.supabase.co';
const publicKey=process.env.QA_SUPABASE_PUBLISHABLE_KEY||'';
const secretKey=process.env.QA_SUPABASE_SECRET_KEY||'';
const origin='http://localhost:4173';
const tag=(String(process.env.GITHUB_RUN_ID||Date.now()).slice(-8)+String(process.env.GITHUB_RUN_ATTEMPT||'1')).replace(/\D/g,'');
const prefix='zz_teste_'+tag;
const endpoint=url+'/functions/v1/kids-auth';
assert(/^[a-z0-9]{20}$/.test(ref),'QA: referência inválida');
assert.notEqual(ref,production,'PROIBIDO executar no Supabase de PRODUÇÃO');
assert(publicKey.startsWith('sb_publishable_'),'QA: chave publicável deve ser do projeto de TESTE');
assert(secretKey.startsWith('sb_secret_'),'QA: chave secreta deve ser do projeto de TESTE');
const svc=createClient(url,secretKey,{auth:{autoRefreshToken:false,persistSession:false}});
function client(){return createClient(url,publicKey,{auth:{autoRefreshToken:false,persistSession:false}})}
function randomPass(){return 'Aa9!'+crypto.randomBytes(24).toString('base64url')}
function save(s){fs.writeFileSync(filepath,JSON.stringify(s),{encoding:'utf8',mode:0o600});}
function load(){return JSON.parse(fs.readFileSync(filepath,'utf8'))}
function check(data,error,where){if(error)throw new Error(where+': '+(error.code||'erro'));return data}
function record(msg){console.log('QA PASS: '+msg)}
function next(s,postfix){
 s.counter=(s.counter||0)+1;save(s);
 const key=postfix||String(s.counter);
 const u=prefix+'_'+key;
 assert(u.length<=26,'nome de usuário sintético maior que 26');
 return {usuario:u,nome:'Pessoa Teste Automatizado',telefone:'(11) 98888-7777',
 email:prefix+'_'+key+'@example.com',senha:randomPass()};
}
async function call(action,data={},auth=null,options={}){
 const headers={'Content-Type':'application/json','Origin':options.origin||origin,'apikey':publicKey};
 if(auth)headers.Authorization='Bearer '+auth;
 const response=await fetch(endpoint,{method:options.method||'POST',headers,
  body:options.malformed || JSON.stringify({action,...data}),signal:AbortSignal.timeout(25000)});
 let body={};try{body=await response.json()}catch{}
 return {status:response.status,body};
}
async function invite(s,uses=1){
 const {status,body}=await call('invite',{dias:7,usos:uses},s.admin.token);
 assert.equal(status,200,'emitir convite '+status+' '+String(body.error||''));
 assert.match(body.codigo,/^[a-f0-9]{64}$/);
 assert.match(body.codigo_curto,/^[A-Z]{3}-\d{3}$/);
 return body;
}
async function register(s,inv,persona,expected=201){
 const r=await call('register',{...persona,codigo:inv});
 assert.equal(r.status,expected,'registro: HTTP '+r.status+' campo='+String(r.body.field||'n/a'));
 if(expected===201){assert.equal(r.body.ok,true);assert.equal(r.body.status,'pendente')}
 return r;
}
async function allAuth(){
 const all=[];
 for(let page=1;page<=20;page++){
   const {data,error}=await svc.auth.admin.listUsers({page,perPage:100});
   check(data,error,'listar Auth');
   all.push(...data.users);
   if(data.users.length<100)break;
 }
 return all;
}
async function testUser(s,persona){
 const {data,error}=await svc.from('perfis').select('*').eq('usuario',persona.usuario).single();
 check(data,error,'localizar perfil');
 return data;
}
async function userClient(persona){
 const c=client();
 const {data,error}=await c.auth.signInWithPassword({email:persona.email,password:persona.senha});
 check(data,error,'login usuario sintético');
 assert(data.session?.access_token);
 return {c,token:data.session.access_token};
}
async function security(persona,statusExpected){
 const {c,token}=await userClient(persona);
 const {data:own,error:readError}=await c.from('perfis').select('id,usuario,status,perfil');
 check(own,readError,'RLS leitura');
 assert.equal(own.length,1,'usuário deve visualizar somente próprio perfil');
 assert.equal(own[0].usuario,persona.usuario);
 assert.equal(own[0].status,statusExpected);
 const id=own[0].id;
 for(const table of ['convites','auditoria','funcoes_pessoa']){
   const {data,error}=await c.from(table).select('*');
   check(data,error,'RLS '+table);
   assert.equal(data.length,0,'vazamento em '+table);
 }
 const upd=await c.from('perfis').update({status:'ativo',perfil:'administrador',pode_aprovar:true}).eq('id',id).select();
 assert(upd.error || !upd.data?.length,'UPDATE indevido deve ser negado');
 const ins=await c.from('perfis').insert({
  id:crypto.randomUUID(),usuario:'invasor_qa',nome:'Não permitido',
  telefone:'+5511999999999',status:'ativo',perfil:'administrador'}).select();
 assert(ins.error || !ins.data?.length,'INSERT indevido deve ser negado');
 for(const [action,payload] of [
  ['invite',{dias:7,usos:1}],
  ['review',{id,aprovar:true,perfil:'administrador',funcoes:[]}],
  ['manage',{id,perfil:'administrador',status:'ativo',funcoes:[]}],
 ]){
  const r=await call(action,payload,token);
  assert.equal(r.status,403,'Edge '+action+' por '+statusExpected);
 }
 const {data:after,error:e}=await svc.from('perfis').select('status,perfil,pode_aprovar').eq('id',id).single();
 check(after,e,'verificar ausência mutação');
 assert.equal(after.status,statusExpected);
 assert.equal(after.perfil,'voluntario');
 assert.equal(after.pode_aprovar,false);
 record('RLS e escrita proibida para '+statusExpected+' com JWT real');
}
async function setup(){
 const s={tag,prefix,counter:0};
 const adminPersona=next(s,'admin');
 const {data,error}=await svc.auth.admin.createUser({email:adminPersona.email,password:adminPersona.senha,email_confirm:true});
 check(data,error,'criar admin QA');
 assert(data.user?.id);
 s.admin={id:data.user.id,email:adminPersona.email,senha:adminPersona.senha};save(s);
 const profile={id:data.user.id,usuario:adminPersona.usuario,nome:'Administrador Testes',
   telefone:null,perfil:'administrador',status:'ativo',primeiro_acesso:false,pode_aprovar:false};
 const {error:pe}=await svc.from('perfis').insert(profile);check(null,pe,'perfil admin QA');
 const login=client();
 const {data:session,error:le}=await login.auth.signInWithPassword({email:adminPersona.email,password:adminPersona.senha});
 check(session,le,'login admin QA');
 s.admin.token=session.session.access_token;save(s);
 record('admin sintético autenticado, nenhuma credencial exibida');
}
async function integration(){
 const s=load();assert.equal(s.tag,tag);
 const qr=await invite(s);
 assert.equal((await call('check_invite',{codigo:qr.codigo})).status,200);
 assert.equal((await call('check_invite',{codigo:qr.codigo_curto})).status,200);
 record('geração de convite e validação real por QR longo e código curto');
 const before=(await allAuth()).filter(x=>x.email?.startsWith(prefix)).length;
 const good=next(s,'aprovado');
 await register(s,qr.codigo,good);
 const after=(await allAuth()).filter(x=>x.email?.startsWith(prefix)).length;
 assert.equal(after,before+1,'auth.users +1 no register');
 const profile=await testUser(s,good);
 assert.equal(profile.status,'pendente');
 const {data:conv,error:ce}=await svc.from('convites').select('usos').eq('id',qr.id).single();
 check(conv,ce,'usos convite');assert.equal(conv.usos,1);
 const {data:audit,error:ae}=await svc.from('auditoria').select('id').eq('alvo',profile.id).eq('acao','cadastro_pendente');
 check(audit,ae,'auditoria cadastro');assert.equal(audit.length,1);
 record('register real: Auth +1, pendente, convite +1, auditoria +1');
 const {data:adminList,error:al}=await clientWithSession(s.admin.email,s.admin.senha).then(c=>c.from('perfis').select('id,usuario,status').eq('id',profile.id));
 check(adminList,al,'fila de aprovações RLS');assert.equal(adminList.length,1);
 await security(good,'pendente');
 const approval=await call('review',{id:profile.id,aprovar:true,perfil:'voluntario',funcoes:['professor','auxiliar'],pode_aprovar:false},s.admin.token);
 assert.equal(approval.status,200);
 assert.equal((await testUser(s,good)).status,'ativo');
 const {data:funs,error:fe}=await svc.from('funcoes_pessoa').select('funcao').eq('pessoa_id',profile.id);
 check(funs,fe,'funções');assert.deepEqual(funs.map(x=>x.funcao).sort(),['auxiliar','professor']);
 const login=await call('login',{usuario:good.usuario,senha:good.senha});
 assert.equal(login.status,200,'login por usuário aprovado');
 assert(login.body.access_token && login.body.refresh_token);
 await securityActive(good);
 record('aprovado: funções atribuídas, login por usuário e RLS ativo');
 const invR=await invite(s);
 const refused=next(s,'recusado');
 await register(s,invR.codigo_curto,refused);
 const profileR=await testUser(s,refused);
 await security(refused,'pendente');
 const rejection=await call('review',{id:profileR.id,aprovar:false,perfil:'voluntario',funcoes:[]},s.admin.token);
 assert.equal(rejection.status,200);
 await security(refused,'recusado');
 record('recusa e isolamento com token real');
 const invE=await invite(s);
 const countBefore=(await allAuth()).filter(x=>x.email?.startsWith(prefix)).length;
 const emailDup=next(s,'dupeemail');emailDup.email=good.email;
 const dr=await register(s,invE.codigo_curto,emailDup,409);
 assert.equal(dr.body.field,'email');
 assert.equal((await allAuth()).filter(x=>x.email?.startsWith(prefix)).length,countBefore,'duplicidade e-mail sem conta');
 const invU=await invite(s);
 const dupU=next(s,'dupeuser');dupU.usuario=good.usuario;
 const ur=await register(s,invU.codigo_curto,dupU,409);
 assert.equal(ur.body.field,'usuario');
 assert(!(await allAuth()).some(x=>x.email===dupU.email),'rollback deixou auth órfão');
 record('duplicidades e-mail e nome de usuário sem resíduo Auth');
 const invC=await invite(s,1);
 const cA=next(s,'conc_a'),cB=next(s,'conc_b');
 const pair=await Promise.all([call('register',{...cA,codigo:invC.codigo}),
                             call('register',{...cB,codigo:invC.codigo_curto})]);
 assert.equal(pair.filter(x=>x.status===201).length,1,'concorrência: esperado um sucesso');
 const {data:used,error:ue}=await svc.from('convites').select('usos').eq('id',invC.id).single();
 check(used,ue,'consumo concorrente');assert.equal(used.usos,1);
 const authSet=(await allAuth()).filter(x=>[cA.email,cB.email].includes(x.email));
 assert.equal(authSet.length,1,'concorrência: conta órfã');
 record('convite de uso único: exatamente um sucesso, zero órfãos');
 const testInv=await invite(s);
 const badFields=[
  ['usuario','1x'],['nome','a'],['email','semarroba'],
  ['telefone','123'],['senha','fraca'],['codigo','INVALIDO']
 ];
 for(const [field,value] of badFields){
  const bad=next(s,'neg_'+field);
  const payload={...bad,codigo:testInv.codigo,[field]:value};
  const result=await call('register',payload);
  assert.equal(result.status,422,'campo '+field);
  assert.equal(result.body.field,field,'campo reportado incorreto: '+field);
  assert(!(await allAuth()).some(x=>x.email===bad.email),'conta criada para campo inválido '+field);
 }
 const {data:afterNeg,error:en}=await svc.from('convites').select('usos').eq('id',testInv.id).single();
 check(afterNeg,en,'convite após validações negativas');assert.equal(afterNeg.usos,0);
 const malformed=await call('register',{},null,{malformed:'{'});
 assert.equal(malformed.status,400);
 const forbidden=await call('check_invite',{codigo:'ZZZ-999'},null,{origin:'https://example.invalid'});
 assert.equal(forbidden.status,403);
 const unknown=await call('check_invite',{codigo:'ZZZ-999'});
 assert.equal(unknown.status,400);
 const invExpired=await invite(s);
 check(null,(await svc.from('convites').update({expira_em:new Date(Date.now()-60000).toISOString()}).eq('id',invExpired.id)).error,'expirar convite');
 assert.equal((await call('check_invite',{codigo:invExpired.codigo_curto})).status,400);
 const invRev=await invite(s);
 assert.equal((await call('revoke_invite',{id:invRev.id},s.admin.token)).status,200);
 assert.equal((await call('check_invite',{codigo:invRev.codigo})).status,400);
 assert.equal((await call('check_invite',{codigo:qr.codigo})).status,400,'convite já usado');
 record('campos inválidos, convite vencido/revogado/usado, corpo e origem não autorizada');
 s.ui={};
 for(const project of ['android-chrome','iphone-webkit']){
   s.ui[project]={};
   for(const kind of ['qr','short','weak','double','offline']){
     s.ui[project][kind]=await invite(s);
   }
 }
 save(s);
 record('convites para Playwright preparados (códigos não impressos)');
}
async function clientWithSession(email,password){
 const c=client();
 const {error}=await c.auth.signInWithPassword({email,password});check(null,error,'cliente com sessão');
 return c;
}
async function securityActive(persona){
 const {c}=await userClient(persona);
 const {data:people,error}=await c.from('perfis').select('id,status,usuario,perfil');
 check(people,error,'voluntário RLS');
 assert.equal(people.length,1);
 assert.equal(people[0].usuario,persona.usuario);
 assert.equal(people[0].status,'ativo');
 const r=await call('invite',{dias:1,usos:1},(await c.auth.getSession()).data.session.access_token);
 assert.equal(r.status,403,'voluntário não deve emitir convite');
}
async function rate(){
 const s=load();
 const item=await invite(s);
 for(let i=0;i<25;i++)assert.equal((await call('check_invite',{codigo:item.codigo_curto})).status,200,'IP compartilhado bloqueou uso normal');
 record('25 validações na mesma rede/IP sem bloqueio');
 let limited=false;
 for(let i=0;i<80;i++){
   const r=await call('check_invite',{codigo:item.codigo_curto});
   if(r.status===429){limited=true;break;}
   assert.equal(r.status,200);
 }
 assert(limited,'não ocorreu 429 no limite do código');
 record('429 no limite por código, sem dados reais');
}
async function cleanup(){
 // Mesmo se uma etapa falhar, encontrar as contas por prefixo de runId.
 const users=(await allAuth()).filter(x=>x.email?.startsWith(prefix));
 const ids=users.map(x=>x.id);
 const s=fs.existsSync(filepath)?load():null;
 if(s && s.admin?.id && !ids.includes(s.admin.id)) ids.push(s.admin.id);
 if(ids.length){
   for(const col of ['quem','alvo']){
     const {error}=await svc.from('auditoria').delete().in(col,ids);check(null,error,'limpar auditoria '+col);
   }
   if(s?.admin?.id){
     const {error}=await svc.from('convites').delete().eq('criado_por',s.admin.id);
     check(null,error,'limpar convites');
   }
   check(null,(await svc.from('funcoes_pessoa').delete().in('pessoa_id',ids)).error,'limpar funções');
   check(null,(await svc.from('perfis').delete().in('id',ids)).error,'limpar perfis');
   for(const u of users){
     const {error}=await svc.auth.admin.deleteUser(u.id);
     check(null,error,'rollback deleteUser Auth');
   }
 }
 const {data:limitDeleted,error:le}=await svc.rpc('qa_limpar_limites');
 check(limitDeleted,le,'limpar limite privado');
 const leftovers=(await allAuth()).filter(x=>x.email?.startsWith(prefix));
 assert.equal(leftovers.length,0,'resíduos em auth.users');
 const counts={};
 for(const table of ['perfis','convites','funcoes_pessoa','auditoria']){
   const resp=await svc.from(table).select('id',{count:'exact',head:true});
   check(null,resp.error,'contagem '+table);
   counts[table]=resp.count;
   assert.equal(resp.count,0,'resíduos: '+table);
 }
 const {data:second,error:re}=await svc.rpc('qa_limpar_limites');
 check(second,re,'verificação do limite privado');
 assert.equal(second,0,'resíduos rate limit');
 if(fs.existsSync(filepath))fs.unlinkSync(filepath);
 record('LIMPEZA ZERO: Auth=0, perfis=0, convites=0, funções=0, auditoria=0, limites=0');
}
(async()=>{
 try{
  if(mode==='setup')await setup();
  else if(mode==='integration')await integration();
  else if(mode==='rate')await rate();
  else if(mode==='cleanup')await cleanup();
  else throw Error('Modo QA desconhecido');
 }catch(e){console.error('QA FALHOU: '+String(e.message).replace(/zz_teste_[a-z0-9_]+/ig,'[conta sintetica]'));process.exitCode=1}
})();