# Consentio — Modelagem NoSQL (MongoDB)

Repositório da atividade de NoSQL: descrição do sistema **Consentio** e scripts que criam os bancos, as coleções (com validação de esquema e índices) e documentos de exemplo no **MongoDB Atlas**.

Site do sistema: https://consentio.com.br

---

## 1. Descrição do sistema

O **Consentio** é uma plataforma web (SaaS) de **gestão e compliance documental para clínicas odontológicas**. Ela é voltada a cirurgiões‑dentistas e clínicas que querem reduzir a burocracia do dia a dia, reunindo em um só lugar o cadastro de pacientes, a agenda e a geração dos documentos de cada atendimento.

### Problema que resolve
Muitas clínicas ainda preenchem documentos à mão a cada atendimento, usam modelos genéricos tirados da internet, têm dificuldade para localizar documentos antigos e mantêm informações do paciente espalhadas. Isso gera perda de tempo e o risco de usar um documento inadequado para o procedimento realizado.

### Como funciona
1. **Cadastrar o paciente** — dados pessoais, contato e ficha (anamnese) ficam centralizados.
2. **Escolher o procedimento** — o profissional seleciona o procedimento odontológico realizado.
3. **Gerar o documento** — o sistema usa automaticamente o modelo correspondente ao procedimento (ex.: termo de consentimento para extração, clareamento, toxina botulínica), preenchendo os dados do paciente e da clínica.
4. **Organizar o histórico** — cada documento gerado fica associado ao paciente, formando um histórico documental consultável.

### Funcionalidades
- **Gestão de pacientes** e **ficha do paciente** com histórico centralizado.
- **Agenda** da clínica e dos profissionais.
- **Documentos automáticos por procedimento**, a partir de modelos elaborados com participação de advogado especialista.
- **Histórico documental** por paciente.
- **Odontograma** (registro da condição de cada dente).
- **Mapas faciais** de harmonização orofacial: **mapa de toxina** e **mapa de preenchimento**.
- **Planos de assinatura** e configurações da clínica.

### Planos
| Plano | Preço | Limites |
|---|---|---|
| Básico | R$ 0,00/mês | até 2 pacientes, até 5 documentos/mês |
| Essencial | R$ 59,90/mês | até 60 pacientes, documentos ilimitados |
| Business | R$ 119,90/mês | pacientes e documentos ilimitados, suporte no WhatsApp |

### Equipe
Desenvolvido por três profissionais com perfis complementares: tecnologia e estratégia digital (Tamyres Resende), direito (Victor Monteiro, advogado, mestre pela UFU) e odontologia (Mayra Resende, cirurgiã‑dentista, mestra pela UFU).

---

## 2. Por que MongoDB

- **Documentos de tamanho e forma variáveis**: a ficha do paciente, um odontograma e um mapa de toxina têm estruturas muito diferentes; o modelo de documentos acomoda isso sem dezenas de tabelas.
- **Dados embutidos lidos juntos**: anamnese, endereço e contato são sempre lidos com o paciente, então ficam embutidos (*embedding*), evitando *joins*.
- **Snapshot dos documentos gerados**: o documento gerado guarda uma cópia do modelo (título, versão e texto final). Se o modelo mudar depois, o documento já assinado continua íntegro — importante para valor jurídico.
- **Multi‑tenant simples**: todas as coleções de dados de clínica têm `clinica_id`, com índices compostos começando por ele.

---

## 3. Modelagem

### Banco `consentio` (dados da aplicação)

| Coleção | O que guarda | Relações |
|---|---|---|
| `planos` | Planos de assinatura, preço e limites | — |
| `clinicas` | Dados da clínica, assinatura atual (embutida) e uso do mês | `assinatura.plano_id → planos` |
| `usuarios` | Profissionais e secretárias que acessam o sistema | `clinica_id → clinicas` |
| `pacientes` | Cadastro + ficha/anamnese embutida | `clinica_id → clinicas` |
| `procedimentos` | Catálogo de procedimentos odontológicos | `modelo_documento_id → modelos_documentos` |
| `modelos_documentos` | Modelos de termos/contratos com variáveis `{{...}}` | — |
| `documentos` | Documentos gerados (snapshot do modelo, status, assinatura, hash) | `paciente_id`, `profissional_id`, `procedimento_id` |
| `agendamentos` | Agenda de consultas | `paciente_id`, `profissional_id`, `procedimento_id` |
| `odontogramas` | Registro dente a dente (numeração FDI) | `paciente_id`, `profissional_id` |
| `mapas_faciais` | Mapas de toxina e de preenchimento (pontos aplicados, produto, lote) | `paciente_id`, `profissional_id` |

