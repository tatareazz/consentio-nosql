// =====================================================================
// Consentio — documentos de exemplo (dados fictícios)
// Uso: mongosh "<connection string do Atlas>" --file scripts/02_inserir_exemplos.js
// Rode depois do 01_criar_estrutura.js
// =====================================================================

const app = db.getSiblingDB("consentio");
const auditoria = db.getSiblingDB("consentio_auditoria");

// IDs fixos para que as referências entre coleções fiquem consistentes
const id = {
  plano_basico: ObjectId("65a000000000000000000001"),
  plano_essencial: ObjectId("65a000000000000000000002"),
  plano_business: ObjectId("65a000000000000000000003"),

  clinica_sorriso: ObjectId("65b000000000000000000001"),
  clinica_harmonia: ObjectId("65b000000000000000000002"),

  dra_mayra: ObjectId("65c000000000000000000001"),
  dr_lucas: ObjectId("65c000000000000000000002"),
  sec_julia: ObjectId("65c000000000000000000003"),
  dra_paula: ObjectId("65c000000000000000000004"),

  pac_ana: ObjectId("65d000000000000000000001"),
  pac_carlos: ObjectId("65d000000000000000000002"),
  pac_helena: ObjectId("65d000000000000000000003"),
  pac_pedro: ObjectId("65d000000000000000000004"),

  mod_exodontia: ObjectId("65e000000000000000000001"),
  mod_clareamento: ObjectId("65e000000000000000000002"),
  mod_toxina: ObjectId("65e000000000000000000003"),
  mod_preenchimento: ObjectId("65e000000000000000000004"),
  mod_canal: ObjectId("65e000000000000000000005"),

  proc_exodontia: ObjectId("65f000000000000000000001"),
  proc_clareamento: ObjectId("65f000000000000000000002"),
  proc_toxina: ObjectId("65f000000000000000000003"),
  proc_preenchimento: ObjectId("65f000000000000000000004"),
  proc_canal: ObjectId("65f000000000000000000005"),
  proc_limpeza: ObjectId("65f000000000000000000006"),

  doc1: ObjectId("660000000000000000000001"),
  doc2: ObjectId("660000000000000000000002"),
  doc3: ObjectId("660000000000000000000003"),
};

// ---------------- planos ----------------
app.planos.insertMany([
  {
    _id: id.plano_basico, codigo: "basico", nome: "Básico",
    descricao: "Teste gratuitamente nossa plataforma",
    preco_mensal: 0, limites: { pacientes: 2, documentos_mes: 5 },
    recursos: ["gestao_pacientes", "documentos_automaticos"], ativo: true,
  },
  {
    _id: id.plano_essencial, codigo: "essencial", nome: "Essencial",
    descricao: "Para clínicas em crescimento",
    preco_mensal: 59.9, limites: { pacientes: 60, documentos_mes: null },
    recursos: ["gestao_pacientes", "documentos_automaticos", "agenda", "historico_documental"], ativo: true,
  },
  {
    _id: id.plano_business, codigo: "business", nome: "Business",
    descricao: "Para quem quer a experiência completa",
    preco_mensal: 119.9, limites: { pacientes: null, documentos_mes: null },
    recursos: ["gestao_pacientes", "documentos_automaticos", "agenda", "historico_documental",
               "odontograma", "mapas_faciais", "suporte_whatsapp"], ativo: true,
  },
]);

// ---------------- clínicas ----------------
app.clinicas.insertMany([
  {
    _id: id.clinica_sorriso, nome: "Clínica Sorriso Pleno", cnpj: "12.345.678/0001-90",
    endereco: { logradouro: "Av. Rondon Pacheco", numero: "1500", bairro: "Tibery",
                cidade: "Uberlândia", uf: "MG", cep: "38405-142" },
    contato: { telefone: "(34) 3210-0000", email: "contato@sorrisopleno.com.br" },
    assinatura: { plano_id: id.plano_business, status: "ativa",
                  inicio: ISODate("2026-08-01T00:00:00Z"), proxima_cobranca: ISODate("2026-12-01T00:00:00Z") },
    uso_mes: { referencia: "2026-11", documentos_gerados: 3 },
    configuracoes: { fuso_horario: "America/Sao_Paulo", duracao_padrao_consulta_min: 40 },
    criado_em: ISODate("2026-08-01T12:00:00Z"),
  },
  {
    _id: id.clinica_harmonia, nome: "Consultório Dra. Paula Lima",
    endereco: { logradouro: "Rua Duque de Caxias", numero: "320", bairro: "Centro",
                cidade: "Uberlândia", uf: "MG", cep: "38400-142" },
    contato: { telefone: "(34) 99888-7777", email: "paula.lima.odonto@email.com" },
    assinatura: { plano_id: id.plano_basico, status: "trial",
                  inicio: ISODate("2026-10-25T00:00:00Z"), proxima_cobranca: null },
    uso_mes: { referencia: "2026-11", documentos_gerados: 0 },
    criado_em: ISODate("2026-10-25T18:30:00Z"),
  },
]);

