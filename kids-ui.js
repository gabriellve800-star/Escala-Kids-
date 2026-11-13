// Escala Kids · Fase 3 PR2. Interface puramente declarativa, sem gravar dados.
export const KIDS_PERMISSIONS={
  gerenciar_turmas:'Gerenciar turmas',
  cadastrar_criancas:'Cadastrar crianças',
  confirmar_cadastros:'Confirmar cadastros',
  gerenciar_vinculos:'Vincular responsáveis',
  gerenciar_presencas:'Gerenciar presença',
  chamar_responsavel:'Chamar responsável',
  consultar_saude:'Consultar saúde (auditado, em fase futura)',
};
const safe=(v,esc)=>esc(v??'');
const opts=(turmas,esc)=>turmas.filter(x=>x.ativa).map(t=>
  `<option value="${safe(t.id,esc)}">${safe(t.nome,esc)} · ${t.idade_min_meses}–${t.idade_max_meses} meses</option>`
).join('');
const readable=(dia)=>dia?new Date(dia+'T12:00:00').toLocaleDateString('pt-BR'):'—';
const stateLabel={aguardando_equipe:'Aguardando equipe',consentimento_pendente:'Aguardando consentimento',ativo:'Ativo',inativo:'Inativo'};
function termsCard(term,esc) {
 if(!term) return `<div class="card kids-lock"><h3>Consentimento ainda não disponível</h3>
   <p class="mut">O termo oficial ainda não foi publicado. Para proteger as famílias, o cadastro de crianças está bloqueado no servidor, inclusive para administradores.</p></div>`;
 return `<details class="kids-term card"><summary>Termo de consentimento · versão ${safe(term.versao,esc)}</summary>
   <p class="kids-term-text">${safe(term.texto,esc)}</p></details>`;
}
export function kidsPermissionChips(personId,current,esc){
 return `<div class="kids-perms"><h4>Permissões individuais do Kids</h4>
   <p class="mut">Somente o administrador concede ou revoga. A permissão não substitui a escala da turma.</p>
   <div class="pillset">${Object.entries(KIDS_PERMISSIONS).map(([key,label])=>
    `<button type="button" class="chip ${current.includes(key)?'on':''}"
       data-a="kid-perm" data-id="${safe(personId,esc)}" data-p="${key}"
       aria-pressed="${current.includes(key)}">${safe(label,esc)}</button>`).join('')}</div></div>`;
}
export function kidsTeamUI({isAdmin,isLeader,classes,children,families,term,esc,canManageClasses=false,canRegisterChild=false,canInviteFamily=false,inviteCode=''}){
 let out=`<div class="kids-heading"><button class="btn ghost kids-back" data-a="kids-back">Voltar</button>
  <h2>Kids</h2><p class="mut">Turmas, cadastros e segurança dos pequenos.</p></div>`;
 if(!classes.length) out+=`<div class="card"><h3>Configure as turmas</h3><p class="mut">Os nomes e as idades são definidos pela liderança. Nenhuma turma fictícia será publicada.</p></div>`;
 out+='<h3 class="kids-section">Turmas</h3>';
 if(canManageClasses) {
  for(let pos=1;pos<=4;pos++){
    const t=classes.find(x=>x.posicao===pos);
    out+=`<div class="card"><h3>Turma ${pos}</h3>
    <form data-form="kids-class" class="kids-form">
      <input type="hidden" name="kid-pos" value="${pos}">
      <label>Nome <input class="in" name="kid-class-name" maxlength="60" minlength="2" required
      value="${safe(t?.nome||'',esc)}" placeholder="Nome oficial"></label>
      <div class="kids-two"><label>Idade inicial (meses)
      <input class="in" name="kid-min" type="number" min="0" max="215" required value="${t?.idade_min_meses??''}"></label>
      <label>Idade final (meses)
      <input class="in" name="kid-max" type="number" min="0" max="215" required value="${t?.idade_max_meses??''}"></label></div>
      <button type="submit" class="btn ghost">${t?'Salvar turma':'Criar turma'}</button>
    </form></div>`;
  }
 } else out+=classes.map(t=>`<div class="card"><strong>${safe(t.nome,esc)}</strong><p class="mut">${t.idade_min_meses} a ${t.idade_max_meses} meses</p></div>`).join('');
 out+=termsCard(term,esc);
 if(canInviteFamily) {
   out+=`<h3 class="kids-section">Convite de família</h3><div class="card">
     <p class="mut">Convites próprios dos responsáveis, diferentes dos convites da equipe. Compartilhe o código somente com a família autorizada.</p>
     <button class="btn pri" type="button" data-a="kids-invite-family">Gerar convite familiar</button>
     ${inviteCode?`<div class="kids-invite"><p class="mut">Copie agora. O código não será exibido novamente após sair desta tela.</p>
     <code>${safe(inviteCode,esc)}</code>
     <button type="button" data-a="kids-copy-invite" class="btn ghost">Copiar código familiar</button></div>`:''}
     </div>`;
 }
 out+=`<h3 class="kids-section">Responsáveis</h3>`;
 if(!families.length) out+='<div class="card"><p class="mut">Nenhum responsável acessível ao seu perfil.</p></div>';
 else out+=families.map(f=>`<div class="card"><div class="row"><strong>${safe(f.nome,esc)}</strong>
 <span class="tag ${f.status==='ativo'?'':'warn'}">${f.status==='ativo'?'Ativo':'Aguardando aprovação'}</span></div>
 ${f.status==='pendente'?`<button class="btn ghost" data-a="kids-approve-family" data-id="${safe(f.usuario_id,esc)}">Aprovar responsável</button>`:''}</div>`).join('');
 out+=`<h3 class="kids-section">Crianças</h3>`;
 if(term&&classes.some(c=>c.ativa)&&canRegisterChild) {
   out+=`<div class="card"><h3>Novo cadastro pela equipe</h3><p class="mut">A ficha ficará aguardando o consentimento da família. Nenhum dado de saúde é solicitado aqui.</p>
    <form data-form="kids-child-team" class="kids-form">
      <label>Nome da criança<input class="in" name="kid-child-name" minlength="2" maxlength="120" autocomplete="off" required></label>
      <label>Data de nascimento<input class="in" type="date" name="kid-child-dob" required></label>
      <label>Turma<select class="in" name="kid-child-class" required>${opts(classes,esc)}</select></label>
      <button class="btn pri" type="submit">Criar ficha pendente</button>
    </form></div>`;
 }
 if(!children.length) out+='<div class="card"><p class="mut">Nenhuma criança cadastrada ou visível nesta turma.</p></div>';
 else for(const c of children){
   const t=classes.find(x=>x.id===c.turma_id);
   out+=`<div class="card"><div class="row"><div><strong>${safe(c.numero,esc)} · ${safe(c.nome,esc)}</strong>
     <p class="mut">${safe(t?.nome||'Turma',esc)} · ${readable(c.nascimento)}</p></div>
     <span class="tag ${c.status==='ativo'?'':'warn'}">${safe(stateLabel[c.status]||c.status,esc)}</span></div>
     ${c.status==='aguardando_equipe' && (isAdmin||isLeader)?`<button class="btn pri" data-a="kids-approve-child" data-id="${safe(c.id,esc)}">Confirmar cadastro</button>`:''}
     ${c.origem==='equipe' && c.status==='consentimento_pendente' && families.some(f=>f.status==='ativo') && (isAdmin||isLeader)?`
       <form data-form="kids-link-child" class="kids-form">
         <input type="hidden" name="kid-link-id" value="${safe(c.id,esc)}">
         <label>Vincular a responsável confirmado
           <select class="in" name="kid-link-parent" required>
             <option value="">Selecione…</option>
             ${families.filter(f=>f.status==='ativo').map(f=>`<option value="${safe(f.usuario_id,esc)}">${safe(f.nome,esc)}</option>`).join('')}
           </select></label>
         <button class="btn ghost" type="submit">Pedir consentimento familiar</button>
       </form>`:''}
   </div>`;
 }
 out+=`<div class="card kids-footnote"><strong>Proteção dos pequenos</strong><p class="mut">Dados de saúde e telefone do responsável não são mostrados aqui. A consulta clínica exige controle e auditoria específicos. Cadastro e presença não devem substituir procedimentos de emergência.</p></div>`;
 return out;
}
export function familyAccessUI({family,auth,term,esc}){
 if(family && family.status!=='ativo')return `<div class="card"><h2>Cadastro em análise</h2>
  <p class="mut">Seu e-mail foi confirmado. A equipe precisa aprovar seu acesso familiar antes do cadastro de crianças.</p>
  <button class="btn ghost" data-a="family-refresh">Verificar aprovação</button>
  <details class="kids-term"><summary>Direitos e privacidade</summary>
   <form data-form="family-privacy-request" class="kids-form">
    <label>Solicitação<select class="in" name="pr-kind">
      <option value="acesso">Acessar meus dados</option>
      <option value="correcao">Correção</option>
      <option value="revogacao">Revogação</option>
      <option value="exclusao">Exclusão</option></select></label>
    <button type="submit" class="btn ghost">Enviar solicitação</button>
   </form></details></div>
  <button class="btn ghost" data-a="out">Sair</button>`;
 if(auth==='family-signup')return `<h2>Cadastro de responsável</h2><p class="mut">Você precisa de um convite próprio para famílias. Primeiro confirme seu e-mail. Depois, entre e valide o convite com a equipe.</p>
 <form data-form="family-signup" class="kids-form">
  <label>Código familiar<input class="in" name="fs-code" required minlength="64" maxlength="64" autocomplete="off" pattern="[0-9a-f]{64}" placeholder="Cole seu código de convite"></label>
  <label>E-mail<input class="in" name="fs-email" type="email" autocomplete="email" required></label>
  <label>Senha<input class="in" name="fs-password" type="password" autocomplete="new-password" minlength="10" maxlength="128" required></label>
  <button class="btn pri" type="submit">Criar conta familiar</button>
 </form><button class="btn ghost" data-a="family-login-tab">Já tenho uma conta</button>`;
 if(auth==='family-login')return `<h2>Entrar como responsável</h2><p class="mut">Acesso exclusivo à família. Sem escalas, equipe ou convites ministeriais.</p>
 <form data-form="family-login" class="kids-form">
  <label>E-mail<input class="in" name="fl-email" type="email" autocomplete="email" required></label>
  <label>Senha<input class="in" name="fl-password" type="password" autocomplete="current-password" required></label>
  <button class="btn pri" type="submit">Entrar</button>
 </form><button class="btn ghost" data-a="family-signup-tab">Tenho um convite familiar</button>
 <button class="btn ghost" data-a="login">Entrar como equipe</button>`;
 if(auth==='family-email-wait')return `<div class="card"><h2>Verifique seu e-mail</h2><p class="mut">Confirme a posse do e-mail usando a mensagem enviada pelo Supabase. Depois volte ao Escala Kids, entre como responsável e digite seu código de convite. Não há cadastro infantil antes da aprovação e do termo.</p></div>
 <button class="btn pri" data-a="family-login-tab">Ir para login familiar</button>`;
 if(!family)return `<h2>Confirmar convite familiar</h2><p class="mut">Sua conta deve ter um e-mail confirmado. Digite seu nome e o código familiar fornecido pela equipe. Seu acesso ficará pendente de aprovação.</p>
 <form data-form="family-redeem" class="kids-form">
   <label>Nome completo<input class="in" name="fr-name" minlength="3" maxlength="120" autocomplete="name" required></label>
   <label>Código familiar<input class="in" name="fr-code" minlength="64" maxlength="64" autocomplete="off" pattern="[0-9a-f]{64}" required></label>
   <button class="btn pri" type="submit">Enviar solicitação</button>
 </form><button class="btn ghost" data-a="out">Sair</button>`;
 return '';
}
export function familyPortalUI({family,classes,children,links,requests,term,esc,tab}){
 const first=safe(family?.nome?.split(' ')[0]||'Família',esc);
 if(tab==='family-privacy'){
   return `<h2>Privacidade</h2><p class="mut">Você pode solicitar acesso, correção, revogação e exclusão de dados. A solicitação será analisada pela administração.</p>
   <div class="card"><h3>Fazer uma solicitação</h3>
   <form data-form="family-privacy-request" class="kids-form">
    <label>Tipo<select class="in" name="pr-kind"><option value="acesso">Acessar meus dados</option>
     <option value="correcao">Solicitar correção</option><option value="revogacao">Revogar autorização</option>
     <option value="exclusao">Solicitar exclusão</option></select></label>
    <label>Criança (opcional)<select class="in" name="pr-child"><option value="">Dados da família</option>${children.filter(c=>links.some(v=>v.crianca_id===c.id&&v.status==='confirmado')).map(c=>`<option value="${safe(c.id,esc)}">${safe(c.numero,esc)}</option>`).join('')}</select></label>
    <button class="btn pri" type="submit">Enviar solicitação</button>
   </form></div>
   <h3 class="kids-section">Solicitações anteriores</h3>
   ${requests.length?requests.map(r=>`<div class="card"><strong>${safe(r.tipo,esc)}</strong><p class="mut">${safe(r.status,esc)}</p></div>`).join(''):'<div class="card"><p class="mut">Nenhuma solicitação.</p></div>'}`;
 }
 if(tab==='family-account')return `<h2>Minha conta</h2><div class="card"><h3>${safe(family.nome,esc)}</h3>
 <p class="mut">Perfil: responsável familiar</p><p class="mut">Situação: ${safe(family.status,esc)}</p>
 <button class="btn ghost" data-a="out">Sair da conta</button></div>
 <div class="card"><p class="mut">Alertas e dispositivos serão habilitados no PR 3 após testes de Web Push. Este PWA não substitui o telão ou o WhatsApp.</p></div>`;
 let out=`<div class="hero kids-family-hero"><p>Bom dia, ${first}</p><h2>Seus pequenos estão em boas mãos</h2>
 <p>Veja cadastros e confirmações da sua família.</p></div>`;
 out+=termsCard(term,esc);
 out+='<h3 class="kids-section">Meus filhos</h3>';
 if(!children.length)out+='<div class="card"><p class="mut">Nenhuma ficha vinculada ainda. Se a equipe cadastrou sua criança, aguarde a confirmação do vínculo.</p></div>';
 else for(const c of children){
  const cls=classes.find(x=>x.id===c.turma_id);
  const link=links.find(v=>v.crianca_id===c.id);
  out+=`<div class="card"><div class="row"><div><strong>${safe(c.numero,esc)}</strong><p class="mut">${safe(c.nome,esc)}</p>
   <p class="mut">${safe(cls?.nome||'Turma',esc)} · ${readable(c.nascimento)}</p></div>
   <span class="tag ${c.status==='ativo'?'':'warn'}">${safe(stateLabel[c.status]||c.status,esc)}</span></div>
   ${c.origem==='equipe' && c.status==='consentimento_pendente' && link?.status==='pendente' && term?
    `<button class="btn pri" data-a="family-confirm-child" data-id="${safe(c.id,esc)}">Li o termo e confirmo este cadastro</button>`:''}
   </div>`;
 }
 if(term&&classes.some(c=>c.ativa))out+=`<div class="card"><h3>Cadastrar meu filho</h3><p class="mut">Após o envio, a equipe confirmará o cadastro. Não preencha informações de saúde nesta etapa.</p>
  <form data-form="kids-child-family" class="kids-form">
   <label>Nome da criança<input class="in" name="kid-child-name" required minlength="2" maxlength="120"></label>
   <label>Data de nascimento<input class="in" name="kid-child-dob" type="date" required></label>
   <label>Turma<select class="in" name="kid-child-class" required>${opts(classes,esc)}</select></label>
   <label class="kids-consent"><input type="checkbox" name="kid-accept" required> Li e aceito o termo de cadastro, versão ${safe(term.versao,esc)}.</label>
   <button class="btn pri" type="submit">Solicitar cadastro</button>
  </form></div>`;
 out+='<div class="card"><p class="mut">As chamadas ao responsável e o botão “Estou indo” serão disponibilizados na próxima etapa. Por enquanto, acompanhe os comunicados pelos meios habituais.</p></div>';
 return out;
}
