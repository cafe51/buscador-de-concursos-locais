import { loadEnvConfig } from '@next/env';
// Carrega as variáveis de ambiente do .env e .env.local antes de qualquer coisa
loadEnvConfig(process.cwd());

import { buscarTodosEditais, buscarEditaisPorCidade } from '../src/app/actions';
import { sincronizarBanco, adicionarScrapingLog, LogCidadeDetail, DatabaseSyncLog } from '../src/lib/storage';
import { CIDADES_ATIVAS } from '../src/lib/scrapers/registry';
import { randomUUID } from 'crypto';

// ==============================================================
// ⏱️ CONFIGURAÇÕES DE RETENTATIVA
// ==============================================================
const RETRY_DELAY_MINUTES = 1;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = RETRY_DELAY_MINUTES * 60 * 1000;

async function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log("===================================================");
  console.log("🚀 INICIANDO BLOCO DE RASPAGEM AUTOMATIZADA (GITHUB ACTIONS)");
  console.log("===================================================");

  const inicioDate = new Date();
  const inicio = performance.now();

  // Inicializando mapa de logs para todas as cidades
  const logsCidades: Record<string, LogCidadeDetail> = {};
  CIDADES_ATIVAS.forEach(c => {
    logsCidades[c] = { cidade: c, sucesso: false, itens: 0, tentativaSucesso: 0, tempoGastoSegundos: 0, erro: 'Não iniciada' };
  });

  let tentativasEfetuadas = 1;

  try {
    // 1. Roda a raspagem completa de todas as cidades (Primeira etapa do bloco)
    let { editais, falhas, resultadosDetalhes } = await buscarTodosEditais();
    const todosEditais = [...editais];
    let cidadesComFalha = [...falhas];

    // Processar resultados detalhados da tentativa inicial (Pega tempo, aviso, erros)
    resultadosDetalhes.forEach(res => {
      logsCidades[res.cidade] = {
        cidade: res.cidade,
        sucesso: res.sucesso,
        itens: res.dados ? res.dados.length : 0,
        tentativaSucesso: res.sucesso ? 1 : 0,
        tempoGastoSegundos: res.tempoGasto || 0,
        aviso: res.aviso,
        erro: res.motivo
      };
    });

    console.log(`\n✅ Raspagem inicial finalizada. Itens extraídos: ${editais.length}`);

    // 2. Lógica de Retentativas
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      if (cidadesComFalha.length === 0) break;

      tentativasEfetuadas = attempt + 1; // 2, 3, 4...

      console.log(`\n⚠️ Falhas detectadas em: ${cidadesComFalha.join(', ')}`);
      console.log(`⏳ Aguardando ${RETRY_DELAY_MINUTES} minuto(s) para a Tentativa ${tentativasEfetuadas} (Retry ${attempt} de ${MAX_RETRIES})...`);

      await wait(RETRY_DELAY_MS);

      const nomesCidades = cidadesComFalha.map(falha => {
        const cidadeEncontrada = CIDADES_ATIVAS.find(c => falha.startsWith(c + ' ('));
        return cidadeEncontrada || falha.trim();
      });

      cidadesComFalha = [];

      for (const cidadeKey of nomesCidades) {
        console.log(`\n♻️ Reprocessando cidade com falha: ${cidadeKey}`);
        try {
          const resultado = await buscarEditaisPorCidade(cidadeKey);

          if (resultado.resultadosDetalhes && resultado.resultadosDetalhes.length > 0) {
            const res = resultado.resultadosDetalhes[0];

            // Soma o tempo gasto nas retentativas e atualiza status
            logsCidades[cidadeKey] = {
              cidade: res.cidade,
              sucesso: res.sucesso,
              itens: res.dados ? res.dados.length : 0,
              tentativaSucesso: res.sucesso ? tentativasEfetuadas : 0,
              tempoGastoSegundos: (logsCidades[cidadeKey].tempoGastoSegundos || 0) + (res.tempoGasto || 0),
              aviso: res.aviso,
              erro: res.motivo
            };

            if (res.sucesso) {
              todosEditais.push(...res.dados);
            } else {
              cidadesComFalha.push(`${cidadeKey} (${res.motivo})`);
            }
          }
        } catch (e: any) {
          const erroMsg = e.message || 'Erro no reprocessamento';
          cidadesComFalha.push(`${cidadeKey} (${erroMsg})`);
          logsCidades[cidadeKey].erro = erroMsg;
        }
      }
    }

    if (cidadesComFalha.length > 0) {
      console.log(`\n🚨 O Bloco de raspagem terminou, mas ainda restaram falhas: ${cidadesComFalha.join(', ')}`);
    } else {
      console.log(`\n✅ Bloco de raspagem finalizado com SUCESSO TOTAL para todas as cidades!`);
    }

    console.log(`📊 Total consolidado de editais extraídos no bloco: ${todosEditais.length}`);

    // 3. Montar Métricas e Sincronizar Banco
    const fimDate = new Date();
    const duracaoSegundos = Math.round((fimDate.getTime() - inicioDate.getTime()) / 1000);

    let statusGeral: 'sucesso' | 'falha_parcial' | 'falha' = 'sucesso';
    if (cidadesComFalha.length > 0) {
      if (cidadesComFalha.length === CIDADES_ATIVAS.length) {
        statusGeral = 'falha';
      } else {
        statusGeral = 'falha_parcial';
      }
    }

    let syncInfo: DatabaseSyncLog | undefined = undefined;

    // Sincroniza com o Vercel Blob e captura o Relatório Detalhado
    if (todosEditais.length > 0) {
      console.log("\nIniciando sincronização principal com o banco de dados...");
      const resultadoSync = await sincronizarBanco(todosEditais, false);

      if (resultadoSync.sucesso) {
        syncInfo = {
          adicionados: resultadoSync.adicionados,
          atualizados: resultadoSync.atualizados.length,
          relatorioAdicoes: resultadoSync.relatorioAdicoes,
          relatorioAtualizacoes: resultadoSync.atualizados // No backend o log vem cru aqui
        };
        console.log("✅ Sincronização concluída com sucesso!");
      } else {
        console.error("❌ Falha na sincronização com o banco de dados.");
        process.exit(1);
      }
    } else {
      console.log("⚠️ Nenhum edital encontrado no bloco. O banco de dados não foi atualizado.");
    }

    // 4. Salvar Log do Bloco
    const novoLog = {
      id: randomUUID(),
      inicio: inicioDate.toISOString(),
      fim: fimDate.toISOString(),
      duracaoSegundos,
      tentativas: tentativasEfetuadas,
      status: statusGeral,
      totalEditais: todosEditais.length,
      detalhesCidades: Object.values(logsCidades),
      syncInfo
    };

    console.log("\nSalvando Log de Raspagem no Banco de Dados...");
    await adicionarScrapingLog(novoLog);
    console.log("✅ Log salvo com sucesso!");

  } catch (error) {
    console.error("❌ Erro fatal no script de raspagem:", error);
    process.exit(1);
  } finally {
    const fim = performance.now();
    console.log("\n===================================================");
    console.log(`⏱️ Tempo total do bloco de execução: ${((fim - inicio) / 1000).toFixed(2)}s`);
    console.log("===================================================");
    
    // Força o encerramento do processo Node.js com sucesso.
    // Isso evita que a Action do GitHub fique travada "In progress" devido a conexões pendentes (como conexões HTTP keep-alive).
    process.exit(0);
  }
}

main();
