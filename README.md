# Consentio — Bancos de dados NoSQL (MongoDB + Redis)

> ## 🔗 [Acessar Demo Visual do Sistema (GitHub Pages)](https://tatareazz.github.io/consentio-nosql/)
> Interface navegável com 4 telas: **Visão geral**, **Pacientes** (documento MongoDB com anamnese embutida), **Documentos** (pipelines A2 executados estágio por estágio) e **Monitor Redis** (cache de login, Bloom Filter, HyperLogLog e Count-Min Sketch, com o comando exato de cada clique). Roda 100% no navegador, sem backend; também abre direto com duplo clique em [`docs/index.html`](docs/index.html).
>
> **Para ativar o link:** no GitHub, abra **Settings → Pages**.
> Em *Build and deployment*, escolha **Source: Deploy from a branch**, **Branch: `main`** e **Folder: `/docs`**, e clique em **Save**.
> Em 1 a 2 minutos o site fica no ar em `https://tatareazz.github.io/consentio-nosql/`.

Repositório das atividades de NoSQL do sistema **Consentio**:

| Atividade | Banco NoSQL | Tipo | O que foi feito |
|---|---|---|---|
| A1 | MongoDB Atlas | Documentos | Descrição do sistema, bancos, coleções com validação e índices, documentos de exemplo |
| A2 | MongoDB Atlas | Documentos | 2 funcionalidades com pipelines de agregação diferentes |
| A3 | Redis | Chave-valor em memória | Cache de login de usuário e estatísticas com Bloom Filter, HyperLogLog e Count-Min Sketch |
| Visual | — | Interface web | [`docs/index.html`](docs/index.html): demo navegável das três atividades (GitHub Pages) |

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
- **O paciente guarda tudo o que é dele**: ficha/anamnese, documentos gerados, agendamentos, odontogramas e mapas faciais ficam **embutidos** (*embedding*) no documento do paciente. Uma única leitura traz o prontuário completo, e incluir um item novo é um `$push` atômico no próprio paciente.
- **Snapshot dos documentos gerados**: o documento gerado guarda uma cópia do modelo (título, versão e texto final). Se o modelo mudar depois, o documento já assinado continua íntegro — importante para valor jurídico.
- **Multi‑tenant simples**: todas as coleções de dados de clínica têm `clinica_id`, com índices compostos começando por ele.

---

## 3. Modelagem

### Banco `consentio` (dados da aplicação)

O banco tem **6 coleções**. A principal é `pacientes`: **cada paciente guarda tudo o que é dele** em arrays de subdocumentos (`documentos[]`, `agendamentos[]`, `odontogramas[]`, `mapas_faciais[]`). As demais coleções guardam o que é **compartilhado** por vários pacientes (clínica, profissionais, catálogo de procedimentos e modelos de termos) e são referenciadas pelo `ObjectId`.

| Coleção | O que cada documento guarda | Embutido no documento | Referências (`ObjectId`) |
|---|---|---|---|
| `pacientes` | **Prontuário completo do paciente** | `ficha.anamnese`, `contato`, `endereco`, `responsavel_legal`, **`documentos[]`**, **`agendamentos[]`**, **`odontogramas[]`**, **`mapas_faciais[]`** | `clinica_id`; nos itens: `profissional_id`, `procedimento_id` |
| `clinicas` | Dados da clínica e uso do mês | `assinatura`, `endereco`, `contato`, `uso_mes` | `assinatura.plano_id` |
| `usuarios` | Profissional ou secretária com acesso ao sistema | `cro`, `especialidades[]` | `clinica_id` |
| `planos` | Plano de assinatura, preço e limites | `limites`, `recursos[]` | — |
| `procedimentos` | Procedimento odontológico do catálogo | — | `modelo_documento_id` |
| `modelos_documentos` | Modelo de termo com variáveis `{{...}}` | `revisao_juridica`, `campos_variaveis[]` | — |

**O que fica dentro de cada item do paciente:**

| Array no paciente | Cada item guarda |
|---|---|
| `documentos[]` | `_id`, profissional, procedimento, **snapshot do modelo** (título e versão), texto final, status, assinatura e hash SHA-256 |
| `agendamentos[]` | `_id`, profissional, procedimento, início, fim, status e observações |
| `odontogramas[]` | `_id`, profissional, data e `dentes[]` (número FDI, faces e condição) |
| `mapas_faciais[]` | `_id`, profissional, tipo (toxina/preenchimento), `produto` (nome, lote, validade) e `pontos[]` |

