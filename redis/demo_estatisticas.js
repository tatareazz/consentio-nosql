// =====================================================================
// DEMO 2 — Estatísticas de uso com estruturas probabilísticas
// Executar:  npm run estatisticas      (dentro da pasta redis/)
//
// Gera um volume simulado de uso do Consentio e compara o valor
// ESTIMADO (estrutura probabilística) com o valor EXATO, mostrando o
// erro e a memória gasta.
// =====================================================================
const { conectar, detectarModulos } = require("./src/conexao");
const { BloomFilter, HLL, CountMinSketch } = require("./src/probabilisticas");
const { usuarios } = require("./src/banco_principal");

const titulo = (t) => console.log(`\n\x1b[1m=== ${t} ===\x1b[0m`);
const kb = (bytes) => (bytes / 1024).toFixed(1) + " KB";
const pct = (est, real) => (((est - real) / real) * 100).toFixed(2) + "%";

// gerador pseudoaleatório com semente (resultado igual em toda execução)
let semente = 42;
const aleatorio = () => ((semente = (semente * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);

async function limpar(client) {
  for await (const chave of client.scanIterator({ MATCH: "consentio:stats:*", COUNT: 500 })) await client.del(chave);
}

(async () => {
  const client = await conectar();
  await limpar(client);
  const modulos = await detectarModulos(client);
  console.log("Modo Bloom Filter:", modulos.bloom ? "nativo (BF.*)" : "implementação própria (SETBIT/GETBIT)");
  console.log("Modo Count-Min Sketch:", modulos.cms ? "nativo (CMS.*)" : "implementação própria (HINCRBY)");

  // ===================================================================
  // 1) BLOOM FILTER — e-mails já cadastrados
  // Uso no Consentio: na tela de cadastro, antes de consultar o MongoDB,
  // perguntar "este e-mail já existe?". Se o Bloom diz NÃO, é certeza:
  // libera o cadastro sem ir ao banco. Se diz TALVEZ, confirma no MongoDB.
  // ===================================================================
  titulo("1. Bloom Filter — e-mails de usuários já cadastrados");
  const bfEmails = new BloomFilter(client, "consentio:stats:bf:emails", { capacidade: 10000, erro: 0.01, nativo: modulos.bloom });
  await bfEmails.criar();
  console.log(`Parâmetros: capacidade 10.000 | erro 1% → m = ${bfEmails.m} bits (${kb(bfEmails.m / 8)}), k = ${bfEmails.k} hashes`);

  const cadastrados = [...usuarios.map((u) => u.email)];
  for (let i = 0; i < 9996; i++) cadastrados.push(`usuario${i}@clinica${i % 800}.com.br`);
  await bfEmails.adicionar(cadastrados);
  console.log(`Inseridos: ${cadastrados.length} e-mails`);

  const existentes = await bfEmails.talvezExista(cadastrados);
  const falsosNegativos = existentes.filter((x) => !x).length;
  console.log(`Falsos negativos entre os cadastrados: ${falsosNegativos} (garantido: sempre 0)`);

  const novos = Array.from({ length: 10000 }, (_, i) => `novo${i}@outraclinica.com.br`);
  const fp = (await bfEmails.talvezExista(novos)).filter(Boolean).length;
  console.log(`Falsos positivos em 10.000 e-mails novos: ${fp} (${((fp / 10000) * 100).toFixed(2)}% — esperado ≈ 1%)`);
  console.log(`→ ${10000 - fp} cadastros liberados SEM consultar o MongoDB; só ${fp} precisaram confirmar no banco.`);

  const [teste] = await bfEmails.talvezExista(["mayra@sorrisopleno.com.br"]);
  console.log(`"mayra@sorrisopleno.com.br" já existe? ${teste ? "TALVEZ → confirmar no MongoDB" : "NÃO"}`);
  console.log(`Memória do Bloom no Redis: ${kb(await client.memoryUsage("consentio:stats:bf:emails"))}`);

  // ===================================================================
  // 2) HYPERLOGLOG — usuários ativos únicos e pacientes únicos atendidos
  // Uso no Consentio: painel "quantos usuários usaram o sistema hoje /
  // na semana" e "quantos pacientes diferentes cada clínica atendeu".
  // ===================================================================
  titulo("2. HyperLogLog — usuários ativos e pacientes únicos");
  const dias = ["2026-11-13", "2026-11-14", "2026-11-15", "2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19"];
  const exatoSemana = new Set();
  for (const dia of dias) {
    const ativosHoje = [];
    for (let i = 0; i < 3000; i++) ativosHoje.push(`u${Math.floor(aleatorio() * 6000)}`); // 6.000 usuários na base
    await HLL.adicionar(client, `consentio:stats:hll:ativos:${dia}`, ativosHoje);          // PFADD
    ativosHoje.forEach((u) => exatoSemana.add(u));
    const est = await HLL.contar(client, [`consentio:stats:hll:ativos:${dia}`]);           // PFCOUNT
    console.log(`${dia}: estimado ${String(est).padStart(5)} | exato ${String(new Set(ativosHoje).size).padStart(5)} | erro ${pct(est, new Set(ativosHoje).size)}`);
  }
  // PFMERGE: une os 7 dias sem contar duas vezes o mesmo usuário
  await HLL.unir(client, "consentio:stats:hll:ativos:semana-47", dias.map((d) => `consentio:stats:hll:ativos:${d}`));
  const semana = await HLL.contar(client, ["consentio:stats:hll:ativos:semana-47"]);
  console.log(`Semana (PFMERGE dos 7 dias): estimado ${semana} | exato ${exatoSemana.size} | erro ${pct(semana, exatoSemana.size)}`);

  // Comparação de memória: HyperLogLog x SET exato com 100 mil pacientes
  const pacientes = Array.from({ length: 100000 }, (_, i) => `paciente:${i}`);
  for (let i = 0; i < pacientes.length; i += 5000) {
    await HLL.adicionar(client, "consentio:stats:hll:pacientes:clinica1", pacientes.slice(i, i + 5000));
    await client.sAdd("consentio:stats:set:pacientes:clinica1", pacientes.slice(i, i + 5000));
  }
  const estPac = await HLL.contar(client, ["consentio:stats:hll:pacientes:clinica1"]);
  console.log(`\n100.000 pacientes únicos visualizados na clínica 1:`);
  console.log(`  HyperLogLog → ${estPac} (erro ${pct(estPac, 100000)}) usando ${kb(await client.memoryUsage("consentio:stats:hll:pacientes:clinica1"))}`);
  console.log(`  SET exato   → ${await client.sCard("consentio:stats:set:pacientes:clinica1")} usando ${kb(await client.memoryUsage("consentio:stats:set:pacientes:clinica1"))}`);
  await client.del("consentio:stats:set:pacientes:clinica1"); // o SET era só para comparar

  // ===================================================================
  // 3) COUNT-MIN SKETCH — frequência de ações no sistema
  // Uso no Consentio: quantas vezes cada ação foi disparada no dia e
  // em que horário acontece o pico de geração de termos.
  // ===================================================================
  titulo("3. Count-Min Sketch — ações mais disparadas e horário de pico");
  const cms = new CountMinSketch(client, "consentio:stats:cms:eventos:2026-11-19", { largura: 2000, profundidade: 5, nativo: modulos.cms });
  await cms.criar();

  const pesos = { agenda_consultada: 40, ficha_aberta: 25, documento_gerado: 15, odontograma_aberto: 10, mapa_facial_aberto: 5, login: 5 };
  const sorteio = Object.entries(pesos).flatMap(([acao, p]) => Array(p).fill(acao));
  const exato = {};
  let lote = {};
  for (let i = 0; i < 50000; i++) {
    const acao = sorteio[Math.floor(aleatorio() * sorteio.length)];
    // horário com pico no fim da manhã e no meio da tarde (horário comercial)
    const hora = [8, 9, 10, 10, 11, 11, 11, 13, 14, 14, 15, 15, 15, 16, 17, 18][Math.floor(aleatorio() * 16)];
    for (const item of [acao, `${acao}@${hora}h`]) {
      exato[item] = (exato[item] || 0) + 1;
      lote[item] = (lote[item] || 0) + 1;
    }
    if (i % 2000 === 1999) { await cms.incrementar(lote); lote = {}; } // envia em lotes
  }
  await cms.incrementar(lote);

  console.log("Ação                 estimado    exato   diferença");
  const acoes = Object.keys(pesos);
  const est = await cms.consultar(acoes);
  acoes.map((a, i) => [a, est[i]]).sort((a, b) => b[1] - a[1]).forEach(([a, e]) =>
    console.log(`${a.padEnd(20)} ${String(e).padStart(8)} ${String(exato[a]).padStart(8)}   +${e - exato[a]}`));

  const horas = Array.from({ length: 24 }, (_, h) => h);
  const porHora = await cms.consultar(horas.map((h) => `documento_gerado@${h}h`));
  const pico = porHora.indexOf(Math.max(...porHora));
  console.log(`\nPico de geração de termos: ${pico}h (≈ ${porHora[pico]} termos; exato ${exato[`documento_gerado@${pico}h`]})`);
  console.log(`Memória do Count-Min Sketch: ${kb(await client.memoryUsage("consentio:stats:cms:eventos:2026-11-19"))} para 50.000 eventos`);

  // Mesmo fluxo num CMS minúsculo (largura 8) para VER a superestimativa:
  // com poucas colunas, ações diferentes caem no mesmo contador e somam.
  const mini = new CountMinSketch(client, "consentio:stats:cms:mini", { largura: 8, profundidade: 2, nativo: modulos.cms });
  await mini.criar();
  const itensPorHora = Object.fromEntries(Object.entries(exato).filter(([i]) => i.includes("@")));
  await mini.incrementar(itensPorHora);
  const amostra = ["documento_gerado@11h", "login@8h", "mapa_facial_aberto@18h"];
  const estMini = await mini.consultar(amostra);
  console.log("\nCMS pequeno de propósito (largura 8, profundidade 2) — erro aparece, sempre para CIMA:");
  amostra.forEach((a, i) => console.log(`  ${a.padEnd(24)} estimado ${String(estMini[i]).padStart(5)} | exato ${String(exato[a]).padStart(5)} | +${estMini[i] - exato[a]}`));

  // TTL: estatística diária não precisa ficar para sempre
  for await (const chave of client.scanIterator({ MATCH: "consentio:stats:*" })) await client.expire(chave, 90 * 24 * 3600);
  console.log("\nTodas as chaves de estatística receberam TTL de 90 dias.");

  await client.quit();
})().catch((e) => { console.error(e); process.exit(1); });
