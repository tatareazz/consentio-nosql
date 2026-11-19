// =====================================================================
// Executa um arquivo .redis linha a linha, ignorando comentários (#),
// e mostra cada comando com a resposta. Funciona em Windows/Mac/Linux,
// sem precisar instalar o redis-cli.
// Uso:  node cli/executar.js cli/01_cache_login.redis
// =====================================================================
const fs = require("fs");
const { conectar } = require("../src/conexao");

// separa a linha em argumentos, respeitando "texto entre aspas"
const argumentos = (linha) => [...linha.matchAll(/"([^"]*)"|(\S+)/g)].map((m) => m[1] ?? m[2]);

const formatar = (r, nivel = 0) => {
  if (r === null) return "(nil)";
  if (Array.isArray(r)) return r.length ? "\n" + r.map((x, i) => `${"   ".repeat(nivel + 1)}${i + 1}) ${formatar(x, nivel + 1)}`).join("\n") : "(vazio)";
  return typeof r === "number" ? `(integer) ${r}` : String(r);
};

(async () => {
  const arquivo = process.argv[2];
  if (!arquivo) return console.log("Uso: node cli/executar.js cli/<arquivo>.redis");
  const client = await conectar();
  for (const bruta of fs.readFileSync(arquivo, "utf8").split(/\r?\n/)) {
    const linha = bruta.trim();
    if (!linha) continue;
    if (linha.startsWith("#")) { console.log(`\x1b[90m${linha}\x1b[0m`); continue; }
    try {
      console.log(`\x1b[36m> ${linha}\x1b[0m\n${formatar(await client.sendCommand(argumentos(linha)))}`);
    } catch (e) {
      console.log(`\x1b[31m(erro) ${e.message}\x1b[0m`);
    }
  }
  await client.quit();
})();
