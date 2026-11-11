// ESCALA KIDS | FASE 1
// A folha CSS é a do protótipo v2. Nesta fase, os dados vêm de Supabase.
// Funções de escala, check-in e crianças serão conectadas nas próximas fases.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0?bundle';
import { config } from './config.js';

const $ = (sel) => document.querySelector(sel);
const esc = (v = '') => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const FN = { professor:'Professor', auxiliar:'Auxiliar', lanche:'Lanche', portaria:'Portaria' };
const PF = { administrador:'Administrador', lider:'Líder', voluntario:'Voluntário' };
const cleanUsername = (s) => String(s || '').trim().toLowerCase();
const IC = {
  home:'<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  cal:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
  users:'<circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-3.5 3-5.5 7-5.5s7 2 7 5.5M17 4.5a3.5 3.5 0 0 1 0 7M19 15c2 .8 3 2.4 3 5"/>',
  list:'<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
};
const ico = (name) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${IC[name] || IC.home}</svg>`;
const TOK = { login:'login', signup:'signup', wait:'wait' };
const params = new URLSearchParams(location.search);
const rawInvite = params.get('convite');
// Não deixa tokens de convite no histórico depois de carregar a página.
if (rawInvite) history.replaceState(null, '', location.pathname);
const state = {
  user:null, profile:null, auth:rawInvite?TOK.signup:TOK.login,
  invitation:rawInvite || '', people:[], functions:[], invites:[], audit:[],
  tab:'inicio', drafts:{}, modal:null, busy:false, toast:'', error:'',
  currentInvitation:'', demoTheme:'',
};
let sb;
let toastTimer;
const isReady = () => /^https:\/\//.test(config.supabaseUrl || '') &&
  /^(sb_publishable_|eyJ)/.test(config.publishableKey || '') &&
  !config.supabaseUrl.includes('COLE_') && !config.publishableKey.includes('COLE_') &&
  /^[a-z0-9.-]+\.[a-z]{2,}$/.test(config.loginDomain || '');
const toMail = user => `${cleanUsername(user)}@${config.loginDomain.trim().toLowerCase()}`;
const isAdmin = () => state.profile?.perfil === 'administrador';
const canApprove = () => isAdmin() || (state.profile?.perfil === 'lider' && state.profile?.pode_aprovar);
const isLeader = () => isAdmin() || state.profile?.perfil === 'lider';
const canWork = () => state.profile?.status === 'ativo' && !state.profile.primeiro_acesso;
const first = () => state.profile?.nome?.split(' ')[0] || 'Olá';

function field(id, label, type='text', extra='') {
  return `<div class="field"><label for="${id}">${esc(label)}</label><input class="in" id="${id}" name="${id}" type="${esc(type)}" ${extra}></div>`;
}
function notify(message, error=false) {
  state.toast=message; state.error=error?message:'';
  renderToast();
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>{state.toast='';document.querySelector('.toast')?.remove()},4000);
}
function renderToast() {
  document.querySelector('.toast')?.remove();
  if (!state.toast) return;
  const d=document.createElement('div');d.className='toast';d.setAttribute('role','status');
  d.textContent=state.toast;$('#app').append(d);
}
function renderHeader() {
  $('#seg').innerHTML=state.user && canWork()
    ? `<span class="mut" style="padding:0 10px;align-self:center">${esc(first())}</span><button data-a="out" aria-label="Sair da conta">Sair</button>` : '';
}
function tabs() {
  if (!state.user || !canWork()) return [];
  if (isAdmin()) return [['aprov','Aprovações','list'],['pessoas','Pessoas','users'],['convites','Convites','cal'],['auditoria','Auditoria','user']];
  if (isLeader()) return [['escala','Escala','cal'],['equipe','Equipe','users'],
    ...(canApprove()?[['aprov','Aprovações','list'],['convites','Convites','user']]:[])];
  return [['inicio','Início','home'],['disp','Disponibilidade','cal'],['perfil','Perfil','user']];
}
function renderNav() {
  $('#nav').innerHTML=tabs().map(([id,name,icon]) =>
    `<button class="${state.tab===id?'on':''}" data-a="tab" data-tab="${id}" aria-current="${state.tab===id?'page':'false'}">${ico(icon)}${name}</button>`).join('');
  $('#nav').style.display=tabs().length?'flex':'none';
}
function authUI() {
  if (!isReady()) return `<h2>Configurar Escala Kids</h2><p class="mut">O aplicativo está preparado, mas ainda não está ligado ao banco de dados. Preencha o arquivo config.js e configure o Supabase conforme o manual da Fase 1.</p>`;
  if (state.user && state.profile && !canWork()) {
    if (state.profile.primeiro_acesso && state.profile.status==='ativo')
      return `<h2>Crie sua senha definitiva</h2><p class="mut">A senha temporária vale só no primeiro acesso. Use 10 ou mais caracteres com maiúscula, minúscula, número e símbolo.</p>
        <form data-form="password">${field('p1','Nova senha','password','autocomplete="new-password" required minlength="10"')}${field('p2','Repita a senha','password','autocomplete="new-password" required minlength="10"')}
        <div style="height:10px"></div><button class="btn pri" type="submit" ${state.busy?'disabled':''}>Salvar e entrar</button></form>`;
    if (state.profile.status==='pendente') return `<div class="card" style="margin-top:28px"><h2>Cadastro em análise</h2><p class="mut">Seu cadastro foi recebido. Um administrador ou líder autorizado precisa aprovar seu acesso.</p></div><button class="btn ghost" data-a="reload">Verificar aprovação</button><div style="height:8px"></div><button class="btn ghost" data-a="out">Sair</button>`;
    return `<div class="card" style="margin-top:28px"><h2>Acesso ${state.profile.status==='recusado'?'não aprovado':'indisponível'}</h2><p class="mut">Fale com a liderança do ministério para esclarecer sua situação.</p></div><button class="btn ghost" data-a="out">Sair</button>`;
  }
  if (state.auth==='wait') return `<div class="card" style="margin-top:24px"><h2>Cadastro enviado</h2><p class="mut">Quando a liderança aprovar, você poderá entrar com seu nome de usuário e senha.</p></div><button class="btn ghost" data-a="login">Voltar ao início</button>`;
  if (state.auth==='signup') return `<h2>Criar seu acesso</h2><p class="mut">Você recebeu um convite do ministério Kids. Depois do envio, um responsável aprova seu cadastro.</p>
    <form data-form="signup">
      ${field('sn','Nome completo','text','autocomplete="name" required minlength="3" maxlength="120"')}
      ${field('su','Nome de usuário','text','autocomplete="username" required pattern="[A-Za-z][A-Za-z0-9._-]{2,25}"')}
      ${field('sf','Telefone','tel','autocomplete="tel" required inputmode="tel"')}
      ${field('sp','Senha','password','autocomplete="new-password" required minlength="10"')}
      <p class="helper">Pelo menos 10 caracteres, incluindo letra maiúscula, minúscula, número e símbolo.</p>
      ${field('sc','Código de convite','text',`required value="${esc(state.invitation)}"`)}
      <div style="height:12px"></div><button class="btn pri" type="submit" ${state.busy?'disabled':''}>Enviar cadastro</button>
    </form><div style="height:8px"></div><button class="btn ghost" data-a="login">Voltar</button>`;
  return `<div class="hero" style="margin-top:14px"><h2 style="margin:0 0 8px">Bem-vindo ao Escala Kids</h2><p>Entre para ver sua escala e cuidar dos pequenos.</p></div>
    <form data-form="login">${field('lu','Usuário ou e-mail','text','autocomplete="username" required')}${field('lp','Senha','password','autocomplete="current-password" required')}
      <div style="height:10px"></div><button class="btn pri" type="submit" ${state.busy?'disabled':''}>Entrar</button></form>
    <div style="height:8px"></div><button class="btn ghost" data-a="signup">Tenho um convite</button>`;
}
function functionsOf(id) { return state.functions.filter(x=>x.pessoa_id===id).map(x=>x.funcao); }
function draftOf(person) {
  if (!state.drafts[person.id]) state.drafts[person.id]={
    perfil:person.perfil,status:person.status,pode_aprovar:person.pode_aprovar,funcoes:functionsOf(person.id),
  };
  return state.drafts[person.id];
}
function roleChip(person, allowAdmin) {
  const d=draftOf(person), role=d.perfil;
  return `<button class="chip on" data-a="role" data-id="${person.id}" data-alladmin="${allowAdmin?'true':'false'}">${esc(PF[role])}<small>Perfil, toque para alterar</small></button>`;
}
function functionChips(person) {
  const d=draftOf(person);
  return `<div class="pillset">${Object.keys(FN).map(f=>
    `<button class="chip ${d.funcoes.includes(f)?'on':''}" data-a="fn" data-id="${person.id}" data-f="${f}" aria-pressed="${d.funcoes.includes(f)}">${FN[f]}</button>`).join('')}</div>`;
}
function approvalsUI() {
  if (!canApprove()) return `<h2>Sem permissão</h2>`;
  const pending=state.people.filter(p=>p.status==='pendente');
  let h=`<h2>Aprovações</h2><p class="mut">Defina perfil e funções de cada pessoa antes de aprovar.</p><div style="height:12px"></div>`;
  if (!pending.length) return h+`<div class="card"><p class="mut">Nenhum cadastro aguardando. Quando alguém entrar pelo seu convite, aparece aqui.</p></div>`;
  for (const p of pending) {
    const d=draftOf(p);
    h+=`<div class="card"><div class="row" style="border:0;padding:0 0 10px"><span class="who">${esc(p.nome)}</span><span class="mut">@${esc(p.usuario)}</span></div>
      ${roleChip(p,isAdmin())}${functionChips(p)}
      ${d.perfil==='lider'&&isAdmin()?`<div class="row" style="border:0"><span>Pode aprovar cadastros</span><button class="tog ${d.pode_aprovar?'on':''}" data-a="ap" data-id="${p.id}" role="switch" aria-checked="${d.pode_aprovar}" aria-label="Permissão de aprovar: ${esc(p.nome)}"></button></div>`:''}
      <div class="row actions" style="border:0;padding:12px 0 0"><button class="btn ghost" data-a="reject" data-id="${p.id}">Recusar</button><button class="btn pri" data-a="approve" data-id="${p.id}">Aprovar</button></div></div>`;
  }
  return h;
}
function peopleUI() {
  if (!isAdmin()) return `<h2>Sem permissão</h2>`;
  let h=`<h2>Pessoas</h2><p class="mut">Perfis e permissões. Só o administrador altera isto.</p><div style="height:12px"></div>`;
  const people=state.people.filter(p=>p.status==='ativo'||p.status==='desativado');
  if (!people.length) return h+'<div class="card">Nenhuma pessoa cadastrada.</div>';
  for (const p of people) {
    const d=draftOf(p);
    h+=`<div class="card"><div class="row" style="border:0;padding:0 0 10px"><div><span class="who">${esc(p.nome)}</span><br><span class="mut">@${esc(p.usuario)}</span></div><span class="tag ${p.status==='desativado'?'warn':''}">${p.status==='desativado'?'Desativado':'Ativo'}</span></div>
      ${roleChip(p,true)}${functionChips(p)}
      ${d.perfil==='lider'?`<div class="row" style="border:0"><span class="mini">Pode aprovar cadastros</span><button class="tog ${d.pode_aprovar?'on':''}" data-a="ap" data-id="${p.id}" role="switch" aria-checked="${d.pode_aprovar}" aria-label="Pode aprovar: ${esc(p.nome)}"></button></div>`:''}
      ${p.id!==state.user.id?`<div class="row" style="border:0"><span class="mini">Conta ${d.status==='ativo'?'ativa':'desativada'}</span><button class="chip ${d.status==='ativo'?'on':''}" data-a="status" data-id="${p.id}">${d.status==='ativo'?'Desativar':'Reativar'}</button></div>`:''}
      <button class="btn pri" style="margin-top:12px" data-a="saveperson" data-id="${p.id}">Salvar alterações</button></div>`;
  }
  return h;
}
function invitesUI() {
  if (!canApprove()) return '<h2>Sem permissão</h2>';
  let h=`<h2>Convites</h2><p class="mut">Envie um link para cadastrar novos voluntários. O cadastro ainda precisa ser aprovado.</p>
  <div class="card" style="margin-top:16px"><h3>Criar convite</h3><form data-form="invite">
  ${field('days','Validade em dias','number','min="1" max="30" value="7" required')}
  ${field('uses','Número máximo de usos','number','min="1" max="50" value="1" required')}
  <div style="height:10px"></div><button class="btn pri" type="submit">Gerar convite</button></form></div>`;
  if (state.currentInvitation) {
    h+=`<div class="card" style="background:var(--mint)"><h3 style="color:var(--mintink)">Convite criado</h3>
    <p class="mini" style="margin:9px 0;color:var(--mintink);word-break:break-all">${esc(state.currentInvitation)}</p>
    <button class="btn pri" data-a="copy">Copiar link</button><p class="micro" style="margin-top:8px;color:var(--mintink)">Copie agora. Por segurança, o código completo não é exibido novamente.</p></div>`;
  }
  h+=`<h3 style="margin:18px 0 10px">Convites emitidos</h3>`;
  if (!state.invites.length) return h+'<div class="card"><p class="mut">Ainda não há convites.</p></div>';
  for (const c of state.invites) {
    const valid=!c.revogado&&new Date(c.expira_em)>new Date()&&c.usos<c.usos_max;
    h+=`<div class="card"><div class="row" style="padding:0"><span class="who">${valid?'Convite ativo':'Convite encerrado'}</span><span class="tag ${valid?'':'warn'}">${c.usos} / ${c.usos_max} usos</span></div>
    <p class="mut" style="margin:10px 0 0">Válido até ${esc(new Date(c.expira_em).toLocaleString('pt-BR'))}</p>
    ${valid?`<button class="btn ghost" style="margin-top:12px" data-a="revoke" data-id="${c.id}">Revogar convite</button>`:''}</div>`;
  }
  return h;
}
function auditUI() {
  if (!isAdmin()) return '<h2>Sem permissão</h2>';
  let h='<h2>Auditoria</h2><p class="mut">Registro das decisões de acesso. Apenas o administrador vê esta página.</p><div style="height:12px"></div>';
  if (!state.audit.length) return h+'<div class="card"><p class="mut">Nenhuma ação registrada ainda.</p></div>';
  for(const r of state.audit) {
    const who=state.people.find(p=>p.id===r.quem)?.nome || 'Sistema';
    h+=`<div class="card"><h3>${esc((r.acao||'ação').replaceAll('_',' '))}</h3><p class="mut" style="margin-top:7px">${esc(who)} · ${esc(new Date(r.quando).toLocaleString('pt-BR'))}</p></div>`;
  }
  return h;
}
function badgesUI() {
  const b=[['Pontual','var(--sun)','var(--sunink)','<circle cx="12" cy="13" r="7"/><path d="M12 9v4l3 2M9 3h6"/>'],
    ['Sala organizada','var(--mint)','var(--mintink)','<path d="M4 20V9l8-5 8 5v11zM9 20v-6h6v6"/>'],
    ['Constante','var(--rose)','var(--roseink)','<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.3 6L12 16.4 6.6 19.4l1.3-6L3.4 9.3l6-.7z"/>']];
  return `<div class="badges">${b.map(x=>`<div class="badge"><div class="b" style="background:${x[1]};color:${x[2]}"><svg class="i" style="width:30px;height:30px" viewBox="0 0 24 24">${x[3]}</svg></div>${x[0]}</div>`).join('')}</div>`;
}
function homeUI() {
  return `<div class="hero"><p>Seu próximo turno</p><div style="margin:12px 0 14px"><h2 style="font-size:26px">Aguardando primeira escala</h2></div>
    <p>As escalas reais serão ativadas na fase 2.</p><button class="btn sun" disabled>Fazer check-in</button></div>
    <div class="card"><h3>Seus selos</h3><p class="mut" style="margin:4px 0 12px">Cada selo reconhece uma forma de servir bem.</p>${badgesUI()}</div>
    <div class="card"><h3>Santa Ceia</h3><p class="mut">Quem serviu em uma Santa Ceia descansa da seguinte. Essa regra será aplicada às escalas reais na fase 2.</p></div>`;
}
function profileUI() {
  const p=state.profile;
  const fs=functionsOf(p.id);
  return `<h2>${esc(p.nome)}</h2><p class="mut">${fs.length?esc(fs.map(f=>FN[f]).join(' e ')):'Funções a definir pela liderança'}</p>
    <div class="card" style="margin-top:18px"><h3>Seu acesso</h3><div class="row"><span class="mut">Usuário</span><span class="who">@${esc(p.usuario)}</span></div>
    <div class="row"><span class="mut">Perfil</span><span class="who">${esc(PF[p.perfil])}</span></div><div class="row"><span class="mut">Situação</span><span class="tag">Ativo</span></div></div>
    <div class="card"><h3>Selos conquistados</h3><p class="mut" style="margin:5px 0 12px">O registro real de selos será vinculado aos serviços da fase 2.</p>${badgesUI()}</div>`;
}
function waitingUI(title, description) {return `<h2>${esc(title)}</h2><p class="mut">${esc(description)}</p><div class="card" style="margin-top:16px"><h3>Próxima etapa</h3><p class="mut" style="margin-top:6px">Seu acesso já está protegido. Este recurso será conectado ao banco na próxima fase.</p></div>`;}
function teamUI() {
  const people=state.people.filter(p=>p.status==='ativo');
  let h='<h2>Equipe</h2><p class="mut">Pessoas do ministério. Os indicadores de cuidado entram com as escalas reais na fase 2.</p><div style="height:12px"></div>';
  for(const p of people) h+=`<div class="card"><div class="row" style="border:0;padding:0"><div><span class="who">${esc(p.nome)}</span><br><span class="mut">${esc(functionsOf(p.id).map(f=>FN[f]).join(', ')||'Funções a definir')}</span></div><span class="tag">${esc(PF[p.perfil])}</span></div></div>`;
  return h;
}
function activeUI() {
  switch(state.tab) {
    case 'aprov':return approvalsUI();
    case 'pessoas':return peopleUI();
    case 'convites':return invitesUI();
    case 'auditoria':return auditUI();
    case 'equipe':return teamUI();
    case 'perfil':return profileUI();
    case 'disp':return waitingUI('Quando você pode servir?','As disponibilidades reais serão ativadas na fase 2.');
    case 'escala':return waitingUI('Escala','A geração e publicação reais das 12 vagas serão ativadas na fase 2.');
    default:return homeUI();
  }
}
function renderModal() {
  document.querySelector('.sheet')?.remove();
  if (!state.modal) return;
  const {title,description}=state.modal;
  const d=document.createElement('div');d.className='sheet';d.setAttribute('role','dialog');d.setAttribute('aria-modal','true');
  d.innerHTML=`<div><h2>${esc(title)}</h2><p class="mut" style="margin:12px 0 18px">${esc(description)}</p>
    <button class="btn pri" data-a="confirm">Confirmar</button><div style="height:8px"></div><button class="btn ghost" data-a="cancel">Cancelar</button></div>`;
  $('#app').appendChild(d);
}
function render() {
  renderHeader(); renderNav();
  $('#main').innerHTML=state.user && canWork()?activeUI():authUI();
  renderToast();renderModal();
}
async function readProfile() {
  const {data:u,error:e}=await sb.auth.getUser();
  if(e || !u?.user){state.user=null;state.profile=null;return;}
  state.user=u.user;
  const {data:p,error:pe}=await sb.from('perfis').select('*').eq('id',u.user.id).maybeSingle();
  if(pe || !p){state.profile=null;await sb.auth.signOut({scope:'local'});state.user=null;notify('Conta sem perfil. Fale com o administrador.',true);return;}
  state.profile=p;
}
async function loadData() {
  if (!sb || !canWork()) {render();return;}
  const jobs=[];
  if(isLeader()) jobs.push(sb.from('perfis').select('*').order('nome'));
  else jobs.push(sb.from('perfis').select('*').eq('id',state.profile.id));
  jobs.push(sb.from('funcoes_pessoa').select('pessoa_id,funcao'));
  if(canApprove())jobs.push(sb.from('convites').select('id,criado_por,expira_em,usos,usos_max,revogado,criado_em').order('criado_em',{ascending:false}).limit(50));
  if(isAdmin())jobs.push(sb.from('auditoria').select('id,quem,acao,alvo,quando').order('quando',{ascending:false}).limit(100));
  const res=await Promise.all(jobs);
  if(res.some(r=>r.error)) {notify('Não foi possível carregar todas as informações.',true);render();return;}
  let idx=0;state.people=res[idx++].data||[];state.functions=res[idx++].data||[];
  state.invites=canApprove()?res[idx++].data||[]:[];
  state.audit=isAdmin()?res[idx++].data||[]:[];
  state.drafts={};render();
}
async function boot() {
  if(!isReady()) {render();return;}
  await readProfile();
  if(state.user && canWork()) {
    const available=tabs().map(x=>x[0]);
    if(!available.includes(state.tab)) state.tab=available[0];
    await loadData();
  } else render();
}
function showError(error) {
  // supabase-js devolve detalhes em error.context para respostas não-2xx da função.
  return error?.message || 'Não foi possível concluir a ação.';
}
async function gateway(action, args={}) {
  const {data,error}=await sb.functions.invoke('kids-auth',{body:{action,...args}});
  if(error) {
    let msg='Falha ao falar com o servidor. Verifique sua conexão.';
    try {const value=await error.context?.json(); if(value?.error) msg=value.error;} catch {/* offline */}
    throw new Error(msg);
  }
  if(data?.error)throw new Error(data.error);
  return data;
}
async function handleForm(form) {
  if(state.busy)return;
  state.busy=true;renderToast();
  const id=form.dataset.form;
  const val=x=>{const v=form.querySelector(`[name="${x}"]`)?.value||'';
    return ['lp','sp','p1','p2'].includes(x)?v:v.trim();};
  try {
    if(id==='login') {
      const username=cleanUsername(val('lu'));
      const isEmail=username.includes('@');
      if(isEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(username))throw new Error('Digite um e-mail válido.');
      if(!isEmail && !/^[a-z][a-z0-9._-]{2,25}$/.test(username))throw new Error('Digite um nome de usuário válido.');
      // A conta administradora inicial usa e-mail real; as demais contas seguem o identificador de usuário.
      const {error}=await sb.auth.signInWithPassword({email:isEmail?username:toMail(username),password:val('lp')});
      if(error)throw new Error('Usuário ou senha incorretos.');
      state.tab='inicio';await boot();
      if(state.profile?.status==='ativo'&&!state.profile.primeiro_acesso)notify('Bem-vindo ao Escala Kids.');
    } else if(id==='signup') {
      const code=val('sc').match(/[a-f0-9]{64}/)?.[0]||'';
      await gateway('register',{
        usuario:cleanUsername(val('su')),nome:val('sn'),telefone:val('sf'),senha:val('sp'),codigo:code,
      });
      state.auth='wait';state.invitation='';render();
    } else if(id==='password') {
      if(val('p1')!==val('p2')) throw new Error('As senhas precisam ser iguais.');
      await gateway('change_password',{senha:val('p1')});
      await sb.auth.signOut({scope:'global'});
      state.user=null;state.profile=null;state.auth='login';render();
      notify('Senha atualizada. Entre novamente com a nova senha.');
    } else if(id==='invite') {
      const data=await gateway('invite',{dias:Number(val('days')),usos:Number(val('uses'))});
      // Só o navegador do emissor recebe o token em claro; no banco fica apenas hash.
      state.currentInvitation=`${location.origin}${location.pathname}?convite=${data.codigo}`;
      await loadData();notify('Convite criado.');
    }
  } catch(e) {notify(showError(e),true);} finally {state.busy=false;render();}
}
async function confirmAction() {
  const m=state.modal;state.modal=null;
  if(!m||state.busy)return;
  state.busy=true;render();
  try {
    if(m.action==='review') {
      const p=state.people.find(x=>x.id===m.id);if(!p)throw new Error('Cadastro não encontrado.');
      const d=draftOf(p);
      await gateway('review',{id:p.id,aprovar:m.approve,perfil:d.perfil,funcoes:d.funcoes,
        pode_aprovar:!!d.pode_aprovar});
      notify(m.approve?'Cadastro aprovado.':'Cadastro recusado.');
    } else if(m.action==='manage') {
      const p=state.people.find(x=>x.id===m.id),d=draftOf(p);
      await gateway('manage',{id:p.id,...d});notify('Permissões atualizadas.');
    } else if(m.action==='revoke') {
      await gateway('revoke_invite',{id:m.id});notify('Convite revogado.');
    }
    await loadData();
  } catch(e) {notify(showError(e),true);} finally {state.busy=false;render();}
}
function modal(title, description, action, id, approve=false) {
  state.modal={title,description,action,id,approve};render();
}
async function actionClick(b) {
  const a=b.dataset.a,id=b.dataset.id;
  if(a==='tab'){state.tab=b.dataset.tab;state.currentInvitation='';render();$('#main').scrollTop=0;return;}
  if(a==='login'){state.auth='login';render();return;}
  if(a==='signup'){state.auth='signup';render();return;}
  if(a==='cancel'){state.modal=null;render();return;}
  if(a==='confirm'){await confirmAction();return;}
  if(a==='out'){
    await sb.auth.signOut({scope:'global'});state.user=null;state.profile=null;
    state.auth='login';state.drafts={};state.people=[];render();return;
  }
  if(a==='reload'){await boot();if(canWork())notify('Seu acesso foi aprovado.');else notify('Seu cadastro ainda está em análise.');return;}
  if(a==='copy'){
    try{await navigator.clipboard.writeText(state.currentInvitation);notify('Link copiado.');}
    catch{notify('Selecione e copie o link exibido.',true);}
    return;
  }
  const p=state.people.find(x=>x.id===id);
  if (['role','fn','ap','status','approve','reject','saveperson'].includes(a) && !p) return;
  if(a==='role') {
    const d=draftOf(p),choices=b.dataset.alladmin==='true'?['voluntario','lider','administrador']:['voluntario','lider'];
    d.perfil=choices[(choices.indexOf(d.perfil)+1)%choices.length];
    if(d.perfil!=='lider')d.pode_aprovar=false;
    render();return;
  }
  if(a==='fn') {
    const d=draftOf(p);d.funcoes=d.funcoes.includes(b.dataset.f)?d.funcoes.filter(f=>f!==b.dataset.f):[...d.funcoes,b.dataset.f];render();return;
  }
  if(a==='ap') {const d=draftOf(p);d.pode_aprovar=!d.pode_aprovar;render();return;}
  if(a==='status') {const d=draftOf(p);d.status=d.status==='ativo'?'desativado':'ativo';render();return;}
  if(a==='approve') {modal('Aprovar cadastro',`Confirmar entrada de ${p.nome} como ${PF[draftOf(p).perfil]}?`,'review',p.id,true);return;}
  if(a==='reject') {modal('Recusar cadastro',`O acesso de ${p.nome} não será liberado.`,'review',p.id,false);return;}
  if(a==='saveperson') {modal('Salvar alterações',`Confirmar as novas permissões de ${p.nome}?`,'manage',p.id);return;}
  if(a==='revoke') {modal('Revogar convite','Este link não poderá mais ser utilizado.','revoke',id);return;}
}
$('#app').addEventListener('submit', async e=>{const form=e.target.closest('form[data-form]');if(!form)return;e.preventDefault();await handleForm(form);});
$('#app').addEventListener('click', async e=>{const b=e.target.closest('button[data-a]');if(!b||b.disabled)return;await actionClick(b);});

if(isReady()) {
  sb=createClient(config.supabaseUrl,config.publishableKey,{
    auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:'escala-kids-auth-v1'},
  });
  sb.auth.onAuthStateChange((event)=>{
    if(event==='SIGNED_OUT'){state.user=null;state.profile=null;state.auth='login';render();}
  });
}
render();
boot().catch(()=>notify('Não foi possível conectar. Confira sua internet ou a configuração.',true));
// PWA: verifica novas versões ao abrir, voltar ao app e periodicamente.
// A atualização depende de internet e de o navegador buscar o novo service worker.
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' });
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        location.reload();
      });
      const offerUpdate = () => {
        // Não exibir aviso na instalação inicial; somente na atualização.
        if (!registration.waiting || !navigator.serviceWorker.controller) return;
        if (document.querySelector('#pwa-update')) return;
        const box = document.createElement('div');
        box.id = 'pwa-update';
        box.setAttribute('role', 'status');
        box.innerHTML = '<span>Nova versão disponível</span><button type="button" class="pwa-update-btn">Atualizar</button>';
        document.body.append(box);
        box.querySelector('button').addEventListener('click', () => {
          box.querySelector('button').disabled = true;
          registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
        });
      };
      offerUpdate();
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed') offerUpdate();
        });
      });
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) registration.update().catch(() => {});
      });
      setInterval(() => registration.update().catch(() => {}), 60 * 60 * 1000);
    } catch { /* O aplicativo continua online mesmo sem service worker. */ }
  });
}