// ---------------- usuários ----------------
app.usuarios.insertMany([
  {
    _id: id.dra_mayra, clinica_id: id.clinica_sorriso, nome: "Dra. Mayra Oliveira",
    email: "mayra@sorrisopleno.com.br", senha_hash: "$2b$12$exemploHashBcryptNaoUsarEmProducao000000000000",
    papel: "administrador", cro: { numero: "45678", uf: "MG" },
    especialidades: ["harmonizacao_orofacial", "clinica_geral"],
    ativo: true, ultimo_login: ISODate("2026-11-03T11:02:00Z"), criado_em: ISODate("2026-08-01T12:05:00Z"),
  },
  {
    _id: id.dr_lucas, clinica_id: id.clinica_sorriso, nome: "Dr. Lucas Ferreira",
    email: "lucas@sorrisopleno.com.br", senha_hash: "$2b$12$exemploHashBcryptNaoUsarEmProducao111111111111",
    papel: "dentista", cro: { numero: "51234", uf: "MG" }, especialidades: ["endodontia", "cirurgia"],
    ativo: true, ultimo_login: ISODate("2026-11-02T19:40:00Z"), criado_em: ISODate("2026-08-03T14:00:00Z"),
  },
  {
    _id: id.sec_julia, clinica_id: id.clinica_sorriso, nome: "Júlia Martins",
    email: "recepcao@sorrisopleno.com.br", senha_hash: "$2b$12$exemploHashBcryptNaoUsarEmProducao222222222222",
    papel: "secretaria", ativo: true, ultimo_login: ISODate("2026-11-03T10:55:00Z"),
    criado_em: ISODate("2026-08-05T09:00:00Z"),
  },
  {
    _id: id.dra_paula, clinica_id: id.clinica_harmonia, nome: "Dra. Paula Lima",
    email: "paula.lima.odonto@email.com", senha_hash: "$2b$12$exemploHashBcryptNaoUsarEmProducao333333333333",
    papel: "administrador", cro: { numero: "60321", uf: "MG" }, especialidades: ["dentistica"],
    ativo: true, ultimo_login: null, criado_em: ISODate("2026-10-25T18:30:00Z"),
  },
]);

