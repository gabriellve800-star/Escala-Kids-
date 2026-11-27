// Attendance: no storage of children's data, no offline writes.
export const ATTENDANCE_CULTS={domingo_manha:'Domingo · manhã',domingo_noite:'Domingo · noite',quarta_noite:'Quarta · noite'};
export function attendanceCults(day){const n=new Date(day+'T12:00:00Z').getUTCDay();return n===0?['domingo_manha','domingo_noite']:n===3?['quarta_noite']:[];}
export function attendanceCounts(rows){return {total:rows.length,present:rows.filter(x=>x.estado==='presente').length,left:rows.filter(x=>x.estado==='saiu').length,pending:rows.filter(x=>x.estado==='nao_registrada').length};}
const hh=v=>v?new Date(v).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',timeZone:'America/Sao_Paulo'}):'—';
export function attendanceTeamUI({rows=[],culto='',day='',loading=false,error=false,calls=[],callsError=false,esc}){
 const cults=attendanceCults(day),count=attendanceCounts(rows);
 let h='<h2>Lista de presença</h2><p class="mut">Entrada e retirada dos pequenos · '+esc(day.split('-').reverse().join('/'))+'</p>';
 if(!cults.length)return h+'<div class="card">Hoje não há culto regular cadastrado. A presença ficará disponível no dia do culto.</div>';
 h+='<div class="pillset">'+cults.map(c=>'<button type="button" class="chip '+(c===culto?'on':'')+'" data-a="attendance-culto" data-id="'+c+'">'+ATTENDANCE_CULTS[c]+'</button>').join('')+'</div><button class="btn ghost" data-a="attendance-refresh">Atualizar lista</button>';
 if(loading)return h+'<p class="mut" role="status">Carregando presença…</p>';
 if(error)return h+'<div class="alert">Não foi possível consultar a lista. Nenhuma alteração foi presumida.</div>';
 h+='<div class="attendance-kpis"><div><strong>'+count.present+'</strong><span>Presentes</span></div><div><strong>'+count.left+'</strong><span>Saíram</span></div><div><strong>'+count.pending+'</strong><span>Sem registro</span></div></div>';
 if(!rows.length)return h+'<div class="card">Nenhuma criança disponível para seu perfil neste culto. Confira sua escala com a liderança.</div>';
 let previous=null;
 for(const row of rows){
  if(row.turma!==previous){h+='<h3 class="kids-section">'+esc(row.turma)+'</h3>';previous=row.turma;}
  const tag=row.estado==='presente'?'Presente':row.estado==='saiu'?'Saiu':'Sem registro';
  h+='<div class="card attendance-card"><div class="row"><div><strong>'+esc(row.nome)+'</strong><p class="mut">'+esc(row.numero)+'</p></div><span class="tag '+(row.estado==='nao_registrada'?'warn':'')+'">'+tag+'</span></div>';
  if(row.estado==='nao_registrada')h+='<form data-form="attendance-register"><input type="hidden" name="attendance-child" value="'+esc(row.crianca_id)+'"><input type="hidden" name="attendance-action" value="entrada"><button type="submit" class="btn pri">Registrar entrada</button></form>';
  else h+='<p class="mut">Entrada: '+esc(hh(row.entrada_em))+(row.estado==='saiu'?' · Saída: '+esc(hh(row.saida_em)):'')+'</p>';
  if(row.estado==='presente'){
   h+=teamCallUI(row,calls,callsError,esc);
   if(!row.responsaveis?.length)h+='<p class="mut">Nenhum responsável confirmado. Não libere a criança pelo aplicativo; chame a liderança.</p>';
   else h+='<details><summary>Registrar retirada</summary><form data-form="attendance-register" class="kids-form"><input type="hidden" name="attendance-child" value="'+esc(row.crianca_id)+'"><input type="hidden" name="attendance-action" value="saida"><label>Responsável vinculado<select required class="in" name="attendance-guardian"><option value="">Selecione após identificar</option>'+row.responsaveis.map(g=>'<option value="'+esc(g.id)+'">'+esc(g.nome)+'</option>').join('')+'</select></label><label class="kids-consent"><input required type="checkbox" name="attendance-checked"> Conferi presencialmente a identidade e a autorização de retirada.</label><p class="mut">O aplicativo não verifica documentos nem substitui a conferência presencial.</p><button type="submit" class="btn ghost">Confirmar saída</button></form></details>';
  }
  h+='</div>';
 }
 return h;
}
export function attendanceFamilyUI({rows=[],loading=false,error=false,calls=[],callsError=false,esc}){
 let h='<h2>Presença dos meus filhos</h2><p class="mut">Registros de hoje feitos pela equipe.</p><button class="btn ghost" data-a="attendance-refresh">Atualizar</button>';
 if(loading)return h+'<p class="mut">Carregando…</p>';
 h+=familyCallsUI(calls,callsError,esc);
 if(error)return h+'<div class="alert">Não foi possível consultar os registros. Confirme presencialmente com a equipe.</div>';
 if(!rows.length)return h+'<div class="card">Nenhuma entrada registrada hoje.</div>';
 return h+rows.map(x=>'<div class="card"><strong>'+esc(x.nome)+'</strong><p class="mut">'+esc(x.numero)+' · '+esc(ATTENDANCE_CULTS[x.culto]||x.culto)+'</p><span class="tag">'+(x.estado==='presente'?'Presente':'Saiu')+'</span><p class="mut">Entrada: '+esc(hh(x.entrada_em))+(x.saida_em?' · Saída: '+esc(hh(x.saida_em)):'')+'</p></div>').join('');
}

