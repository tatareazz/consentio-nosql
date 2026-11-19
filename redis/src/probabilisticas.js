// =====================================================================
// Estruturas probabilísticas no Redis — Consentio
// =====================================================================
// - Bloom Filter  : "este e-mail/CPF/hash já existe?"   (BF.* ou bitmap)
// - HyperLogLog   : "quantos usuários/pacientes únicos?" (PFADD/PFCOUNT, nativo)
// - Count-Min Sketch: "quantas vezes este evento ocorreu?" (CMS.* ou hash)
//
// Bloom e CMS usam os comandos do módulo RedisBloom quando ele existe
// (Redis Stack, Redis Cloud, Redis 8). Sem o módulo, usam uma
// implementação própria, com o MESMO algoritmo, só com comandos básicos
// (SETBIT/GETBIT e HINCRBY). A interface é igual nos dois modos.
// =====================================================================
const crypto = require("crypto");

// Gera dois números de 32 bits a partir do SHA-256 do item.
// Com eles, "fabricamos" k hashes independentes: h(i) = h1 + i*h2
// (técnica de double hashing de Kirsch & Mitzenmacher).
function doisHashes(item) {
  const d = crypto.createHash("sha256").update(String(item)).digest();
  // ">>> 0" mantém o número sem sinal; "| 1" deixa h2 ímpar (nunca zero)
  return [d.readUInt32BE(0), (d.readUInt32BE(4) | 1) >>> 0];
}

// =====================================================================
// BLOOM FILTER
// =====================================================================
class BloomFilter {
  // capacidade = quantos itens esperamos; erro = taxa de falso positivo
  constructor(client, chave, { capacidade = 10000, erro = 0.01, nativo = false } = {}) {
    this.client = client;
    this.chave = chave;
    this.nativo = nativo;
    this.capacidade = capacidade;
    this.erro = erro;
    // Fórmulas clássicas do Bloom Filter:
    //   m (bits)    = -n * ln(p) / (ln 2)^2
    //   k (hashes)  = (m / n) * ln 2
    this.m = Math.ceil((-capacidade * Math.log(erro)) / Math.LN2 ** 2);
    this.k = Math.round((this.m / capacidade) * Math.LN2);
  }

  async criar() {
    if (!this.nativo) return; // bitmap é criado sozinho no primeiro SETBIT
    try {
      // BF.RESERVE chave taxa_erro capacidade
      await this.client.sendCommand(["BF.RESERVE", this.chave, String(this.erro), String(this.capacidade)]);
    } catch (e) {
      if (!/exists/i.test(e.message)) throw e; // já criado antes: tudo bem
    }
  }

  posicoes(item) {
    const [h1, h2] = doisHashes(item);
    return Array.from({ length: this.k }, (_, i) => (h1 + i * h2) % this.m);
  }

  async adicionar(itens) {
    if (this.nativo) {
      // BF.MADD chave item1 item2 ...
      for (let i = 0; i < itens.length; i += 1000) {
        await this.client.sendCommand(["BF.MADD", this.chave, ...itens.slice(i, i + 1000).map(String)]);
      }
      return;
    }
    // Fallback: liga os k bits de cada item (SETBIT chave posição 1)
    const multi = this.client.multi();
    for (const item of itens) for (const p of this.posicoes(item)) multi.setBit(this.chave, p, 1);
    await multi.exec();
  }

  // true  = "talvez exista" (pode ser falso positivo)
  // false = "com certeza NÃO existe" (nunca há falso negativo)
  async talvezExista(itens) {
    if (this.nativo) {
      const r = await this.client.sendCommand(["BF.MEXISTS", this.chave, ...itens.map(String)]);
      return r.map((x) => x === 1);
    }
    const multi = this.client.multi();
    for (const item of itens) for (const p of this.posicoes(item)) multi.getBit(this.chave, p);
    const bits = await multi.exec();
    // o item "existe" só se TODOS os seus k bits estiverem ligados
    return itens.map((_, i) => bits.slice(i * this.k, (i + 1) * this.k).every((b) => b === 1));
  }
}

// =====================================================================
// HYPERLOGLOG (nativo em qualquer Redis: PFADD, PFCOUNT, PFMERGE)
// =====================================================================
const HLL = {
  adicionar: (client, chave, itens) => client.pfAdd(chave, itens.map(String)),   // PFADD
  contar: (client, chaves) => client.pfCount(chaves),                              // PFCOUNT
  unir: (client, destino, origens) => client.pfMerge(destino, origens),            // PFMERGE
};

// =====================================================================
// COUNT-MIN SKETCH
// =====================================================================
class CountMinSketch {
  // largura (w) controla o tamanho do erro; profundidade (d) a confiança
  //   erro ≈ e / w        (e = 2,718)   → w = 2000 → erro ≈ 0,14% do total
  //   confiança = 1 - e^(-d)            → d = 5    → 99,3%
  constructor(client, chave, { largura = 2000, profundidade = 5, nativo = false } = {}) {
    Object.assign(this, { client, chave, largura, profundidade, nativo });
  }

  async criar() {
    if (!this.nativo) return; // hash é criado no primeiro HINCRBY
    try {
      // CMS.INITBYDIM chave largura profundidade
      await this.client.sendCommand(["CMS.INITBYDIM", this.chave, String(this.largura), String(this.profundidade)]);
    } catch (e) {
      if (!/exists/i.test(e.message)) throw e;
    }
  }

  // coluna do item em cada linha: um hash diferente por linha
  colunas(item) {
    const [h1, h2] = doisHashes(item);
    return Array.from({ length: this.profundidade }, (_, i) => (h1 + i * h2) % this.largura);
  }

  // incrementos: { "documento_gerado": 1, "agenda_consultada": 3, ... }
  async incrementar(incrementos) {
    const pares = Object.entries(incrementos);
    if (this.nativo) {
      // CMS.INCRBY chave item1 qtd1 item2 qtd2 ...
      await this.client.sendCommand(["CMS.INCRBY", this.chave, ...pares.flatMap(([i, q]) => [String(i), String(q)])]);
      return;
    }
    // Fallback: matriz d x w guardada num HASH (campo "linha:coluna")
    const multi = this.client.multi();
    for (const [item, qtd] of pares) {
      this.colunas(item).forEach((col, linha) => multi.hIncrBy(this.chave, `${linha}:${col}`, qtd));
    }
    await multi.exec();
  }

  // estimativa = MENOR contador entre as d linhas (o menos "contaminado")
  async consultar(itens) {
    if (this.nativo) {
      return (await this.client.sendCommand(["CMS.QUERY", this.chave, ...itens.map(String)])).map(Number);
    }
    const resultado = [];
    for (const item of itens) {
      const campos = this.colunas(item).map((col, linha) => `${linha}:${col}`);
      const valores = await this.client.hmGet(this.chave, campos);                 // HMGET
      resultado.push(Math.min(...valores.map((v) => Number(v) || 0)));
    }
    return resultado;
  }
}

module.exports = { BloomFilter, HLL, CountMinSketch };
