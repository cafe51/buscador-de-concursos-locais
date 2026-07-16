# 📋 Achador de Editais

Sistema de monitoramento automatizado de editais de concursos públicos e processos seletivos das prefeituras e câmaras municipais da região noroeste do estado de São Paulo. O projeto rastreia **27 cidades** (20 prefeituras + 7 câmaras municipais), extrai os editais dos portais governamentais, enriquece os dados com Inteligência Artificial (Google Gemini) e notifica usuários cadastrados por e-mail quando novos concursos aparecem.

Um módulo secundário monitora servidores públicos federais do IBGE via API do Portal da Transparência.

---

## 🏗️ Stack Tecnológica

| Camada | Tecnologia |
|---|---|
| **Framework** | Next.js 16 (App Router, Server Actions, React 19) |
| **Linguagem** | TypeScript |
| **Estilo** | Tailwind CSS v4 (via PostCSS) |
| **Banco de Dados** | MongoDB (Mongoose) |
| **IA** | Google Gemini (`@google/generative-ai`) — 2 modelos: extração + auditoria |
| **Autenticação** | JWT (`jose`) + `bcryptjs`, cookies httpOnly |
| **E-mail** | Resend (API transacional) |
| **Scraping** | `cheerio` (HTML parsing), `pdf-parse` / `mammoth` / `word-extractor` (documentos) |
| **Conversão DOC→PDF** | LibreOffice headless (`soffice`) |
| **Infra** | GitHub Actions + Self-Hosted Runner (Oracle Cloud, São Paulo) |
| **Validação** | Zod + React Hook Form |

---

## 🚀 Início Rápido

### Pré-requisitos

- Node.js 24+
- MongoDB (local ou Atlas)
- LibreOffice instalado (`soffice` no PATH) — necessário para conversão de .doc/.docx em PDF pela IA
- Chaves de API: `GEMINI_API_KEY`, `RESEND_API_KEY`, `MONGODB_URI`

### Instalação

```bash
# Clonar o repositório
git clone <repo-url>
cd achadordeeditais

# Instalar dependências
npm install

# Configurar variáveis de ambiente
cp .env .env.local
# Editar .env.local com suas chaves:
#   MONGODB_URI=mongodb://...
#   GEMINI_API_KEY=...
#   RESEND_API_KEY=...
#   JWT_SECRET=...  (mínimo 32 caracteres)
#   NEXT_PUBLIC_SITE_URL=http://localhost:3000
#   PORTAL_TRANSPARENCIA_API_KEY=...  (módulo IBGE)

# Rodar em desenvolvimento
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

### Scripts disponíveis

| Script | Descrição |
|---|---|
| `npm run dev` | Servidor de desenvolvimento (webpack) |
| `npm run build` | Build de produção |
| `npm run start` | Servidor de produção |
| `npm run lint` | Lint via ESLint |
| `npm run install-ssd` | Instala node_modules em outro diretório (para economizar SSD) |
| `npm run link-ssd` | Symlinka node_modules/.next de outro diretório |

### Scripts auxiliares (executáveis via `npx tsx`)

| Script | Descrição |
|---|---|
| `scripts/run-scraper.ts` | Pipeline completo de raspagem (usado pelo GitHub Actions) |
| `scripts/sync-ibge.ts` | Sincronização de servidores IBGE via Portal da Transparência |
| `scripts/initScraperConfigs.ts` | Inicializa configurações de scrapers no MongoDB |
| `scripts/testScraper.ts` | Testa raspagem de uma cidade isolada |
| `scripts/testConfig.ts` | Testa/força configuração de disponibilidade de um scraper |

---

## 📖 Documentação

- **[`ESTRUTURA.md`](./ESTRUTURA.md)** — Arquitetura detalhada: árvore de arquivos, descrição de cada módulo, pipeline completo, modelos de dados e fluxo de funcionamento.
- **[`INFRAESTRUTURA.md`](./INFRAESTRUTURA.md)** — Infraestrutura do self-hosted runner na Oracle Cloud, workflows do GitHub Actions e configuração do servidor.

---

## 🌍 O que o sistema faz

1. **Raspa** portais de 27 cidades (prefeituras + câmaras) 3x ao dia
2. **Filtra** ruído (editais de licitação, compras, atas, homologações pós-abertura)
3. **Sincroniza** com MongoDB, identificando apenas novos editais e atualizações
4. **Enriquece** novos editais com IA Gemini: gera título limpo, descrição, identifica o concurso e data de publicação
5. **Audita** (opcional) o trabalho da IA com um modelo superior que corrige erros
6. **Notifica** usuários por e-mail (Resend) respeitando preferências de cidade e órgão
7. **Exibe** tudo numa interface web com busca, filtros, visualização em lista ou pastas de concurso

---

## 🗺️ Cidades Monitoradas

**Prefeituras (20):** Fernandópolis, Votuporanga, Jales, Ouroeste, Macedônia, Estrela d'Oeste, Guarani d'Oeste, Meridiano, São João das Duas Pontes, Pedranópolis, Mira Estrela, Indiaporã, Álvares Florence, Parisi, Valentim Gentil, Vitória Brasil, Urânia, Dolcinópolis, Pontalinda, Santa Salete.

**Câmaras Municipais (7):** Fernandópolis, Votuporanga, Jales, Meridiano, Mira Estrela, Indiaporã, Parisi.

---

## ⚠️ Notas

- O `AGENTS.md` alerta que esta versão do Next.js (16) tem breaking changes em relação ao que consta na documentação pública — APIs e convenções podem diferir do esperado.
- A chave SSH `ssh-key-2026-05-27.key` está no repositório para acesso ao self-hosted runner (Oracle Cloud).
- O remetente de e-mail (`from`) no `email.ts` usa o domínio sandbox do Resend (`onboarding@resend.dev`) e deve ser alterado para um domínio verificado em produção.
