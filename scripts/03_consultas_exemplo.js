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
