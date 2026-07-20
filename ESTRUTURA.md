# 🗂️ Estrutura do Projeto — Achador de Editais

Este documento descreve a arquitetura, a organização de arquivos e o funcionamento completo do projeto **Achador de Editais** (também referenciado como *Buscador de Concursos Locais*), um sistema automatizado de monitoramento de editais de concursos públicos e processos seletivos de prefeituras e câmaras municipais da região noroeste de São Paulo.

O projeto é construído sobre o ecossistema **Next.js 16** (App Router, Server Actions, React 19) com **Tailwind CSS v4**, integrado a um banco **MongoDB** (Mongoose), com enriquecimento de dados via **Google Gemini AI** e notificações por e-mail via **Resend**.

---

## 🌳 Árvore de Diretórios

```text
achadordeeditais/
├── .github/
│   └── workflows/
│       ├── scraper.yml              # Workflow GitHub Actions: raspagem 3x/dia (self-hosted)
│       └── sync-ibge.yml            # Workflow GitHub Actions: sincronização IBGE 2x/dia
├── .env / .env.local                # Variáveis de ambiente (chaves de API, MongoDB URI)
├── .gitignore                        # Ignora node_modules, .next e backups/
├── AGENTS.md                        # Regras para agentes de IA (Next.js 16 tem breaking changes)
├── CLAUDE.md                        # Referência a AGENTS.md
├── ESTRUTURA.md                     # Este documento
├── INFRAESTRUTURA.md                # Documentação do self-hosted runner (Oracle Cloud)
├── README.md                        # Manual introdutório e guia de início rápido
├── backups/                         # Diretório local de backups do MongoDB (ignorado no git)
├── eslint.config.mjs               # Configuração ESLint
├── next-env.d.ts                   # Tipos globais automáticos do Next.js
├── next.config.ts                  # Config: reactCompiler, devOrigins, bodySizeLimit 5MB
├── package.json                    # Dependências e scripts (inclui npm run db:backup)
├── package-lock.json
├── postcss.config.mjs             # PostCSS para Tailwind CSS v4
├── tsconfig.json                   # Config TypeScript (alias @/*)
├── tsconfig.tsbuildinfo
├── ssh-key-2026-05-27.key         # Chave SSH para o self-hosted runner (Oracle Cloud)
├── test.doc / test.pdf            # Arquivos de teste para docParser/wordToPdf
├── test-drive.ts / test-parser.ts / test-parser-real.ts / test-word.ts  # Scripts de teste manuais
├── scripts/
│   ├── backup-db.ts               # Exporta backup EJSON de todas as coleções em backups/
│   ├── run-scraper.ts             # Entry point do GitHub Actions: pipeline completo de raspagem
│   ├── sync-ibge.ts               # Sincronização de servidores IBGE via Portal da Transparência
│   ├── initScraperConfigs.ts      # Inicializa ScraperConfig no MongoDB para todas as cidades
│   ├── testConfig.ts              # Testa/força configuração de disponibilidade de scraper
│   └── testScraper.ts             # Testa raspagem de uma cidade isolada
└── src/
    ├── proxy.ts                   # Middleware global: protege rotas, valida JWT do cookie
    ├── app/
    │   ├── actions.ts             # Server Actions: buscarTodosEditais, buscarEditaisPorCidade, enriquecer
    │   ├── globals.css            # Estilos globais + import do Tailwind CSS v4
    │   ├── layout.tsx             # Layout HTML base (fontes Geist, metadados)
    │   ├── page.tsx               # Página inicial: painel principal com editais
    │   ├── favicon.ico
    │   ├── admin/
    │   │   └── actions.ts         # Server Actions admin: ScraperConfig CRUD (require role=admin)
    │   ├── api/
    │   │   ├── dev/
    │   │   │   └── logs/
    │   │   │       └── route.ts   # SSE endpoint: streaming de logs do backend (dev only)
    │   │   └── servidores-ibge/
    │   │       ├── route.ts       # GET: busca servidores IBGE por cidade
    │   │       ├── agencias/route.ts    # GET: lista agências do IBGE agrupadas por estado
    │   │       └── remuneracao/route.ts # GET: busca remuneração de servidor (Portal da Transparência)
    │   ├── auth/
    │   │   └── actions.ts         # Server Actions: login, signup, logout, reset senha, update email, delete conta
    │   ├── developer/
    │   │   └── logs/
    │   │       └── page.tsx       # Painel admin: métricas das últimas 20 execuções do scraper
    │   ├── login/
    │   │   └── page.tsx           # Tela de login
    │   ├── profile/
    │   │   ├── page.tsx            # Página de perfil (servidora, busca configs admin)
    │   │   ├── ProfileClient.tsx   # Lógica client: alteração de email, senha, notificações, exclusão
    │   │   └── AdminScraperConfigs.tsx # Painel admin: toggle Modo Disponibilidade por cidade
    │   ├── reset-password/
    │   │   └── page.tsx           # Tela de solicitação de recuperação de senha
    │   ├── signup/
    │   │   └── page.tsx           # Tela de cadastro de novos usuários
    │   ├── update-password/
    │   │   └── page.tsx           # Tela de definição de nova senha (via token de reset)
    │   └── servidoresIBGE/
    │       ├── page.tsx            # Página servidora do módulo IBGE
    │       └── ServidoresIBGE.tsx  # Componente client: busca de servidores com filtros por estado/cidade
    ├── components/
    │   ├── AdminLogsButton.tsx     # Botão no header: link para /developer/logs (visível para admins)
    │   ├── ControlsBar.tsx         # Barra de controle: busca global, modos de view, export JSON
    │   ├── DevToolsPanel.tsx       # Painel flutuante admin: disparar raspagens, toggle IA/emails, auditorias
    │   ├── EditalCard.tsx          # Card visual de um edital (badges, links, datas, dados enriquecidos)
    │   ├── FilterPanel.tsx         # Painel lateral: filtros por cidade, termo, licitações, expirados
    │   ├── FolderDetailView.tsx    # Visualização expandida: documentos de um concurso
    │   ├── FolderView.tsx          # Modo de visualização: editais agrupados em pastas por concurso
    │   ├── Footer.tsx             # Rodapé
    │   ├── Header.tsx             # Cabeçalho (logo, navegação, ProfileButton, AdminLogsButton)
    │   ├── ListView.tsx           # Modo de visualização: lista cronológica de editais
    │   ├── ProfileButton.tsx      # Botão de conta no header (Entrar / Meu Perfil / Logout)
    │   └── TerminalPanel.tsx      # Terminal flutuante: logs do backend em tempo real via SSE (dev only)
    ├── lib/
    │   ├── aiAnalysis.ts           # IA Júnior (Gemini 3.1 Flash Lite): extrai dados de editais via few-shot
    │   ├── aiAuditor.ts            # IA Auditora (Gemini 3.5 Flash): audita e corrige extração da IA Júnior
    │   ├── auth.ts                 # Utilitários JWT (jose) + bcrypt: sign, verify, hash, cookies
    │   ├── blacklist.ts            # Lista de URLs de PDFs inválidos/vazios a ignorar
    │   ├── devLogger.ts            # Intercepta console.log/warn/error e emite via EventEmitter (SSE para dev)
    │   ├── diagnostics.ts          # Auditoria de portais Instar: compara contagem de arquivos no site vs banco
    │   ├── docParser.ts            # Baixa PDF/DOCX/DOC, resolve redirects, extrai texto e datas
    │   ├── email.ts                # Abstração da API Resend para envio de e-mails transacionais
    │   ├── filtrosGlobais.ts       # Heurísticas anti-ruído: ehSujeira, ehAndamentoOrfao, extrairIdConcurso
    │   ├── mockScrapingLogs.ts      # Gerador de logs de scraping realistas para desenvolvimento
    │   ├── mongodb.ts              # Gerenciador de conexão MongoDB com cache (evita pool exhaustion em serverless)
    │   ├── notifications.ts        # Pipeline de notificações: filtro burocrático → preferências → e-mail
    │   ├── orchestrator.ts         # Orquestrador central: pipeline completo de raspagem → IA → notificações
    │   ├── pdfParserModern.ts      # Extração de texto de PDFs via pdfjs-dist (layout espacial para Diários Oficiais)
    │   ├── runner.ts               # Executor resiliente: timeout 290s/cidade, dados parciais, logs formatados
    │   ├── storage.ts              # Persistência MongoDB: CRUD de editais, logs, metadata, enriquecimento
    │   ├── wordToPdf.ts            # Conversão .doc/.docx → PDF via LibreOffice headless (soffice)
    │   └── scrapers/
    │       ├── registry.ts          # MAPA_SCRAPERS (cidade→função), MAPA_SCRAPERS_DIARIO e CIDADES_ATIVAS
    │       ├── utils.ts             # fetchHtml (retries, headers navegador), extrairData, limparTituloDoc
    │       ├── instar.ts             # Motor genérico para portais Instar (paginação, pastas, download links)
    │       ├── webline.ts            # Motor para portais Webline
    │       ├── alvaresflorence.ts   # Scraper: Álvares Florence
    │       ├── dolcinopolis.ts      # Scraper: Dolcinópolis
    │       ├── estrela.ts           # Scraper: Estrela d'Oeste
    │       ├── fernandopolis.ts     # Scraper: Fernandópolis
    │       ├── guaranidoeste.ts     # Scraper: Guarani d'Oeste
    │       ├── indiapora.ts         # Scraper: Indiaporã
    │       ├── jales.ts             # Scraper: Jales
    │       ├── macedonia.ts         # Scraper: Macedônia
    │       ├── meridiano.ts         # Scraper: Meridiano
    │       ├── miraestrela.ts       # Scraper: Mira Estrela
    │       ├── ouroeste.ts          # Scraper: Ouroeste (reutiliza motor Instar)
    │       ├── parisi.ts            # Scraper: Parisi
    │       ├── pedranopolis.ts      # Scraper: Pedranópolis
    │       ├── pontalinda.ts        # Scraper: Pontalinda
    │       ├── santasalete.ts       # Scraper: Santa Salete
    │       ├── saojoao.ts           # Scraper: São João das Duas Pontes
    │       ├── urania.ts            # Scraper: Urânia
    │       ├── valentimgentil.ts    # Scraper: Valentim Gentil
    │       ├── vitoriabrasil.ts     # Scraper: Vitória Brasil
    │       ├── votuporanga.ts       # Scraper: Votuporanga
    │       └── camaras/              # Scrapers das Câmaras Municipais (Poder Legislativo)
    │           ├── fernandopolis.ts
    │           ├── indiapora.ts
    │           ├── jales.ts
    │           ├── meridiano.ts
    │           ├── miraestrela.ts
    │           ├── parisi.ts
    │           └── votuporanga.ts
    ├── models/
    │   ├── Edital.ts               # Schema Mongoose: editais (link único, dadosEnriquecidos, timestamps)
    │   ├── Metadata.ts             # Schema Mongoose: chave-valor (última atualização global)
    │   ├── ScraperConfig.ts        # Schema Mongoose: flag verificarDisponibilidade por cidade
    │   ├── ScrapingLog.ts           # Schema Mongoose: histórico de execuções (detalhes por cidade)
    │   ├── ServidorIBGE.ts          # Schema Mongoose: servidores IBGE (Portal da Transparência)
    │   └── User.ts                 # Schema Mongoose: usuários, credenciais, role, preferências de notificação
    ├── types/
    │   └── index.ts                # Tipo Edital e interface ScraperOptions
    └── utils/
        └── exportJson.ts           # Converte editais exibidos em arquivo .json para download no navegador
```

