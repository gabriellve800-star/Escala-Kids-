// ESCALA KIDS | FASE 1 | Edge Function (Deno)
// Deploy: supabase functions deploy kids-auth --no-verify-jwt
// Credencial privilegiada fica SOMENTE no ambiente da função.
import { createClient } from 'npm:@supabase/supabase-js@2.57.0';

const url = Deno.env.get('SUPABASE_URL') ?? '';
const serverKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
// Identidades agora usam e-mails reais: não é necessário domínio próprio.
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const appOrigin = 'https://gabriellve800-star.github.io'; // Domínio único permitido pelo CORS.
const rateSalt = Deno.env.get('RATE_LIMIT_PEPPER') || serverKey; // Segredo privado do servidor.
const admin = createClient(url, serverKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': appOrigin,
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Vary': 'Origin',
    },
  });
}
function err(message: string, code = 400, meta: Record<string,unknown> = {}) { return json({ error: message, ...meta }, code); }
const usuarioValido = (v: unknown) => typeof v === 'string' && /^[a-z][a-z0-9._-]{2,25}$/.test(v);
const senhaValida = (v: unknown) => typeof v === 'string' && v.length >= 10 && v.length <= 128 &&
  /[a-z]/.test(v) && /[A-Z]/.test(v) && /\d/.test(v) && /[^A-Za-z0-9]/.test(v);
const funcoesValidas = (fs: unknown) => Array.isArray(fs) && fs.every(
  (f) => ['professor', 'auxiliar', 'lanche', 'portaria'].includes(f),
);

// Retorna só o campo reprovado; jamais registrar dados pessoais em logs.
const emailValido = (email) => {
  if (typeof email !== 'string' || email.length > 254) return false;
  const pieces=email.split('@');
  if (pieces.length!==2) return false;
  const [local,host]=pieces;
  if (!local || local.length>64 || local.startsWith('.') || local.endsWith('.') ||
      local.includes('..') || !/^[a-z0-9._%+-]+$/i.test(local)) return false;
  const labels=host.split('.');
  return labels.length>=2 && labels.every(x=>x.length>0 && x.length<=63 &&
    /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(x)) && labels[labels.length-1].length>=2;
};

function erroCadastro(b: Record<string,unknown>) {
  const usuario=String(b.usuario??'').trim().toLowerCase();
  const nome=String(b.nome??'').trim().replace(/\s+/g,' ');
  const email=String(b.email??'').trim().toLowerCase();
  const telefone=String(b.telefone??'').replace(/[^\d+]/g,'');
  if(!usuarioValido(usuario)) return {field:'usuario',message:'Nome de usuário: use 3 a 26 caracteres, começando com letra, sem espaços ou acentos.'};
  if(nome.length<3 || nome.length>120) return {field:'nome',message:'Nome completo: informe de 3 a 120 caracteres.'};
  if(!emailValido(email)) return {field:'email',message:'E-mail inválido. Confira o endereço e use até 64 caracteres antes do @.'};
  if(!/^\+?\d{10,15}$/.test(telefone)) return {field:'telefone',message:'Telefone inválido. Informe DDD e número, por exemplo (11) 99999-9999.'};
  if(!senhaValida(b.senha)) return {field:'senha',message:'Senha: use de 10 a 128 caracteres com letra maiúscula, minúscula, número e símbolo.'};
  if(!normalizeInvite(b.codigo)) return {field:'codigo',message:'Convite inválido. Valide um código ABC-123 ou use o QR Code.'};
  return null;
}
const normalizeInvite = (input: unknown) => {
  const raw = String(input ?? '').trim().toUpperCase();
  if (/^[A-Z]{3}[- ]?\d{3}$/.test(raw)) return raw.slice(0,3) + '-' + raw.replace(/\D/g,'').slice(-3);
  if (/^[A-F0-9]{64}$/.test(raw)) return raw.toLowerCase();
  return '';
};
async function lookupInvite(code: string) {
  const hash = await sha256(code);
  const { data:c, error } = await admin.from('convites')
    .select('id,expira_em,usos,usos_max,revogado')
    .or(`codigo_hash.eq.${hash},codigo_curto_hash.eq.${hash}`).maybeSingle();
  if (error) throw new Error('ERRO_CONVITE');
  return c && !c.revogado && new Date(c.expira_em).getTime() > Date.now() && c.usos < c.usos_max ? c : null;
}
function newShortCode() {
  const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits='0123456789';
  const random=crypto.getRandomValues(new Uint8Array(6));
  return Array.from(random.slice(0,3),i=>alphabet[i%alphabet.length]).join('')+'-'+
    Array.from(random.slice(3),i=>digits[i%10]).join('');
}

