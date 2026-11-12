// =====================================================================
// Consentio — consultas de demonstração
// Uso: mongosh "<connection string do Atlas>" --file scripts/03_consultas_exemplo.js
// =====================================================================

const app = db.getSiblingDB("consentio");
const clinica = ObjectId("65b000000000000000000001"); // Clínica Sorriso Pleno
const titulo = (t) => print(`\n=== ${t} ===`);

titulo("1. Busca de paciente por nome (índice de texto)");
printjson(app.pacientes.find({ $text: { $search: "carlos" } }, { nome: 1, cpf: 1 }).toArray());

titulo("2. Pacientes com alergia registrada na anamnese");
printjson(app.pacientes.find(
  { clinica_id: clinica, "ficha.anamnese.alergias.0": { $exists: true } },
  { nome: 1, "ficha.anamnese.alergias": 1 }
).toArray());

titulo("3. Histórico documental do paciente Carlos (com nome do procedimento)");
printjson(app.documentos.aggregate([
  { $match: { clinica_id: clinica, paciente_id: ObjectId("65d000000000000000000002") } },
  { $sort: { gerado_em: -1 } },
  { $lookup: { from: "procedimentos", localField: "procedimento_id", foreignField: "_id", as: "proc" } },
  { $project: { _id: 0, gerado_em: 1, status: 1, documento: "$modelo.titulo", procedimento: { $first: "$proc.nome" } } },
]).toArray());

titulo("4. Agenda da semana (03/11 a 09/11/2026) com nomes de paciente e profissional");
printjson(app.agendamentos.aggregate([
  { $match: { clinica_id: clinica,
              inicio: { $gte: ISODate("2026-11-03T03:00:00Z"), $lt: ISODate("2026-11-10T03:00:00Z") },
              status: { $ne: "cancelado" } } },
  { $sort: { inicio: 1 } },
  { $lookup: { from: "pacientes", localField: "paciente_id", foreignField: "_id", as: "pac" } },
  { $lookup: { from: "usuarios", localField: "profissional_id", foreignField: "_id", as: "prof" } },
  { $project: { _id: 0, inicio: 1, status: 1, paciente: { $first: "$pac.nome" }, profissional: { $first: "$prof.nome" } } },
]).toArray());

titulo("5. Documentos gerados por status");
printjson(app.documentos.aggregate([
  { $match: { clinica_id: clinica } },
  { $group: { _id: "$status", total: { $sum: 1 } } },
  { $sort: { total: -1 } },
]).toArray());

titulo("6. Total de unidades de toxina aplicadas por paciente");
printjson(app.mapas_faciais.aggregate([
  { $match: { clinica_id: clinica, tipo: "toxina" } },
  { $unwind: "$pontos" },
  { $group: { _id: "$paciente_id", total_unidades: { $sum: "$pontos.unidades" } } },
  { $lookup: { from: "pacientes", localField: "_id", foreignField: "_id", as: "pac" } },
  { $project: { _id: 0, paciente: { $first: "$pac.nome" }, total_unidades: 1 } },
]).toArray());

titulo("7. Clínicas que atingiram o limite de documentos do plano no mês");
printjson(app.clinicas.aggregate([
  { $lookup: { from: "planos", localField: "assinatura.plano_id", foreignField: "_id", as: "plano" } },
  { $unwind: "$plano" },
  { $match: { "plano.limites.documentos_mes": { $ne: null } } },
  { $project: { _id: 0, nome: 1, plano: "$plano.nome", usados: "$uso_mes.documentos_gerados",
                limite: "$plano.limites.documentos_mes",
                atingiu_limite: { $gte: ["$uso_mes.documentos_gerados", "$plano.limites.documentos_mes"] } } },
]).toArray());

titulo("8. Teste da validação: inserir paciente sem data de nascimento (deve falhar)");
try {
  app.pacientes.insertOne({ clinica_id: clinica, nome: "Teste Inválido", criado_em: new Date() });
  print("Inserido (inesperado)");
} catch (e) {
  print("Rejeitado pelo $jsonSchema, como esperado: " + e.message.split("\n")[0]);
}

// =====================================================================
// ATIVIDADE A2 — 2 funcionalidades com pipelines de agregação diferentes
// =====================================================================

// ---------------------------------------------------------------------
// Funcionalidade 1: Top 5 alergias mais comuns entre os pacientes
// Tipo de pipeline: DESMEMBRAMENTO de array embutido (uma só coleção)
// Utilidade: ajuda a clínica a prever cuidados e materiais
// (ex.: luvas sem látex, evitar dipirona).
// ---------------------------------------------------------------------
titulo("A2.1 Top 5 alergias mais comuns ($unwind + $group)");
console.log("Coleção: pacientes | Etapas: $match → $unwind → $group → $sort → $limit → $project\n");

const estatisticaAlergias = app.pacientes.aggregate([
  // 1) Só pacientes que têm pelo menos uma alergia registrada
  { $match: { "ficha.anamnese.alergias.0": { $exists: true } } },

  // 2) Quebra o array: um paciente com 2 alergias vira 2 documentos
  { $unwind: "$ficha.anamnese.alergias" },

  // 3) Agrupa por alergia e conta quantos pacientes têm cada uma
  { $group: { _id: { $toLower: "$ficha.anamnese.alergias" }, total_pacientes: { $sum: 1 } } },

  // 4) Ordena da mais comum para a menos comum (desempate alfabético)
  { $sort: { total_pacientes: -1, _id: 1 } },

  // 5) Mantém apenas as 5 primeiras
  { $limit: 5 },

  // 6) Renomeia o _id para ficar legível
  { $project: { _id: 0, alergia: "$_id", total_pacientes: 1 } },
]).toArray();

printjson(estatisticaAlergias);

// ---------------------------------------------------------------------
// Funcionalidade 2: Relatório de documentos com contato do paciente
// Tipo de pipeline: PONTE / JOIN entre duas coleções
// Utilidade: a recepção vê quais termos ainda não foram assinados
// e já tem o telefone para cobrar o paciente.
// ---------------------------------------------------------------------
titulo("A2.2 Relatório de documentos com contato do paciente ($lookup)");
console.log("Coleções: documentos + pacientes | Etapas: $lookup → $unwind → $sort → $project\n");

const relatorioDocumentos = app.documentos.aggregate([
  // 1) JOIN: busca na coleção pacientes o documento cujo _id = paciente_id
  { $lookup: {
      from: "pacientes",
      localField: "paciente_id",
      foreignField: "_id",
      as: "dados_paciente",
  } },

  // 2) O $lookup devolve um array; o $unwind transforma em objeto único
  { $unwind: "$dados_paciente" },

  // 3) Mais recentes primeiro
  { $sort: { gerado_em: -1 } },

  // 4) Esconde os ObjectIds e mostra só o que interessa
  { $project: {
      _id: 0,
      status_documento: "$status",
      documento: "$modelo.titulo",
      data_geracao: "$gerado_em",
      paciente_nome: "$dados_paciente.nome",
      paciente_cpf: { $ifNull: ["$dados_paciente.cpf", "não informado"] },
      paciente_telefone: { $ifNull: ["$dados_paciente.contato.telefone", "não informado"] },
  } },
]).toArray();

printjson(relatorioDocumentos);
