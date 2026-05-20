// src/app/actions.ts
'use server'

import { Edital } from '../types';
import { buscarFernandopolis } from '../lib/scrapers/fernandopolis';
import { buscarVotuporanga } from '../lib/scrapers/votuporanga';
import { buscarOuroeste } from '../lib/scrapers/ouroeste';
import { buscarMacedonia } from '../lib/scrapers/macedonia';
import { buscarPedranopolis } from '../lib/scrapers/pedranopolis';
import { buscarEstrela } from '../lib/scrapers/estrela';
import { buscarMeridiano } from '../lib/scrapers/meridiano';
import { buscarSaoJoao } from '../lib/scrapers/saojoao';
import { buscarJales } from '../lib/scrapers/jales';
import { urlsParaBlacklist } from '../lib/docParser';

export type ResultadoBusca = {
  editais: Edital[];
  falhas: string[];
};

// ==============================================================
// ⏱️ LIMITE MÁXIMO DE TEMPO POR CIDADE (55 Segundos)
// ==============================================================
const TIMEOUT_POR_CIDADE_MS = 55000;

async function rodarComProtecao(nomeCidade: string, funcaoScraper: () => Promise<Edital[]>) {
  const tempoInicio = performance.now();

  try {
    // Cria a promessa-bomba relógio
    const cronometro = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('TIMEOUT')), TIMEOUT_POR_CIDADE_MS);
    });

    // O Promise.race faz o scraper apostar corrida com o cronômetro
    const dados = await Promise.race([
      funcaoScraper(),
      cronometro
    ]);

    const tempoFim = performance.now();
    const tempoGasto = ((tempoFim - tempoInicio) / 1000).toFixed(2);

    // Log de Sucesso (Com o tempo exato e quantidade de itens daquela cidade)
    // Define um tamanho máximo fixo para a coluna da cidade (ex: 30 caracteres)
    const tamanhoFixoNome = 30;
    const tamanhoFixoTempo = 5;

    // O padEnd vai adicionar espaços à direita do nome da cidade até que a string tenha 30 caracteres
    const nomeFormatado = `[${nomeCidade}]`.padEnd(tamanhoFixoNome, ' ');

    const tempoFormatado = tempoGasto.padEnd(tamanhoFixoTempo, ' ');

    console.log(`🟢 ${nomeFormatado} OK \t| Tempo: ${tempoFormatado}s \t| Itens extraídos: ${dados.length}`);

    return { sucesso: true, cidade: nomeCidade, dados };
  } catch (e: any) {
    const tempoFim = performance.now();
    const tempoGasto = ((tempoFim - tempoInicio) / 1000).toFixed(2);

    // Log de Falha
    let motivo = e.message;
    if (motivo === 'TIMEOUT') {
      motivo = `Tempo limite de ${TIMEOUT_POR_CIDADE_MS / 1000}s excedido`;
    }

    console.error(`🔴 [${nomeCidade}] FALHOU \t| Tempo: ${tempoGasto}s \t| Motivo: ${motivo}`);

    return { sucesso: false, cidade: nomeCidade, dados: [] };
  }
}

export async function buscarTodosEditais(): Promise<ResultadoBusca> {
  let todosOsEditais: Edital[] = [];
  const cidadesComFalha: string[] = [];

  urlsParaBlacklist.clear();

  console.log("\n===================================================");
  console.log("⏳ INICIANDO RASPAGEM DE DADOS...");
  console.log("===================================================");

  const tempoInicioTotal = performance.now();

  try {
    const promessas = await Promise.all([
      // rodarComProtecao('Fernandópolis', buscarFernandopolis),
      rodarComProtecao('Votuporanga', buscarVotuporanga),
      rodarComProtecao('Ouroeste', buscarOuroeste),

      // rodarComProtecao('Jales', buscarJales),
      // rodarComProtecao('Macedônia', buscarMacedonia),
      // rodarComProtecao("Estrela d'Oeste", buscarEstrela),
      // rodarComProtecao('Meridiano', buscarMeridiano),
      // rodarComProtecao('São João das Duas Pontes', buscarSaoJoao),
      // rodarComProtecao('Pedranópolis', buscarPedranopolis),
    ]);

    promessas.forEach((resultado) => {
      if (resultado.sucesso) {
        todosOsEditais = [...todosOsEditais, ...resultado.dados];
      } else {
        cidadesComFalha.push(resultado.cidade);
      }
    });

    // ==============================================================
    // 🛡️ O DESDUPLICADOR GLOBAL: Remove cards com o mesmo link
    // ==============================================================
    const editaisUnicos = new Map<string, Edital>();

    todosOsEditais.forEach((edital) => {
      if (!editaisUnicos.has(edital.link)) {
        editaisUnicos.set(edital.link, edital);
      }
    });

    let listaLimpa = Array.from(editaisUnicos.values());

    // Ordenação Cronológica
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
    console.log(`📊 Total de editais extraídos: ${listaLimpa.length}`);
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
      falhas: cidadesComFalha
    };

  } catch (e: any) {
    throw new Error('Erro grave ao processar as buscas.');
  }
}