async function sha256(s: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(bytes), (x) => x.toString(16).padStart(2, '0')).join('');
}
function token(req: Request) {
  const h = req.headers.get('authorization') ?? '';
  return /^Bearer \S+$/.test(h) ? h.slice(7) : null;
}
async function actor(req: Request) {
  const access = token(req);
  if (!access) throw new Error('NAO_AUTENTICADO');
  // getUser confirma a assinatura e a identidade do token no Auth.
  const { data, error } = await admin.auth.getUser(access);
  if (error || !data.user) throw new Error('NAO_AUTENTICADO');
  const { data: pessoa, error: perr } = await admin.from('perfis').select('*').eq('id', data.user.id).single();
  if (perr || !pessoa || pessoa.status !== 'ativo') throw new Error('SEM_PERMISSAO');
  return pessoa;
}
function assertManager(p: Record<string, unknown>) {
  if (p.primeiro_acesso || !(p.perfil === 'administrador' || (p.perfil === 'lider' && p.pode_aprovar))) {
    throw new Error('SEM_PERMISSAO');
  }
}
function assertAdmin(p: Record<string, unknown>) {
  if (p.primeiro_acesso || p.perfil !== 'administrador') throw new Error('SEM_PERMISSAO');
}
async function rpc(name: string, values: Record<string, unknown>) {
  const { data, error } = await admin.rpc(name, values);
  if (error) throw new Error(error.message || 'ERRO_BANCO');
  return data;
}
const untrustedError = (e: unknown) => e instanceof Error ? e.message : String(e);

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID(); // Identificador aleatório, não revela dados pessoais.
  if (req.method === 'OPTIONS') return json({}, 200);
  if (req.method !== 'POST') return err('Método não permitido.', 405);
  if (!url || !serverKey || rateSalt.length < 24) {
    return err('Configuração do servidor incompleta.', 503);
  }
  // CORS não substitui autenticação, mas restringe o uso comum no navegador.
  if (req.headers.get('origin') !== appOrigin) return err('Origem não autorizada.', 403);
  const size = Number(req.headers.get('content-length') || 0);
  if (size > 12000) return err('Requisição muito grande.', 413);

  let b: Record<string, unknown>;
  try {
    const bodyText = await req.text();
    if (bodyText.length > 12000) return err('Requisição muito grande.', 413);
    b = JSON.parse(bodyText);
    if (!b || Array.isArray(b) || typeof b !== 'object') throw Error();
  } catch { return err('Requisição inválida.'); }

  try {
    switch (b.action) {
      case 'check_invite': {
        const aparentIp = req.headers.get('x-real-ip') || req.headers.get('cf-connecting-ip') ||
          (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'desconhecido';
        const permitido = await rpc('limitar_cadastro',{
          p_chave:await sha256(`convite-check:${aparentIp}:${rateSalt}`),
          p_max:120,
        });
        if (!permitido) return err('Muitas tentativas. Tente mais tarde.',429);
        const codigo=normalizeInvite(b.codigo);
        if (!codigo) return err('Código inválido. Digite ABC-123 ou use o QR Code.',400);
        const limiteCodigo=await rpc('limitar_cadastro',{
          p_chave:await sha256(`convite-check-codigo:${aparentIp}:${codigo}:${rateSalt}`),
          p_max:60,
        });
        if(!limiteCodigo) return err('Muitas validações deste convite. Tente mais tarde.',429);
        const valid=await lookupInvite(codigo);
        if (!valid) return err('Código inválido, expirado ou já utilizado.',400);
        return json({ok:true,valid:true});
      }
      case 'register': {
        // Rede compartilhada: até 80 tentativas de cadastro por hora por IP, com limite por convite.
        // Para produção pública use também WAF/CAPTCHA, pois cabeçalhos de proxy podem variar.
        const aparentIp = req.headers.get('x-real-ip') || req.headers.get('cf-connecting-ip') ||
          (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'desconhecido';
        const permitido = await rpc('limitar_cadastro', {
          p_chave: await sha256(`cadastro:${aparentIp}:${rateSalt}`),
          p_max:80,
        });
        if (!permitido) return err('Muitas tentativas. Tente novamente mais tarde.', 429);
        // Só este fluxo cria contas. Nenhum cliente tem permissão de autoaprovar.
        const usuario = String(b.usuario ?? '').trim().toLowerCase();
        const nome = String(b.nome ?? '').trim().replace(/\s+/g, ' ');
        const email = String(b.email ?? '').trim().toLowerCase();
        const telefone = String(b.telefone ?? '').replace(/[^\d+]/g, '');
        const codigo = normalizeInvite(b.codigo);
        const erro=erroCadastro(b);
        if (erro) {
          console.warn('escala_register_validation_rejected',{request_id:requestId,stage:'validate',code:'INVALID_FIELD',field:erro.field});
          return err(erro.message,422,{field:erro.field,request_id:requestId});
        }
        // Protege convites repetidos sem bloquear toda uma igreja no mesmo Wi-Fi.
        const permitidoCodigo=await rpc('limitar_cadastro',{
          p_chave:await sha256(`cadastro-convite:${aparentIp}:${codigo}:${rateSalt}`),
          p_max:60,
        });
        if (!permitidoCodigo) return err('Muitas tentativas com este convite. Peça outro código.',429);
        // A finalização faz nova validação atômica no banco, sob bloqueio de linha.
        const c = await lookupInvite(codigo);
        if (!c) {
          return err('Convite inválido, expirado ou já utilizado.');
        }
        const { data: created, error: ae } = await admin.auth.admin.createUser({
          email, password: String(b.senha), email_confirm: true,
        });
        if (ae || !created.user) {
          console.warn('escala_register_auth_error',{request_id:requestId,stage:'createUser',code:ae?.code||'AUTH_ERROR',status:ae?.status||0});
          return err('Não foi possível criar o acesso. Verifique se já existe conta com este e-mail.', 409,{field:'email',request_id:requestId});
        }
        try {
          await rpc('finalizar_cadastro', {
            p_id: created.user.id, p_usuario: usuario, p_nome: nome,
            p_telefone: telefone, p_codigo: codigo,
          });
        } catch (e) {
          // Erros SQL livres podem conter dados pessoais; só registrar categoria segura.
          const info=untrustedError(e);
          const motivo=info.includes('perfis_usuario_key')?'USUARIO_DUPLICADO':
            info.includes('CONVITE_INVALIDO')?'CONVITE_INVALIDO':'ERRO_RPC';
          console.warn('escala_register_database_error',{request_id:requestId,stage:'finalizar_cadastro',code:motivo});
          // Reverter Auth E CONFERIR o resultado; evitar ocultar conta órfã.
          const { error: rollbackError } = await admin.auth.admin.deleteUser(created.user.id);
          if (rollbackError) {
            console.error('escala_register_rollback_failed',{
              request_id:requestId,stage:'rollback',code:rollbackError.code||'ERRO_AUTH',status:rollbackError.status||0,
            });
            return err('Falha de finalização. Contate o administrador antes de repetir o cadastro.',500,{request_id:requestId});
          }
          if (info.includes('perfis_usuario_key') || info.includes('usuario')) return err('Esse nome de usuário já está cadastrado. Escolha outro.',409,{field:'usuario',request_id:requestId});
          if (info.includes('CONVITE_INVALIDO')) return err('Convite vencido ou já utilizado. Solicite outro código.',409,{field:'codigo',request_id:requestId});
          return err('Não foi possível concluir o cadastro. Tente outra vez ou solicite um novo convite.',409,{request_id:requestId});
        }
        return json({ ok: true, status: 'pendente' }, 201);
      }
      case 'login': {
        if (!anonKey) return err('Serviço de login indisponível no momento.', 503);
        // Não expor e-mail/telefone associado a um nome de usuário.
        const usuario = String(b.usuario ?? '').trim().toLowerCase();
        if (!usuarioValido(usuario) || typeof b.senha !== 'string' || b.senha.length > 128) {
          return err('Usuário ou senha incorretos.', 401);
        }
        const aparentIp = req.headers.get('x-real-ip') || req.headers.get('cf-connecting-ip') ||
          (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'desconhecido';
        const permitido = await rpc('limitar_cadastro', {
          p_chave: await sha256(`login:${aparentIp}:${rateSalt}`),
          p_max:120,
        });
        if (!permitido) return err('Muitas tentativas de login. Tente mais tarde.', 429);
        const permitidoUsuario=await rpc('limitar_cadastro',{
          p_chave:await sha256(`login-usuario:${usuario}:${rateSalt}`),
          p_max:10,
        });
        if(!permitidoUsuario) return err('Muitas tentativas para este usuário. Tente mais tarde.',429);
        const { data: perfil } = await admin.from('perfis').select('id').eq('usuario', usuario).maybeSingle();
        if (!perfil?.id) return err('Usuário ou senha incorretos.', 401);
        const { data: authRecord, error: userError } = await admin.auth.admin.getUserById(perfil.id);
        if (userError || !authRecord?.user?.email) return err('Usuário ou senha incorretos.', 401);
        // Cliente isolado: nunca chamar signInWithPassword no cliente privilegiado.
        const signInClient = createClient(url, anonKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data, error: signInError } = await signInClient.auth.signInWithPassword({
          email: authRecord.user.email, password: b.senha,
        });
        if (signInError || !data.session) return err('Usuário ou senha incorretos.', 401);
        return json({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
      }
      case 'invite': {
        const p = await actor(req); assertManager(p);
        const dias = Number(b.dias ?? 7), usos = Number(b.usos ?? 1);
        if (!Number.isInteger(dias) || dias < 1 || dias > 30 || !Number.isInteger(usos) || usos < 1 || usos > 50)
          return err('Validade ou quantidade inválida.');
        const random = crypto.getRandomValues(new Uint8Array(32));
        const codigo = Array.from(random, (x) => x.toString(16).padStart(2, '0')).join('');
        // O QR contém token longo, enquanto o código curto pode ser digitado.
        // Ambos são armazenados SOMENTE como hash, nunca em texto puro.
        for (let tentativas=0;tentativas<12;tentativas++) {
          const codigo_curto = newShortCode();
          try {
            const id = await rpc('emitir_convite', {
              p_ator:p.id,p_codigo_hash:await sha256(codigo),
              p_codigo_curto_hash:await sha256(codigo_curto),
              p_dias:dias,p_usos_max:usos,
            });
            return json({ok:true,id,codigo,codigo_curto});
          } catch(e) {
            // Raríssimo: um código curto colidiu com outro convite.
            if (untrustedError(e).includes('duplicate key') || untrustedError(e).includes('23505')) continue;
            throw e;
          }
        }
        return err('Não foi possível gerar um código único. Tente novamente.',503);
      }
      case 'revoke_invite': {
        const p = await actor(req); assertManager(p);
        if (typeof b.id !== 'string') return err('Convite inválido.');
        await rpc('revogar_convite', { p_ator: p.id, p_convite: b.id });
        return json({ ok: true });
      }
      case 'review': {
        const p = await actor(req); assertManager(p);
        const perfil = String(b.perfil ?? 'voluntario');
        const aprovado = b.aprovar === true;
        if (typeof b.id !== 'string' || !['administrador', 'lider', 'voluntario'].includes(perfil) || !funcoesValidas(b.funcoes))
          return err('Preencha corretamente o perfil e as funções.');
        await rpc('revisar_cadastro', {
          p_ator: p.id, p_pessoa: b.id, p_aprovar: aprovado,
          p_perfil: perfil, p_funcoes: b.funcoes,
          p_pode_aprovar: b.pode_aprovar === true && p.perfil === 'administrador',
        });
        return json({ ok: true });
      }
      case 'manage': {
        const p = await actor(req); assertAdmin(p);
        if (typeof b.id !== 'string' || !['administrador', 'lider', 'voluntario'].includes(String(b.perfil)) ||
          !['ativo', 'desativado'].includes(String(b.status)) || !funcoesValidas(b.funcoes))
          return err('Dados de atualização inválidos.');
        await rpc('gerir_pessoa', {
          p_ator: p.id, p_pessoa: b.id, p_perfil: b.perfil,
          p_funcoes: b.funcoes, p_pode_aprovar: b.pode_aprovar === true,
          p_status: b.status,
        });
        return json({ ok: true });
      }
      case 'change_password': {
        const p = await actor(req);
        if (!p.primeiro_acesso) return err('Troca inicial já concluída.');
        if (!senhaValida(b.senha)) return err('Use 10+ caracteres com maiúscula, minúscula, número e símbolo.');
        const { error } = await admin.auth.admin.updateUserById(p.id, { password: String(b.senha) });
        if (error) return err('Não foi possível atualizar a senha.', 500);
        await rpc('finalizar_primeiro_acesso', { p_pessoa: p.id });
        return json({ ok: true });
      }
      default: return err('Operação desconhecida.', 404);
    }
  } catch (e) {
    const m = untrustedError(e);
    // Não inclui detalhes técnicos internos para usuários finais.
    if (m.includes('SEM_PERMISSAO') || m.includes('NAO_AUTENTICADO')) return err('Sem permissão para esta ação.', 403);
    if (m.includes('CADASTRO_NAO_PENDENTE')) return err('Este cadastro não está pendente.', 409);
    if (m.includes('CONVITE_INVALIDO')) return err('Convite expirado ou indisponível.', 409);
    return err('Não foi possível concluir a ação. Tente novamente.', 400);
  }
});