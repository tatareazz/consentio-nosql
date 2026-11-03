// =====================================================================
// Consentio — criação dos bancos, coleções, validações e índices
// Uso: mongosh "<connection string do Atlas>" --file scripts/01_criar_estrutura.js
// ATENÇÃO: apaga e recria as coleções listadas abaixo.
// =====================================================================

const app = db.getSiblingDB("consentio");
const auditoria = db.getSiblingDB("consentio_auditoria");

function recriar(banco, nome, schema) {
  if (banco.getCollectionNames().includes(nome)) {
    banco.getCollection(nome).drop();
  }
  banco.createCollection(nome, {
    validator: { $jsonSchema: schema },
    validationLevel: "strict",
    validationAction: "error",
  });
  print(`✔ ${banco.getName()}.${nome} criada`);
}

// Sub-esquemas reutilizados
const endereco = {
  bsonType: "object",
  properties: {
    logradouro: { bsonType: "string" },
    numero: { bsonType: "string" },
    bairro: { bsonType: "string" },
    cidade: { bsonType: "string" },
    uf: { bsonType: "string", minLength: 2, maxLength: 2 },
    cep: { bsonType: "string" },
  },
};

const contato = {
  bsonType: "object",
  properties: {
    telefone: { bsonType: "string" },
    email: { bsonType: "string", pattern: "^.+@.+\\..+$" },
  },
};

// =====================================================================
// BANCO: consentio
// =====================================================================

recriar(app, "planos", {
  required: ["codigo", "nome", "preco_mensal", "limites", "ativo"],
  properties: {
    codigo: { enum: ["basico", "essencial", "business"] },
    nome: { bsonType: "string" },
    descricao: { bsonType: "string" },
    preco_mensal: { bsonType: "number", minimum: 0 },
    limites: {
      bsonType: "object",
      required: ["pacientes", "documentos_mes"],
      properties: {
        pacientes: { bsonType: ["number", "null"] }, // null = ilimitado
        documentos_mes: { bsonType: ["number", "null"] },
      },
    },
    recursos: { bsonType: "array", items: { bsonType: "string" } },
    ativo: { bsonType: "bool" },
  },
});

recriar(app, "clinicas", {
  required: ["nome", "contato", "assinatura", "criado_em"],
  properties: {
    nome: { bsonType: "string" },
    cnpj: { bsonType: "string" },
    endereco: endereco,
    contato: contato,
    assinatura: {
      bsonType: "object",
      required: ["plano_id", "status", "inicio"],
      properties: {
        plano_id: { bsonType: "objectId" },
        status: { enum: ["ativa", "trial", "inadimplente", "cancelada"] },
        inicio: { bsonType: "date" },
        proxima_cobranca: { bsonType: ["date", "null"] },
      },
    },
    uso_mes: {
      bsonType: "object",
      properties: {
        referencia: { bsonType: "string", pattern: "^\\d{4}-\\d{2}$" },
        documentos_gerados: { bsonType: "number", minimum: 0 },
      },
    },
    configuracoes: { bsonType: "object" },
    criado_em: { bsonType: "date" },
  },
});

recriar(app, "usuarios", {
  required: ["clinica_id", "nome", "email", "senha_hash", "papel", "ativo"],
  properties: {
    clinica_id: { bsonType: "objectId" },
    nome: { bsonType: "string" },
    email: { bsonType: "string", pattern: "^.+@.+\\..+$" },
    senha_hash: { bsonType: "string" },
    papel: { enum: ["administrador", "dentista", "secretaria"] },
    cro: {
      bsonType: "object",
      required: ["numero", "uf"],
      properties: {
        numero: { bsonType: "string" },
        uf: { bsonType: "string", minLength: 2, maxLength: 2 },
      },
    },
    especialidades: { bsonType: "array", items: { bsonType: "string" } },
    ativo: { bsonType: "bool" },
    ultimo_login: { bsonType: ["date", "null"] },
    criado_em: { bsonType: "date" },
  },
});

recriar(app, "pacientes", {
  required: ["clinica_id", "nome", "data_nascimento", "criado_em"],
  properties: {
    clinica_id: { bsonType: "objectId" },
    nome: { bsonType: "string", minLength: 2 },
    cpf: { bsonType: "string", pattern: "^\\d{3}\\.\\d{3}\\.\\d{3}-\\d{2}$" },
    data_nascimento: { bsonType: "date" },
    sexo: { enum: ["F", "M", "outro", "nao_informado"] },
    contato: contato,
    endereco: endereco,
    responsavel_legal: {
      bsonType: "object",
      properties: {
        nome: { bsonType: "string" },
        cpf: { bsonType: "string" },
        parentesco: { bsonType: "string" },
      },
    },
    ficha: {
      bsonType: "object",
      properties: {
        anamnese: {
          bsonType: "object",
          properties: {
            alergias: { bsonType: "array", items: { bsonType: "string" } },
            medicamentos_em_uso: { bsonType: "array", items: { bsonType: "string" } },
            doencas_preexistentes: { bsonType: "array", items: { bsonType: "string" } },
            gestante: { bsonType: "bool" },
            fumante: { bsonType: "bool" },
            observacoes: { bsonType: "string" },
          },
        },
        convenio: { bsonType: ["string", "null"] },
      },
    },
    tags: { bsonType: "array", items: { bsonType: "string" } },
    criado_em: { bsonType: "date" },
    atualizado_em: { bsonType: "date" },
  },
});

