// =====================================================================
// "Banco principal" (MongoDB) — simulado em memória para a demo rodar
// em qualquer máquina, mesmo sem acesso ao Atlas.
//
// Os usuários são os mesmos de scripts/02_inserir_exemplos.js.
// Em produção, buscarUsuarioPorEmail() seria:
//   db.getSiblingDB("consentio").usuarios.findOne({ email })
// Cada chamada é contada para mostrar quantas vezes o cache evitou o banco.
// =====================================================================
const { gerarHash } = require("./senha");

const SENHA_DEMO = "Consentio@2026"; // senha de todos os usuários fictícios

const usuarios = [
  { _id: "65c000000000000000000001", clinica_id: "65b000000000000000000001",
    nome: "Dra. Mayra Oliveira", email: "mayra@sorrisopleno.com.br", papel: "administrador" },
  { _id: "65c000000000000000000002", clinica_id: "65b000000000000000000001",
    nome: "Dr. Lucas Ferreira", email: "lucas@sorrisopleno.com.br", papel: "dentista" },
  { _id: "65c000000000000000000003", clinica_id: "65b000000000000000000001",
    nome: "Júlia Martins", email: "recepcao@sorrisopleno.com.br", papel: "secretaria" },
  { _id: "65c000000000000000000004", clinica_id: "65b000000000000000000002",
    nome: "Dra. Paula Lima", email: "paula.lima.odonto@email.com", papel: "administrador" },
].map((u) => ({ ...u, senha_hash: gerarHash(SENHA_DEMO), ativo: true }));

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
