// =====================================================================
// Conexão com o Redis + detecção dos módulos probabilísticos
// =====================================================================
// REDIS_URL aceita Redis local, Docker ou Redis Cloud:
//   redis://localhost:6379
//   redis://default:SENHA@redis-12345.c1.us-east-1-2.ec2.redns.redis-cloud.com:12345
// =====================================================================
const { createClient } = require("redis");

async function conectar() {
  const url = process.env.REDIS_URL || "redis://localhost:6379";
  const client = createClient({ url });
  client.on("error", (err) => console.error("Erro no Redis:", err.message));
  await client.connect();
  return client;
}

// Testa se um comando de módulo existe (BF.* vem do RedisBloom, que está
// no Redis Stack, no Redis Cloud e embutido no Redis 8). Se não existir,
// o código usa a implementação própria com comandos básicos do Redis.
async function temComando(client, comandoTeste) {
  try {
    await client.sendCommand(comandoTeste);
    return true;
  } catch (e) {
    if (/unknown command/i.test(e.message)) return false;
    return true; // existe, só reclamou dos argumentos
  }
}

async function detectarModulos(client) {
  const bloom = await temComando(client, ["BF.EXISTS", "consentio:__teste__", "x"]);
  const cms = await temComando(client, ["CMS.INFO", "consentio:__teste__"]);
  return { bloom, cms };
}

module.exports = { conectar, detectarModulos };
