// =====================================================================
// Consentio — consultas de demonstração
// Uso: mongosh "<connection string do Atlas>" --file scripts/03_consultas_exemplo.js
//
// Modelagem: cada paciente guarda tudo o que é dele (documentos,
// agendamentos, odontogramas e mapas faciais são arrays embutidos).
// =====================================================================

const app = db.getSiblingDB("consentio");
const clinica = ObjectId("65b000000000000000000001"); // Clínica Sorriso Pleno
const titulo = (t) => print(`\n=== ${t} ===`);

titulo("1. Prontuário completo do paciente em UMA leitura (find)");
// Tudo o que é do paciente vem junto: ficha, documentos, agenda, odontogramas e mapas
printjson(app.pacientes.findOne(
  { _id: ObjectId("65d000000000000000000002") },
  { nome: 1, "ficha.anamnese": 1, "documentos.modelo.titulo": 1, "documentos.status": 1,
    "agendamentos.inicio": 1, "agendamentos.status": 1, "odontogramas.dentes": 1 }
));

titulo("2. Busca de paciente por nome (índice de texto)");
printjson(app.pacientes.find({ $text: { $search: "carlos" } }, { nome: 1, cpf: 1 }).toArray());

titulo("3. Pacientes com alergia registrada na anamnese");
printjson(app.pacientes.find(
  { clinica_id: clinica, "ficha.anamnese.alergias.0": { $exists: true } },
  { nome: 1, "ficha.anamnese.alergias": 1 }
).toArray());

titulo("4. Histórico documental do paciente Carlos (com nome do procedimento)");
printjson(app.pacientes.aggregate([
  { $match: { _id: ObjectId("65d000000000000000000002") } },
  { $unwind: "$documentos" },                                   // um item por documento do paciente
  { $sort: { "documentos.gerado_em": -1 } },
  { $lookup: { from: "procedimentos", localField: "documentos.procedimento_id", foreignField: "_id", as: "proc" } },
  { $project: { _id: 0, gerado_em: "$documentos.gerado_em", status: "$documentos.status",
                documento: "$documentos.modelo.titulo", procedimento: { $first: "$proc.nome" } } },
]).toArray());

titulo("5. Agenda da semana (03/11 a 09/11/2026) da clínica");
const inicioSemana = ISODate("2026-11-03T03:00:00Z");
const fimSemana = ISODate("2026-11-10T03:00:00Z");
printjson(app.pacientes.aggregate([
  // usa o índice multikey { clinica_id, "agendamentos.inicio" } para achar só quem tem consulta na semana
  { $match: { clinica_id: clinica, "agendamentos.inicio": { $gte: inicioSemana, $lt: fimSemana } } },
  { $unwind: "$agendamentos" },
  { $match: { "agendamentos.inicio": { $gte: inicioSemana, $lt: fimSemana },
              "agendamentos.status": { $ne: "cancelado" } } },
  { $sort: { "agendamentos.inicio": 1 } },
  { $lookup: { from: "usuarios", localField: "agendamentos.profissional_id", foreignField: "_id", as: "prof" } },
  { $project: { _id: 0, inicio: "$agendamentos.inicio", status: "$agendamentos.status",
                paciente: "$nome", profissional: { $first: "$prof.nome" } } },
]).toArray());

titulo("6. Documentos da clínica por status");
printjson(app.pacientes.aggregate([
  { $match: { clinica_id: clinica } },
  { $unwind: "$documentos" },
  { $group: { _id: "$documentos.status", total: { $sum: 1 } } },
  { $sort: { total: -1 } },
]).toArray());

titulo("7. Unidades de toxina aplicadas por paciente");
printjson(app.pacientes.aggregate([
  { $match: { clinica_id: clinica, "mapas_faciais.tipo": "toxina" } },
  { $unwind: "$mapas_faciais" },
  { $match: { "mapas_faciais.tipo": "toxina" } },
  { $unwind: "$mapas_faciais.pontos" },
  { $group: { _id: "$nome", total_unidades: { $sum: "$mapas_faciais.pontos.unidades" } } },
  { $project: { _id: 0, paciente: "$_id", total_unidades: 1 } },
]).toArray());

