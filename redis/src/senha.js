// =====================================================================
// Hash de senha com scrypt (nativo do Node.js, sem dependência extra)
// A senha NUNCA é guardada em texto puro: nem no MongoDB, nem no Redis.
// Formato salvo: scrypt$<salt em hex>$<hash em hex>
// =====================================================================
const crypto = require("crypto");

function gerarHash(senha) {
  const salt = crypto.randomBytes(16);                 // salt aleatório por usuário
  const hash = crypto.scryptSync(senha, salt, 64);     // função lenta de propósito
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

function conferirSenha(senha, armazenado) {
  const [alg, saltHex, hashHex] = String(armazenado).split("$");
  if (alg !== "scrypt") return false;
  const calculado = crypto.scryptSync(senha, Buffer.from(saltHex, "hex"), 64);
  // timingSafeEqual: compara em tempo constante (evita ataque de tempo)
  return crypto.timingSafeEqual(calculado, Buffer.from(hashHex, "hex"));
}

module.exports = { gerarHash, conferirSenha };
