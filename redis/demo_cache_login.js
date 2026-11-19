// =====================================================================
// DEMO 1 — Cache de login de usuário (Consentio + Redis)
// Executar:  npm run login      (dentro da pasta redis/)
// =====================================================================
const { conectar } = require("./src/conexao");
const L = require("./src/cache_login");
const { totalConsultasAoBanco, SENHA_DEMO } = require("./src/banco_principal");

const titulo = (t) => console.log(`\n\x1b[1m=== ${t} ===\x1b[0m`);
const ms = async (fn) => { const t = performance.now(); const r = await fn(); return [r, (performance.now() - t).toFixed(1)]; };

// Apaga só as chaves da demo (nunca FLUSHALL, para não apagar dados de outros)
async function limpar(client) {
  for await (const chave of client.scanIterator({ MATCH: "consentio:*", COUNT: 500 })) await client.del(chave);
}

(async () => {
  const client = await conectar();
  await limpar(client);
  const email = "mayra@sorrisopleno.com.br";

  titulo("1. Primeiro login → CACHE MISS (busca no MongoDB e grava no Redis)");
  let [r, t] = await ms(() => L.login(client, email, SENHA_DEMO, "177.10.20.30"));
  console.log(`${r.origem} | ${t} ms | consultas ao banco até agora: ${totalConsultasAoBanco()}`);
  console.log("Sessão criada:", r.sessao);
  console.log("Token (vai no cookie/Authorization do navegador):", r.token.slice(0, 16) + "…");

  titulo("2. O que ficou guardado no Redis");
  const cacheUsuario = await client.hGetAll(L.k.usuario(email));
  console.log("HGETALL", L.k.usuario(email));
  console.log({ ...cacheUsuario, senha_hash: cacheUsuario.senha_hash.slice(0, 30) + "… (hash scrypt, nunca a senha)" });
  console.log("TTL do usuário em cache:", await client.ttl(L.k.usuario(email)), "s");
  console.log("TTL da sessão:", await client.ttl(L.k.sessao(r.token)), "s");

  titulo("3. Requisições seguintes validam a sessão direto no Redis");
  const [sessao, t2] = await ms(() => L.validarSessao(client, r.token));
  console.log(`Sessão válida em ${t2} ms, sem ir ao banco →`, sessao.nome, "|", sessao.papel, "|", sessao.permissoes.join(" "));

  titulo("4. Logout e novo login → CACHE HIT (não consulta o MongoDB)");
  await L.logout(client, r.token);
  console.log("Após logout, sessão antiga existe?", (await L.validarSessao(client, r.token)) !== null);
  [r, t] = await ms(() => L.login(client, email, SENHA_DEMO));
  console.log(`${r.origem} | ${t} ms | consultas ao banco até agora: ${totalConsultasAoBanco()} (não aumentou)`);

  titulo("5. Proteção contra força bruta (5 senhas erradas → bloqueio de 15 min)");
  const alvo = "recepcao@sorrisopleno.com.br";
  for (let i = 1; i <= 6; i++) {
    const x = await L.login(client, alvo, "senhaErrada" + i);
    console.log(`Tentativa ${i}:`, x.motivo);
  }
  const certa = await L.login(client, alvo, SENHA_DEMO);
  console.log("Mesmo com a senha certa:", certa.motivo);

  titulo("6. Invalidação: usuário trocou a senha no MongoDB → derruba todas as sessões");
  const lucas = "lucas@sorrisopleno.com.br";
  const celular = await L.login(client, lucas, SENHA_DEMO, "10.0.0.2");
  const notebook = await L.login(client, lucas, SENHA_DEMO, "10.0.0.3");
  console.log("Sessões abertas do Dr. Lucas:", await client.sCard(L.k.sessoesDoUsuario(celular.sessao.usuario_id)));
  const derrubadas = await L.invalidarUsuario(client, celular.sessao.usuario_id, lucas);
  console.log(`Sessões derrubadas: ${derrubadas}`);
  console.log("Celular ainda logado?", (await L.validarSessao(client, celular.token)) !== null);
  console.log("Notebook ainda logado?", (await L.validarSessao(client, notebook.token)) !== null);
  console.log("Cache do usuário existe?", (await client.exists(L.k.usuario(lucas))) === 1);

  titulo("Chaves no Redis ao final");
  for await (const chave of client.scanIterator({ MATCH: "consentio:*" })) {
    console.log(`${(await client.type(chave)).padEnd(6)} TTL ${String(await client.ttl(chave)).padStart(5)}s  ${chave.length > 70 ? chave.slice(0, 70) + "…" : chave}`);
  }

  await client.quit();
})().catch((e) => { console.error(e); process.exit(1); });
