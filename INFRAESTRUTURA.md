# Infraestrutura: Servidor de Raspagem (Runner)

Este documento descreve a infraestrutura utilizada para executar a raspagem automatizada dos editais. O sistema utiliza um **Self-Hosted Runner** do GitHub Actions hospedado na Oracle Cloud para contornar bloqueios geográficos (Geo-Blocking) impostos pelos firewalls das prefeituras.

## 🖥️ Especificações da Máquina Virtual

* **Provedor:** Oracle Cloud Infrastructure (OCI)
* **Região:** São Paulo, Brasil (Garante IP Brasileiro para bypass de WAFs governamentais)
* **Sistema Operacional:** Ubuntu 22.04.5 LTS (GNU/Linux 6.8.0-1052-oracle x86_64)
* **Memória RAM:** 1 GB
* **Memória Swap:** 2 GB (Configurada para evitar erros de `Out Of Memory` durante as instâncias do Node/Fetch)
* **IP Público:** `164.152.60.75`
* **Usuário:** `ubuntu`
* **Nome da Instância:** `instance-20260527-1904`

## 🔑 Acesso SSH

O acesso à máquina é feito utilizando a chave privada gerada na criação da VM:

```bash
ssh -i ./ssh-key-2026-05-27.key ubuntu@164.152.60.75
```

## ⚙️ Configurações Realizadas

As seguintes customizações foram aplicadas no sistema operacional:

### 1. Criação de Swap Space (2GB)
Devido à limitação de 1GB de RAM, foi alocado um arquivo de paginação para suportar picos de uso de memória pelo Node.js.
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

* **Comando para checar os logs do serviço em tempo real:**
  ```bash
  sudo journalctl -u actions.runner.* -f
  ```
* **Comandos de gerenciamento (no diretório ~/actions-runner):**
  ```bash
  sudo ./svc.sh status   # Verifica o status do serviço
  sudo ./svc.sh stop     # Para o runner
  sudo ./svc.sh start    # Inicia o runner
  ```

## 🚀 Como o Workflow Funciona

O arquivo `.github/workflows/scraper.yml` está configurado com a tag `runs-on: self-hosted`.
Isso significa que quando o Github Actions é acionado (seja manualmente ou pelos CRONs programados), o GitHub **não** roda o código em seus servidores americanos. Em vez disso, ele despacha as instruções para esta VM na Oracle.

A VM baixa o código, instala o Node 24, e executa o `run-scraper.ts`. Quando as prefeituras recebem a requisição, elas enxergam o IP de São Paulo (`164.152.60.75`) e permitem o tráfego, ignorando os bloqueios 403 Forbidden que ocorriam nos IPs estrangeiros.
