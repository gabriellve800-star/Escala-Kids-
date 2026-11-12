// Escala Kids v1.2.5 — calendários reais, sem modificar autenticação ou convites.
export const CULTOS = Object.freeze({
  domingo_manha:'Domingo de manhã',
  domingo_noite:'Domingo à noite',
  quarta_noite:'Quarta-feira à noite',
});
export const TURMAS_SUGERIDAS = ['Berçário','Maternal','Infantil','Pré-adolescentes'];
export const isISODate = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value||'')) &&
  !Number.isNaN(new Date(value+'T12:00:00').getTime()) &&
  isoLocal(new Date(value+'T12:00:00'))===value;
export const isoLocal = d => [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
export const firstMonth = (offset=0, now=new Date()) => isoLocal(new Date(now.getFullYear(),now.getMonth()+offset,1,12));
export const lastMonthExclusive = (offset=0,now=new Date()) => firstMonth(offset+1,now);
export const monthTitle = iso => new Date(iso+'T12:00:00').toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
export const dayTitle = iso => new Date(iso+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'});
export function slotsForDate(iso){
  if(!isISODate(iso))return [];
  const weekday=new Date(iso+'T12:00:00').getDay();
  if(weekday===0)return ['domingo_manha','domingo_noite'];
  if(weekday===3)return ['quarta_noite'];
  return [];
}
export const validSlot = (dia,culto) => slotsForDate(dia).includes(culto);
export const shortTime = s => String(s||'').slice(0,5);
export const sortedShifts = values => [...values].sort((a,b)=>(a.dia+'T'+shortTime(a.horario)).localeCompare(b.dia+'T'+shortTime(b.horario)));
export function nextShift(rows,now=new Date()){
  const future=sortedShifts(rows).filter(x=>validSlot(x.dia,x.culto) &&
    new Date(x.dia+'T'+shortTime(x.horario)+':00').getTime()>=now.getTime());
  return future[0]||null;
}
export function monthDays(month){
  if(!isISODate(month))return [];
  const first=new Date(month+'T12:00:00');
  const days=new Date(first.getFullYear(),first.getMonth()+1,0).getDate();
  return Array.from({length:days},(_,i)=>isoLocal(new Date(first.getFullYear(),first.getMonth(),i+1,12)));
}
const weekdays=['D','S','T','Q','Q','S','S'];
function grid(month,renderCell){
  const days=monthDays(month);
  const offset=new Date(month+'T12:00:00').getDay();
  return '<div class="agenda-calendar" role="group" aria-label="Calendário de '+monthTitle(month)+'">'+
    weekdays.map((w,i)=>'<span class="agenda-weekday" aria-label="'+['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'][i]+'">'+w+'</span>').join('')+
    Array.from({length:offset},()=>'<span aria-hidden="true"></span>').join('')+
    days.map(d=>renderCell(d)).join('')+'</div>';
}
export function volunteerAgendaUI({rows=[],availability=[],draftSelection=null,selectedDate,labels={},esc}){
  const current=firstMonth();
  const next=firstMonth(1);
  const upcoming=nextShift(rows);
  const mine=sortedShifts(rows.filter(x=>x.dia>=current && x.dia<lastMonthExclusive()));
  const saved=new Set(availability.map(a=>a.dia+'|'+a.culto));
  const available=draftSelection || saved;
  const select=slotsForDate(selectedDate).length && selectedDate>=next && selectedDate<firstMonth(2)
    ? selectedDate:monthDays(next).find(d=>slotsForDate(d).length);
  const dayRows=rows.filter(x=>x.dia===select);
  const head=upcoming
    ? '<div class="agenda-next-card"><div class="agenda-eyebrow">SUA PRÓXIMA ESCALA</div><div class="agenda-next-day"><strong>'+
      esc(new Date(upcoming.dia+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit'}))+'</strong><div>'+
      esc(new Date(upcoming.dia+'T12:00:00').toLocaleDateString('pt-BR',{month:'long',weekday:'long'}))+
      '</div></div><h3>'+esc(CULTOS[upcoming.culto]||upcoming.culto)+'</h3><p class="agenda-next-info">'+
      esc(shortTime(upcoming.horario))+' · Turma '+esc(upcoming.turma)+'</p><span class="agenda-next-tag">'+esc(labels[upcoming.funcao]||upcoming.funcao)+'</span></div>'
    : '<div class="agenda-next-card"><div class="agenda-eyebrow">SUA PRÓXIMA ESCALA</div><h3>Aguardando a próxima escala</h3><p class="agenda-next-info">Quando a liderança publicar seu dia de serviço, ele aparecerá aqui.</p></div>';
  return '<h2>Minha Escala</h2><p class="mut">Seu serviço no Kids, sempre organizado.</p>'+head+
   '<section class="card agenda-panel"><div class="agenda-section-title"><h3>Minhas escalas</h3><span>'+esc(monthTitle(current))+'</span></div>'+
   grid(current,d=>{
     const has=mine.some(x=>x.dia===d);
     return '<div class="agenda-date '+(has?'agenda-assigned':'')+(d===isoLocal(new Date())?' agenda-today':'')+'" aria-label="'+esc(dayTitle(d))+(has?' com escala':'')+'">'+
       '<span>'+Number(d.slice(-2))+'</span>'+(has?'<i aria-hidden="true"></i>':'')+'</div>';
   })+
   (mine.length?'<div class="agenda-items">'+mine.map(x=>'<div class="agenda-row"><span class="agenda-row-day">'+
      esc(new Date(x.dia+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}))+'</span><div><strong>'+
      esc(CULTOS[x.culto]||x.culto)+'</strong><small>'+esc(shortTime(x.horario))+' · '+esc(x.turma)+' · '+esc(labels[x.funcao]||x.funcao)+'</small></div></div>').join('')+'</div>'
      :'<p class="agenda-empty">Nenhuma escala publicada para este mês.</p>')+'</section>'+
   '<section class="card agenda-panel"><div class="agenda-section-title"><h3>Quando posso servir?</h3><span>'+esc(monthTitle(next))+'</span></div>'+
   '<p class="mut agenda-help">Selecione os períodos em que pode servir. Depois, toque em Enviar.</p>'+
   grid(next,d=>{
     const opts=slotsForDate(d),count=opts.filter(c=>available.has(d+'|'+c)).length;
     const changed=opts.some(c=>available.has(d+'|'+c)!==saved.has(d+'|'+c));
     const pendingRemoval=opts.some(c=>saved.has(d+'|'+c)&&!available.has(d+'|'+c));
     return opts.length?'<button type="button" class="agenda-date agenda-date-button '+(d===select?'agenda-selected ':'')+(count?'agenda-available ':'')+(changed?'agenda-date-draft ':'')+(pendingRemoval?'agenda-date-removal ':'')+
      '" data-a="agenda-day" data-day="'+d+'" aria-pressed="'+(d===select)+'" aria-label="'+esc(dayTitle(d))+', '+count+' horários disponíveis"><span>'+
      Number(d.slice(-2))+'</span>'+(count?'<i aria-hidden="true"></i>':'')+'</button>':
      '<span class="agenda-date agenda-date-muted">'+Number(d.slice(-2))+'</span>';
   })+
   '<div class="agenda-select-panel"><div class="agenda-selected-title">'+esc(dayTitle(select))+'</div>'+
   '<div class="agenda-slots">'+slotsForDate(select).map(c=>{
     const checked=available.has(select+'|'+c),wasSent=saved.has(select+'|'+c);
     const pending=checked!==wasSent,label=c==='domingo_manha'?'Manhã':c==='domingo_noite'?'Noite':'Noite · Quarta-feira';
     const suffix=pending?(checked?' · Selecionado':' · Retirar'):(checked?' · Enviado':'');
     return '<button type="button" class="agenda-slot '+(checked?'on ':'')+(wasSent&&!pending?'sent ':'')+
       (pending?(checked?'pending ':' : 'pending-remove '):'')+'" data-a="agenda-toggle" data-day="'+select+'" data-culto="'+c+
      '" aria-pressed="'+checked+'" aria-label="'+esc(label+suffix)+'">'+esc(label)+'<span class="agenda-slot-status">'+esc(suffix)+'</span></button>';
   }).join('')+'</div><p class="agenda-hint">Toque para marcar ou desmarcar. Pontos verdes indicam dias disponíveis.</p></div>'+
   '<p class="agenda-count" data-agenda-count aria-live="polite">'+available.size+' período(s) selecionado(s) para o próximo mês.</p>'+
   (dayRows.length?'<p class="agenda-hint">Você já tem escala publicada neste dia.</p>':'')+
   '</section>';
}
export function leaderAgendaUI({rows=[],availability=[],people=[],labels={},esc}){
  const candidates=people.filter(p=>p.status==='ativo'&&!p.primeiro_acesso);
  const today=isoLocal(new Date());
  const future=sortedShifts(rows.filter(x=>x.dia>=today)).slice(0,35);
  const month=firstMonth(1);
  const avail=availability.filter(x=>x.dia>=month&&x.dia<firstMonth(2)).sort((a,b)=>
   (a.dia+a.culto).localeCompare(b.dia+b.culto));
  const name=id=>people.find(p=>p.id===id)?.nome||'Voluntário';
  return '<h2>Escalas da equipe</h2><p class="mut">Organize os cultos e atribua as turmas aos voluntários.</p>'+
   '<section class="card agenda-panel"><h3>Adicionar escala</h3><form data-form="schedule">'+
   '<div class="field"><label for="agenda-person">Pessoa</label><select class="in" id="agenda-person" name="agenda-person" required>'+
     '<option value="">Selecione um voluntário</option>'+candidates.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.nome)+' · '+esc(({voluntario:'Voluntário',lider:'Líder',administrador:'Administrador'})[p.perfil]||'Equipe')+'</option>').join('')+'</select></div>'+
   '<div class="fieldgrid"><div class="field"><label for="agenda-date">Dia</label><input class="in" id="agenda-date" name="agenda-date" type="date" min="'+today+'" required></div>'+
   '<div class="field"><label for="agenda-time">Horário</label><input class="in" id="agenda-time" name="agenda-time" type="time" required></div></div>'+
   '<div class="field"><label for="agenda-culto">Culto</label><select class="in" id="agenda-culto" name="agenda-culto">'+
     Object.entries(CULTOS).map(([k,v])=>'<option value="'+k+'">'+esc(v)+'</option>').join('')+'</select></div>'+
   '<div class="fieldgrid"><div class="field"><label for="agenda-turma">Turma</label><input class="in" id="agenda-turma" name="agenda-turma" type="text" minlength="2" maxlength="80" list="agenda-turmas" placeholder="Ex.: Maternal" required><datalist id="agenda-turmas">'+
     TURMAS_SUGERIDAS.map(x=>'<option value="'+esc(x)+'">').join('')+'</datalist></div>'+
   '<div class="field"><label for="agenda-funcao">Função</label><select class="in" id="agenda-funcao" name="agenda-funcao">'+
     Object.entries(labels).filter(([id])=>['professor','auxiliar','lanche','portaria'].includes(id)).map(([id,label])=>'<option value="'+esc(id)+'">'+esc(label)+'</option>').join('')+'</select></div></div>'+
   '<button class="btn pri" type="submit">Publicar escala</button></form></section>'+
   '<section class="card agenda-panel"><div class="agenda-section-title"><h3>Próximas escalas</h3><span>'+future.length+' agendamento(s)</span></div>'+
     (future.length?future.map(x=>'<div class="agenda-team-row"><div><strong>'+esc(name(x.pessoa_id))+'</strong><small>'+
       esc(dayTitle(x.dia))+' · '+esc(CULTOS[x.culto]||x.culto)+' · '+esc(shortTime(x.horario))+
       '<br>'+esc(x.turma)+' · '+esc(labels[x.funcao]||x.funcao)+'</small></div><button type="button" class="agenda-remove" data-a="agenda-remove" data-id="'+esc(x.id)+'" aria-label="Remover escala de '+esc(name(x.pessoa_id))+'">Remover</button></div>').join('')
       :'<p class="agenda-empty">Nenhuma escala futura publicada.</p>')+'</section>'+
   '<section class="card agenda-panel"><div class="agenda-section-title"><h3>Disponibilidade recebida</h3><span>'+esc(monthTitle(month))+'</span></div>'+
   (avail.length?avail.map(x=>'<div class="agenda-team-row"><div><strong>'+esc(name(x.pessoa_id))+'</strong><small>'+
      esc(dayTitle(x.dia))+' · '+esc(CULTOS[x.culto]||x.culto)+'</small></div><span class="tag">Disponível</span></div>').join('')
       :'<p class="agenda-empty">Os voluntários ainda não informaram disponibilidades para o próximo mês.</p>')+
   '</section>';
}
