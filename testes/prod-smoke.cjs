'use strict';
// Smoke de produção limitado a IDs sintéticos deste run. JAMAIS zera tabelas ou apaga dados reais.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const assert=require('node:assert/strict');
const {createClient}=require('@supabase/supabase-js');
const {chromium,webkit,devices,expect}=require('@playwright/test');
const ref='pntzfuxwkjreugxzovjj',url='https://'+ref+'.supabase.co';
const site='https://gabriellve800-star.github.io/Escala-Kids-/';
const secret=process.env.PROD_SUPABASE_SECRET_KEY||'';
assert(secret.startsWith('sb_secret_'),'PROD_SMOKE_KEY_MISSING');
const cfg=fs.readFileSync(path.resolve('config.js'),'utf8');
const key=cfg.match(/publishableKey:\s*'([^']+)'/)?.[1]||'';
assert(cfg.includes(ref+'.supabase.co')&&!cfg.includes('eofoeijyfpptcktiqeah'));
assert(key.startsWith('sb_publishable_'),'publishable missing');
const admin=createClient(url,secret,{auth:{autoRefreshToken:false,persistSession:false}});
const publicClient=()=>createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
const prefix='zz_teste_'+String(process.env.GITHUB_RUN_ID||Date.now()).slice(-8);
const filepath=path.resolve('.prod-smoke-state.json');
const secretPass=()=> 'Aa9!'+crypto.randomBytes(22).toString('base64url');
const data=(label)=>({usuario:(prefix+'_'+label).slice(0,26),nome:'Cadastro Teste Automatizado',
 email:prefix+'_'+label+'@example.com',senha:secretPass(),telefone:'(11) 98888-7777'});
