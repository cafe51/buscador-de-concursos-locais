# 🗂️ Estrutura do Projeto - Achador de Editais

Este documento apresenta a organização e a estrutura de pastas do projeto **Achador de Editais** (Buscador de Concursos Locais), detalhando a função de cada arquivo para guiar desenvolvedores e leitores no entendimento técnico da arquitetura da aplicação.

O projeto é construído sobre o ecossistema moderno do **Next.js** (App Router, Server Actions, React 19) estilizado com **Tailwind CSS v4** (PostCSS), integrado ao **Supabase Auth + SSR** para gerenciamento de contas, **Vercel Blob Storage** como banco de dados JSON leve de alta performance, e **Resend** para fluxos de e-mail e notificações.

---

## 🌳 Árvore de Diretórios

Abaixo está a representação visual da estrutura completa de pastas e arquivos do projeto:

```text
achadordeeditais/
├── .github/
│   └── workflows/
│       └── scraper.yml        # Workflow do GitHub Actions para raspagem automática diária
├── eslint.config.mjs          # Configuração do ESLint (padronização e qualidade de código)
├── next-env.d.ts              # Definições de tipos globais automáticas do Next.js
├── next.config.ts             # Configurações do Next.js (reactCompiler, origins autorizados e limites de payload)
├── package.json               # Dependências do projeto (Next.js v16, Tailwind CSS v4, Supabase, Resend, etc.)
├── postcss.config.mjs         # Configuração do PostCSS para compilação do Tailwind v4
├── tsconfig.json              # Configuração do compilador TypeScript
├── ESTRUTURA.md               # Esta documentação de arquitetura e estrutura do projeto
├── INFRAESTRUTURA.md          # Documentação do servidor self-hosted (VM na Oracle Cloud) para execução dos scrapers
├── README.md                  # Manual introdutório do projeto e guia de inicialização rápida
├── AGENTS.md                  # Regras e restrições para agentes de Inteligência Artificial
├── CLAUDE.md                  # Configurações rápidas de comandos para assistentes de desenvolvimento
├── ssh-key-2026-05-27.key     # Chave de segurança para conexões SSH ao servidor Runner na Oracle Cloud
├── scripts/
│   └── run-scraper.ts         # Script principal de execução e sincronização do scraper em lote com retentativas
└── src/
    ├── proxy.ts               # Proxy de middleware de rotas para gerenciamento e atualização de sessão do Supabase
    ├── app/
    │   ├── actions.ts         # Server Actions principais (execução em lote dos scrapers, auditorias e buscas)
    │   ├── globals.css        # Configurações globais e injeção do Tailwind CSS v4
    │   ├── layout.tsx         # Layout HTML base da aplicação (metadados e injeção de fontes Geist)
    │   ├── page.tsx           # Página inicial e painel principal do buscador de editais
    │   ├── auth/
    │   │   ├── actions.ts     # Server Actions de autenticação (login, cadastro, senhas, exclusão)
    │   │   └── callback/
    │   │       └── route.ts   # Rota de callback do Supabase para redirecionamento de confirmação
    │   ├── developer/
    │   │   └── logs/
    │   │       └── page.tsx   # Painel administrativo de monitoramento de logs de execuções do scraper
    │   ├── login/
    │   │   └── page.tsx       # Tela moderna de autenticação de usuários
    │   ├── profile/
    │   │   ├── page.tsx       # Tela servidora de perfil do usuário (Supabase Auth SSR)
    │   │   └── ProfileClient.tsx # Lógica interativa de alteração cadastral e exclusão de conta
    │   ├── reset-password/
    │   │   └── page.tsx       # Tela de recuperação de senha esquecida
    │   ├── signup/
    │   │   └── page.tsx       # Tela elegante de cadastro de novos usuários
    │   └── update-password/
    │       └── page.tsx       # Tela de definição de nova senha pós-link de recuperação
    ├── components/
    │   ├── ControlsBar.tsx    # Barra de controle de visualização (pesquisa global, modos e download JSON)
    │   ├── DevToolsPanel.tsx  # Painel de ferramentas de desenvolvimento (auditoria, simulação de falhas, disparos)
    │   ├── EditalCard.tsx     # Card de exibição visual contendo badges, links e detalhes de um edital
    │   ├── FilterPanel.tsx    # Painel lateral expansível para filtragem refinada (cidade, termo, exclusão de licitações)
    │   ├── FolderDetailView.tsx # Visualização de pasta contendo a lista de documentos e anexos de um certame
    │   ├── FolderView.tsx     # Modo de exibição virtual agrupando editais e anexos em pastas por concurso
    │   ├── Footer.tsx         # Rodapé moderno e de contatos da aplicação
    │   ├── Header.tsx         # Cabeçalho da aplicação (logo, navegação principal e botões de conta)
    │   ├── ListView.tsx       # Modo de visualização de lista linear (cronológica) dos editais
    │   └── ProfileButton.tsx  # Botão do header que reflete o estado do usuário logado (links para perfil e logout)
    ├── lib/
    │   ├── blacklist.ts       # Banco de URLs de documentos inválidos que devem ser ignorados
    │   ├── diagnostics.ts     # Auditorias e raw scrapers focados em portais no padrão "Instar"
    │   ├── docParser.ts       # Baixador e analisador de anexos (PDF/DOCX) para extração automática de datas via Regex
    │   ├── email.ts           # Integração com serviço Resend para despachar e-mails de alertas e recuperação
    │   ├── filtrosGlobais.ts  # Regras globais de filtragem e heurística anti-ruído (eliminação de compras públicas)
    │   ├── mockScrapingLogs.ts # Gerador de registros realistas de logs de scraping para testes em desenvolvimento
    │   ├── runner.ts          # Executor resiliente de scrapers com proteção contra timeouts (290s por cidade)
    │   ├── storage.ts         # Módulo de persistência e sincronização de dados (editais, logs) no Vercel Blob Storage
    │   └── scrapers/
    │       ├── alvaresflorence.ts # Scraper para Álvares Florence
    │       ├── dolcinopolis.ts   # Scraper para Dolcinópolis
    │       ├── estrela.ts        # Scraper para Estrela d'Oeste
    │       ├── fernandopolis.ts  # Scraper para Fernandópolis
    │       ├── guaranidoeste.ts  # Scraper para Guarani d'Oeste
    │       ├── indiapora.ts      # Scraper para Indiaporã
    │       ├── instar.ts         # Motor base adaptável e genérico para portais no formato padrão "Instar"
    │       ├── jales.ts          # Scraper para Jales
    │       ├── macedonia.ts      # Scraper para Macedônia
    │       ├── meridiano.ts      # Scraper para Meridiano
    │       ├── miraestrela.ts    # Scraper para Mira Estrela
    │       ├── ouroeste.ts       # Scraper para Ouroeste (utiliza a infraestrutura do Instar)
    │       ├── parisi.ts         # Scraper para Parisi
    │       ├── pedranopolis.ts   # Scraper para Pedranópolis
    │       ├── registry.ts       # Registro central de scrapers ativos (`MAPA_SCRAPERS`) e lista de cidades (`CIDADES_ATIVAS`)
    │       ├── santasalete.ts    # Scraper para Santa Salete
    │       ├── saojoao.ts        # Scraper para São João das Duas Pontes
    │       ├── urania.ts         # Scraper para Urânia
    │       ├── utils.ts          # Utilitários de scrapers (requisição HTTP com retentativas, datas e nomes de arquivos)
    │       ├── valentimgentil.ts # Scraper para Valentim Gentil
    │       ├── vitoriabrasil.ts  # Scraper para Vitória Brasil
    │       ├── votuporanga.ts    # Scraper para Votuporanga
    │       ├── webline.ts        # Módulo de suporte/parser para portais no padrão "Webline"
    │       └── camaras/          # Raspadores das Câmaras Municipais (Poder Legislativo)
    │           ├── fernandopolis.ts # Scraper para a Câmara de Fernandópolis
    │           ├── indiapora.ts     # Scraper para a Câmara de Indiaporã
    │           ├── jales.ts         # Scraper para a Câmara de Jales
    │           ├── meridiano.ts     # Scraper para a Câmara de Meridiano
    │           ├── miraestrela.ts   # Scraper para a Câmara de Mira Estrela
    │           ├── parisi.ts        # Scraper para a Câmara de Parisi
    │           └── votuporanga.ts   # Scraper para a Câmara de Votuporanga
    ├── types/
    │   └── index.ts           # Definição e tipagem central do objeto TypeScript `Edital`
    └── utils/
        ├── exportJson.ts      # Utilitário para formatação e download do arquivo JSON dos editais no navegador
        └── supabase/
            ├── client.ts      # Inicializador do cliente Supabase para o lado cliente (Browser)
            ├── middleware.ts  # Interceptador e renovador de cookies da sessão ativa do usuário autenticado
            └── server.ts      # Inicializador do cliente Supabase para Server Components e Server Actions
```

