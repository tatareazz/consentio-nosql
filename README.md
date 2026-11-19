# Consentio — Bancos de dados NoSQL (MongoDB + Redis)

Repositório das atividades de NoSQL do sistema **Consentio**:

| Atividade | Banco NoSQL | Tipo | O que foi feito |
|---|---|---|---|
| A1 | MongoDB Atlas | Documentos | Descrição do sistema, bancos, coleções com validação e índices, documentos de exemplo |
| A2 | MongoDB Atlas | Documentos | 2 funcionalidades com pipelines de agregação diferentes |
| A3 | Redis | Chave-valor em memória | Cache de login de usuário e estatísticas com Bloom Filter, HyperLogLog e Count-Min Sketch |

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

- **Documentos de tamanho e forma variáveis**: a ficha do paciente, um odontograma e um mapa de toxina têm estruturas muito diferentes; o modelo de documentos acomoda isso com esquema flexível, cada coleção guardando documentos no formato que o dado realmente tem.
- **Dados embutidos lidos juntos**: anamnese, endereço e contato são sempre lidos com o paciente, então ficam embutidos (*embedding*) e chegam em uma única leitura do documento, sem precisar buscar em outras coleções.
- **Snapshot dos documentos gerados**: o documento gerado guarda uma cópia do modelo (título, versão e texto final). Se o modelo mudar depois, o documento já assinado continua íntegro — importante para valor jurídico.
- **Multi‑tenant simples**: todas as coleções de dados de clínica têm `clinica_id`, com índices compostos começando por ele.

---

## 3. Modelagem

### Banco `consentio` (dados da aplicação)

Cada coleção guarda **documentos BSON**. O que é lido sempre junto fica **embutido** no próprio documento (subdocumentos e arrays). O que é compartilhado entre coleções é **referenciado** pelo `ObjectId` do outro documento, resolvido com `$lookup` quando necessário.

| Coleção | O que cada documento guarda | Embutido no documento | Referências (`ObjectId`) |
|---|---|---|---|
| `planos` | Plano de assinatura, preço e limites | `limites`, `recursos[]` | — |
| `clinicas` | Dados da clínica e uso do mês | `assinatura`, `endereco`, `contato`, `uso_mes` | `assinatura.plano_id` (planos) |
| `usuarios` | Profissional ou secretária com acesso ao sistema | `cro`, `especialidades[]` | `clinica_id` (clinicas) |
| `pacientes` | Cadastro do paciente | `ficha.anamnese`, `contato`, `endereco`, `responsavel_legal` | `clinica_id` (clinicas) |
| `procedimentos` | Procedimento odontológico do catálogo | — | `modelo_documento_id` (modelos_documentos) |
| `modelos_documentos` | Modelo de termo/contrato com variáveis `{{...}}` | `revisao_juridica`, `campos_variaveis[]` | — |
| `documentos` | Documento gerado para o paciente | `modelo` (snapshot), `assinatura` | `paciente_id`, `profissional_id`, `procedimento_id` |
| `agendamentos` | Consulta na agenda | — | `paciente_id`, `profissional_id`, `procedimento_id` |
| `odontogramas` | Registro dente a dente (numeração FDI) | `dentes[]` | `paciente_id`, `profissional_id` |
| `mapas_faciais` | Mapa de toxina ou de preenchimento | `produto`, `pontos[]` | `paciente_id`, `profissional_id` |

### Banco `consentio_auditoria` (rastreabilidade / LGPD)

| Coleção | O que guarda |
|---|---|
| `eventos_auditoria` | Quem fez o quê em qual documento (criou paciente, gerou/assinou documento…) |
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

## 4. Funcionalidades com pipelines de agregação (Atividade A2)

Estão no final de `scripts/03_consultas_exemplo.js`.

| # | Funcionalidade | Coleção(ões) | Etapas do pipeline |
|---|---|---|---|
| 1 | **Top 5 alergias mais comuns** — ajuda a clínica a se preparar (ex.: luvas sem látex, evitar certos medicamentos) | `pacientes` | `$match` → `$unwind` → `$group` (`$sum`) → `$sort` → `$limit` → `$project` |
| 2 | **Relatório de documentos com contato do paciente** — mostra o status de cada termo e o telefone do paciente para a recepção cobrar assinaturas pendentes | `documentos` + `pacientes` | `$lookup` → `$unwind` → `$sort` → `$project` |

### Por que os dois pipelines são bem diferentes

O primeiro pipeline trabalha **dentro de uma única coleção** e processa um **array embutido** no próprio documento: o `$unwind` desmembra `ficha.anamnese.alergias`, transformando um paciente com N alergias em N documentos temporários, e o `$group` com `$sum` agrega esses documentos para contar as ocorrências. Ele aproveita a modelagem por **embedding**, já que as alergias moram dentro do paciente e nenhuma outra coleção é consultada. O segundo pipeline faz o caminho oposto: cruza **duas coleções** por **referência**. O `$lookup` usa o `paciente_id` guardado em `documentos` para buscar o paciente correspondente em `pacientes` (junção de coleções por referência, feita pelo próprio MongoDB). Aqui o `$unwind` só converte o array de 1 elemento que o `$lookup` devolve em um objeto, e o `$project` remodela a saída, escondendo os ObjectIds. Em resumo, o primeiro **multiplica e reduz documentos** para gerar estatística (N → muitos → 5 grupos), enquanto o segundo **enriquece cada documento** com dados de outra coleção, mantendo a mesma quantidade de documentos (1 → 1).

