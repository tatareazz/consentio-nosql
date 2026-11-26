// =====================================================================
// "Banco principal" (MongoDB) — simulado em memória para a demo rodar
// em qualquer máquina, mesmo sem acesso ao Atlas.
//
// Os usuários são os mesmos de scripts/02_inserir_exemplos.js.
// Em produção, buscarUsuarioPorEmail() seria:
//   db.getSiblingDB("consentio").usuarios.findOne({ email })
// Cada chamada é contada para mostrar quantas vezes o cache evitou o banco.
// =====================================================================
const SENHA_DEMO = "Consentio@2026"; // senha de todos os usuários fictícios

// senha_hash: os mesmos hashes scrypt de scripts/02_inserir_exemplos.js
// (todos são a senha de demonstração "Consentio@2026").
const usuarios = [
  { _id: "65c000000000000000000001", clinica_id: "65b000000000000000000001",
    nome: "Dra. Mayra Oliveira", email: "mayra@sorrisopleno.com.br", papel: "administrador",
    senha_hash: "scrypt$c0ffee00000000000000000000000000$e04903ce8b5d5356078cc783a0fbbad155781096c186b7b161bfca00acd9c88dce03c0f1967ffd065205f0497f5895b9e1060f6a3a91d0954828f4f2012b1561" },
  { _id: "65c000000000000000000002", clinica_id: "65b000000000000000000001",
    nome: "Dr. Lucas Ferreira", email: "lucas@sorrisopleno.com.br", papel: "dentista",
    senha_hash: "scrypt$c0ffee10000000000000000000000000$28633f07232fe6aff69d3ce473db88b00975830fb31278d77dea53c5f8167ae143cfcc7794ece4734faf03113117140a848d96f5b740c3460028b2bfb60b801b" },
  { _id: "65c000000000000000000003", clinica_id: "65b000000000000000000001",
    nome: "Júlia Martins", email: "recepcao@sorrisopleno.com.br", papel: "secretaria",
    senha_hash: "scrypt$c0ffee20000000000000000000000000$789b60f0d1ce9c8dadef3c91d9a863fd882dfa346f688f8e859b5faded83bb919466d018f2df618ba96d274187469ca869079fd147c135b3fd0e261c5b58a139" },
  { _id: "65c000000000000000000004", clinica_id: "65b000000000000000000002",
    nome: "Dra. Paula Lima", email: "paula.lima.odonto@email.com", papel: "administrador",
    senha_hash: "scrypt$c0ffee30000000000000000000000000$c9e91cb98e90a573b08a6ff080440d6845e76e6d6f129c9ad203343027209916a3abdfec72a1dbb8706c7795b7a0dab516636742d3de641b82139e4c1f90d525" },
].map((u) => ({ ...u, ativo: true }));

// Permissões por papel (no sistema real viriam da clínica/configuração)
const PERMISSOES = {
  administrador: ["pacientes:ler", "pacientes:editar", "documentos:gerar", "agenda:editar", "plano:gerenciar"],
  dentista: ["pacientes:ler", "pacientes:editar", "documentos:gerar", "agenda:editar"],
  secretaria: ["pacientes:ler", "agenda:editar"],
};

let consultasAoBanco = 0;

async function buscarUsuarioPorEmail(email) {
  consultasAoBanco++;
  await new Promise((r) => setTimeout(r, 40)); // simula a latência de rede até o Atlas
  return usuarios.find((u) => u.email === email.toLowerCase()) || null;
}

function totalConsultasAoBanco() { return consultasAoBanco; }

module.exports = { buscarUsuarioPorEmail, totalConsultasAoBanco, PERMISSOES, SENHA_DEMO, usuarios };