// ---------------- pacientes ----------------
app.pacientes.insertMany([
  {
    _id: id.pac_ana, clinica_id: id.clinica_sorriso, nome: "Ana Beatriz Souza", cpf: "123.456.789-09",
    data_nascimento: ISODate("1992-04-15T00:00:00Z"), sexo: "F",
    contato: { telefone: "(34) 99999-1111", email: "ana.souza@email.com" },
    endereco: { logradouro: "Rua Goiás", numero: "88", bairro: "Centro", cidade: "Uberlândia", uf: "MG", cep: "38400-027" },
    ficha: {
      anamnese: { alergias: ["dipirona"], medicamentos_em_uso: [], doencas_preexistentes: [],
                  gestante: false, fumante: false, observacoes: "Ansiedade em procedimentos longos." },
      convenio: null,
    },
    tags: ["harmonizacao"],
    criado_em: ISODate("2026-10-20T13:00:00Z"), atualizado_em: ISODate("2026-10-28T15:10:00Z"),
  },
  {
    _id: id.pac_carlos, clinica_id: id.clinica_sorriso, nome: "Carlos Eduardo Ribeiro", cpf: "987.654.321-00",
    data_nascimento: ISODate("1978-11-02T00:00:00Z"), sexo: "M",
    contato: { telefone: "(34) 98888-2222" },
    ficha: {
      anamnese: { alergias: [], medicamentos_em_uso: ["losartana 50mg"], doencas_preexistentes: ["hipertensão"],
                  gestante: false, fumante: true },
      convenio: "OdontoPrev",
    },
    tags: ["endodontia"],
    criado_em: ISODate("2026-09-12T17:20:00Z"), atualizado_em: ISODate("2026-10-30T12:00:00Z"),
  },
  {
    // paciente menor de idade, com responsável legal e sem CPF informado
    _id: id.pac_helena, clinica_id: id.clinica_sorriso, nome: "Helena Costa Almeida",
    data_nascimento: ISODate("2015-06-30T00:00:00Z"), sexo: "F",
    contato: { telefone: "(34) 97777-3333" },
    responsavel_legal: { nome: "Fernanda Costa Almeida", cpf: "111.222.333-44", parentesco: "mãe" },
    ficha: { anamnese: { alergias: ["látex"], medicamentos_em_uso: [], doencas_preexistentes: [] } },
    criado_em: ISODate("2026-10-05T14:00:00Z"),
  },
  {
    _id: id.pac_pedro, clinica_id: id.clinica_harmonia, nome: "Pedro Henrique Nunes", cpf: "555.666.777-88",
    data_nascimento: ISODate("1999-01-21T00:00:00Z"), sexo: "M",
    contato: { email: "pedro.nunes@email.com" },
    criado_em: ISODate("2026-10-26T10:00:00Z"),
  },
]);

// ---------------- modelos de documentos ----------------
const revisao = { revisado_por: "Victor Monteiro", registro_oab: "OAB/MG 000.000", revisado_em: ISODate("2026-07-15T00:00:00Z") };

app.modelos_documentos.insertMany([
  {
    _id: id.mod_exodontia, titulo: "Termo de Consentimento — Exodontia", tipo: "termo_consentimento", versao: 2,
    conteudo: "Eu, {{paciente.nome}}, CPF {{paciente.cpf}}, autorizo o(a) {{profissional.nome}} (CRO {{profissional.cro}}) " +
              "a realizar a extração do(s) dente(s) {{procedimento.dentes}}. Fui informado(a) sobre riscos como dor, " +
              "inchaço, sangramento e parestesia, e sobre os cuidados pós-operatórios. {{clinica.cidade}}, {{data}}.",
    campos_variaveis: ["paciente.nome", "paciente.cpf", "profissional.nome", "profissional.cro", "procedimento.dentes", "clinica.cidade", "data"],
    revisao_juridica: revisao, vigente: true, criado_em: ISODate("2026-07-15T00:00:00Z"),
  },
  {
    _id: id.mod_clareamento, titulo: "Termo de Consentimento — Clareamento Dental", tipo: "termo_consentimento", versao: 1,
    conteudo: "Eu, {{paciente.nome}}, declaro estar ciente de que o clareamento pode causar sensibilidade temporária " +
              "e que restaurações e coroas não mudam de cor. {{clinica.cidade}}, {{data}}.",
    campos_variaveis: ["paciente.nome", "clinica.cidade", "data"],
    revisao_juridica: revisao, vigente: true, criado_em: ISODate("2026-07-15T00:00:00Z"),
  },
  {
    _id: id.mod_toxina, titulo: "Termo de Consentimento — Toxina Botulínica", tipo: "termo_consentimento", versao: 3,
    conteudo: "Eu, {{paciente.nome}}, autorizo a aplicação de toxina botulínica ({{produto.nome}}, lote {{produto.lote}}) " +
              "nas regiões indicadas no mapa de aplicação. Fui informado(a) de que o efeito é temporário e pode haver " +
              "assimetria, edema ou ptose transitória. {{clinica.cidade}}, {{data}}.",
    campos_variaveis: ["paciente.nome", "produto.nome", "produto.lote", "clinica.cidade", "data"],
    revisao_juridica: revisao, vigente: true, criado_em: ISODate("2026-07-20T00:00:00Z"),
  },
  {
    _id: id.mod_preenchimento, titulo: "Termo de Consentimento — Preenchimento com Ácido Hialurônico", tipo: "termo_consentimento", versao: 1,
    conteudo: "Eu, {{paciente.nome}}, autorizo o preenchimento com ácido hialurônico ({{produto.nome}}, lote {{produto.lote}}). " +
              "Estou ciente dos riscos de edema, hematoma e, raramente, oclusão vascular. {{clinica.cidade}}, {{data}}.",
    campos_variaveis: ["paciente.nome", "produto.nome", "produto.lote", "clinica.cidade", "data"],
    revisao_juridica: revisao, vigente: true, criado_em: ISODate("2026-07-20T00:00:00Z"),
  },
  {
    _id: id.mod_canal, titulo: "Termo de Consentimento — Tratamento Endodôntico", tipo: "termo_consentimento", versao: 1,
    conteudo: "Eu, {{paciente.nome}}, autorizo o tratamento de canal no dente {{procedimento.dentes}}, ciente de que " +
              "podem ser necessárias várias sessões e, em alguns casos, retratamento. {{clinica.cidade}}, {{data}}.",
    campos_variaveis: ["paciente.nome", "procedimento.dentes", "clinica.cidade", "data"],
    revisao_juridica: revisao, vigente: true, criado_em: ISODate("2026-07-15T00:00:00Z"),
  },
]);

