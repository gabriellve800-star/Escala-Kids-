// Escala Kids v1.2.7 — planejamento mensal. Nenhum dado infantil é carregado aqui.
// Cálculo determinístico e auditável: disponibilidade + função + uma vaga por culto.
import { CULTOS,dayTitle,monthTitle,validSlot } from './agenda.js?v=1.2.7';

export const ROLE_TITLES=Object.freeze({
  professor:'Professor(a)',auxiliar:'Auxiliar',portaria:'Portaria',lanche:'Cozinha',
});
const roles=['professor','auxiliar','portaria','lanche'];
const norm=x=>String(x??'').trim().toLocaleLowerCase('pt-BR');
const uuidText=x=>String(x??'');
const str=x=>String(x??'');
export const slotKey=s=>[s.dia,s.culto,s.funcao,s.turma_id||'-'].join('|');
export const serviceKey=s=>s.dia+'|'+s.culto;
const personKey=s=>serviceKey(s)+'|'+s.pessoa_id;
const nameFor=(p,id)=>p.find(v=>v.id===id)?.nome||'Pessoa já escalada';

export function sessionsForMonth(month){
 if(!/^\d{4}-(0[1-9]|1[0-2])-01$/.test(month||''))return [];
 const [year,m]=month.split('-').map(Number),end=new Date(Date.UTC(year,m,0)).getUTCDate();
 const values=[];
 for(let i=1;i<=end;i++){
  const day=month.slice(0,7)+'-'+String(i).padStart(2,'0');
  const weekday=new Date(day+'T12:00:00Z').getUTCDay();
  for(const culto of weekday===0?['domingo_manha','domingo_noite']:weekday===3?['quarta_noite']:[])
    values.push({dia:day,culto});
 }
 return values;
}
export function publishedForSlot(s,published=[],classes=[]){
 const cls=classes.find(t=>t.id===s.turma_id);
 return published.find(p=>p.dia===s.dia&&p.culto===s.culto&&p.funcao===s.funcao&&(
  s.turma_id
    ?p.turma_id===s.turma_id||(!p.turma_id&&norm(p.turma)===norm(cls?.nome))
    :true // Portaria e cozinha são funções do culto, não pertencem a uma turma.
 ))||null;
}
export function candidatePeople(slot,base,items=[]){
 if(!slot||!base)return [];
 const available=new Set((base.disponibilidades||[])
   .filter(d=>d.dia===slot.dia&&d.culto===slot.culto).map(d=>d.pessoa_id));
 const occupied=new Set((base.publicadas||[])
   .filter(p=>p.dia===slot.dia&&p.culto===slot.culto).map(p=>p.pessoa_id));
 for(const row of items){
   if(row!==slot&&row.dia===slot.dia&&row.culto===slot.culto&&row.pessoa_id)
     occupied.add(row.pessoa_id);
 }
 return (base.equipe||[]).filter(p=>available.has(p.id)&&!occupied.has(p.id)&&
   Array.isArray(p.funcoes)&&p.funcoes.includes(slot.funcao)).sort((a,b)=>
     a.nome.localeCompare(b.nome,'pt-BR')||a.id.localeCompare(b.id));
}
export function createSuggestion(base){
 const classes=(base?.turmas||[]).filter(t=>t.ativa)
   .sort((a,b)=>a.posicao-b.posicao);
 if(classes.length!==4||new Set(classes.map(t=>t.posicao)).size!==4)
   throw new Error('Configure as quatro turmas fixas antes de gerar a sugestão.');
 const sessions=sessionsForMonth(base.mes);
 const results=[],frequency=new Map();
 for(const session of sessions){
   const slots=[];
   for(const role of ['professor','auxiliar'])
     for(const cls of classes)slots.push({
       dia:session.dia,culto:session.culto,funcao:role,turma_id:cls.id,
       pessoa_id:null,horario:null,
     });
   for(const role of ['portaria','lanche'])slots.push({
       dia:session.dia,culto:session.culto,funcao:role,turma_id:null,
       pessoa_id:null,horario:null,
   });
   // Primeiro as funções com menos candidatos, reduzindo vagas não atendidas.
   const open=slots.filter(s=>!publishedForSlot(s,base.publicadas,classes));
   const countEligible=s=>candidatePeople(s,base,slots).length;
   open.sort((a,b)=>countEligible(a)-countEligible(b) ||
     roles.indexOf(a.funcao)-roles.indexOf(b.funcao) ||
     ((classes.find(t=>t.id===a.turma_id)?.posicao||0)-
      (classes.find(t=>t.id===b.turma_id)?.posicao||0)));
   for(const slot of open){
     const candidates=candidatePeople(slot,base,slots).sort((a,b)=>
       (frequency.get(a.id)||0)-(frequency.get(b.id)||0)||
       a.nome.localeCompare(b.nome,'pt-BR')||a.id.localeCompare(b.id));
     if(candidates.length){
       slot.pessoa_id=candidates[0].id;
       frequency.set(candidates[0].id,(frequency.get(candidates[0].id)||0)+1);
     }
   }
   results.push(...slots);
 }
 return results;
}
export function summaryFor(items=[],base={}){
 const classes=base.turmas||[],published=base.publicadas||[];
 let occupied=0,assigned=0,gaps=0,timesMissing=0;
 for(const s of items){
   if(publishedForSlot(s,published,classes))occupied++;
   else if(s.pessoa_id){assigned++;if(!s.horario)timesMissing++;}
   else gaps++;
 }
 return {occupied,assigned,gaps,timesMissing,total:items.length};
}