---

## 📄 Detalhamento dos Componentes e Módulos

### 🚀 1. Raiz do Projeto (Configurações)
*   **`next.config.ts`**: Habilita o compilador React e define regras de CORS para desenvolvimento local (IPs autorizados na rede). Também aumenta o limite de payload de requisições no servidor para 5MB, essencial para uploads e transações pesadas de dados.
*   **`postcss.config.mjs`**: Gerencia a compilação do Tailwind CSS v4, que substitui o arquivo tradicional de configurações (`tailwind.config.ts`) por declarações em arquivos CSS.
*   **`eslint.config.mjs` / `tsconfig.json`**: Garantem, respectivamente, regras de boa conduta/padronização estilística do código e as configurações do compilador TypeScript (como aliases `@/*`).
*   **`INFRAESTRUTURA.md`**: Detalha as especificações do servidor self-hosted rodando na Oracle Cloud (Ubuntu, Swap de 2GB e Runner GitHub Actions), que serve para desviar de barreiras de Geo-Blocking e WAFs governamentais que barram IPs internacionais.
*   **`AGENTS.md` / `CLAUDE.md`**: Manuais e atalhos contendo instruções especiais para agentes autônomos que realizam tarefas de engenharia no projeto.

### ⚙️ 2. Diretório `scripts/` (Rotinas do Servidor / Actions)
*   **`run-scraper.ts`**: Script disparado automaticamente em intervalos programados (três vezes ao dia) pela pipeline do GitHub Actions. Ele executa a raspagem geral de todas as prefeituras e câmaras com um mecanismo inteligente de **até 3 retentativas** (separadas por 10 minutos) para recuperar dados de portais municipais lentos ou instáveis. No final, consolida os resultados, sincroniza o banco central no Vercel Blob e registra os logs de execução.