---

## 📐 Arquitetura — Pipeline Completo

O sistema opera em dois modos que compartilham o mesmo código-base:

1. **Automático (GitHub Actions)** — 3x ao dia, um self-hosted runner na Oracle Cloud (IP brasileiro) executa o pipeline completo
2. **Local (UI de desenvolvimento)** — um painel DevTools na própria aplicação permite disparar raspagens seletivas, ligar/desligar IA e e-mails

O fluxo de ponta a ponta é orquestrado por `runFullScraperWorkflow()` em `orchestrator.ts`:

```
GitHub Actions (cron 3x/dia)  ou  DevToolsPanel (UI local)
  └─ scripts/run-scraper.ts  ou  actions.rodarFluxoCompletoServerAction()
       └─ orchestrator.runFullScraperWorkflow()
            │
            ├─ 1. RASPAGEM (actions.ts → buscarTodosEditais)
            │     ├─ Consulta ScraperConfig no MongoDB (Modo Disponibilidade?)
            │     ├─ Executa em lotes de 4 cidades em paralelo
            │     └─ runner.ts (rodarComProtecao, timeout 290s/cidade)
            │          └─ registry.ts → MAPA_SCRAPERS[cidade]
            │               ├─ instar.ts (motor genérico para portais Instar)
            │               ├─ webline.ts (motor para portais Webline)
            │               └─ scrapers específicos por cidade
            │
            ├─ 2. RETENTATIVAS (até 3, com 10min de espera entre elas)
            │     └─ Re-roda apenas cidades que falharam
            │
            ├─ 3. DEDUPLICAÇÃO (por link único)
            │
            ├─ 4. SINCRONIZAÇÃO COM BANCO (storage.ts)
            │     ├─ identificarMudancas() — diff: novos vs existentes no MongoDB
            │     └─ persistirSincronizacao() — bulkWrite (insertOne/updateOne)
            │
            ├─ 5. ENRIQUECIMENTO IA (aiAnalysis.ts) — apenas para novos editais
            │     └─ processarComIA() — Gemini 3.1 Flash Lite
            │          ├─ docParser.ts baixa o PDF/DOCX/HTML do edital
            │          ├─ PDFs >10 páginas → extrai primeiras 5 + últimas 5
            │          ├─ .doc/.docx → converte via LibreOffice (wordToPdf.ts)
            │          ├─ Upload para Gemini API (File Manager)
            │          ├─ Few-Shot Prompting → JSON { titulo, descricao, concurso, dataPublicacao }
            │          ├─ Rate limit: 4s entre requisições, retry em 429 (60s espera)
            │          └─ Calcula custo em USD→BRL (cotação do dólar em tempo real)
            │
            ├─ 6. AUDITORIA IA (aiAuditor.ts) — apenas enriquecimento manual com mudanças
            │     └─ Gemini 3.5 Flash (modelo superior) audita a IA Júnior
            │          ├─ Veredicto: CORRETO ou INCORRETO
            │          └─ Se INCORRETO: corrige dados automaticamente em memória
            │
            ├─ 7. NOTIFICAÇÕES (notifications.ts) — apenas se houver novos editais
            │     ├─ Passo 1: Filtro burocrático (41 termos → descarta homologação, convocação, etc.)
            │     ├─ Passo 2: Busca usuários com notificações ativas no MongoDB
            │     ├─ Passo 3: Filtra por preferências individuais (cidade, órgão)
            │     └─ Passo 4: Envia e-mails individuais via Resend (email.ts)
            │
            └─ 8. LOG (storage.ts → adicionarScrapingLog)
                  └─ Salva métricas do bloco no MongoDB (mantém 20 mais recentes)
```