recriar(app, "modelos_documentos", {
  required: ["titulo", "tipo", "versao", "conteudo", "vigente"],
  properties: {
    titulo: { bsonType: "string" },
    tipo: {
      enum: [
        "termo_consentimento",
        "contrato_servico",
        "orcamento",
        "termo_uso_imagem",
        "atestado",
        "receituario",
      ],
    },
    versao: { bsonType: "number", minimum: 1 },
    conteudo: { bsonType: "string" }, // texto com variáveis {{paciente.nome}} etc.
    campos_variaveis: { bsonType: "array", items: { bsonType: "string" } },
    revisao_juridica: {
      bsonType: "object",
      properties: {
        revisado_por: { bsonType: "string" },
        registro_oab: { bsonType: "string" },
        revisado_em: { bsonType: "date" },
      },
    },
    vigente: { bsonType: "bool" },
    criado_em: { bsonType: "date" },
  },
});

recriar(app, "procedimentos", {
  required: ["codigo", "nome", "categoria", "ativo"],
  properties: {
    codigo: { bsonType: "string" },
    nome: { bsonType: "string" },
    categoria: {
      enum: [
        "clinica_geral",
        "dentistica",
        "endodontia",
        "periodontia",
        "cirurgia",
        "ortodontia",
        "implantodontia",
        "protese",
        "harmonizacao_orofacial",
      ],
    },
    descricao: { bsonType: "string" },
    modelo_documento_id: { bsonType: ["objectId", "null"] },
    ativo: { bsonType: "bool" },
  },
});

recriar(app, "documentos", {
  required: [
    "clinica_id",
    "paciente_id",
    "profissional_id",
    "procedimento_id",
    "modelo",
    "conteudo_renderizado",
    "status",
    "gerado_em",
  ],
  properties: {
    clinica_id: { bsonType: "objectId" },
    paciente_id: { bsonType: "objectId" },
    profissional_id: { bsonType: "objectId" },
    procedimento_id: { bsonType: "objectId" },
    // snapshot do modelo usado — o documento não muda se o modelo mudar
    modelo: {
      bsonType: "object",
      required: ["id", "titulo", "versao"],
      properties: {
        id: { bsonType: "objectId" },
        titulo: { bsonType: "string" },
        versao: { bsonType: "number" },
      },
    },
    conteudo_renderizado: { bsonType: "string" },
    status: { enum: ["gerado", "enviado", "assinado", "cancelado"] },
    assinatura: {
      bsonType: "object",
      properties: {
        assinado_em: { bsonType: "date" },
        metodo: { enum: ["presencial_papel", "presencial_tablet", "link_eletronico"] },
        ip: { bsonType: "string" },
      },
    },
    hash_sha256: { bsonType: "string", minLength: 64, maxLength: 64 },
    gerado_em: { bsonType: "date" },
  },
});

recriar(app, "agendamentos", {
  required: ["clinica_id", "paciente_id", "profissional_id", "inicio", "fim", "status"],
  properties: {
    clinica_id: { bsonType: "objectId" },
    paciente_id: { bsonType: "objectId" },
    profissional_id: { bsonType: "objectId" },
    procedimento_id: { bsonType: ["objectId", "null"] },
    inicio: { bsonType: "date" },
    fim: { bsonType: "date" },
    status: { enum: ["agendado", "confirmado", "realizado", "faltou", "cancelado"] },
    observacoes: { bsonType: "string" },
    criado_em: { bsonType: "date" },
  },
});

recriar(app, "odontogramas", {
  required: ["clinica_id", "paciente_id", "profissional_id", "data", "dentes"],
  properties: {
    clinica_id: { bsonType: "objectId" },
    paciente_id: { bsonType: "objectId" },
    profissional_id: { bsonType: "objectId" },
    data: { bsonType: "date" },
    dentes: {
      bsonType: "array",
      items: {
        bsonType: "object",
        required: ["numero", "condicao"],
        properties: {
          numero: { bsonType: "number", minimum: 11, maximum: 85 }, // notação FDI
          faces: {
            bsonType: "array",
            items: { enum: ["mesial", "distal", "oclusal", "vestibular", "lingual", "palatina", "incisal"] },
          },
          condicao: {
            enum: ["higido", "carie", "restaurado", "ausente", "extracao_indicada", "canal", "implante", "protese", "fratura"],
          },
          observacao: { bsonType: "string" },
        },
      },
    },
    observacoes: { bsonType: "string" },
  },
});