titulo("8. Clínicas que atingiram o limite de documentos do plano no mês");
printjson(app.clinicas.aggregate([
  { $lookup: { from: "planos", localField: "assinatura.plano_id", foreignField: "_id", as: "plano" } },
  { $unwind: "$plano" },
  { $match: { "plano.limites.documentos_mes": { $ne: null } } },
  { $project: { _id: 0, nome: 1, plano: "$plano.nome", usados: "$uso_mes.documentos_gerados",
                limite: "$plano.limites.documentos_mes",
                atingiu_limite: { $gte: ["$uso_mes.documentos_gerados", "$plano.limites.documentos_mes"] } } },
]).toArray());

titulo("9. Novo agendamento: entra direto no array do paciente ($push)");
// Exemplo de escrita na modelagem embutida: um único updateOne, atômico no documento
const novoAg = ObjectId();
app.pacientes.updateOne(
  { _id: ObjectId("65d000000000000000000003") },
  { $push: { agendamentos: { _id: novoAg, profissional_id: ObjectId("65c000000000000000000002"),
                              inicio: ISODate("2026-11-25T13:00:00Z"), fim: ISODate("2026-11-25T13:40:00Z"),
                              status: "agendado", criado_em: new Date() } },
    $set: { atualizado_em: new Date() } }
);
printjson(app.pacientes.findOne({ _id: ObjectId("65d000000000000000000003") }, { _id: 0, nome: 1, agendamentos: 1 }));
app.pacientes.updateOne({ _id: ObjectId("65d000000000000000000003") }, { $pull: { agendamentos: { _id: novoAg } } }); // desfaz o exemplo

titulo("10. Teste da validação: inserir paciente sem data de nascimento (deve falhar)");
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
// Tipo de pipeline: CONTAGEM — desmembra um array de valores simples e
// REDUZ tudo a uma estatística (muitos pacientes → 5 grupos).
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
// Funcionalidade 2: Relatório de documentos com contato do paciente e
// dados do profissional que emitiu o termo
// Tipo de pipeline: ENRIQUECIMENTO — abre o array de subdocumentos
// documentos[] e completa cada um com dados de OUTRA coleção ($lookup).
// Utilidade: a recepção vê quais termos ainda não foram assinados, já
// com o telefone do paciente e o CRO de quem emitiu.
// ---------------------------------------------------------------------
titulo("A2.2 Relatório de documentos com contato do paciente ($unwind + $lookup)");
console.log("Coleções: pacientes + usuarios | Etapas: $match → $unwind → $lookup → $unwind → $sort → $project\n");

const relatorioDocumentos = app.pacientes.aggregate([
  // 1) Só pacientes que têm algum documento gerado
  { $match: { "documentos.0": { $exists: true } } },

  // 2) Cada documento embutido vira um item separado
  //    (os dados de contato do paciente vêm junto, sem buscar em lugar nenhum)
  { $unwind: "$documentos" },

  // 3) $lookup: busca na coleção usuarios o profissional que emitiu o termo
  { $lookup: {
      from: "usuarios",
      localField: "documentos.profissional_id",
      foreignField: "_id",
      as: "profissional",
  } },

  // 4) O $lookup devolve um array; o $unwind transforma em objeto único
  { $unwind: "$profissional" },

  // 5) Mais recentes primeiro
  { $sort: { "documentos.gerado_em": -1 } },

  // 6) Esconde os ObjectIds e mostra só o que interessa
  { $project: {
      _id: 0,
      status_documento: "$documentos.status",
      documento: "$documentos.modelo.titulo",
      data_geracao: "$documentos.gerado_em",
      paciente_nome: "$nome",
      paciente_cpf: { $ifNull: ["$cpf", "não informado"] },
      paciente_telefone: { $ifNull: ["$contato.telefone", "não informado"] },
      profissional: "$profissional.nome",
      cro: { $concat: ["$profissional.cro.uf", " ", "$profissional.cro.numero"] },
  } },
]).toArray();

printjson(relatorioDocumentos);
