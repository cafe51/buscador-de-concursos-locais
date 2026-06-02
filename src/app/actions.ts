'use server'

import { Edital } from '../types';
import { MAPA_SCRAPERS, CIDADES_ATIVAS } from '../lib/scrapers/registry';
import { rodarComProtecao } from '../lib/runner';
import { urlsParaBlacklist } from '../lib/docParser';

// Modules are now imported directly from their respective files.

export type ResultadoBusca = {
  editais: Edital[];
  falhas: string[];
  resultadosDetalhes: import('../lib/runner').ResultadoRunner[];
};

// ==============================================================
// 🚀 NOVA FERRAMENTA: BUSCAR UMA CIDADE ISOLADA (MODO DEV)
// ==============================================================
export async function buscarEditaisPorCidade(nomeCidade: string): Promise<ResultadoBusca> {
  urlsParaBlacklist.clear();
  const funcaoScraper = MAPA_SCRAPERS[nomeCidade];

  if (!funcaoScraper) {
    throw new Error(`Scraper não encontrado para a cidade: ${nomeCidade}`);
  }

  console.log(`\n===================================================`);
  console.log(`⏳ INICIANDO RASPAGEM INDIVIDUAL: ${nomeCidade}...`);
  console.log(`===================================================`);

  const resultado = await rodarComProtecao(nomeCidade, funcaoScraper);

  let listaLimpa: Edital[] = [];
  if (resultado.sucesso) {
    const editaisUnicos = new Map<string, Edital>();
    resultado.dados.forEach((edital: Edital) => {
      if (!editaisUnicos.has(edital.link)) editaisUnicos.set(edital.link, edital);
    });

    listaLimpa = Array.from(editaisUnicos.values());

    listaLimpa.sort((a, b) => {
      if (b.dataTimestamp !== a.dataTimestamp) return b.dataTimestamp - a.dataTimestamp;
      return (a.ordemOriginal || 0) - (b.ordemOriginal || 0);
    });
  }

  return {
    editais: listaLimpa,
    falhas: resultado.sucesso ? [] : [`${resultado.cidade} (${resultado.motivo})`],
    resultadosDetalhes: [resultado]
  };
}

// ==============================================================
// 🚀 BUSCA PRINCIPAL DE TODAS AS CIDADES
// ==============================================================
export async function buscarTodosEditais(): Promise<ResultadoBusca> {
  let todosOsEditais: Edital[] = [];
  const cidadesComFalha: string[] = [];

  urlsParaBlacklist.clear();

  console.log("\n===================================================");
  console.log("⏳ INICIANDO RASPAGEM DE DADOS...");
  console.log("===================================================");

  const tempoInicioTotal = performance.now();

  try {
    const tarefas = CIDADES_ATIVAS.map(cidade => {
      const scraper = MAPA_SCRAPERS[cidade];
      return () => rodarComProtecao(cidade, scraper);
    });

    const promessas: any[] = [];

    // Executa em lotes de 4 para evitar sobrecarga de Sockets e evitar timeout
    for (let i = 0; i < tarefas.length; i += 4) {
      const lote = tarefas.slice(i, i + 4);
      const resultadosLote = await Promise.all(lote.map(t => t()));
      promessas.push(...resultadosLote);
    }

    promessas.forEach((resultado) => {
      if (resultado.sucesso) {
        todosOsEditais = [...todosOsEditais, ...resultado.dados];
      } else {
        if (resultado.dados && resultado.dados.length > 0) {
          todosOsEditais = [...todosOsEditais, ...resultado.dados];
        }
        cidadesComFalha.push(`${resultado.cidade} (${resultado.motivo})`);
      }
    });

    const editaisUnicos = new Map<string, Edital>();

    todosOsEditais.forEach((edital) => {
      if (!editaisUnicos.has(edital.link)) {
        editaisUnicos.set(edital.link, edital);
      }
    });

    let listaLimpa = Array.from(editaisUnicos.values());

    listaLimpa.sort((a, b) => {
      if (b.dataTimestamp !== a.dataTimestamp) {
        return b.dataTimestamp - a.dataTimestamp;
      }
      return (a.ordemOriginal || 0) - (b.ordemOriginal || 0);
    });

    const tempoFimTotal = performance.now();
    const tempoGasto = ((tempoFimTotal - tempoInicioTotal) / 1000).toFixed(2);

    console.log("===================================================");
    console.log(`✅ RASPAGEM TOTAL CONCLUÍDA EM ${tempoGasto} SEGUNDOS!`);
    console.log(`📊 Total de editais extraídos (após remover duplicações): ${listaLimpa.length}`);
    if (cidadesComFalha.length > 0) {
      console.log(`⚠️ Falhas detectadas em: ${cidadesComFalha.join(', ')}`);
    }

    if (urlsParaBlacklist.size > 0) {
      console.log(`\n🛑 ARQUIVOS SEM DATA OU IMAGENS ENCONTRADOS (${urlsParaBlacklist.size}):`);
      console.log(JSON.stringify(Array.from(urlsParaBlacklist), null, 2));
    }
    console.log("===================================================\n");

    return {
      editais: listaLimpa,
      falhas: cidadesComFalha,
      resultadosDetalhes: promessas
    };

  } catch (e: any) {
    console.error("ERRO GRAVE NA BUSCA:", e); throw new Error("Erro grave ao processar as buscas.");
  }
}

// ==============================================================
// 🚀 NOVA ACTION: EXECUTAR FLUXO COMPLETO VIA INTERFACE LOCAL
// ==============================================================
export async function rodarFluxoCompletoServerAction() {
  const { runFullScraperWorkflow } = await import('../lib/orchestrator');
  return await runFullScraperWorkflow({ isLocalUI: true });
}