---

## 📄 Detalhamento dos Módulos

### 🚀 1. Raiz do Projeto (Configurações)

- **`next.config.ts`**: Habilita o React Compiler, define `allowedDevOrigins` para IP local na rede, e aumenta o limite de payload de Server Actions para 5MB (necessário para operações pesadas de dados).
- **`postcss.config.mjs`**: Gerencia a compilação do Tailwind CSS v4, que substitui o arquivo tradicional `tailwind.config.ts` por declarações diretamente em CSS.
- **`eslint.config.mjs` / `tsconfig.json`**: Regras de lint e configuração do TypeScript (alias `@/*` → `src/*`).
- **`package.json`**: Define dependências (Next.js 16, React 19, Mongoose 9, Gemini SDK, Resend, Cheerio, pdf-parse, mammoth, word-extractor, jose, bcryptjs, Zod, React Hook Form, lucide-react) e scripts. Inclui scripts `link-ssd`/`install-ssd` para instalar node_modules em outro diretório, economizando espaço no SSD.
- **`AGENTS.md`**: Alerta que o Next.js 16 tem breaking changes em relação à documentação pública — APIs e convenções podem diferir do esperado. Inclui regra para consultar `node_modules/next/dist/docs/` antes de escrever código.
- **`CLAUDE.md`**: Referência simples a `AGENTS.md`.

