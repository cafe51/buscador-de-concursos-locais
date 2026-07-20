'use server'

import { Edital } from '../types';
import { MAPA_SCRAPERS, CIDADES_ATIVAS, obterScraperParaCidade } from '../lib/scrapers/registry';
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

  console.log(`\n===================================================`);
  console.log(`⏳ INICIANDO RASPAGEM INDIVIDUAL: ${nomeCidade}...`);
  console.log(`===================================================`);

  let verificarDisponibilidade = false;
  let tipoFonte: string | undefined = undefined;
  try {
    const connectToDatabase = (await import('../lib/mongodb')).default;
    await connectToDatabase();
    const { ScraperConfigModel } = await import('../models/ScraperConfig');
    const config = await ScraperConfigModel.findOne({ nome: nomeCidade });
    if (config) {
      if (config.verificarDisponibilidade) verificarDisponibilidade = true;
      if (config.tipoFonte) tipoFonte = config.tipoFonte;
    }
  } catch (e) {
    console.error("Falha ao buscar config em buscarEditaisPorCidade:", e);
  }

  const funcaoScraper = obterScraperParaCidade(nomeCidade, tipoFonte);

  if (!funcaoScraper) {
    throw new Error(`Scraper não encontrado para a cidade: ${nomeCidade}`);
  }

  const resultado = await rodarComProtecao(nomeCidade, funcaoScraper, { verificarDisponibilidade });

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
// 🚀 BUSCA PRINCIPAL DE TODAS AS CIDADES (COM SUPORTE A FILTRO)
// ==============================================================
export async function buscarTodosEditais(cidadesAlvo?: string[]): Promise<ResultadoBusca> {
  let todosOsEditais: Edital[] = [];
  const cidadesComFalha: string[] = [];

  urlsParaBlacklist.clear();

  // Busca configurações de disponibilidade e tipo de fonte no banco
  let configMap = new Map<string, { verificarDisponibilidade: boolean; tipoFonte?: string }>();
  try {
    const connectToDatabase = (await import('../lib/mongodb')).default;
    await connectToDatabase();
    const { ScraperConfigModel } = await import('../models/ScraperConfig');
    const configs = await ScraperConfigModel.find();
    configs.forEach((c: any) => {
      configMap.set(c.nome, {
        verificarDisponibilidade: !!c.verificarDisponibilidade,
        tipoFonte: c.tipoFonte
      });
    });
  } catch (e) {
    console.error("Falha ao buscar ScraperConfigModel, usando padrão (falso).", e);
  }

  console.log("\n===================================================");
  console.log("⏳ INICIANDO RASPAGEM DE DADOS...");
  console.log("===================================================");

  const tempoInicioTotal = performance.now();

  try {
    const cidadesParaRaspar = cidadesAlvo && cidadesAlvo.length > 0 ? cidadesAlvo : CIDADES_ATIVAS;

    const tarefas = cidadesParaRaspar.map(cidade => {
      const cfg = configMap.get(cidade);
      const scraper = obterScraperParaCidade(cidade, cfg?.tipoFonte);
      const verificarDisponibilidade = cfg?.verificarDisponibilidade === true;
      return () => rodarComProtecao(cidade, scraper, { verificarDisponibilidade });
    });

    const promessas: any[] = [];

    // Executa em lotes de 4 para evitar sobrecarga de Sockets e evitar timeout
    for (let i = 0; i < tarefas.length; i += 4) {
      const lote = tarefas.slice(i, i + 4);
      const resultadosLote = await Promise.all(lote.map(t => t()));
      promessas.push(...resultadosLote);
    }

    promessas.forEach((resultado) => {
      if (resultado.ignorado) {
        return; // Pula contagem de falha e de sucesso, não entra na raspagem total
      }
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
export interface OrquestradorOptions {
  isLocalUI: boolean;
  enableAI?: boolean;
  enableEmails?: boolean;
  cidadesSelecionadas?: string[];
}

export async function rodarFluxoCompletoServerAction(options: OrquestradorOptions) {
  const { runFullScraperWorkflow } = await import('../lib/orchestrator');
  return await runFullScraperWorkflow(options);
}

// ==============================================================
// 🚀 NOVA ACTION: ENRIQUECER ARQUIVOS DE UM CONCURSO MANUALMENTE
// ==============================================================
export async function enriquecerArquivosAction(editais: Edital[]) {
  const { processarComIA } = await import('../lib/aiAnalysis');
  const { salvarEnriquecimentoEmLote } = await import('../lib/storage');

  // Filtra apenas os editais que ainda não têm dados enriquecidos
  const editaisPendentes = editais.filter(
    (e) => !e.dadosEnriquecidos || Object.keys(e.dadosEnriquecidos).length === 0
  );

  if (editaisPendentes.length === 0) {
    console.log("Nenhum edital pendente de enriquecimento neste concurso.");
    return { sucesso: true, count: 0, links: [] };
  }

  // A função original foi desenhada para receber e mutar os editais passados como array.
  // Ela já imprime logs detalhados no console.
  await processarComIA(editaisPendentes);

  // Filtra para pegar apenas os que conseguiram os dados enriquecidos após a IA.
  const editaisEnriquecidosComSucesso = editaisPendentes.filter(
    (e) => e.dadosEnriquecidos && Object.keys(e.dadosEnriquecidos).length > 0
  );

  let linksEnriquecidos: string[] = [];

  if (editaisEnriquecidosComSucesso.length > 0) {
    linksEnriquecidos = editaisEnriquecidosComSucesso.map((e) => e.link);
    console.log("===================================================");
    console.log(`✅ ${linksEnriquecidos.length} arquivos analisados. Iniciando auditoria...`);
    console.log("Links:");
    console.log(linksEnriquecidos);

    // ==============================================================
    // LÓGICA DE COMPARAÇÃO DE MUDANÇAS
    // ==============================================================
    const isDataDiferenteMais3Dias = (d1?: string, d2?: string) => {
      if (!d1 && !d2) return false;
      if (!d1 || !d2) return true;

      const parseData = (str: string) => {
        const partes = str.match(/(\d{2})\/(\d{2})\/(\d{4})/);
        if (partes) {
          return new Date(Number(partes[3]), Number(partes[2]) - 1, Number(partes[1]));
        }
        const d = new Date(str);
        if (isNaN(d.getTime())) return null;
        return d;
      };

      const dataOriginal = parseData(d1);
      const dataNova = parseData(d2);

      if (!dataOriginal || !dataNova) return true; 

      const diffMs = Math.abs(dataOriginal.getTime() - dataNova.getTime());
      const diffDias = diffMs / (1000 * 60 * 60 * 24);
      return diffDias > 3;
    };

    const logsMudancas: string[] = [];
    const editaisComMudancas: any[] = [];

    editaisEnriquecidosComSucesso.forEach((edital) => {
      const mudancasGerais = [];
      
      const concursoAntigo = (edital.concurso || "").trim();
      const concursoNovo = (edital.dadosEnriquecidos?.concurso || "").trim();
      
      if (concursoAntigo !== concursoNovo) {
        mudancasGerais.push(`concurso: "${concursoAntigo || 'vazio'}" -> "${concursoNovo || 'vazio'}"`);
      }

      if (isDataDiferenteMais3Dias(edital.dataPublicacao, edital.dadosEnriquecidos?.dataPublicacao)) {
        mudancasGerais.push(`dataPublicacao: "${edital.dataPublicacao || 'vazia'}" -> "${edital.dadosEnriquecidos?.dataPublicacao || 'vazia'}"`);
      }

      if (mudancasGerais.length > 0) {
        const tituloLog = edital.dadosEnriquecidos?.titulo || edital.titulo;
        const mudancasTexto = mudancasGerais.join(' | ');
        logsMudancas.push(`"${tituloLog}" [${edital.link}] ${mudancasTexto}`);
        
        editaisComMudancas.push({
          edital,
          mudancasTexto
        });
      }
    });

    if (logsMudancas.length > 0) {
      console.log(`\n🔍 MUDANÇAS ENCONTRADAS APÓS ENRIQUECIMENTO (${logsMudancas.length} edital(is)):`);
      logsMudancas.forEach(log => console.log(`  - ${log}`));

      // Executa a Auditoria IA nas mudanças encontradas antes de prosseguir para o banco
      const { processarAuditoria } = await import('../lib/aiAuditor');
      await processarAuditoria(editaisComMudancas);

    } else {
      console.log(`\n🔍 Nenhuma mudança significativa foi encontrada em relação aos dados originais.`);
    }
    
    // Agora que a auditoria corrigiu os objetos em memória (se necessário), salvamos no banco
    await salvarEnriquecimentoEmLote(editaisEnriquecidosComSucesso);
    console.log(`✅ Dados salvos no MongoDB com sucesso!`);
    // ==============================================================

    console.log("===================================================");
  } else {
    console.log("⚠️ A IA rodou mas nenhum arquivo foi enriquecido com sucesso.");
  }

  return { 
    sucesso: true, 
    count: editaisEnriquecidosComSucesso.length,
    links: linksEnriquecidos,
    // Cria novos objetos quebando a referência para que o Next.js não ignore os novos dados no Client
    atualizados: editaisEnriquecidosComSucesso.map(e => ({
      link: e.link,
      dadosEnriquecidos: { ...e.dadosEnriquecidos }
    }))
  };
}

export async function reverterEnriquecimentoAction(link: string) {
  const { reverterEnriquecimento } = await import('../lib/storage');
  return await reverterEnriquecimento(link);
}