### 🕷️ 3. Módulo `src/proxy.ts` e Diretório `src/utils/supabase/` (Middlewares & Sessões)
*   **`src/proxy.ts`**: Atua como o middleware global do Next.js. Ele intercepta as chamadas a páginas e recursos estáticos do sistema para renovar a sessão do Supabase (através de `updateSession`), garantindo autenticação persistente.
*   **`supabase/client.ts`**: Fornece a instância do cliente Supabase utilizada em componentes do lado cliente (usando variáveis de ambiente públicas do Supabase).
*   **`supabase/server.ts`**: Configura o cliente Supabase seguro e baseado em cookies para execução no lado servidor (usado em Server Actions e Server Components).
*   **`supabase/middleware.ts`**: Lógica que lê os cookies do request, verifica a sessão com a API do Supabase Auth e devolve os cookies atualizados na resposta HTTP para manter o usuário logado com segurança.

### 🖥️ 4. Diretório `src/app/` (Páginas, Telas & Controles do Usuário)
*   **`actions.ts`**: Concentra as Server Actions essenciais da página principal. Gerencia a execução paralela dos scrapers com controle de timeout e auditorias de badges.
*   **`page.tsx`**: Interface inicial da aplicação. Consome as ações de carregamento de editais em tempo real a partir da nuvem e orquestra a exibição, o cabeçalho e a barra lateral de filtros.
*   **`globals.css`**: Arquivo de folha de estilos global do Next.js. Nele é injetado o Tailwind CSS v4 (`@import "tailwindcss";`) e aplicadas regras de transições fluidas.
*   **`auth/actions.ts`**: Server Actions responsáveis por toda a lógica de autenticação no Supabase. Lida com:
    *   `login()`: Validação e autenticação de usuários.
    *   `signup()`: Cadastro seguro, injeção de metadados (`username`) e redirecionamento de confirmação de e-mail.
    *   `logout()`: Desconexão e invalidação de sessão ativa.
    *   `requestPasswordReset()` / `updatePassword()`: Fluxo completo de recuperação e atualização de senha por e-mail.
    *   `updateEmail()`: Solicitação e verificação de nova caixa postal.
    *   `deleteAccount()`: Remoção completa e irreversível da conta de usuário no banco de autenticação através de uma chamada administrativa segura usando a chave `SUPABASE_SERVICE_ROLE_KEY`.