### ⚙️ 2. Diretório `scripts/` (Rotinas e Entry Points)

- **`backup-db.ts`**: Realiza o backup completo do banco de dados MongoDB em formato EJSON (Extended JSON), preservando tipos nativos (ObjectId, Date, etc.). Salva cada uma das 11 coleções em arquivos `.json` com timestamp dentro do diretório `backups/backup-YYYY-MM-DDTHH-mm-ss` e gera um arquivo de resumo `backup-info.json`. Pode ser executado com `npm run db:backup`.
- **`run-scraper.ts`**: Ponto de entrada do GitHub Actions. Carrega variáveis de ambiente (`@next/env`), chama `runFullScraperWorkflow({ isLocalUI: false })` e força `process.exit(0)` ao final para evitar que a Action fique pendurada em conexões abertas.
- **`sync-ibge.ts`**: Sincroniza servidores do IBGE via API do Portal da Transparência. Pagina todos os servidores do órgão SIAPE 45205, faz upsert no MongoDB, e envia e-mail de notificação para `cafecafe51@hotmail.com` quando detecta alterações em servidores de Fernandópolis (novos servidores, mudança de cargo, situação, regime, jornada, etc.).
- **`initScraperConfigs.ts`**: Cria registros de `ScraperConfig` no MongoDB para todas as cidades em `CIDADES_ATIVAS` (com `verificarDisponibilidade: false`). Rodar uma vez ao configurar o banco pela primeira vez.
- **`testScraper.ts`**: Testa a raspagem de uma cidade isolada (ex: Fernandópolis) e imprime resultados.
- **`testConfig.ts`**: Testa e força o valor de `verificarDisponibilidade` para uma cidade no MongoDB.
- **Arquivos `test-*.ts` na raiz**: Scripts de teste manual para docParser, wordToPdf e Google Drive.

### 🛡️ 3. Segurança, Middleware e Autenticação

- **`src/proxy.ts`**: Middleware global do Next.js. Intercepta todas as rotas (exceto arquivos estáticos), valida o cookie `session` (JWT via `jose`). Redireciona usuários não autenticados para `/login` ao acessar `/profile`, `/developer`, `/admin`. Redireciona usuários logados para `/` ao acessar `/login`, `/signup`, `/reset-password`.
- **`src/lib/auth.ts`**: Utilitários de backend: `hashPassword` (bcrypt, 10 rounds), `comparePassword`, `signToken` (JWT HS256, 30 dias de validade), `verifyToken`, `getSessionUser` (lê cookie via `next/headers`), `setSessionCookie` (httpOnly, secure em produção, sameSite lax), `deleteSessionCookie`.
- **`src/app/auth/actions.ts`**: Server Actions de autenticação integradas ao MongoDB:
  - `login()`: Valida email/senha com bcrypt, emite JWT, seta cookie.
  - `signup()`: Cria usuário no MongoDB, login automático, redirecionamento.
  - `logout()`: Remove cookie de sessão.
  - `requestPasswordReset()`: Gera token UUID, salva no MongoDB (1h de validade), envia link por e-mail via Resend.
  - `updatePassword()`: Redefine senha via token (do e-mail) ou via sessão ativa. Login automático pós-reset.
  - `updateEmail()`: Atualiza email, re-emite JWT com novo email.
  - `deleteAccount()`: Valida senha e exclui a conta fisicamente do MongoDB.
  - `updateNotificationSettings()`: Atualiza preferências de notificação (enabled, organs, cities).

### 🖥️ 4. Diretório `src/app/` (Páginas, Telas e Server Actions)

- **`actions.ts`**: Server Actions principais:
  - `buscarTodosEditais(cidadesAlvo?)`: Executa raspagem de todas as cidades (ou um subconjunto) em lotes de 4, consulta `ScraperConfig` para verificar modo de disponibilidade, deduplica por link, ordena por data.
  - `buscarEditaisPorCidade(nomeCidade)`: Raspagem individual de uma cidade (usado em retentativas e testes).
  - `rodarFluxoCompletoServerAction(options)`: Delega para `orchestrator.runFullScraperWorkflow()`.
  - `enriquecerArquivosAction(editais)`: Enriquecimento manual de IA via UI — filtra pendentes, chama `processarComIA()`, detecta mudanças significativas (concurso ou data >3 dias de diferença), aciona auditoria IA, salva no banco.
  - `reverterEnriquecimentoAction(link)`: Remove `dadosEnriquecidos` de um edital no MongoDB.
