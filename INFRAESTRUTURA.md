# Infraestrutura: Servidor de Raspagem (Self-Hosted Runner)

Este documento descreve a infraestrutura utilizada para executar a raspagem automatizada de editais e a sincronização de dados do IBGE. O sistema utiliza um **Self-Hosted Runner** do GitHub Actions hospedado na Oracle Cloud para contornar bloqueios geográficos (Geo-Blocking) e WAFs impostos pelos firewalls das prefeituras municipais.

---

## 🖥️ Especificações da Máquina Virtual

| Item | Valor |
|---|---|
| **Provedor** | Oracle Cloud Infrastructure (OCI) |
| **Região** | São Paulo, Brasil (garante IP brasileiro para bypass de WAFs) |
| **Sistema Operacional** | Ubuntu 22.04.5 LTS (GNU/Linux 6.8.0-1052-oracle x86_64) |
| **Memória RAM** | 1 GB |
| **Memória Swap** | 2 GB (configurada para evitar OOM durante execução do Node) |
| **IP Público** | `164.152.60.75` |
| **Usuário** | `ubuntu` |
| **Nome da Instância** | `instance-20260527-1904` |

---

## 🔑 Acesso SSH

O acesso à máquina é feito utilizando a chave privada commitada no repositório:

```bash
ssh -i ./ssh-key-2026-05-27.key ubuntu@164.152.60.75
```

---

## ⚙️ Configurações Realizadas no Servidor

### 1. Criação de Swap Space (2GB)

Devido à limitação de 1GB de RAM, foi alocado um arquivo de paginação para suportar picos de uso de memória pelo Node.js durante a raspagem:

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### 2. Instalação do GitHub Actions Runner

O agente do GitHub (versão `v2.334.0`) foi instalado no diretório `~/actions-runner`.

O runner foi registrado sob o repositório `cafe51/buscador-de-concursos-locais` e está rodando ininterruptamente como um **serviço do sistema (systemd)**.

**Comandos de gerenciamento (no diretório `~/actions-runner`):**
```bash
sudo ./svc.sh status   # Verifica o status do serviço
sudo ./svc.sh stop     # Para o runner
sudo ./svc.sh start    # Inicia o runner
```

**Checar logs do serviço em tempo real:**
```bash
sudo journalctl -u actions.runner.* -f
```

### 3. Instalação do LibreOffice

O LibreOffice (`soffice`) é necessário para converter documentos `.doc`/`.docx` em PDF antes de enviar para a IA Gemini. Deve estar instalado e acessível no PATH do usuário `ubuntu`.

---

## 🚀 Workflows do GitHub Actions

Dois workflows estão configurados no repositório, ambos com `runs-on: self-hosted` para executar nesta VM:

### Workflow 1: Raspagem de Editais (`.github/workflows/scraper.yml`)

Executa o pipeline completo de raspagem de editais das 27 cidades monitoradas.

- **Agendamento**: 3x ao dia — `cron: '0 8,16,23 * * *'` (UTC)
  - 08:00 UTC ≈ 05:00 BRT
  - 16:00 UTC ≈ 13:00 BRT
  - 23:00 UTC ≈ 20:00 BRT
- **Também**: disparável manualmente via `workflow_dispatch`
- **Execução**: `npx tsx scripts/run-scraper.ts`
- **Secrets necessários**:
  - `MONGODB_URI` — conexão com o banco de dados
  - `GEMINI_API_KEY` — chave da API do Google Gemini (enriquecimento IA)
  - `RESEND_API_KEY` — chave da API do Resend (envio de e-mails)
  - `BLOB_READ_WRITE_TOKEN` — token Vercel Blob (legado)
  - `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_SERVICE_ROLE_KEY` — Supabase (legado)

### Workflow 2: Sincronização IBGE (`.github/workflows/sync-ibge.yml`)

Sincroniza dados de servidores públicos federais do IBGE via API do Portal da Transparência.

- **Agendamento**: 2x ao dia — `cron: '0 7,19 * * *'` (UTC)
  - 07:00 UTC ≈ 04:00 BRT
  - 19:00 UTC ≈ 16:00 BRT
- **Também**: disparável manualmente via `workflow_dispatch`
- **Execução**: `npx tsx scripts/sync-ibge.ts`
- **Secrets necessários**:
  - `MONGODB_URI` — conexão com o banco de dados
  - `PORTAL_TRANSPARENCIA_API_KEY` — chave da API do Portal da Transparência

---

## 🌐 Como o Bypass de Geo-Blocking Funciona

Muitas prefeituras municipais utilizam WAFs (Web Application Firewalls) que bloqueiam requisições vindas de IPs internacionais, retornando HTTP 403 Forbidden. Os servidores do GitHub Actions (quando não self-hosted) rodam nos EUA e seriam bloqueados.

Ao utilizar um self-hosted runner na Oracle Cloud em São Paulo, as requisições das prefeituras enxergam um IP brasileiro (`164.152.60.75`) e permitem o tráfego. O runner baixa o código do repositório, instala o Node 24 via `actions/setup-node@v4`, executa `npm ci` e então roda o script de raspagem — tudo localmente na VM, com o IP brasileiro.

---

## 📊 Pipeline de Execução (Resumo)

```
GitHub Actions (cron ou manual)
  → despacha para self-hosted runner (Oracle Cloud, SP)
    → checkout do código
    → setup Node.js 24
    → npm ci (com cache)
    → npx tsx scripts/run-scraper.ts (ou sync-ibge.ts)
      → carrega .env (secrets injetados como env vars)
      → executa pipeline completo (raspagem → IA → notificações → log)
    → process.exit(0) para encerrar limpo
```

---

## 🔧 Manutenção e Troubleshooting

### Verificar se o runner está online
No GitHub: Settings → Actions → Runners. O runner deve aparecer como "Idle" (pronto).

### Logs do runner
```bash
sudo journalctl -u actions.runner.* -f
```

### Logs das execuções
Visíveis na aba "Actions" do repositório no GitHub. Cada execução mostra o output completo do `run-scraper.ts` ou `sync-ibge.ts`.

### Reiniciar o runner após reboot da VM
```bash
cd ~/actions-runner
sudo ./svc.sh start
```

### Inicializar ScraperConfigs no banco (primeira configuração)
```bash
npx tsx scripts/initScraperConfigs.ts
```
Isso cria registros de `ScraperConfig` para todas as 27 cidades com `verificarDisponibilidade: false`.