*   **`auth/callback/route.ts`**: Endpoint de redirecionamento (Handler de rotas) utilizado pelo provedor do Supabase Auth para verificar tokens temporários de login/senha e converter para cookies permanentes.
*   **`developer/logs/page.tsx`**: Painel administrativo de controle. Exibe um sumário de execuções (últimos 20 blocos) contendo tempo total de raspagem, quantidade de itens adicionados ou modificados, e relatórios de falhas individuais de cada cidade/câmara.
*   **`login/` / `signup/` / `reset-password/` / `update-password/` / `profile/`**: Páginas Next.js que abrigam os fluxos de telas de conta do usuário, todas integradas a formulários modernos com validação detalhada e estilização elegante.

### 🎨 5. Diretório `src/components/` (Componentes Visuais Modulares)
*   **`Header.tsx` / `Footer.tsx`**: Elementos de estrutura que delimitam a navegação no topo e rodapé da interface.
*   **`ProfileButton.tsx`**: Controla o estado de identificação no topo do site, mostrando um botão de "Entrar" para anônimos ou exibindo o menu de conta / "Meu Perfil" para usuários logados.
*   **`ControlsBar.tsx`**: Permite aos usuários realizarem buscas de texto rápidas, alternarem entre visualização linear e organização por pastas, e realizarem a exportação instantânea dos resultados em arquivo JSON estruturado.
*   **`FilterPanel.tsx`**: Menu de filtros na barra lateral que permite restringir editais por cidades ativas, termos textuais no título e exibir/esconder concursos expirados ou licitações.
*   **`ListView.tsx` / `FolderView.tsx`**: Dois modos de renderização concorrentes da busca. O primeiro exibe os editais cronologicamente, enquanto o segundo organiza os editais e anexos sob a forma de pastas virtuais de concursos.
*   **`EditalCard.tsx` / `FolderDetailView.tsx`**: O card visual individual e a janela expandida de documentos agrupados, respectivamente, enriquecidos com badges de status, links diretos e datas.
*   **`DevToolsPanel.tsx`**: Barra flutuante disponível no ambiente de desenvolvimento/administrador para acionar auditorias profundas de scrapers, disparar scrapings manuais em lote e simular cenários de falhas de comunicação.