- **`admin/actions.ts`**: Server Actions administrativas (requerem `role: 'admin'`):
  - `getScraperConfigsAction()`: Lista todas as configurações de scraper.
  - `toggleScraperConfigAction(nome, newValue)`: Liga/desliga o Modo Verificação de Disponibilidade de uma cidade.
- **`page.tsx`**: Página inicial. Carrega editais do MongoDB em tempo real, renderiza Header, ControlsBar, FilterPanel, ListView/FolderView e DevToolsPanel.
- **`developer/logs/page.tsx`**: Painel administrativo. Exibe métricas das últimas 20 execuções: tempo total, tentativas, status (sucesso/falha_parcial/falha), itens por cidade, adições e atualizações no banco.
- **`servidoresIBGE/`**: Módulo IBGE. `page.tsx` é a página servidora; `ServidoresIBGE.tsx` é o componente client com dropdowns pesquisáveis de estado/cidade, tabela de servidores e busca de remuneração.
- **`login/`, `signup/`, `reset-password/`, `update-password/`, `profile/`**: Páginas de fluxos de conta, todas com formulários e validação.

### 🎨 5. Diretório `src/components/` (Componentes Visuais)

- **`Header.tsx`**: Cabeçalho com logo, navegação, `ProfileButton` e `AdminLogsButton` (visível apenas para admins).
- **`Footer.tsx`**: Rodapé da aplicação.
- **`ProfileButton.tsx`**: Mostra "Entrar" para anônimos ou menu "Meu Perfil"/"Sair" para logados.
- **`AdminLogsButton.tsx`**: Botão no header que linka para `/developer/logs`. Renderiza apenas se `user.role === 'admin'`.
- **`ControlsBar.tsx`**: Barra de controle: busca textual global, alternância entre ListView e FolderView, exportação dos resultados em JSON.
- **`FilterPanel.tsx`**: Painel lateral: filtros por cidade, termo no título, mostrar/esconder licitações e concursos expirados.
- **`ListView.tsx`**: Visualização cronológica (linear) dos editais.
- **`FolderView.tsx`**: Visualização agrupada por concurso (pasta virtual), com `FolderDetailView` para expandir.
- **`EditalCard.tsx`**: Card individual: badges (cidade, órgão, IA), título, descrição, data, link direto.
- **`FolderDetailView.tsx`**: Janela expandida com todos os documentos de um concurso.
- **`DevToolsPanel.tsx`**: Painel flutuante (admin/dev): disparar raspagens manuais (com seleção de cidades), ligar/desligar IA e e-mails, acionar auditorias, simular falhas. Configurações salvas em `localStorage`.
- **`TerminalPanel.tsx`**: Terminal flutuante que exibe logs do backend em tempo real via SSE (Server-Sent Events). Conecta a `/api/dev/logs`. Disponível apenas em desenvolvimento.

### 🔧 6. Diretório `src/lib/` (Módulos de Negócio, IA e Raspagem)

#### Orquestração e Execução

- **`orchestrator.ts`**: O Orquestrador Central. `runFullScraperWorkflow(options)` executa o pipeline completo: raspagem → retentativas → deduplicação → sincronização → enriquecimento IA → notificações → log. Em modo local (`isLocalUI: true`), respeita configurações do DevToolsPanel (IA on/off, e-mails on/off, cidades selecionadas). Em modo GitHub Actions, retentativas têm 10min de espera; em UI local, 30s.
- **`runner.ts`**: `rodarComProtecao(nomeCidade, funcaoScraper, opcoes)`: executa um scraper com `Promise.race` contra um timeout de 290s. Trata 4 cenários: sucesso (OK), falha (FALHOU), aviso com dados parciais (AVISO), e modo disponibilidade (ONLINE/OFFLINE). Logs formatados com colunas alinhadas.

#### Raspagem

- **`scrapers/registry.ts`**: Registro central. `MAPA_SCRAPERS` mapeia nome da cidade → função raspadora. `CIDADES_ATIVAS` define a lista ordenada de 27 cidades executadas no pipeline automático.
- **`scrapers/utils.ts`**: `fetchHtml(url, forceCache, timeoutMs)` — requisição HTTP com headers de navegador real, até 3 tentativas com 10s de espera. `extrairData(texto)` — regex para DD/MM/YYYY (aceita separadores `/`, `.`, `-`, corrige "1º" → "01"). `limparTituloDoc()` — remove palavras genéricas (download, anexo, clique aqui) e lixo numérico. `verificaDisponibilidade(url)` — ping rápido para checar se o site está online.
- **`scrapers/instar.ts`**: Motor genérico para portais no formato Instar. Varre múltiplos statuses (Aberto, Em Andamento, Em Julgamento, Homologado, Encerrado) e offsets de paginação (0, 1, 2, 3, 4, 10, 12, 20, 24, 30, 36, 40, 48, 50, 60, 72, 80, 90, 100). Extrai pastas de concurso, resolve links de download com redirect meta-refresh, detecta portais que exigem login. Aplica filtros globais (`ehSujeira`, `ehAndamentoOrfao`) e extrai ID do concurso. Agrupa documentos por concurso e marca duplicatas com `(*)`.
- **`scrapers/webline.ts`**: Motor para portais baseados na tecnologia Webline.
- **Scrapers específicos por cidade** (20 prefeituras): cada um implementa a lógica de raspagem particular do portal daquela cidade. Alguns reutilizam o motor Instar (ex: `ouroeste.ts`).
- **Scrapers de Câmaras** (`camaras/`, 7 cidades): Raspam os portais das Câmaras de Vereadores (Poder Legislativo).

