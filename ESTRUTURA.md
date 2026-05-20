# 🗂️ Estrutura do Projeto - Achador de Editais

Este documento apresenta a organização e a estrutura de pastas do projeto **Achador de Editais** (Buscador de Concursos Locais), detalhando a função de cada arquivo para guiar desenvolvedores e leitores.

---

## 🌳 Árvore de Diretórios

Abaixo está a representação visual da estrutura de pastas e arquivos de código sob o diretório principal `src/` e na raiz do projeto:

```text
achadordeeditais/
├── eslint.config.mjs          # Configuração do ESLint (regras de linting)
├── next.config.ts             # Configuração do Next.js (dev origins, compiler, etc.)
├── postcss.config.mjs         # Configuração do PostCSS para estilização
├── tailwind.config.ts         # Configuração de temas e estilos do Tailwind CSS
├── tsconfig.json              # Configurações do compilador TypeScript
├── ESTRUTURA.md               # Esta documentação da estrutura do projeto
└── src/
    ├── app/
    │   ├── actions.ts         # Server Actions (gerenciamento e execução paralela dos scrapers)
    │   ├── globals.css        # Estilos CSS globais da aplicação
    │   ├── layout.tsx         # Layout principal da aplicação Next.js
    │   └── page.tsx           # Página principal (Interface de busca e listagem)
    ├── components/
    │   ├── EditalCard.tsx     # Card de exibição individual para cada Edital encontrado
    │   └── FilterPanel.tsx    # Painel de filtros (filtra por termo, cidade, status, etc.)
    ├── lib/
    │   ├── blacklist.ts       # Lista de URLs de editais (PDFs) a serem ignorados/suprimidos
    │   ├── docParser.ts       # Parser de documentos (extrator de datas e textos de PDF/DOCX)
    │   ├── filtrosGlobais.ts  # Regras globais de filtragem (eliminação de ruído/licitações)
    │   └── scrapers/
    │       ├── estrela.ts     # Scraper para a cidade de Estrela d'Oeste
    │       ├── fernandopolis.ts # Scraper para a cidade de Fernandópolis
    │       ├── instar.ts      # Scraper Base Genérico para portais padrão "Instar"
    │       ├── jales.ts       # Scraper para a cidade de Jales
    │       ├── macedonia.ts   # Scraper para a cidade de Macedônia
    │       ├── meridiano.ts   # Scraper para a cidade de Meridiano
    │       ├── ouroeste.ts    # Scraper para a cidade de Ouroeste (utiliza a base do Instar)
    │       ├── pedranopolis.ts # Scraper para a cidade de Pedranópolis
    │       ├── saojoao.ts     # Scraper para a cidade de São João das Duas Pontes
    │       └── votuporanga.ts # Scraper para a cidade de Votuporanga
    ├── types/
    │   └── index.ts           # Definição centralizada de tipos TypeScript (ex: Edital)
    └── utils/
        └── exportJson.ts      # Utilitário de exportação dos editais localizados para formato JSON
```

---

## 📄 Detalhamento dos Componentes e Arquivos

### 🚀 1. Raiz do Projeto (Configurações)
*   **`next.config.ts`**: Define as configurações de compilação do Next.js e controles de acessibilidade (como IPs autorizados no servidor de desenvolvimento).
*   **`eslint.config.mjs`**: Mantém a padronização e boas práticas de código no projeto.
*   **`postcss.config.mjs`**: Auxilia na orquestração e otimização das regras de CSS da aplicação.
*   **`tsconfig.json`**: Controla os parâmetros do compilador TypeScript (caminhos absolutos, escopos e checagens).

### 🖥️ 2. Diretório `src/app/` (Interface & Server Actions)
*   **`actions.ts`**: Concentra a lógica principal de execução de todos os raspadores. Roda no lado do servidor (`'use server'`), gerencia timeouts individuais (limite de 55s por cidade) para garantir resiliência contra lentidões de sites oficiais, e desduplica/ordena os resultados finais.
*   **`layout.tsx`**: Estrutura global da página (metadados, fontes Geist Sans/Geist Mono e injeção do HTML básico).
*   **`page.tsx`**: Interface do usuário principal. Renderiza o cabeçalho dinâmico, consome a Server Action para buscar os dados e coordena a visualização e os filtros.

### 🎨 3. Diretório `src/components/` (Componentes Visuais)
*   **`EditalCard.tsx`**: Um card dinâmico, moderno e elegante que apresenta cada certame com badges coloridas indicando:
    *   📍 Cidade do edital.
    *   🏛️ Órgão público emissor.
    *   📌 Status (Aberto, Em Julgamento, Homologado, etc.).
    *   📄 Tipo de documento e link direto.
    *   🗓️ Data de publicação.
*   **`FilterPanel.tsx`**: Fornece ferramentas interativas de busca e filtragem, permitindo buscar por palavras-chave, cidades específicas, esconder licitações concluídas, e baixar os dados em formato estruturado.

### 🔧 4. Diretório `src/lib/` (Lógica de Raspagem e Processamento)
*   **`blacklist.ts`**: Um repositório de links diretos de arquivos (especialmente PDFs) marcados para exclusão porque representam editais inválidos, imagens vazias ou arquivos sem datas válidas.
*   **`docParser.ts`**: Responsável por fazer download assíncrono dos editais (PDF ou DOCX), ler seus conteúdos textuais em buffers temporários e varrer o texto com Regex para extrair a data de publicação mais recente ali documentada.
*   **`filtrosGlobais.ts`**: Define a lista negra de palavras irrelevantes (ex: licitações, pregões, atas, compras públicas, conselhos civis) e funções como `ehSujeira()` e `extrairIdConcurso()`, que higienizam os dados extraídos das páginas oficiais.

### 🕷️ 5. Diretório `src/lib/scrapers/` (Scrapers Específicos por Município)
Contém os módulos coletores de dados das prefeituras.
*   **`instar.ts`**: Motor base projetado para o padrão de portais "Instar", facilitando a reutilização de código em cidades que utilizam esse sistema.
*   **`ouroeste.ts`**: Consome a base genérica de `instar.ts` fornecendo os caminhos específicos da prefeitura de Ouroeste.
*   **`votuporanga.ts`, `fernandopolis.ts`, `jales.ts`, `macedonia.ts`, `meridiano.ts`, `saojoao.ts`, `pedranopolis.ts`, `estrela.ts`**: Raspadores sob medida baseados nos formatos específicos de publicação e páginas de editais de cada município.

### 📐 6. Diretório `src/types/` (Modelagem de Dados)
*   **`index.ts`**: Expõe a interface `Edital`, que padroniza o objeto manipulado na aplicação inteira:
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

### 💾 7. Diretório `src/utils/` (Funções Auxiliares)
*   **`exportJson.ts`**: Responsável por converter a lista de editais filtrados em um arquivo JSON formatado e disparar o download no navegador do usuário.