---

## 5. Como executar no MongoDB Atlas

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

## 6. Atividade A3 — Redis: cache de login e estatísticas probabilísticas

O MongoDB continua sendo o banco principal. O **Redis** (NoSQL chave-valor, em memória) entra na frente dele para:

1. **Cache de login de usuário:** sessão, perfil e permissões em Hash com TTL, padrão cache-aside, bloqueio após 5 senhas erradas, logout e invalidação. A senha nunca é guardada em texto (hash scrypt).
2. **Estatísticas de uso com estruturas probabilísticas:**

| Estrutura | Uso no Consentio | Comandos |
|---|---|---|
| **Bloom Filter** | E-mail/CPF já cadastrado? Evita consultar o MongoDB quando a resposta é "não" | `BF.RESERVE`, `BF.MADD`, `BF.MEXISTS` (ou `SETBIT`/`GETBIT`) |
| **HyperLogLog** | Usuários ativos únicos por dia/semana; pacientes únicos por clínica | `PFADD`, `PFCOUNT`, `PFMERGE` |
| **Count-Min Sketch** | Frequência de ações (termos gerados, fichas abertas, agenda) e horário de pico | `CMS.INITBYDIM`, `CMS.INCRBY`, `CMS.QUERY` (ou `HINCRBY`) |

📄 **Explicação completa, linha por linha, com fluxo e trade-offs:** [`redis/DEFESA_A3.md`](redis/DEFESA_A3.md)

### Resultados medidos (demo)
- Validação de sessão pelo Redis: **~0,6 ms**, sem consultar o MongoDB; o 2º login não vai ao banco.
- Bloom Filter (10 mil e-mails, 1%): **0 falsos negativos**, **1,08% de falsos positivos**, 12 KB.
- HyperLogLog com 100 mil pacientes: **erro 0,37% em 14 KB**, contra **5.442 KB** de um SET exato.
- Count-Min Sketch com 50 mil eventos: estimativas exatas com largura 2000; superestimativa visível com largura 8.

### Como executar

**1) Ter um Redis rodando** (uma das opções):
- **Redis Cloud (grátis, recomendado):** crie um banco em https://redis.io/try-free, copie o endereço e a senha. Já vem com Bloom Filter e Count-Min Sketch.
- **Docker:** `docker run -d --name redis -p 6379:6379 redis/redis-stack-server:latest`
- **Redis local** (Linux/Mac/WSL): `redis-server`. Sem o módulo RedisBloom, o código usa automaticamente a implementação própria de Bloom e CMS.

**2) Rodar as demos** (Node.js 18+):
```bash
cd redis
npm install
# Redis Cloud (Linux/Mac):   export REDIS_URL="redis://default:SENHA@HOST:PORTA"
# Redis Cloud (PowerShell):  $env:REDIS_URL="redis://default:SENHA@HOST:PORTA"
# Redis local: não precisa definir nada (usa redis://localhost:6379)

npm run login          # Demo 1: cache de login
npm run estatisticas   # Demo 2: Bloom Filter, HyperLogLog e Count-Min Sketch
```

**3) Testar comandos direto no Redis** (cada arquivo mostra comando + resposta):
```bash
npm run cli:login    # cache de login com HSET/EXPIRE/INCR/DEL
npm run cli:hll      # HyperLogLog
npm run cli:stack    # BF.* e CMS.* nativos (Redis Stack / Redis Cloud / Redis 8)
npm run cli:manual   # Bloom e CMS montados com SETBIT/GETBIT/HINCRBY (qualquer Redis)
```
Com o `redis-cli` instalado: `grep -v '^#' cli/01_cache_login.redis | redis-cli -u "$REDIS_URL"`.

> As demos apagam apenas chaves com prefixo `consentio:` (nunca `FLUSHALL`).

---

## 7. Estrutura do repositório
```
.
├── README.md                        # descrição do sistema, modelagem e instruções
├── scripts/                         # MongoDB (A1 e A2)
│   ├── 01_criar_estrutura.js        # cria bancos, coleções, validações e índices
│   ├── 02_inserir_exemplos.js       # insere documentos de exemplo
│   └── 03_consultas_exemplo.js      # consultas e agregações (inclui as 2 da A2)
└── redis/                           # Redis (A3)
    ├── DEFESA_A3.md                 # explicação linha por linha, fluxo e trade-offs
    ├── package.json                 # dependência "redis" e atalhos npm run ...
    ├── .env.exemplo                 # modelo de REDIS_URL
    ├── demo_cache_login.js          # Demo 1: cache de login
    ├── demo_estatisticas.js         # Demo 2: estruturas probabilísticas
    ├── src/
    │   ├── conexao.js               # conexão e detecção do módulo RedisBloom
    │   ├── senha.js                 # hash de senha com scrypt
    │   ├── banco_principal.js       # usuários (MongoDB simulado para a demo)
    │   ├── cache_login.js           # login, sessão, logout, bloqueio e invalidação
    │   └── probabilisticas.js       # Bloom Filter, HyperLogLog, Count-Min Sketch
    └── cli/
        ├── executar.js              # roda os .redis mostrando comando + resposta
        ├── 01_cache_login.redis
        ├── 02_hyperloglog.redis
        ├── 03_bloom_cms_redisstack.redis
        └── 04_bloom_cms_sem_modulo.redis
```

> Os dados de exemplo são fictícios. Os modelos de documento do Consentio não substituem orientação jurídica individualizada.
