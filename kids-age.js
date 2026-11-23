// Escala Kids — classificação etária. Funções puras; sem dados pessoais persistidos.
// A data de referência usa America/Sao_Paulo, como o PostgreSQL do Kids.
export function parseISODate(value){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
  const [year,month,day]=value.split('-').map(Number);
  if(year<1900||year>2100||month<1||month>12||day<1||day>31)return null;
  const d=new Date(Date.UTC(year,month-1,day));
  if(d.getUTCFullYear()!==year||d.getUTCMonth()!==month-1||d.getUTCDate()!==day)return null;
  return {year,month,day};
}
export function dateInSaoPaulo(now=new Date()){
  const parts=new Intl.DateTimeFormat('en-US',{
    timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',
  }).formatToParts(now);
  const get=type=>parts.find(p=>p.type===type)?.value;
  return get('year')+'-'+get('month')+'-'+get('day');
}
export function completeMonths(birth,today=dateInSaoPaulo()){
  const b=parseISODate(birth),t=parseISODate(today);
  if(!b||!t)return null;
  const months=(t.year-b.year)*12+(t.month-b.month)-(t.day<b.day?1:0);
  return months<0?null:months;
}
export function suggestedClass(birth,classes=[],today=dateInSaoPaulo()){
  const ageMonths=completeMonths(birth,today);
  if(ageMonths===null||ageMonths>215)return {status:'data_invalida',ageMonths:null,room:null};
  const matches=classes.filter(c=>c.ativa&&Number.isInteger(Number(c.idade_min_meses))&&
    Number.isInteger(Number(c.idade_max_meses))&&
    ageMonths>=Number(c.idade_min_meses)&&ageMonths<=Number(c.idade_max_meses));
  if(matches.length===0)return {status:'sem_turma',ageMonths,room:null};
  if(matches.length>1)return {status:'ambigua',ageMonths,room:null};
  return {status:'ok',ageMonths,room:matches[0]};
}