### Banco `consentio_auditoria` (rastreabilidade / LGPD)

| Coleção | O que guarda |
|---|---|
| `eventos_auditoria` | Quem fez o quê em qual registro (criou paciente, gerou/assinou documento…) |
| `logs_acesso` | Tentativas de login; expira automaticamente após 180 dias (índice TTL) |

A auditoria fica em um banco separado para isolar permissões (a aplicação só insere; leitura restrita) e não misturar volume de log com dados de negócio.

### Exemplo de documento (`pacientes`)
```json
{
  "_id": ObjectId("..."),
  "clinica_id": ObjectId("..."),
  "nome": "Ana Beatriz Souza",
  "cpf": "123.456.789-09",
  "data_nascimento": ISODate("1992-04-15"),
  "contato": { "telefone": "(34) 99999-1111", "email": "ana@email.com" },
  "ficha": {
    "anamnese": {
      "alergias": ["dipirona"],
      "medicamentos_em_uso": [],
      "doencas_preexistentes": [],
      "gestante": false
    }
  },
  "criado_em": ISODate("2026-10-20T13:00:00Z")
}
```

### Recursos do MongoDB usados
- **Validação com `$jsonSchema`** em todas as coleções (tipos, campos obrigatórios e `enum`).
- **Índices únicos** (e‑mail do usuário, CPF por clínica, código de plano/procedimento).
- **Índice parcial** (CPF só é único quando informado).
- **Índice de texto** para busca de paciente por nome.
- **Índice TTL** para expirar logs de acesso.

---

## 4. Como executar no MongoDB Atlas

### Pré‑requisitos
- Um cluster no [MongoDB Atlas](https://www.mongodb.com/atlas) (o gratuito M0 serve).
- Um usuário do banco com permissão de leitura/escrita e criação de coleções (ex.: role *Atlas admin* ou `readWriteAnyDatabase` + `dbAdminAnyDatabase`).
- Seu IP liberado em *Network Access*.
- [mongosh](https://www.mongodb.com/try/download/shell) instalado.

### Passos
```bash
# 1) Copie a connection string do Atlas (Connect → Shell) e guarde numa variável
export MONGO_URI="mongodb+srv://USUARIO:SENHA@cluster0.xxxxx.mongodb.net/"

# 2) Cria os bancos, coleções, validações e índices
mongosh "$MONGO_URI" --file scripts/01_criar_estrutura.js

# 3) Insere documentos de exemplo
mongosh "$MONGO_URI" --file scripts/02_inserir_exemplos.js

# 4) (Opcional) Roda consultas de demonstração
mongosh "$MONGO_URI" --file scripts/03_consultas_exemplo.js
```

> ⚠️ O script `01` **apaga e recria** as coleções dos bancos `consentio` e `consentio_auditoria`. Use apenas em um cluster de testes.

No Windows (PowerShell), troque o `export` por:
```powershell
$env:MONGO_URI="mongodb+srv://USUARIO:SENHA@cluster0.xxxxx.mongodb.net/"
mongosh $env:MONGO_URI --file scripts/01_criar_estrutura.js
```

Também dá para rodar pelo **mongosh embutido no MongoDB Compass**: abra o shell, conectado ao cluster, e execute `load("scripts/01_criar_estrutura.js")` com o caminho completo do arquivo.

---

## 5. Estrutura do repositório
```
.
├── README.md                     # descrição do sistema e da modelagem
└── scripts/
    ├── 01_criar_estrutura.js     # cria bancos, coleções, validações e índices
    ├── 02_inserir_exemplos.js    # insere documentos de exemplo
    └── 03_consultas_exemplo.js   # consultas e agregações de demonstração
```

> Os dados de exemplo são fictícios. Os modelos de documento do Consentio não substituem orientação jurídica individualizada.