**Por que embutir:** tudo isso pertence a um único paciente, não é compartilhado com outros e é consultado junto com ele. Uma leitura traz o prontuário inteiro, e cada inclusão (`$push`) é atômica no documento.

**Cuidados dessa modelagem:**
- Um documento do MongoDB tem limite de **16 MB**. Um paciente acumula poucas dezenas de termos e consultas por ano (alguns KB cada), muito abaixo do limite.
- Consultas que atravessam pacientes (agenda do dia da clínica, termos pendentes) usam **índices multikey** sobre os campos dos arrays, como `{ clinica_id: 1, "agendamentos.inicio": 1 }`, e `$unwind` na agregação.

### Banco `consentio_auditoria` (rastreabilidade / LGPD)

| Coleção | O que guarda |
|---|---|
| `eventos_auditoria` | Quem fez o quê e em qual paciente/item (`entidade` + `detalhes.documento_id`) (criou paciente, gerou/assinou documento…) |
| `logs_acesso` | Tentativas de login; expira automaticamente após 180 dias (índice TTL) |

A auditoria fica em um banco separado para isolar permissões (a aplicação só insere; leitura restrita) e não misturar volume de log com dados de negócio.

### Exemplo de documento (`pacientes`)
```json
{
  "_id": ObjectId("65d000000000000000000002"),
  "clinica_id": ObjectId("65b000000000000000000001"),
  "nome": "Carlos Eduardo Ribeiro",
  "cpf": "987.654.321-00",
  "data_nascimento": ISODate("1978-11-02"),
  "contato": { "telefone": "(34) 98888-2222" },
  "ficha": {
    "anamnese": { "alergias": [], "medicamentos_em_uso": ["losartana 50mg"], "doencas_preexistentes": ["hipertensão"] }
  },
  "documentos": [
    {
      "_id": ObjectId("660000000000000000000003"),
      "profissional_id": ObjectId("65c000000000000000000002"),
      "procedimento_id": ObjectId("65f000000000000000000001"),
      "modelo": { "id": ObjectId("65e000000000000000000001"), "titulo": "Termo de Consentimento — Exodontia", "versao": 2 },
      "conteudo_renderizado": "Eu, Carlos Eduardo Ribeiro, ... autorizo ... a extração do dente 18 ...",
      "status": "enviado",
      "hash_sha256": "904060c0...",
      "gerado_em": ISODate("2026-11-03T12:15:00Z")
    }
  ],
  "agendamentos": [
    {
      "_id": ObjectId("661000000000000000000003"),
      "profissional_id": ObjectId("65c000000000000000000002"),
      "procedimento_id": ObjectId("65f000000000000000000001"),
      "inicio": ISODate("2026-11-05T13:00:00Z"), "fim": ISODate("2026-11-05T14:00:00Z"),
      "status": "agendado"
    }
  ],
  "odontogramas": [
    {
      "_id": ObjectId("662000000000000000000001"),
      "profissional_id": ObjectId("65c000000000000000000002"),
      "data": ISODate("2026-10-30T11:30:00Z"),
      "dentes": [
        { "numero": 18, "condicao": "extracao_indicada" },
        { "numero": 46, "faces": ["mesial", "oclusal"], "condicao": "carie" }
      ]
    }
  ],
  "mapas_faciais": []
}
```

### Recursos do MongoDB usados
- **Validação com `$jsonSchema`** em todas as coleções (tipos, campos obrigatórios e `enum`).
- **Índices únicos** (e‑mail do usuário, CPF por clínica, código de plano/procedimento).
- **Índice parcial** (CPF só é único quando informado).
- **Índice de texto** para busca de paciente por nome.
- **Índices multikey** sobre os arrays embutidos no paciente (agenda por data, termos por status, hash do termo, tipo de mapa facial).
- **Índice TTL** para expirar logs de acesso.

---

## 4. Funcionalidades com pipelines de agregação (Atividade A2)

Estão no final de `scripts/03_consultas_exemplo.js`.