const check=(error,stage)=>{if(error)throw Error(stage+': '+(error.code||'rejected'))};
const save=(s)=>fs.writeFileSync(filepath,JSON.stringify(s),{mode:0o600});
const load=()=>fs.existsSync(filepath)?JSON.parse(fs.readFileSync(filepath,'utf8')):null;
async function users(){
 let all=[];
 for(let page=1;page<=50;page++){
  const {data,error}=await admin.auth.admin.listUsers({page,perPage:100});
  check(error,'listUsers');
  all.push(...data.users);if(data.users.length<100)break;
 }
 return all;
}
async function counts(){
 const o={auth:(await users()).length};
 for(const t of ['perfis','convites','auditoria','funcoes_pessoa']){
  const col=t==='funcoes_pessoa'?'pessoa_id':'id';
  const {count,error}=await admin.from(t).select(col,{count:'exact',head:true});
  check(error,'count '+t);o[t]=count;
 }
 return o;
}
async function call(action,payload={},jwt){
 const headers={Origin:'https://gabriellve800-star.github.io','Content-Type':'application/json',apikey:key};
 if(jwt)headers.Authorization='Bearer '+jwt;
 const result=await fetch(url+'/functions/v1/kids-auth',{method:'POST',headers,body:JSON.stringify({action,...payload}),signal:AbortSignal.timeout(30000)});
 let body={};try{body=await result.json()}catch{}
 return {status:result.status,body};
}
async function verifyStatic(){
 const items=['index.html','app.js','agenda.js','styles.css','sw.js','config.js'];
 for(const item of items){
  const b=await fetch(site+item+'?smoke='+encodeURIComponent(prefix),{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(15000)});
  assert.equal(b.status,200,'public HTTP '+item+' '+b.status);
  const remote=Buffer.from(await b.arrayBuffer());
  if(item!=='config.js'){
   const local=fs.readFileSync(path.resolve(item));
   assert.equal(crypto.createHash('sha256').update(remote).digest('hex'),
    crypto.createHash('sha256').update(local).digest('hex'),'hash HTTP diferente de '+item);
  }else{
   const text=remote.toString('utf8');
   assert(text.includes(ref+'.supabase.co')&&!text.includes('sb_secret_')&&!text.includes('eofoeijyfpptcktiqeah'));
  }
  if(item==='index.html')assert(remote.toString('utf8').includes('Escala Kids · v1.2.4'));
  if(item==='sw.js')assert(remote.toString('utf8').includes("escala-kids-v1.2.4-agenda-voluntarios"));
 }
 console.log('PROD_SMOKE_SITE_HASH_OK: v1.2.4 index/app/sw; config prod public; HTTP 200');
}
async function play(browserType,device,persona,invite,kind){
 const browser=await browserType.launch({headless:true});
 const context=await browser.newContext({...device,serviceWorkers:'allow'});
 const page=await context.newPage();
 try{
  if(kind==='qr'){
   await page.addInitScript(code=>history.replaceState(null,'','?convite='+encodeURIComponent(code)),invite.codigo);
   await page.goto(site,{waitUntil:'domcontentloaded'});
   await expect(page.locator('form[data-form=signup]')).toBeVisible({timeout:30000});
  }else{
   await page.goto(site,{waitUntil:'domcontentloaded'});
   await page.locator('[data-a=signup]').click();
   await page.locator('form[data-form=checkinvite] [name=sc]').fill(invite.codigo_curto);
   await page.locator('form[data-form=checkinvite] button[type=submit]').click();
   await expect(page.locator('form[data-form=signup]')).toBeVisible({timeout:30000});
  }
  for(const [field,val] of Object.entries({sn:persona.nome,su:persona.usuario,se:persona.email,sf:persona.telefone,sp:persona.senha})){
   await page.locator('[name='+field+']').fill(val);
  }
  await page.locator('form[data-form=signup] button[type=submit]').click();
  await expect(page.getByText('Cadastro enviado',{exact:true})).toBeVisible({timeout:30000});
  return true;
 }finally{await context.close();await browser.close()}
}
async function verifyProfile(persona,invite){
 const matched=(await users()).filter(u=>u.email===persona.email);
 assert.equal(matched.length,1,'auth não tem conta sintética');
 const id=matched[0].id;
 const {data:profile,error}=await admin.from('perfis').select('id,usuario,status').eq('id',id).single();
 check(error,'profile');assert.equal(profile.usuario,persona.usuario);
 assert.equal(profile.status,'pendente');
 const {data:conv,error:ce}=await admin.from('convites').select('usos').eq('id',invite.id).single();
 check(ce,'convite');assert.equal(conv.usos,1);
 const {data:audit,error:ae}=await admin.from('auditoria').select('id').eq('acao','cadastro_pendente').eq('alvo',id);
 check(ae,'auditoria');assert.equal(audit.length,1);
 return id;
}
async function verifyRls(persona,expected){
 const cl=publicClient();
 const {data:auth,error}=await cl.auth.signInWithPassword({email:persona.email,password:persona.senha});
 check(error,'login RLS');
 const list=await cl.from('perfis').select('id,usuario,status');
 check(list.error,'RLS select');
 assert.equal(list.data.length,1);
 assert.equal(list.data[0].status,expected);
 const own=list.data[0].id;
 const altered=await cl.from('perfis').update({perfil:'administrador',status:'ativo'}).eq('id',own).select();
 assert(altered.error||altered.data.length===0,'elevação indevida');
}
async function verifyServiceWorker(){
 const browser=await chromium.launch({headless:true});
 const context=await browser.newContext({...devices['Pixel 7'],serviceWorkers:'allow'});
 const page=await context.newPage();
 try{
  await page.goto(site,{waitUntil:'domcontentloaded'});
  const result=await page.evaluate(async()=>{
    const cacheName='escala-kids-smoke-legacy';
    const previous=await navigator.serviceWorker.getRegistration();
    if(previous)await previous.unregister();
    await caches.open(cacheName);
    const reg=await navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'});
    await new Promise((resolve,reject)=>{
     if(reg.active?.state==='activated')return resolve();
     const id=setTimeout(()=>reject(Error('SW_ACTIVATION_TIMEOUT')),25000);
     navigator.serviceWorker.addEventListener('controllerchange',()=>{clearTimeout(id);resolve()},{once:true});
     const installing=reg.installing;
     if(installing)installing.addEventListener('statechange',()=>{
       if(installing.state==='activated'){clearTimeout(id);resolve()}
     });
    });
    const names=await caches.keys();
    return {oldPresent:names.includes(cacheName),v123:names.some(x=>x.startsWith('escala-kids-v1.2.4'))};
  });
  assert.equal(result.oldPresent,false,'cache antigo continua presente');
  assert.equal(result.v123,true,'cache v1.2.4 ausente');
  console.log('PROD_SMOKE_SW_OK: nova versão ativa e cache antigo eliminado');
 }finally{await context.close();await browser.close()}
}
async function volunteerAgendaSmoke(persona,day){
 const browser=await chromium.launch({headless:true});
 const context=await browser.newContext({...devices['Pixel 7'],serviceWorkers:'allow'});
 const page=await context.newPage();
 try{
  await page.goto(site,{waitUntil:'domcontentloaded'});
  await page.locator('form[data-form=login] [name=lu]').fill(persona.email);
  await page.locator('form[data-form=login] [name=lp]').fill(persona.senha);
  await page.locator('form[data-form=login] button[type=submit]').click();
  await expect(page.locator('h2').filter({hasText:'Minha Escala'})).toBeVisible({timeout:30000});
  await expect(page.locator('.agenda-next-card')).toContainText('Maternal');
  await page.locator('button[data-a=agenda-day][data-day="'+day+'"]').click();
  await page.locator('button[data-a=agenda-toggle][data-culto=domingo_manha]').click();
  await expect(page.locator('button[data-a=agenda-toggle][data-culto=domingo_manha]')).toHaveAttribute('aria-pressed','true',{timeout:30000});
  return true;
 }finally{await context.close();await browser.close();}
}
async function execution(){
 const pre=await counts();
 console.log('PROD_SMOKE_BASELINE '+JSON.stringify(pre));
 const s={prefix,baseline:pre,ids:[],invites:[],expectedEmails:[]};save(s);
 await verifyStatic();await verifyServiceWorker();

 const persona=data('admin');
 const approved=data('qr'),refused=data('curto');
 s.expectedEmails=[persona.email,approved.email,refused.email];
 assert.equal(new Set(s.expectedEmails).size,3,'E-mails sintéticos repetidos');
 const existing=(await users()).filter(u=>s.expectedEmails.includes(u.email));
 assert.equal(existing.length,0,'Conta com identidade sintética já existente. Abortar antes de criar contas.');
 save(s);
 const {data:au,error:err}=await admin.auth.admin.createUser({email:persona.email,password:persona.senha,email_confirm:true});
 check(err,'createUser admin');assert(au.user?.id);
 s.ids.push(au.user.id);save(s);
 const ins=await admin.from('perfis').insert({id:au.user.id,usuario:persona.usuario,nome:persona.nome,
  perfil:'administrador',status:'ativo',primeiro_acesso:false,pode_aprovar:false});
 check(ins.error,'admin profile');
 const cl=publicClient();
 const {data:auth,error:le}=await cl.auth.signInWithPassword({email:persona.email,password:persona.senha});
 check(le,'admin signin');
 const jwt=auth.session.access_token;
 const invites=[];
 for(let i=0;i<2;i++){
  const inv=await call('invite',{dias:1,usos:1},jwt);
  assert.equal(inv.status,200,'invite HTTP '+inv.status);
  s.invites.push(inv.body.id);save(s);
  assert.equal((await call('check_invite',{codigo:inv.body.codigo})).status,200);
  assert.equal((await call('check_invite',{codigo:inv.body.codigo_curto})).status,200);
  invites.push(inv.body);
 }
 await play(chromium,devices['Pixel 7'],approved,invites[0],'qr');
 const id1=await verifyProfile(approved,invites[0]);s.ids.push(id1);save(s);
 await verifyRls(approved,'pendente');
 const p=await call('review',{id:id1,aprovar:true,perfil:'voluntario',funcoes:['professor'],pode_aprovar:false},jwt);
 assert.equal(p.status,200,'aprovação HTTP '+p.status);
 await verifyRls(approved,'ativo');
 // O card só anuncia uma escala que foi realmente publicada pelo administrador.
 const now=new Date();
 const futureMonth=new Date(now.getFullYear(),now.getMonth()+1,1,12);
 let sunday=null;
 for(let n=1;n<=31;n++){
  const d=new Date(futureMonth.getFullYear(),futureMonth.getMonth(),n,12);
  if(d.getMonth()!==futureMonth.getMonth())break;
  if(d.getDay()===0){sunday=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(n).padStart(2,'0')].join('-');break;}
 }
 assert(sunday,'domingo de teste indisponível');
 const assigned=await cl.from('escalas').insert({pessoa_id:id1,dia:sunday,culto:'domingo_manha',horario:'09:00',turma:'Maternal',funcao:'professor'});
 check(assigned.error,'escala sintética por administrador');
 await volunteerAgendaSmoke(approved,sunday);
 const own=publicClient();
 check((await own.auth.signInWithPassword({email:approved.email,password:approved.senha})).error,'login para disponibilidade');
 const av=await own.from('disponibilidades').select('dia,culto').eq('dia',sunday).eq('culto','domingo_manha');
 check(av.error,'ler disponibilidade real');assert.equal(av.data.length,1);
 console.log('PROD_SMOKE_AGENDA_OK: card próxima escala, login voluntário, calendário e disponibilidade salvos no site público');
 const logged=await call('login',{usuario:approved.usuario,senha:approved.senha});
 assert.equal(logged.status,200,'login aprovado HTTP '+logged.status);
 assert(logged.body.access_token&&logged.body.refresh_token);
 await play(webkit,devices['iPhone 13'],refused,invites[1],'short');
 const id2=await verifyProfile(refused,invites[1]);s.ids.push(id2);save(s);
 const rejection=await call('review',{id:id2,aprovar:false,perfil:'voluntario',funcoes:[]},jwt);
 assert.equal(rejection.status,200,'recusa HTTP '+rejection.status);
 await verifyRls(refused,'recusado');
 console.log('PROD_SMOKE_E2E_OK: público QR Android + curto iPhone, pendência, aprovação, recusa, login, RLS, auditoria');
}
async function cleanup(){
 const s=load();
 if(!s){
  console.log('PROD_SMOKE_NO_STATE: nenhum registro criado nesta execução');
  return;
 }
 // Resolva IDs SOMENTE das três identidades que foram pré-registradas neste run.
 // Os e-mails eram comprovadamente inexistentes antes da criação. Nunca limpar por prefixo.
 const expected=new Set(s.expectedEmails||[]);
 assert(expected.size>0,'Estado QA sem lista explícita de identidades; limpeza recusada por segurança');
 const generated=(await users()).filter(u=>expected.has(u.email));
 const ids=[...new Set([...s.ids,...generated.map(x=>x.id)])];
 const adminProfiles=ids.length?await admin.from('perfis').select('id').in('id',ids).eq('perfil','administrador'):{data:[],error:null};
 check(adminProfiles.error,'admin test profiles');
 const admins=(adminProfiles.data||[]).map(x=>x.id);
 let inviteIds=[...s.invites];
 if(admins.length){
  const own=await admin.from('convites').select('id').in('criado_por',admins);
  check(own.error,'test invites');
  inviteIds=[...new Set([...inviteIds,...(own.data||[]).map(x=>x.id)])];
 }
 if(ids.length){
  check((await admin.from('auditoria').delete().in('quem',ids)).error,'delete audit actor');
  check((await admin.from('auditoria').delete().in('alvo',ids)).error,'delete audit target');
  check((await admin.from('funcoes_pessoa').delete().in('pessoa_id',ids)).error,'delete user functions');
 }
 if(inviteIds.length)check((await admin.from('convites').delete().in('id',inviteIds)).error,'delete ONLY invitation ids');
 if(ids.length)check((await admin.from('perfis').delete().in('id',ids)).error,'delete ONLY profile ids');
 for(const u of generated)check((await admin.auth.admin.deleteUser(u.id)).error,'delete ONLY Auth synthetic id');
 assert.equal((await users()).filter(u=>expected.has(u.email)).length,0,'Auth de identidades criadas residual');
 const unknown=(await users()).filter(u=>u.email?.startsWith(s.prefix+'_')&&!expected.has(u.email));
 assert.equal(unknown.length,0,'Encontradas identidades não previstas; NÃO excluí-las automaticamente');
 for(const t of ['perfis','convites','auditoria','funcoes_pessoa']){
  const col=t==='funcoes_pessoa'?'pessoa_id':'id';
  if(!ids.length && !inviteIds.length)continue;
  if(t==='convites'){if(inviteIds.length){const x=await admin.from(t).select('id').in('id',inviteIds);check(x.error,'verify invites');assert.equal(x.data.length,0)}}
  else if(t==='auditoria'){
   const a=await admin.from(t).select('id').in('quem',ids),b=await admin.from(t).select('id').in('alvo',ids);
   check(a.error,'audit who');check(b.error,'audit target');assert.equal(a.data.length+b.data.length,0);
  }else if(ids.length){const x=await admin.from(t).select(col).in(col,ids);check(x.error,'verify '+t);assert.equal(x.data.length,0)}
 }
 const post=await counts();
 console.log('PROD_SMOKE_AFTER '+JSON.stringify(post));
 assert.deepEqual(post,s.baseline,'contagens alteradas; não apagar dados de outros usuários');
 console.log('PROD_SMOKE_CLEAN_ZERO: IDs exatos de Auth, perfis, convites, funções e auditoria removidos; totais restaurados');
 fs.unlinkSync(filepath);
}
(async()=>{
 try{
  if(process.argv[2]==='cleanup')await cleanup();
  else if(process.argv[2]==='run')await execution();
  else throw Error('invalid mode');
 }catch(e){
  const msg=String(e.message).replace(/zz_teste_[a-z0-9_]+/ig,'[synthetic]');
  console.error('PROD_SMOKE_FAIL '+msg);
  process.exitCode=1;
 }
})();
