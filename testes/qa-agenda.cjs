'use strict';
// Exclusivo do Supabase QA. Contas de teste são removidas pela limpeza geral, nunca em produção.
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const {createClient}=require('@supabase/supabase-js');
const state=JSON.parse(fs.readFileSync('.qa-state.json','utf8'));
const ref=process.env.QA_SUPABASE_PROJECT_REF;
assert.equal(ref,'eofoeijyfpptcktiqeah');
const url='https://'+ref+'.supabase.co';
const svc=createClient(url,process.env.QA_SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const pub=process.env.QA_SUPABASE_PUBLISHABLE_KEY;
const client=()=>createClient(url,pub,{auth:{persistSession:false,autoRefreshToken:false}});
const {pathToFileURL}=require('node:url'),path=require('node:path');
function person(suffix,perfil='voluntario'){
 const usuario=(state.prefix+'_ag'+suffix).slice(0,26);
 return {usuario,perfil,email:usuario+'@example.com',senha:'Aa9!'+crypto.randomBytes(19).toString('base64url')};
}
function check(result,stage){if(result.error)throw Error(stage+': '+String(result.error.code||'error'));return result.data;}
async function create(p){
 const auth=check(await svc.auth.admin.createUser({email:p.email,password:p.senha,email_confirm:true}),'createAuth');
 p.id=auth.user.id;
 check(await svc.from('perfis').insert({id:p.id,usuario:p.usuario,nome:'QA Agenda '+p.perfil,telefone:'+5511999997777',status:'ativo',perfil:p.perfil,primeiro_acesso:false}),'createProfile');
 const c=client();check(await c.auth.signInWithPassword({email:p.email,password:p.senha}),'login');
 p.c=c;return p;
}
(async()=>{
 const a=await import(pathToFileURL(path.resolve('agenda.js')).href);
 const target=a.monthDays(a.firstMonth(1)).find(d=>a.slotsForDate(d).includes('domingo_manha'));
 const second=a.monthDays(a.firstMonth(1)).find(d=>a.slotsForDate(d).includes('quarta_noite'));
 assert(target && second,'no service days');
 const [personA,personB,leader]=await Promise.all([create(person('a')),create(person('b')),create(person('l','lider'))]);
 const payload={pessoa_id:personA.id,dia:target,culto:'domingo_manha'};
 check(await personA.c.from('disponibilidades').insert(payload),'availability self');
 const other=await personB.c.from('disponibilidades').insert(payload);
 assert(other.error,'RLS should reject writing other volunteer availability');
 const wrongDay=await personA.c.from('disponibilidades').insert({pessoa_id:personA.id,dia:target,culto:'quarta_noite'});
 assert(wrongDay.error,'CHECK should reject Wednesday slot on Sunday');
 const wrongMonth=await personA.c.from('disponibilidades').insert({pessoa_id:personA.id,dia:a.monthDays(a.firstMonth()).find(x=>a.slotsForDate(x).includes('domingo_manha')),culto:'domingo_manha'});
 assert(wrongMonth.error,'RLS should reject current month availability');
 const {data:visible,error:visError}=await personB.c.from('disponibilidades').select('pessoa_id,dia,culto');
 if(visError)throw visError;
 assert(!visible.some(x=>x.pessoa_id===personA.id),'other volunteer availability leaked');
 const managerRows=check(await leader.c.from('disponibilidades').select('pessoa_id,dia,culto'),'manager read availability');
 assert(managerRows.some(x=>x.pessoa_id===personA.id),'manager must see volunteers availability');
 const shift={pessoa_id:personA.id,dia:target,culto:'domingo_manha',horario:'09:00',turma:'Maternal',funcao:'professor'};
 const forbidden=await personA.c.from('escalas').insert(shift);
 assert(forbidden.error,'Volunteer may not self assign');
 check(await leader.c.from('escalas').insert(shift),'leader assign shift');
 const aRows=check(await personA.c.from('escalas').select('id,dia,culto,horario,turma,funcao'),'own shifts');
 assert.equal(aRows.length,1);assert.equal(aRows[0].turma,'Maternal');
 const bRows=check(await personB.c.from('escalas').select('id,dia,culto,horario,turma,funcao'),'other shifts');
 assert.equal(bRows.length,0,'volunteer can see another schedule');
 const badDelete=await personA.c.from('escalas').delete().eq('id',aRows[0].id).select('id');
 assert(badDelete.error||!badDelete.data?.length,'volunteer cannot delete shift');
 const canRemove=check(await leader.c.from('escalas').delete().eq('id',aRows[0].id).select('id'),'leader delete shift');
 assert.equal(canRemove.length,1,'manager should delete assigned shift');
 check(await personA.c.from('disponibilidades').delete().match(payload),'self delete availability');
 const left=check(await svc.from('disponibilidades').select('pessoa_id').eq('pessoa_id',personA.id),'availability removed');
 assert.equal(left.length,0);
 // Manter uma escala fictícia para validar a interface real em Chrome e WebKit. O cleanup elimina via FK.
 check(await leader.c.from('escalas').insert(shift),'preparar escala para Playwright');
 const agendaState=JSON.parse(fs.readFileSync('.qa-state.json','utf8'));
 agendaState.agendaVolunteer={usuario:personA.usuario,senha:personA.senha,day:target};
 fs.writeFileSync('.qa-state.json',JSON.stringify(agendaState),{mode:0o600});
 console.log('QA_AGENDA_OK: voluntário só vê a sua; gestor publica; interface será verificada por Playwright.');
})().catch(e=>{console.error('QA_AGENDA_FAILED '+String(e.message).replace(/zz_teste_[a-z0-9_]+/gi,'[test]'));process.exitCode=1;});
