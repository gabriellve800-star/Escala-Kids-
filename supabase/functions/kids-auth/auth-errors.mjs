// Fonte única do mapeamento de falhas do Supabase Auth, sem dados pessoais.
export function mapCreateUserError(authError) {
  const code = String(authError?.code || 'AUTH_ERROR');
  const status = Number(authError?.status || 0);
  if (code === 'email_exists' || code === 'user_already_exists')
    return {status:409,field:'email',message:'Este e-mail já está cadastrado. Use outro endereço.'};
  if (code === 'email_address_invalid')
    return {status:422,field:'email',message:'O servidor rejeitou o formato do e-mail. Corrija o endereço.'};
  if (code === 'email_address_not_authorized')
    return {status:422,field:'email',message:'Este endereço de e-mail não é permitido pelo serviço.'};
  if (code === 'weak_password' || code === 'password_too_short')
    return {status:422,field:'senha',message:'Senha recusada pelo servidor. Use uma senha mais forte.'};
  if (status === 429 || code === 'over_request_rate_limit')
    return {status:429,field:null,message:'Muitas tentativas. Aguarde antes de tentar novamente.'};
  // Falhas inesperadas, autenticação ou rede: jamais presumir e-mail duplicado.
  return {status:503,field:null,message:'Não foi possível criar o acesso agora. Tente mais tarde.'};
}