// ---------------- procedimentos ----------------
app.procedimentos.insertMany([
  { _id: id.proc_exodontia, codigo: "CIR-001", nome: "Exodontia simples", categoria: "cirurgia",
    descricao: "Extração de dente erupcionado.", modelo_documento_id: id.mod_exodontia, ativo: true },
  { _id: id.proc_clareamento, codigo: "DEN-010", nome: "Clareamento dental de consultório", categoria: "dentistica",
    descricao: "Clareamento com gel de peróxido em consultório.", modelo_documento_id: id.mod_clareamento, ativo: true },
  { _id: id.proc_toxina, codigo: "HOF-001", nome: "Aplicação de toxina botulínica", categoria: "harmonizacao_orofacial",
    descricao: "Toxina para terço superior, bruxismo ou sorriso gengival.", modelo_documento_id: id.mod_toxina, ativo: true },
  { _id: id.proc_preenchimento, codigo: "HOF-002", nome: "Preenchimento labial com ácido hialurônico", categoria: "harmonizacao_orofacial",
    descricao: "Volume e contorno labial.", modelo_documento_id: id.mod_preenchimento, ativo: true },
  { _id: id.proc_canal, codigo: "END-001", nome: "Tratamento endodôntico (molar)", categoria: "endodontia",
    descricao: "Tratamento de canal em dente molar.", modelo_documento_id: id.mod_canal, ativo: true },
  { _id: id.proc_limpeza, codigo: "CLI-001", nome: "Profilaxia (limpeza)", categoria: "clinica_geral",
    descricao: "Raspagem supragengival e polimento.", modelo_documento_id: null, ativo: true },
]);

// ---------------- documentos gerados ----------------
const texto1 = "Eu, Ana Beatriz Souza, autorizo a aplicação de toxina botulínica (Botox 100U, lote C1234AB) nas regiões " +
               "indicadas no mapa de aplicação. Fui informado(a) de que o efeito é temporário e pode haver assimetria, " +
               "edema ou ptose transitória. Uberlândia, 28/10/2026.";
const texto2 = "Eu, Carlos Eduardo Ribeiro, autorizo o tratamento de canal no dente 36, ciente de que podem ser necessárias " +
               "várias sessões e, em alguns casos, retratamento. Uberlândia, 30/10/2026.";
const texto3 = "Eu, Carlos Eduardo Ribeiro, CPF 987.654.321-00, autorizo o(a) Dr. Lucas Ferreira (CRO MG 51234) a realizar " +
               "a extração do(s) dente(s) 18. Fui informado(a) sobre riscos como dor, inchaço, sangramento e parestesia, " +
               "e sobre os cuidados pós-operatórios. Uberlândia, 03/11/2026.";