const callStatus={enviado:'Aguardando resposta no aplicativo',visto:'Responsável confirmou leitura',a_caminho:'Responsável está a caminho'};
function teamCallUI(row,calls,error,esc){
 if(error)return '<div class="alert">Chamados indisponíveis. Use o contato presencial ou canal habitual.</div>';
 const active=calls.filter(c=>c.crianca_id===row.crianca_id);
 const id=esc(row.crianca_id);
 if(!active.length)return '<div class="card"><button type="button" class="btn ghost" data-a="attendance-call" data-id="'+id+'">Chamar responsável</button><p class="mut">Chamado no aplicativo. Ainda não há alerta em segundo plano; use também o canal habitual.</p></div>';
 return '<div class="card"><strong>Chamado em aberto</strong>'+active.map(c=>'<p class="mut">'+esc(callStatus[c.status]||c.status)+'</p>').join('')+
 '<button type="button" class="btn ghost" data-a="attendance-call-end" data-status="resolvido" data-id="'+id+'">Resolver chamado</button>'+
 '<button type="button" class="btn ghost" data-a="attendance-call-end" data-status="sem_resposta" data-id="'+id+'">Registrar sem resposta</button>'+
 '<button type="button" class="btn ghost" data-a="attendance-call-end" data-status="cancelado" data-id="'+id+'">Cancelar chamado</button></div>';
}
function familyCallsUI(calls,error,esc){
 if(error)return '<div class="alert">Não foi possível consultar os chamados. Confira o canal habitual da equipe.</div>';
 if(!calls.length)return '';
 return '<h3 class="kids-section">Chamados da equipe</h3>'+calls.map(c=>'<div class="card"><strong>A equipe solicita sua presença</strong><p>'+esc(c.nome)+' · '+esc(c.numero)+'</p><p class="mut">'+esc(callStatus[c.status]||c.status)+'</p>'+
 (c.status==='enviado'?'<button type="button" class="btn ghost" data-a="family-call-response" data-status="visto" data-id="'+esc(c.id)+'">Li o chamado</button>':'')+
 (c.status!=='a_caminho'?'<button type="button" class="btn pri" data-a="family-call-response" data-status="a_caminho" data-id="'+esc(c.id)+'">Estou indo</button>':'<p class="mut">Avise a equipe presencialmente ao chegar.</p>')+'</div>').join('');
}