const strEsc=(s,esc)=>esc(str(s));
const pretty=(service)=>dayTitle(service.dia)+' • '+(CULTOS[service.culto]||service.culto);
function picker(slot,index,base,items,esc,readonly){
 const occupied=publishedForSlot(slot,base.publicadas,base.turmas);
 if(occupied)return '<span class="planner-published">Já publicado · '+
    strEsc(nameFor(base.equipe,occupied.pessoa_id),esc)+'</span>';
 if(readonly)return '<span class="'+(slot.pessoa_id?'planner-person':'planner-empty')+'">'+
   strEsc(slot.pessoa_id?nameFor(base.equipe,slot.pessoa_id):'Vaga aberta',esc)+'</span>';
 const choices=candidatePeople(slot,base,items);
 if(slot.pessoa_id&&!choices.some(p=>p.id===slot.pessoa_id)){
   const current=base.equipe.find(p=>p.id===slot.pessoa_id);
   if(current)choices.unshift(current);
 }
 return '<select class="in planner-assignee" data-planner-person="'+index+
    '" aria-label="Escolher '+strEsc(ROLE_TITLES[slot.funcao],esc)+'">'+
    '<option value="">Vaga aberta</option>'+
    choices.map(p=>'<option value="'+strEsc(p.id,esc)+'"'+
      (p.id===slot.pessoa_id?' selected':'')+'>'+strEsc(p.nome,esc)+'</option>').join('')+
    '</select>';
}
export function plannerUI({base,items=[],dirty=false,version=null,loading=false,esc}){
 if(loading||!base)return '<h2>Escala sugerida</h2><div class="card">Carregando planejamento…</div>';
 const active=(base.turmas||[]).filter(t=>t.ativa);
 const status=base.rascunho?.estado||'novo',readonly=status==='aprovado';
 const stats=summaryFor(items,base);
 const ready=items.length&&stats.gaps===0&&stats.timesMissing===0&&!readonly;
 let h='<div class="planner-head"><div><span class="planner-kicker">PLANEJAMENTO DE EQUIPE</span>'+
   '<h2>Escala sugerida</h2><p class="mut">'+strEsc(monthTitle(base.mes),esc)+
   ' · As turmas permanecem fixas. As pessoas mudam a cada culto.</p></div>'+
   '<span class="tag">'+strEsc(status==='novo'?'Não salva':status==='rascunho'?'Rascunho':'Aprovada',esc)+'</span></div>';
 h+='<div class="planner-kpis">'+[
   ['Vagas',stats.total],['Preenchidas',stats.assigned+stats.occupied],
   ['Pendentes',stats.gaps],['Publicadas',stats.occupied]
  ].map(([label,n])=>'<div class="planner-kpi"><strong>'+n+'</strong><span>'+label+'</span></div>').join('')+'</div>';
 if(active.length!==4){
   return h+'<div class="card"><h3>Configure as quatro turmas primeiro</h3>'+
     '<p class="mut">A liderança pode alterar os nomes e as faixas etárias em Kids → Turmas. Não serão inventadas turmas ou pessoas.</p></div>';
 }
 if(!items.length){
   return h+'<div class="card"><p class="mut">Nenhuma sugestão salva para este mês. O aplicativo analisará as disponibilidades enviadas pelos voluntários e preencherá as necessidades de cada culto.</p>'+
     (base.pode_editar?'<button class="btn pri" data-a="planner-generate">Gerar sugestão do mês</button>':'')+'</div>';
 }
 h+='<div class="planner-actions">'+
   (!readonly&&base.pode_editar?'<button class="btn ghost" data-a="planner-generate">Recalcular sugestão</button>'+
     '<button class="btn pri" data-a="planner-save"'+(!dirty?' disabled':'')+'>Salvar rascunho</button>':'')+
   (!readonly&&base.pode_aprovar?'<button class="btn pri" data-a="planner-approve"'+
     ((!ready||dirty||version==null)?' disabled':'')+'>Aprovar e publicar</button>':'')+
   '<button class="btn ghost" data-a="planner-refresh">Atualizar</button></div>';
 if(!readonly){
   h+='<p class="planner-help">'+(stats.gaps
     ?stats.gaps+' vaga(s) sem voluntário disponível e habilitado. '
     :'Todas as vagas têm uma pessoa designada. ')+
     (stats.timesMissing?'Defina o horário de cada culto antes de aprovar. ':'')+
     (dirty?'Salve o rascunho para habilitar a aprovação. ':'')+
     'Nenhuma sugestão é publicada automaticamente.</p>';
 }
 const services=sessionsForMonth(base.mes);
 for(const session of services){
  const group=items.map((s,index)=>({s,index}))
    .filter(({s})=>s.dia===session.dia&&s.culto===session.culto);
  const groupTime=group.map(({s})=>s.horario).find(x=>x)||'';
  const incomplete=group.filter(({s})=>!s.pessoa_id&&!publishedForSlot(s,base.publicadas,base.turmas)).length;
  h+='<section class="planner-service card"><div class="planner-service-head">'+
    '<div><span class="planner-day">'+strEsc(pretty(session),esc)+'</span>'+
    '<span class="planner-service-label">'+(incomplete?incomplete+' vaga(s) em aberto':'Equipe preenchida')+
    '</span></div>'+
    '<label class="planner-time-label">Horário do culto'+
       '<input class="in planner-time" type="time" data-planner-time="'+
       strEsc(serviceKey(session),esc)+'" value="'+strEsc(groupTime,esc)+'"'+
       (readonly||!base.pode_editar?' disabled':'')+'></label></div>'+
    '<div class="planner-table-wrap"><table class="planner-table"><thead>'+
    '<tr><th>Setor / Turma</th><th>Função</th><th>Voluntário designado</th></tr></thead><tbody>';
  for(const {s,index} of group){
   const cls=base.turmas.find(t=>t.id===s.turma_id);
   const sector=cls?.nome||(s.funcao==='portaria'?'Portaria':'Cozinha');
   const vacant=!s.pessoa_id&&!publishedForSlot(s,base.publicadas,base.turmas);
   h+='<tr'+(vacant?' class="planner-row-missing"':'')+'>'+
     '<td><strong>'+strEsc(sector,esc)+'</strong></td><td>'+strEsc(ROLE_TITLES[s.funcao],esc)+'</td>'+
     '<td>'+picker(s,index,base,items,esc,readonly||!base.pode_editar)+'</td></tr>';
  }
  h+='</tbody></table></div></section>';
 }
 h+='<p class="mut planner-footer">O algoritmo respeita disponibilidade, funções habilitadas e um cargo por pessoa em cada culto. Confira manualmente as sugestões antes de publicar.</p>';
 return h;
}