#### Filtragem e Heurísticas

- **`filtrosGlobais.ts`**: Central de heurísticas anti-ruído:
  - `PALAVRAS_IGNORADAS_GLOBAIS`: ~60 termos que descartam editais que não são concursos de contratação de pessoas (habitação, conselhos tutelares, audiências públicas, voluntariado, atletas, simplificados, etc.).
  - `ehSujeira(texto, palavrasLocais, link, excecoes)`: Verifica se o texto ou link contém termos da lista negra global + lista local, com suporte a exceções.
  - `ehAndamentoOrfao(titulo, descricao)`: Detecta documentos de fase intermediária (convocação, retificação, homologação, resultado, etc.) sem menção ao certame original.
  - `extrairIdConcurso(titulo, descricao, aceitarBuscaInvertida, strict)`: Regex robusto que extrai e padroniza "Concurso Público 01/2026" ou "Processo Seletivo 03/2025" de textos com erros de digitação. Aceita busca invertida (número antes da palavra) e modo estrito.
  - `corrigirErrosDigitacao(texto)`: Normaliza erros comuns ("CONCURSO PÚBLOCO" → "CONCURSO PÚBLICO", "PROCESSO SELETIVO 0032023" → "003/2023").

#### IA — Dois Níveis

- **`aiAnalysis.ts`** (IA Júnior): Usa `gemini-3.1-flash-lite` (modelo barato). `analisarEditalComIA(edital)` baixa o documento via `docParser`, trunca PDFs >10 páginas para primeiras 5 + últimas 5, converte .doc/.docx via LibreOffice, faz upload para Gemini File Manager, e usa few-shot prompting (um turno de exemplo mockado) para forçar saída em JSON: `{ titulo, descricao, concurso, dataPublicacao }`. `processarComIA(editais)` itera sobre novos editais com rate limit de 4s, retry em 429 (60s), e calcula custo em USD→BRL com cotação do dólar em tempo real (AwesomeAPI). Inclui tabela de preços por modelo.
- **`aiAuditor.ts`** (IA Auditora): Usa `gemini-3.5-flash` (modelo superior). `auditarEditalComIA(item)` recebe o documento original + log de mudanças feitas pela IA Júnior, e emite veredicto: CORRETO (aprova) ou INCORRETO (corrige `concurso` e/ou `dataPublicacao` diretamente no objeto em memória). `processarAuditoria(itens)` itera com rate limit de 4s. Só é acionada no enriquecimento manual via UI quando há mudanças relevantes (concurso diferente ou data com >3 dias de diferença).

#### Parser de Documentos

- **`docParser.ts`**: Biblioteca central de download e extração:
  - `obterBufferDoDocumento(url)`: Baixa o arquivo, resolve redirects (meta-refresh HTML, JS `location.href`, Google Drive preview → direct download), detecta tipo por content-type e magic bytes (PDF: `25504446`, DOCX: `504b0304`, DOC: `d0cf11e0`). Retorna `{ textoLimpo, isPDF, isDOCX, isDOC, buffer }`.
  - `extrairTextoBruto(url)`: Usa `pdf-parse` (PDF, até 3 páginas), `mammoth` (DOCX), `word-extractor` (DOC) para extrair texto. Silencia warnings do pdf-parse.
  - `extrairDataDoArquivo(url)`: Algoritmo com scoring que encontra a data de publicação/assinatura no texto extraído. Penaliza datas de prazos/cronogramas (contexto: "até", "para", "às 14:00") e bonifica datas de assinatura (contexto: "Aos", "Gabinete", "Paço Municipal", "Em" no início da linha). Aceita datas em formato numérico (DD/MM/AAAA) e por extenso ("15 de março de 2026").
  - `urlsParaBlacklist`: Set dinâmico que coleta URLs de documentos sem data ou com conteúdo insuficiente, para revisão manual.
- **`wordToPdf.ts`**: `converterWordParaPdf(buffer, isDocx)` — escreve o buffer em arquivo temporário, invoca `soffice --headless --convert-to pdf` (LibreOffice), lê o PDF resultante e limpa os arquivos temporários.
- **`blacklist.ts`**: Array estático de URLs de PDFs catalogados como inválidos/vazios (especialmente de São João das Duas Pontes e Urânia). Usado por `docParser` para pega e ignora.

#### Notificações

- **`notifications.ts`**: Pipeline de notificações em 4 passos:
  1. **Filtro burocrático**: 41 termos (classificação, convocação, homologação, gabarito, resultado, recurso, etc.) que descartam postagens intermediárias/administrativas.
  2. **Busca de usuários**: Consulta MongoDB por usuários com `notifications.enabled: true`.
  3. **Filtros individuais**: Para cada usuário, filtra por cidade (lista específica ou "todas") e órgão (todos, prefeitura, câmara).
  4. **Envio**: Monta HTML rico com badges (cidade, órgão, badge IA), descrição enriquecida, link direto. Envia um e-mail por edital via Resend.
  - `enviarAlertaDisponibilidadeAdmin(cidades)`: Envia e-mail para admins quando scrapers em Modo Disponibilidade reportam ONLINE, sugerindo desligar o modo.