### 🔧 6. Diretório `src/lib/` (Módulos de Negócio e Raspadores)
*   **`blacklist.ts`**: Armazena links diretos (especialmente PDFs) catalogados como impróprios, vazios ou sem valor que devem ser cortados da renderização.
*   **`docParser.ts`**: Biblioteca que baixa temporariamente PDFs/DOCX em buffers locais na memória e varre seu conteúdo de texto com Regex para decifrar a data de publicação original contida no documento.
*   **`filtrosGlobais.ts`**: Central de heurísticas anti-ruído. Garante que apenas concursos de contratação de pessoas (servidores públicos) passem pela triagem, descartando editais comerciais de licitação, compras de insumos e leilões.
*   **`email.ts`**: Biblioteca de comunicação que orquestra a integração e a chamada à API do Resend para envio automático de e-mails do sistema.
*   **`storage.ts`**: Fornece toda a lógica de comunicação com o Vercel Blob Storage para gravar e ler o JSON mestre de editais (`editais.json`), os logs de execuções (`scraping-logs.json`) e metadados (`metadata.json`).
*   **`runner.ts`**: Controla a execução individual de scrapers com tratamentos de erros e timeouts por cidade (limite flexível de 290 segundos) para impedir que a lentidão de um único portal comprometa toda a raspagem.
*   **`diagnostics.ts`**: Fornece motores de auditoria que fazem requisições diretas e rápidas aos portais das cidades, lêem o número indicado nas badges de documentos e comparam com a contagem armazenada, alertando sobre possíveis falhas ou perdas de arquivos.

### 🕷️ 7. Diretório `src/lib/scrapers/` (Motores de Coleta Local)
Contém os scripts raspadores específicos para prefeituras e câmaras.
*   **`instar.ts`**: Motor base automatizado adaptado para portais de formato "Instar" (uma das maiores empresas prestadoras de tecnologia para portais governamentais).
*   **`webline.ts`**: Motor genérico voltado para portais baseados na tecnologia "Webline".
*   **`ouroeste.ts`**: Raspador para Ouroeste que reutiliza o motor de `instar.ts`.
*   **`registry.ts`**: Mapeia todas as funções coletoras das cidades e câmaras em um único objeto exportável (`MAPA_SCRAPERS`) e define a lista oficial de execução (`CIDADES_ATIVAS`).
*   **`utils.ts`**: Reúne rotinas como `fetchHtml` (com tratamento de cabeçalhos de navegadores modernos e tentativas espaçadas), `extrairData` e `limparTituloDoc` para higienizar nomes de arquivos salvos.
*   **Scrapers Específicos por Cidade**: `votuporanga.ts`, `fernandopolis.ts`, `jales.ts`, `meridiano.ts`, `pedranopolis.ts`, `saojoao.ts`, `estrela.ts`, `macedonia.ts`, `urania.ts`, `dolcinopolis.ts`, `alvaresflorence.ts`, `santasalete.ts`, `vitoriabrasil.ts`, `valentimgentil.ts`, `guaranidoeste.ts`, `indiapora.ts`, `miraestrela.ts`, `parisi.ts`, `pontalinda.ts`.
*   **Scrapers de Câmaras Municipais (`camaras/`)**: Coletam os editais publicados especificamente pelas Câmaras de Vereadores dos municípios da região: `fernandopolis.ts`, `indiapora.ts`, `jales.ts`, `meridiano.ts`, `miraestrela.ts`, `parisi.ts`, `votuporanga.ts`.

### 📐 8. Diretório `src/types/` (Tipos e Modelagem de Dados)
*   **`index.ts`**: Define a interface `Edital`, padronizando todas as propriedades que compõem o objeto manipulado na aplicação inteira:
    ```typescript
    export type Edital = {
      cidade: string;
      orgao: string;
      titulo: string;
      link: string;
      dataTimestamp: number;
      ano?: number;
      concurso?: string;
      descricao?: string;
      metadados?: string[];
      statusGeral?: string;
      dataPublicacao?: string;
      ordemOriginal?: number;
    };
    ```

### 💾 9. Diretório `src/utils/` (Funções Auxiliares Comuns)
*   **`exportJson.ts`**: Utilitário que converte a matriz de editais exibidos em tela para um arquivo `.json` estruturado, gerando uma URL temporária em memória para download instantâneo no navegador do usuário.

