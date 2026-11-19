// =====================================================================
// Cache de login de usuário — Consentio
// =====================================================================
// Chaves usadas (prefixo consentio: para não misturar com outros dados):
//
//  consentio:usuario:email:<email>   HASH   cópia do usuário (SEM senha em texto;
//                                           só o hash scrypt)          TTL 10 min
//  consentio:sessao:<token>          HASH   sessão ativa (quem é, papel,
//                                           clínica, permissões, ip)   TTL 1 h (renovável)
//  consentio:usuario:<id>:sessoes    SET    tokens ativos do usuário (logout geral)
//  consentio:login:falhas:<email>    STRING contador de senhas erradas TTL 15 min
//
// Padrão: cache-aside (a aplicação olha o Redis primeiro; se não achar,
// busca no MongoDB e grava no Redis com TTL).
// =====================================================================
const crypto = require("crypto");
const { conferirSenha } = require("./senha");
const { buscarUsuarioPorEmail, PERMISSOES } = require("./banco_principal");

const TTL_USUARIO = 10 * 60;      // 10 min: cópia do usuário no cache
const TTL_SESSAO = 60 * 60;       // 1 h: sessão expira se ficar parada
const TTL_BLOQUEIO = 15 * 60;     // 15 min: janela do limite de tentativas
const MAX_TENTATIVAS = 5;         // 5 senhas erradas → bloqueia

const k = {
  usuario: (email) => `consentio:usuario:email:${email}`,
  sessao: (token) => `consentio:sessao:${token}`,
  sessoesDoUsuario: (id) => `consentio:usuario:${id}:sessoes`,
  falhas: (email) => `consentio:login:falhas:${email}`,
};

// ---------------------------------------------------------------------
// 1) Busca o usuário: Redis primeiro (HIT), MongoDB se faltar (MISS)
// ---------------------------------------------------------------------
async function obterUsuario(client, email) {
  const chave = k.usuario(email);
  const emCache = await client.hGetAll(chave);          // HGETALL

  if (Object.keys(emCache).length > 0) {
    return { usuario: emCache, origem: "CACHE HIT (Redis)" };
  }

  const doBanco = await buscarUsuarioPorEmail(email);   // ida ao MongoDB
  if (!doBanco) return { usuario: null, origem: "não encontrado" };

  // Grava no Redis só o necessário para autenticar (nunca a senha em texto)
  const paraCache = {
    id: doBanco._id,
    nome: doBanco.nome,
    email: doBanco.email,
    papel: doBanco.papel,
    clinica_id: doBanco.clinica_id,
    ativo: String(doBanco.ativo),
    senha_hash: doBanco.senha_hash,
  };
  await client.multi()                                    // MULTI ... EXEC (atômico)
    .hSet(chave, paraCache)                               // HSET
    .expire(chave, TTL_USUARIO)                           // EXPIRE 600
    .exec();

  return { usuario: paraCache, origem: "CACHE MISS → MongoDB (gravado no Redis)" };
}

// ---------------------------------------------------------------------
// 2) Login: limite de tentativas → confere senha → cria sessão
// ---------------------------------------------------------------------
async function login(client, email, senha, ip = "127.0.0.1") {
  email = email.toLowerCase();

  // 2a) Está bloqueado por excesso de tentativas?
  const falhas = Number(await client.get(k.falhas(email))) || 0;
  if (falhas >= MAX_TENTATIVAS) {
    const resta = await client.ttl(k.falhas(email));     // TTL: segundos restantes
    return { ok: false, motivo: `bloqueado por ${resta}s (excesso de tentativas)` };
  }

  // 2b) Busca o usuário (cache-aside)
  const { usuario, origem } = await obterUsuario(client, email);

  // 2c) Confere a senha contra o hash (mesma mensagem para e-mail ou senha
  //     errados, para não revelar quais e-mails existem)
  if (!usuario || usuario.ativo !== "true" || !conferirSenha(senha, usuario.senha_hash)) {
    const n = await client.incr(k.falhas(email));         // INCR
    if (n === 1) await client.expire(k.falhas(email), TTL_BLOQUEIO); // janela começa na 1ª falha
    return { ok: false, origem, motivo: `e-mail ou senha inválidos (tentativa ${n}/${MAX_TENTATIVAS})` };
  }

  // 2d) Sucesso: zera falhas e cria a sessão
  await client.del(k.falhas(email));                      // DEL

  const token = crypto.randomBytes(32).toString("hex");   // 256 bits, imprevisível
  const sessao = {
    usuario_id: usuario.id,
    nome: usuario.nome,
    papel: usuario.papel,
    clinica_id: usuario.clinica_id,
    permissoes: (PERMISSOES[usuario.papel] || []).join(","),
    ip,
    criada_em: new Date().toISOString(),
  };

  await client.multi()
    .hSet(k.sessao(token), sessao)                        // HSET sessao
    .expire(k.sessao(token), TTL_SESSAO)                  // EXPIRE 3600
    .sAdd(k.sessoesDoUsuario(usuario.id), token)          // SADD (índice de sessões)
    .expire(k.sessoesDoUsuario(usuario.id), TTL_SESSAO)
    .exec();

  return { ok: true, origem, token, sessao };
}

// ---------------------------------------------------------------------
// 3) Valida a sessão a cada requisição (sem ir ao MongoDB)
//    Expiração deslizante: cada uso renova o TTL de 1 h.
// ---------------------------------------------------------------------
async function validarSessao(client, token) {
  const chave = k.sessao(token);
  const sessao = await client.hGetAll(chave);
  if (Object.keys(sessao).length === 0) return null;     // expirou ou fez logout
  await client.expire(chave, TTL_SESSAO);                 // renova
  return { ...sessao, permissoes: sessao.permissoes ? sessao.permissoes.split(",") : [] };
}

// ---------------------------------------------------------------------
// 4) Logout de uma sessão
// ---------------------------------------------------------------------
async function logout(client, token) {
  const sessao = await client.hGetAll(k.sessao(token));
  await client.del(k.sessao(token));
  if (sessao.usuario_id) await client.sRem(k.sessoesDoUsuario(sessao.usuario_id), token); // SREM
}

// ---------------------------------------------------------------------
// 5) Invalidação: quando o usuário troca senha/papel ou é desativado no
//    MongoDB, apaga o cache dele e derruba todas as sessões abertas.
// ---------------------------------------------------------------------
async function invalidarUsuario(client, usuarioId, email) {
  const tokens = await client.sMembers(k.sessoesDoUsuario(usuarioId)); // SMEMBERS
  const multi = client.multi().del(k.usuario(email.toLowerCase())).del(k.sessoesDoUsuario(usuarioId));
  for (const t of tokens) multi.del(k.sessao(t));
  await multi.exec();
  return tokens.length;
}

module.exports = { obterUsuario, login, validarSessao, logout, invalidarUsuario, k, TTL_SESSAO, TTL_USUARIO, MAX_TENTATIVAS };