- **`email.ts`**: Abstração da API Resend. `enviarEmail(para, assunto, conteudoHTML)`. Instancia o cliente apenas se `RESEND_API_KEY` estiver configurada. O remetente (`from`) usa domínio sandbox do Resend e deve ser alterado em produção.

#### Persistência

- **`storage.ts`**: Comunicação com MongoDB via Mongoose:
  - `carregarDoBanco()`: Carrega todos os editais ordenados por data (desc) + ordemOriginal (asc). Limpa campos internos do MongoDB antes de retornar (usado para Auditorias locais do DevTools).
  - `carregarEditaisPaginados(filtros, pagina, itensPorPagina)`: Carrega os editais da página linear selecionada no feed, aplicando filtros do lado do servidor (MongoDB) e retornando opções dinâmicas para os selects.
  - `carregarPastasPaginadas(filtros, pagina, pastasPorPagina, filtroTipoGrupo)`: Agrupa editais via aggregation pipeline do MongoDB, ordena os grupos em memória, divide-os em páginas (até 9) e busca de forma unificada os editais de cada grupo, garantindo coerência de dados antigos e novos em uma pasta.
  - `carregarTodosEditaisFiltrados(filtros)`: Retorna a lista total de editais filtrados para exportação JSON sob demanda.
  - `carregarGrupoPorChave(chaveUnica)`: Recupera os dados hidratados de uma pasta de concurso pelo link direto.
  - `identificarMudancas(novosEditais, substituirTudo)`: Compara novos editais com existentes por `link`. Identifica adições (link não existe) e atualizações (compara campo a campo, ignorando metadados). Retorna operations para bulkWrite.
  - `persistirSincronizacao(operations, substituirTudo, novosEditais, ...)`: Executa `bulkWrite` no MongoDB. Salva metadata de última atualização. Imprime relatórios detalhados de adições e alterações.
  - `sincronizarBanco()`: Wrapper que chama identificarMudancas + persistirSincronizacao.
  - `salvarEnriquecimentoEmLote(editais)`: Atualiza `dadosEnriquecidos` em lote via bulkWrite.
  - `reverterEnriquecimento(link)`: Remove `dadosEnriquecidos` de um edital.
  - `carregarScrapingLogs()`: Busca os 20 logs mais recentes. Se banco vazio, retorna mock logs.
  - `adicionarScrapingLog(novoLog)`: Insere novo log e remove excesso além de 20.
  - Tipos exportados: `FiltrosEditais`, `LogCidadeDetail`, `SyncLogAddition`, `SyncLogUpdate`, `DatabaseSyncLog`, `ScrapingLog`.
- **`mongodb.ts`**: Gerenciador de conexão com cache global (`global.mongooseConnection`) para evitar pool exhaustion em ambiente serverless. Requer `MONGODB_URI` no ambiente.

#### Diagnóstico e Desenvolvimento

- **`diagnostics.ts`**: Auditoria de portais Instar:
  - `auditarQuantidadesInstar(grupos)`: Compara a contagem de arquivos na badge do site vs a quantidade que temos no banco. Reporta discrepâncias.
  - `extrairDadosRawInstar(urlLista)`: Extrai dados crus de um portal Instar (título, situação, modalidade, número do processo, datas de inscrição, descrição, lista de arquivos) para diagnóstico.
- **`devLogger.ts`**: Intercepta `console.log/info/warn/error` em desenvolvimento, emite eventos via `EventEmitter`, mantém histórico das últimas 200 mensagens. Usado pelo `TerminalPanel` via SSE.
- **`mockScrapingLogs.ts`**: Gera 4 logs de scraping realistas (com dados de cidades reais, tempos, status e relatórios de adições/atualizações) para desenvolvimento quando o banco está vazio.

### 🧱 7. Diretório `src/models/` (Schemas do MongoDB)

- **`Edital.ts`**: Schema dos editais. Campos: `cidade`, `orgao`, `titulo`, `link` (único), `dataTimestamp`, `ano`, `concurso`, `descricao`, `metadados`, `statusGeral`, `dataPublicacao`, `ordemOriginal`, `linkOrigem`, `dadosEnriquecidos` (subdocumento: titulo, descricao, concurso, dataPublicacao). Índice composto `{ dataTimestamp: -1, ordemOriginal: 1 }`. Timestamps automáticos do Mongoose.
- **`User.ts`**: Schema dos usuários. Campos: `email` (único, lowercase), `passwordHash`, `username`, `role` (user/admin, padrão user), `notifications` (subdocumento: enabled, organs [todos/prefeitura/camara], cities [lista ou "todas"]), `passwordResetToken`, `passwordResetExpires`.
- **`ScrapingLog.ts`**: Schema do histórico de execuções. Campos: `id` (UUID), `inicio`, `fim`, `duracaoSegundos`, `tentativas`, `status` (sucesso/falha_parcial/falha), `totalEditais`, `detalhesCidades` (array de LogCidadeDetail), `syncInfo` (DatabaseSyncLog).
- **`ScraperConfig.ts`**: Schema de configuração por cidade. Campos: `nome` (único), `verificarDisponibilidade` (boolean, padrão false). Quando true, o scraper apenas verifica se o site está online sem raspar editais.
- **`Metadata.ts`**: Schema chave-valor simples. Guarda a data da última atualização do banco (`key: 'global'`, `ultimaAtualizacao`).
- **`ServidorIBGE.ts`**: Schema dos servidores IBGE. Campos: `idServidor` (único), `nome`, `cpfFormatado`, `situacao`, `uorgExercicio`, `uorgLotacao`, `ufExercicio`, `rawData` (Mixed), `ultimaAtualizacao`.