app.documentos.insertMany([
  {
    _id: id.doc1, clinica_id: id.clinica_sorriso, paciente_id: id.pac_ana, profissional_id: id.dra_mayra,
    procedimento_id: id.proc_toxina,
    modelo: { id: id.mod_toxina, titulo: "Termo de Consentimento — Toxina Botulínica", versao: 3 },
    conteudo_renderizado: texto1, status: "assinado",
    assinatura: { assinado_em: ISODate("2026-10-28T15:05:00Z"), metodo: "presencial_tablet", ip: "177.10.20.30" },
    hash_sha256: "62644f687e6ee0b0e0e3032738abac4d4d1d2513279c38b373750eb07113d8e7", gerado_em: ISODate("2026-10-28T14:55:00Z"),
  },
  {
    _id: id.doc2, clinica_id: id.clinica_sorriso, paciente_id: id.pac_carlos, profissional_id: id.dr_lucas,
    procedimento_id: id.proc_canal,
    modelo: { id: id.mod_canal, titulo: "Termo de Consentimento — Tratamento Endodôntico", versao: 1 },
    conteudo_renderizado: texto2, status: "assinado",
    assinatura: { assinado_em: ISODate("2026-10-30T11:50:00Z"), metodo: "presencial_papel" },
    hash_sha256: "6825460ecd668106742a7c5563464a0a82891befa9b71e705f09d921291be413", gerado_em: ISODate("2026-10-30T11:40:00Z"),
  },
  {
    _id: id.doc3, clinica_id: id.clinica_sorriso, paciente_id: id.pac_carlos, profissional_id: id.dr_lucas,
    procedimento_id: id.proc_exodontia,
    modelo: { id: id.mod_exodontia, titulo: "Termo de Consentimento — Exodontia", versao: 2 },
    conteudo_renderizado: texto3, status: "enviado",
    hash_sha256: "904060c09cde36416ea258dd1fba1adc11bc4861723c074dc604c75814e79b9d", gerado_em: ISODate("2026-11-03T12:15:00Z"),
  },
]);

// ---------------- agendamentos ----------------
app.agendamentos.insertMany([
  { clinica_id: id.clinica_sorriso, paciente_id: id.pac_ana, profissional_id: id.dra_mayra, procedimento_id: id.proc_toxina,
    inicio: ISODate("2026-10-28T14:30:00Z"), fim: ISODate("2026-10-28T15:30:00Z"), status: "realizado",
    criado_em: ISODate("2026-10-20T13:05:00Z") },
  { clinica_id: id.clinica_sorriso, paciente_id: id.pac_ana, profissional_id: id.dra_mayra, procedimento_id: id.proc_toxina,
    inicio: ISODate("2026-11-12T14:30:00Z"), fim: ISODate("2026-11-12T15:00:00Z"), status: "confirmado",
    observacoes: "Retorno de 15 dias para avaliação da toxina.", criado_em: ISODate("2026-10-28T15:20:00Z") },
  { clinica_id: id.clinica_sorriso, paciente_id: id.pac_carlos, profissional_id: id.dr_lucas, procedimento_id: id.proc_exodontia,
    inicio: ISODate("2026-11-05T13:00:00Z"), fim: ISODate("2026-11-05T14:00:00Z"), status: "agendado",
    criado_em: ISODate("2026-11-03T12:20:00Z") },
  { clinica_id: id.clinica_sorriso, paciente_id: id.pac_helena, profissional_id: id.dr_lucas, procedimento_id: id.proc_limpeza,
    inicio: ISODate("2026-11-04T19:00:00Z"), fim: ISODate("2026-11-04T19:40:00Z"), status: "agendado",
    observacoes: "Paciente alérgica a látex — usar luvas nitrílicas.", criado_em: ISODate("2026-10-05T14:10:00Z") },
  { clinica_id: id.clinica_harmonia, paciente_id: id.pac_pedro, profissional_id: id.dra_paula, procedimento_id: id.proc_clareamento,
    inicio: ISODate("2026-11-06T12:00:00Z"), fim: ISODate("2026-11-06T13:30:00Z"), status: "agendado",
    criado_em: ISODate("2026-10-26T10:05:00Z") },
]);