| # | Funcionalidade | Coleção(ões) | Etapas do pipeline |
|---|---|---|---|
| 1 | **Top 5 alergias mais comuns**: ajuda a clínica a se preparar (ex.: luvas sem látex, evitar certos medicamentos) | `pacientes` | `$match` → `$unwind` → `$group` (`$sum`) → `$sort` → `$limit` → `$project` |
| 2 | **Relatório de documentos com contato do paciente e profissional emissor**: mostra o status de cada termo, o telefone do paciente e o CRO de quem emitiu, para a recepção cobrar assinaturas pendentes | `pacientes` + `usuarios` | `$match` → `$unwind` → `$lookup` → `$unwind` → `$sort` → `$project` |

### Passo a passo de cada pipeline (com os dados de exemplo)

Na demo visual, aba **Documentos → Ver pipeline MongoDB**, cada estágio aparece com o código, quantos documentos entram e saem, e a saída real.

**A2.1: Top 5 alergias** (`pacientes`)

| # | Estágio | O que faz | Entram → saem |
|---|---|---|---|
| 1 | `$match: { "ficha.anamnese.alergias.0": { $exists: true } }` | Só pacientes com pelo menos 1 alergia | 4 → 2 |
| 2 | `$unwind: "$ficha.anamnese.alergias"` | Um paciente com N alergias vira N documentos, cada um com **uma** alergia | 2 → 2 |
| 3 | `$group: { _id: { $toLower: … }, total_pacientes: { $sum: 1 } }` | Agrupa pela alergia (minúsculas) e conta | 2 → 2 |
| 4 | `$sort: { total_pacientes: -1, _id: 1 }` | Mais comum primeiro; empate em ordem alfabética | 2 → 2 |
| 5 | `$limit: 5` | Mantém as 5 primeiras | 2 → 2 |
| 6 | `$project: { _id: 0, alergia: "$_id", total_pacientes: 1 }` | Renomeia `_id` para `alergia` | 2 → 2 |

Resultado: `dipirona: 1`, `látex: 1`. Na demo, ao adicionar uma alergia a um paciente (`$addToSet`), o ranking muda na hora.

**A2.2: Relatório de documentos com contato** (`pacientes` + `usuarios`)

| # | Estágio | O que faz | Entram → saem |
|---|---|---|---|
| 1 | `$match: { "documentos.0": { $exists: true } }` | Só pacientes com algum termo | 4 → 2 |
| 2 | `$unwind: "$documentos"` | Cada termo embutido vira um item; nome, CPF e telefone do paciente vêm junto | 2 → 3 |
| 3 | `$lookup: { from: "usuarios", localField: "documentos.profissional_id", foreignField: "_id", as: "profissional" }` | Busca o dentista que emitiu o termo em **outra coleção** | 3 → 3 |
| 4 | `$unwind: "$profissional"` | Array de 1 elemento do `$lookup` vira objeto | 3 → 3 |
| 5 | `$sort: { "documentos.gerado_em": -1 }` | Mais recentes primeiro | 3 → 3 |
| 6 | `$project: { … }` | Esconde os ObjectIds; mostra status, documento, data, paciente, CPF, telefone, profissional e CRO | 3 → 3 |

Resultado: 3 termos (Exodontia **enviado**, Endodôntico **assinado**, Toxina **assinado**). Na demo, os botões **Emitir**, **Enviar** e **Assinar** executam `$push` e `$set` com o posicional `documentos.$`, e o relatório é recalculado.

### Por que os dois pipelines são bem diferentes

O primeiro é um pipeline de **contagem**: trabalha só na coleção `pacientes`, desmembra com `$unwind` um array de **valores simples** (`ficha.anamnese.alergias`) e depois **reduz** tudo com `$group` + `$sum` a uma estatística. Muitos pacientes viram no máximo 5 grupos, e o paciente original deixa de existir na saída. O segundo é um pipeline de **enriquecimento**: desmembra o array de **subdocumentos** `documentos[]` (cada termo vira um item e carrega junto o nome, CPF e telefone do paciente, que já estão no mesmo documento) e então usa `$lookup` para buscar em **outra coleção** (`usuarios`) o profissional que emitiu cada termo, pelo `profissional_id`. Nada é agrupado: cada termo continua sendo um item, só que completado com dados de fora. Em resumo, o primeiro **reduz** documentos a números dentro de uma coleção; o segundo **mantém** cada item e o **combina** com dados de outra coleção.

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

### Passo a passo dos comandos Redis