### 📐 8. Diretório `src/types/` (Tipos Compartilhados)

- **`index.ts`**: Define o tipo `Edital` (usado em toda a aplicação) e a interface `ScraperOptions` (com flag `verificarDisponibilidade`).

### 💾 9. Diretório `src/utils/` (Funções Auxiliares)

- **`exportJson.ts`**: `exportarParaJSON(dados, prefixoNome)` — converte array de editais para JSON, cria Blob em memória e dispara download no navegador.

### 🌐 10. Diretório `src/app/api/` (API Routes)

- **`dev/logs/route.ts`**: Endpoint SSE (Server-Sent Events) que faz streaming de logs do backend para o `TerminalPanel`. Disponível apenas em desenvolvimento (`NODE_ENV !== 'development'` retorna 404). Envia histórico ao conectar, depois emite cada novo log em tempo real.
- **`servidores-ibge/route.ts`**: `GET ?cidade=...` — busca servidores IBGE no MongoDB por `uorgExercicio` ou `uorgLotacao` contendo o nome da cidade. Deduplica por CPF/nome, preferindo registros com função válida.
- **`servidores-ibge/agencias/route.ts`**: `GET` — agrega todas as agências do IBGE no banco (regex `^AGENCIA DO IBGE EM`), agrupa por estado (UF), retorna lista ordenada para popular dropdowns.
- **`servidores-ibge/remuneracao/route.ts`**: `GET ?id=...` — consulta a API do Portal da Transparência (`api.portaldatransparencia.gov.br`) para buscar remuneração do servidor nos últimos 4 meses. Cache de 1 dia. Requer `PORTAL_TRANSPARENCIA_API_KEY`.

---

## 📊 Modelo de Dados — Tipo `Edital`

```typescript
export type Edital = {
  cidade: string;           // Nome da cidade (ex: "Fernandópolis")
  orgao: string;            // Órgão (ex: "Prefeitura" ou "Câmara")
  titulo: string;           // Título bruto extraído do portal
  link: string;             // URL direta do documento (chave única)
  dataTimestamp: number;    // Timestamp da data do documento (para ordenação)
  ano?: number;             // Ano do concurso
  concurso?: string;        // ID padronizado (ex: "Concurso Público 01/2026")
  descricao?: string;      // Descrição do documento
  metadados?: string[];     // Metadados auxiliares
  statusGeral?: string;    // Status do edital
  dataPublicacao?: string;  // Data de publicação (DD/MM/AAAA)
  ordemOriginal?: number;   // Ordem dentro do concurso
  linkOrigem?: string;      // URL da página interna do portal
  dadosEnriquecidos?: {     // Preenchido pela IA Gemini
    titulo?: string;        // Título limpo gerado pela IA
    descricao?: string;     // Descrição gerada pela IA
    concurso?: string;      // Concurso padronizado pela IA
    dataPublicacao?: string; // Data extraída pela IA
  };
};
```

---

## 🔁 Fluxos de Dados Resumidos

### Raspagem Automática (GitHub Actions)
```
cron (08:00, 16:00, 23:00 UTC)
  → scraper.yml (self-hosted runner)
    → run-scraper.ts
      → orchestrator.runFullScraperWorkflow({ isLocalUI: false })
        → buscarTodosEditais() → 27 cidades em lotes de 4
        → retentativas (até 3, 10min entre elas)
        → identificarMudancas() + persistirSincronizacao() no MongoDB
        → processarComIA() nos novos editais (Gemini 3.1 Flash Lite)
        → processarNotificacoes() (filtro burocrático → e-mails via Resend)
        → adicionarScrapingLog() no MongoDB
```

### Raspagem Manual (UI Local)
```
DevToolsPanel (admin logado)
  → rodarFluxoCompletoServerAction({ isLocalUI: true, enableAI, enableEmails, cidadesSelecionadas })
    → orchestrator.runFullScraperWorkflow() (mesmo pipeline, retentativas com 30s)
```

### Sincronização IBGE (GitHub Actions)
```
cron (07:00, 19:00 UTC)
  → sync-ibge.yml (self-hosted runner)
    → sync-ibge.ts
      → Pagina API Portal da Transparência (órgão IBGE, SIAPE 45205)
      → Upsert no MongoDB (ServidorIBGE)
      → Detecta alterações em Fernandópolis → envia e-mail
```

### Interface Web (Usuário)
```
Usuário acessa /
  → page.tsx carrega editais ou pastas paginados e filtrados do MongoDB (carregarEditaisPaginados ou carregarPastasPaginadas)
  → Renderiza ListView ou FolderView
  → FilterPanel envia filtros por cidade/termo ao servidor (MongoDB)
  → ControlsBar: busca textual + export JSON (chama carregarTodosEditaisFiltrados sob demanda)
  → EditalCard: exibe dados (brutos + enriquecidos pela IA)
  → Usuário logado: pode acessar /profile (preferências de notificação)
  → Admin: pode acessar /developer/logs (métricas) e AdminScraperConfigs
```