// ---------------- odontogramas ----------------
app.odontogramas.insertMany([
  {
    clinica_id: id.clinica_sorriso, paciente_id: id.pac_carlos, profissional_id: id.dr_lucas,
    data: ISODate("2026-10-30T11:30:00Z"),
    dentes: [
      { numero: 18, condicao: "extracao_indicada", observacao: "Terceiro molar semi-incluso." },
      { numero: 16, faces: ["oclusal"], condicao: "restaurado" },
      { numero: 36, condicao: "canal", observacao: "Tratamento endodôntico iniciado." },
      { numero: 46, faces: ["mesial", "oclusal"], condicao: "carie" },
      { numero: 47, condicao: "ausente" },
    ],
    observacoes: "Planejar restauração do 46 após o canal do 36.",
  },
  {
    clinica_id: id.clinica_sorriso, paciente_id: id.pac_helena, profissional_id: id.dr_lucas,
    data: ISODate("2026-10-05T14:20:00Z"),
    dentes: [
      { numero: 55, faces: ["oclusal"], condicao: "carie" },
      { numero: 11, condicao: "higido" },
      { numero: 21, condicao: "higido" },
    ],
  },
]);

// ---------------- mapas faciais ----------------
app.mapas_faciais.insertMany([
  {
    clinica_id: id.clinica_sorriso, paciente_id: id.pac_ana, profissional_id: id.dra_mayra, tipo: "toxina",
    data: ISODate("2026-10-28T15:00:00Z"),
    produto: { nome: "Botox 100U", lote: "C1234AB", validade: ISODate("2027-09-30T00:00:00Z") },
    pontos: [
      { regiao: "frontal", unidades: 10, x: 50, y: 18 },
      { regiao: "glabela", unidades: 20, x: 50, y: 30 },
      { regiao: "orbicular direito (pés de galinha)", unidades: 8, x: 78, y: 36 },
      { regiao: "orbicular esquerdo (pés de galinha)", unidades: 8, x: 22, y: 36 },
    ],
    retorno_previsto: ISODate("2026-11-12T14:30:00Z"),
    observacoes: "Total aplicado: 46U.",
  },
  {
    clinica_id: id.clinica_sorriso, paciente_id: id.pac_ana, profissional_id: id.dra_mayra, tipo: "preenchimento",
    data: ISODate("2026-09-15T15:00:00Z"),
    produto: { nome: "Ácido hialurônico 1 mL", lote: "AH98765", validade: ISODate("2027-12-31T00:00:00Z") },
    pontos: [
      { regiao: "lábio superior", volume_ml: 0.5, x: 50, y: 72 },
      { regiao: "lábio inferior", volume_ml: 0.4, x: 50, y: 77 },
    ],
  },
]);

// ---------------- auditoria ----------------
auditoria.eventos_auditoria.insertMany([
  { clinica_id: id.clinica_sorriso, usuario_id: id.sec_julia, acao: "paciente_criado",
    entidade: { colecao: "pacientes", id: id.pac_ana }, ocorrido_em: ISODate("2026-10-20T13:00:00Z") },
  { clinica_id: id.clinica_sorriso, usuario_id: id.dra_mayra, acao: "documento_gerado",
    entidade: { colecao: "documentos", id: id.doc1 }, detalhes: { modelo_versao: 3 },
    ocorrido_em: ISODate("2026-10-28T14:55:00Z") },
  { clinica_id: id.clinica_sorriso, usuario_id: id.dra_mayra, acao: "documento_assinado",
    entidade: { colecao: "documentos", id: id.doc1 }, detalhes: { metodo: "presencial_tablet" },
    ocorrido_em: ISODate("2026-10-28T15:05:00Z") },
  { clinica_id: id.clinica_sorriso, usuario_id: id.dr_lucas, acao: "documento_gerado",
    entidade: { colecao: "documentos", id: id.doc3 }, detalhes: { modelo_versao: 2 },
    ocorrido_em: ISODate("2026-11-03T12:15:00Z") },
]);

auditoria.logs_acesso.insertMany([
  { usuario_id: id.dra_mayra, email: "mayra@sorrisopleno.com.br", sucesso: true, ip: "177.10.20.30",
    user_agent: "Mozilla/5.0 (Windows NT 10.0)", ocorrido_em: new Date() },
  { usuario_id: null, email: "mayra@sorriso.com", sucesso: false, ip: "177.10.20.30",
    user_agent: "Mozilla/5.0 (Android 14)", ocorrido_em: new Date() },
]);

// ---------------- resumo ----------------
print("\nDocumentos inseridos:");
for (const c of app.getCollectionNames().sort()) print(`  consentio.${c}: ${app.getCollection(c).countDocuments()}`);
for (const c of auditoria.getCollectionNames().sort()) print(`  consentio_auditoria.${c}: ${auditoria.getCollection(c).countDocuments()}`);