Na demo visual, aba **Redis**, cada botão executa estes comandos e mostra a resposta como no `redis-cli`. Os mesmos comandos estão em `redis/cli/*.redis` e no código `redis/src/`.

**(a) Cache de login** (`redis/src/cache_login.js`)

| Passo | Comando | Para quê |
|---|---|---|
| 1. Bloqueado? | `GET consentio:login:falhas:<email>` | 5 ou mais erros: recusa e informa `TTL` restante |
| 2. Busca no cache | `HGETALL consentio:usuario:email:<email>` | Achou: **CACHE HIT**. Vazio: **CACHE MISS** |
| 3. Miss: grava | `MULTI` · `HSET consentio:usuario:email:<email> id … papel … senha_hash scrypt$…` · `EXPIRE … 600` · `EXEC` | Copia o usuário do MongoDB por 10 min (só o hash da senha) |
| 4. Senha errada | `INCR consentio:login:falhas:<email>` · `EXPIRE … 900` (na 1ª) | Conta tentativas numa janela de 15 min |
| 5. Senha certa | `DEL …falhas…` · `MULTI` · `HSET consentio:sessao:<token> usuario_id … permissoes …` · `EXPIRE … 3600` · `SADD consentio:usuario:<id>:sessoes <token>` · `EXEC` | Cria a sessão de 1 h e registra o token do usuário |
| 6. Cada requisição | `HGETALL consentio:sessao:<token>` · `EXPIRE … 3600` | Valida sem ir ao MongoDB e renova o TTL (expiração deslizante) |
| 7. Logout | `DEL consentio:sessao:<token>` · `SREM …:sessoes <token>` | Encerra a sessão |
| 8. Troca de senha | `SMEMBERS …:sessoes` · `MULTI` · `DEL usuario:email:…` · `DEL …:sessoes` · `DEL sessao:<cada token>` · `EXEC` | Invalida o cache e derruba **todas** as sessões |

**(b) Bloom Filter**: "este e-mail/CPF já existe?"

| Passo | Com RedisBloom | Sem módulo (mesmo algoritmo) |
|---|---|---|
| Criar (10.000 itens, 1% de erro) | `BF.RESERVE consentio:stats:bf:emails 0.01 10000` | bitmap de m = 95.851 bits, k = 7 hashes |
| Inserir | `BF.ADD` / `BF.MADD … itens` | `SETBIT … <posição> 1` (7 vezes por item) |
| Consultar | `BF.EXISTS` / `BF.MEXISTS …` | `GETBIT … <posição>` (7 vezes) |
| Ler a resposta | `0`: **com certeza não existe** (cadastra sem consultar o MongoDB). `1`: **talvez exista** (confirma no MongoDB) | algum bit 0 é "não existe"; todos 1 é "talvez" |

**(c) HyperLogLog**: "quantos únicos?"

| Passo | Comando |
|---|---|
| Registrar acesso | `PFADD consentio:stats:hll:ativos:<dia> <usuario>` (repetido não conta de novo) |
| Contar o dia | `PFCOUNT consentio:stats:hll:ativos:<dia>` |
| Somar a semana sem duplicar | `PFMERGE consentio:stats:hll:ativos:semana-48 <7 dias>` · `PFCOUNT …semana-48` |
| Ver a memória | `MEMORY USAGE <chave>` (máx. ~12 KB, qualquer quantidade) |

**(d) Count-Min Sketch**: "quantas vezes?"

| Passo | Com RedisBloom | Sem módulo |
|---|---|---|
| Criar | `CMS.INITBYDIM consentio:stats:cms:eventos:<dia> 2000 5` | matriz num HASH com campos `"linha:coluna"` |
| Registrar evento | `CMS.INCRBY … documento_gerado 1 documento_gerado@11h 1` | `HINCRBY … "<linha>:<coluna>" 1` (uma vez por linha) |
| Consultar | `CMS.QUERY … documento_gerado` | `HMGET …` e pega o **menor** valor |

### Resultados medidos (demo)
- Validação de sessão pelo Redis: **~0,6 ms**, sem consultar o MongoDB; o 2º login não vai ao banco.
- Bloom Filter (10 mil e-mails, 1%): **0 falsos negativos**, **1,08% de falsos positivos** (108 em 10.000; a demo visual dá o mesmo número), 12 KB.
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
├── docs/
│   └── index.html                   # demo visual (GitHub Pages): 4 telas, sem backend
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
