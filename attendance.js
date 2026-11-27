// Attendance: no storage of children's data, no offline writes.
export const ATTENDANCE_CULTS={domingo_manha:'Domingo · manhã',domingo_noite:'Domingo · noite',quarta_noite:'Quarta · noite'};
export function attendanceCults(day){const n=new Date(day+'T12:00:00Z').getUTCDay();return n===0?['domingo_manha','domingo_noite']:n===3?['quarta_noite']:[];}
export function attendanceCounts(rows){return {total:rows.length,present:rows.filter(x=>x.estado==='presente').length,left:rows.filter(x=>x.estado==='saiu').length,pending:rows.filter(x=>x.estado==='nao_registrada').length};}
const hh=v=>v?new Date(v).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',timeZone:'America/Sao_Paulo'}):'—';
export function attendanceTeamUI({rows=[],culto='',day='',loading=false,error=false,esc}){
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
   if(!row.responsaveis?.length)h+='<p class="mut">Nenhum responsável confirmado. Não libere a criança pelo aplicativo; chame a liderança.</p>';
   else h+='<details><summary>Registrar retirada</summary><form data-form="attendance-register" class="kids-form"><input type="hidden" name="attendance-child" value="'+esc(row.crianca_id)+'"><input type="hidden" name="attendance-action" value="saida"><label>Responsável vinculado<select required class="in" name="attendance-guardian"><option value="">Selecione após identificar</option>'+row.responsaveis.map(g=>'<option value="'+esc(g.id)+'">'+esc(g.nome)+'</option>').join('')+'</select></label><label class="kids-consent"><input required type="checkbox" name="attendance-checked"> Conferi presencialmente a identidade e a autorização de retirada.</label><p class="mut">O aplicativo não verifica documentos nem substitui a conferência presencial.</p><button type="submit" class="btn ghost">Confirmar saída</button></form></details>';
  }
  h+='</div>';
 }
 return h;
}
export function attendanceFamilyUI({rows=[],loading=false,error=false,esc}){
 let h='<h2>Presença dos meus filhos</h2><p class="mut">Registros de hoje feitos pela equipe.</p><button class="btn ghost" data-a="attendance-refresh">Atualizar</button>';
 if(loading)return h+'<p class="mut">Carregando…</p>';
 if(error)return h+'<div class="alert">Não foi possível consultar os registros. Confirme presencialmente com a equipe.</div>';
 if(!rows.length)return h+'<div class="card">Nenhuma entrada registrada hoje.</div>';
 return h+rows.map(x=>'<div class="card"><strong>'+esc(x.nome)+'</strong><p class="mut">'+esc(x.numero)+' · '+esc(ATTENDANCE_CULTS[x.culto]||x.culto)+'</p><span class="tag">'+(x.estado==='presente'?'Presente':'Saiu')+'</span><p class="mut">Entrada: '+esc(hh(x.entrada_em))+(x.saida_em?' · Saída: '+esc(hh(x.saida_em)):'')+'</p></div>').join('');
}