recriar(app, "mapas_faciais", {
  required: ["clinica_id", "paciente_id", "profissional_id", "tipo", "data", "produto", "pontos"],
  properties: {
    clinica_id: { bsonType: "objectId" },
    paciente_id: { bsonType: "objectId" },
    profissional_id: { bsonType: "objectId" },
    tipo: { enum: ["toxina", "preenchimento"] },
    data: { bsonType: "date" },
    produto: {
      bsonType: "object",
      required: ["nome", "lote"],
      properties: {
        nome: { bsonType: "string" },
        lote: { bsonType: "string" },
        validade: { bsonType: "date" },
      },
    },
    pontos: {
      bsonType: "array",
      items: {
        bsonType: "object",
        required: ["regiao"],
        properties: {
          regiao: { bsonType: "string" },
          unidades: { bsonType: "number" }, // toxina (U)
          volume_ml: { bsonType: "number" }, // preenchimento (mL)
          x: { bsonType: "number" }, // posição no desenho do rosto (0–100)
          y: { bsonType: "number" },
        },
      },
    },
    retorno_previsto: { bsonType: "date" },
    observacoes: { bsonType: "string" },
  },
});

// ---------------- índices do banco consentio ----------------
app.planos.createIndex({ codigo: 1 }, { unique: true });
app.usuarios.createIndex({ email: 1 }, { unique: true });
app.usuarios.createIndex({ clinica_id: 1, papel: 1 });
app.pacientes.createIndex(
  { clinica_id: 1, cpf: 1 },
  { unique: true, partialFilterExpression: { cpf: { $type: "string" } } }
);
app.pacientes.createIndex({ nome: "text" }, { default_language: "portuguese" });
app.procedimentos.createIndex({ codigo: 1 }, { unique: true });
app.modelos_documentos.createIndex({ tipo: 1, vigente: 1 });
app.documentos.createIndex({ clinica_id: 1, paciente_id: 1, gerado_em: -1 });
app.documentos.createIndex({ clinica_id: 1, status: 1 });
app.agendamentos.createIndex({ clinica_id: 1, profissional_id: 1, inicio: 1 });
app.agendamentos.createIndex({ paciente_id: 1, inicio: -1 });
app.odontogramas.createIndex({ paciente_id: 1, data: -1 });
app.mapas_faciais.createIndex({ paciente_id: 1, tipo: 1, data: -1 });
print("✔ índices do banco consentio criados");

// =====================================================================
// BANCO: consentio_auditoria
// =====================================================================

recriar(auditoria, "eventos_auditoria", {
  required: ["clinica_id", "usuario_id", "acao", "entidade", "ocorrido_em"],
  properties: {
    clinica_id: { bsonType: "objectId" },
    usuario_id: { bsonType: "objectId" },
    acao: {
      enum: [
        "paciente_criado",
        "paciente_atualizado",
        "documento_gerado",
        "documento_assinado",
        "documento_cancelado",
        "agendamento_criado",
        "plano_alterado",
      ],
    },
    entidade: {
      bsonType: "object",
      required: ["colecao", "id"],
      properties: {
        colecao: { bsonType: "string" },
        id: { bsonType: "objectId" },
      },
    },
    detalhes: { bsonType: "object" },
    ocorrido_em: { bsonType: "date" },
  },
});

recriar(auditoria, "logs_acesso", {
  required: ["email", "sucesso", "ocorrido_em"],
  properties: {
    usuario_id: { bsonType: ["objectId", "null"] },
    email: { bsonType: "string" },
    sucesso: { bsonType: "bool" },
    ip: { bsonType: "string" },
    user_agent: { bsonType: "string" },
    ocorrido_em: { bsonType: "date" },
  },
});

auditoria.eventos_auditoria.createIndex({ clinica_id: 1, ocorrido_em: -1 });
auditoria.eventos_auditoria.createIndex({ "entidade.colecao": 1, "entidade.id": 1 });
// TTL: logs de acesso expiram após 180 dias
auditoria.logs_acesso.createIndex({ ocorrido_em: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 180 });
auditoria.logs_acesso.createIndex({ email: 1, ocorrido_em: -1 });
print("✔ índices do banco consentio_auditoria criados");

print("\nEstrutura criada com sucesso.");
