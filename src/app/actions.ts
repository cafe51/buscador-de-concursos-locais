// src/app/actions.ts
'use server'

import * as cheerio from 'cheerio';
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

import { buscarMiraEstrela } from '../lib/scrapers/miraestrela';
import { buscarIndiapora } from '../lib/scrapers/indiapora';
import { buscarAlvaresFlorence } from '../lib/scrapers/alvaresflorence';

// 🔥 NOVAS CIDADES IMPORTADAS AQUI
import { buscarParisi } from '../lib/scrapers/parisi';
import { buscarValentimGentil } from '../lib/scrapers/valentimgentil';
import { buscarVitoriaBrasil } from '../lib/scrapers/vitoriabrasil';

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
    const cronometro = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('TIMEOUT')), TIMEOUT_POR_CIDADE_MS);
    });

    const dados = await Promise.race([
      funcaoScraper(),
      cronometro
    ]);

    const tempoFim = performance.now();
    const tempoGasto = ((tempoFim - tempoInicio) / 1000).toFixed(2);

    const tamanhoFixoNome = 30;
    const tamanhoFixoTempo = 5;

    const nomeFormatado = `[${nomeCidade}]`.padEnd(tamanhoFixoNome, ' ');
    const tempoFormatado = tempoGasto.padEnd(tamanhoFixoTempo, ' ');

    console.log(`🟢 ${nomeFormatado} OK \t| Tempo: ${tempoFormatado}s \t| Itens extraídos: ${dados.length}`);

    return { sucesso: true, cidade: nomeCidade, dados };
  } catch (e: any) {
    const tempoFim = performance.now();
    const tempoGasto = ((tempoFim - tempoInicio) / 1000).toFixed(2);

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

      rodarComProtecao('Mira Estrela', buscarMiraEstrela),
      rodarComProtecao('Indiaporã', buscarIndiapora),
      rodarComProtecao('Álvares Florence', buscarAlvaresFlorence),

      // 🔥 AS TRÊS NOVAS CIDADES
      rodarComProtecao('Parisi', buscarParisi),
      rodarComProtecao('Valentim Gentil', buscarValentimGentil),
      rodarComProtecao('Vitória Brasil', buscarVitoriaBrasil),
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

// ==============================================================
// 🕵️ AUDITORIA DEV DO INSTAR (Suporta Pastas Fundidas)
// ==============================================================
export type Discrepancia = {
  cidade: string;
  concurso: string;
  qtdNossa: number;
  qtdSite: number;
  linksOrigem: string[]; // 🚀 Agora é um array de links
};

export async function auditarQuantidadesInstar(grupos: { nome: string, cidade: string, linksOrigem: string[], qtdNossa: number, temRestricao?: boolean }[]): Promise<Discrepancia[]> {
  const discrepancias: Discrepancia[] = [];
  const TAMANHO_LOTE = 10;

  console.log(`\n===================================================`);
  console.log(`🕵️ INICIANDO AUDITORIA EM ${grupos.length} PASTAS...`);
  console.log(`===================================================`);

  for (let i = 0; i < grupos.length; i += TAMANHO_LOTE) {
    const lote = grupos.slice(i, i + TAMANHO_LOTE);

    await Promise.all(lote.map(async (grupo) => {
      if (grupo.temRestricao) return;

      let qtdSiteTotal = 0;
      let temInstar = false;

      // Percorre todos os links que foram fundidos nesta pasta
      for (const link of grupo.linksOrigem) {
        if (link && link.includes('/portal/editais/')) {
          temInstar = true;
          try {
            const res = await fetch(link, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' });
            if (res.ok) {
              const html = await res.text();
              const $ = cheerio.load(html);
              const textoBadge = $('#btn_arquivos_edital .ed_info_qtde_itens').text().trim();
              if (textoBadge) {
                qtdSiteTotal += parseInt(textoBadge, 10);
              }
            }
          } catch (e) { }
        }
      }

      // Se a soma do site for diferente do que temos no Frontend, avisa!
      if (temInstar && qtdSiteTotal > 0 && qtdSiteTotal !== grupo.qtdNossa) {
        discrepancias.push({
          cidade: grupo.cidade,
          concurso: grupo.nome,
          qtdNossa: grupo.qtdNossa,
          qtdSite: qtdSiteTotal,
          linksOrigem: grupo.linksOrigem
        });
      }
    }));
  }

  console.log(`✅ AUDITORIA CONCLUÍDA! ${discrepancias.length} discrepâncias encontradas.\n`);
  return discrepancias;
}