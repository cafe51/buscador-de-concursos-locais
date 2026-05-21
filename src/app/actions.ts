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
import { buscarUrania } from '../lib/scrapers/urania';
import { buscarDolcinopolis } from '../lib/scrapers/dolcinopolis';

import { buscarMiraEstrela } from '../lib/scrapers/miraestrela';
import { buscarIndiapora } from '../lib/scrapers/indiapora';
import { buscarAlvaresFlorence } from '../lib/scrapers/alvaresflorence';

import { buscarParisi } from '../lib/scrapers/parisi';
import { buscarValentimGentil } from '../lib/scrapers/valentimgentil';
import { buscarVitoriaBrasil } from '../lib/scrapers/vitoriabrasil';

import { buscarGuaraniDOeste } from '../lib/scrapers/guaranidoeste';
import { buscarPontalinda } from '../lib/scrapers/pontalinda';

import { urlsParaBlacklist } from '../lib/docParser';

export type ResultadoBusca = {
  editais: Edital[];
  falhas: string[];
};

export type Discrepancia = {
  cidade: string;
  concurso: string;
  linkOrigem: string;
  qtdNossa: number;
  qtdSite: number;
  linksOrigem: string[];
};

// ==============================================================
// 🗺️ MAPEAMENTO GLOBAL DE SCRAPERS (SEM EXPORT - USO INTERNO)
// ==============================================================
const MAPA_SCRAPERS: Record<string, () => Promise<Edital[]>> = {
  'Fernandópolis': buscarFernandopolis,
  'Votuporanga': buscarVotuporanga,
  'Ouroeste': buscarOuroeste,
  'Jales': buscarJales,
  'Macedônia': buscarMacedonia,
  "Estrela d'Oeste": buscarEstrela,
  'Meridiano': buscarMeridiano,
  'São João das Duas Pontes': buscarSaoJoao,
  'Pedranópolis': buscarPedranopolis,
  'Mira Estrela': buscarMiraEstrela,
  'Indiaporã': buscarIndiapora,
  'Álvares Florence': buscarAlvaresFlorence,
  'Parisi': buscarParisi,
  'Valentim Gentil': buscarValentimGentil,
  'Vitória Brasil': buscarVitoriaBrasil,
  "Guarani d'Oeste": buscarGuaraniDOeste,
  'Urânia': buscarUrania,
  'Dolcinópolis': buscarDolcinopolis,
  'Pontalinda': buscarPontalinda,
};

// ==============================================================
// ⏱️ LIMITE MÁXIMO DE TEMPO POR CIDADE (55 Segundos)
// ==============================================================
const TIMEOUT_POR_CIDADE_MS = 85000;

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

    // Formatação cuidadosa dos Logs
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

    // Formatação do Log de Falha
    const tamanhoFixoNome = 30;
    const nomeFormatado = `[${nomeCidade}]`.padEnd(tamanhoFixoNome, ' ');

    console.error(`🔴 ${nomeFormatado} FALHOU \t| Tempo: ${tempoGasto}s \t| Motivo: ${motivo}`);

    return { sucesso: false, cidade: nomeCidade, dados: [] };
  }
}

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
    resultado.dados.forEach((edital) => {
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
    falhas: resultado.sucesso ? [] : [nomeCidade]
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
    const promessas = await Promise.all([
      // rodarComProtecao('Fernandópolis', buscarFernandopolis),


      // rodarComProtecao('Jales', buscarJales),
      // rodarComProtecao('Macedônia', buscarMacedonia),

      // rodarComProtecao("Estrela d'Oeste", buscarEstrela),
      // rodarComProtecao("Guarani d'Oeste", buscarGuaraniDOeste),

      // rodarComProtecao('Meridiano', buscarMeridiano),
      // rodarComProtecao('São João das Duas Pontes', buscarSaoJoao),
      // rodarComProtecao('Pedranópolis', buscarPedranopolis),

      // rodarComProtecao('Votuporanga', buscarVotuporanga),
      // rodarComProtecao('Ouroeste', buscarOuroeste),
      // rodarComProtecao('Mira Estrela', buscarMiraEstrela),
      // rodarComProtecao('Indiaporã', buscarIndiapora),
      // rodarComProtecao('Álvares Florence', buscarAlvaresFlorence),
      // rodarComProtecao('Parisi', buscarParisi),
      // rodarComProtecao('Valentim Gentil', buscarValentimGentil),
      // rodarComProtecao('Vitória Brasil', buscarVitoriaBrasil),
      // rodarComProtecao('Urânia', buscarUrania),
      // rodarComProtecao('Dolcinópolis', buscarDolcinopolis),
      rodarComProtecao('Pontalinda', buscarPontalinda),
    ]);

    promessas.forEach((resultado) => {
      if (resultado.sucesso) {
        todosOsEditais = [...todosOsEditais, ...resultado.dados];
      } else {
        cidadesComFalha.push(resultado.cidade);
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
// 🕵️ AUDITORIA DEV DO INSTAR
// ==============================================================
export async function auditarQuantidadesInstar(grupos: { nome: string, cidade: string, linksOrigem: string[], qtdNossa: number, temRestricao?: boolean }[]): Promise<Discrepancia[]> {
  const discrepancias: Discrepancia[] = [];
  const TAMANHO_LOTE = 10;

  console.log(`\n===================================================`);
  console.log(`🕵️ INICIANDO AUDITORIA EM ${grupos.length} PASTAS INSTAR...`);
  console.log(`===================================================`);

  for (let i = 0; i < grupos.length; i += TAMANHO_LOTE) {
    const lote = grupos.slice(i, i + TAMANHO_LOTE);

    await Promise.all(lote.map(async (grupo) => {
      if (grupo.temRestricao) return;

      let qtdSiteTotal = 0;
      let temInstar = false;

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

      if (temInstar && qtdSiteTotal > 0 && qtdSiteTotal !== grupo.qtdNossa) {
        discrepancias.push({
          cidade: grupo.cidade,
          concurso: grupo.nome,
          linkOrigem: grupo.linksOrigem[0] || '',
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

// ==============================================================
// 🛠️ SCRAPER RAW (MODO DEV - IGNORA FILTROS)
// ==============================================================
export async function extrairDadosRawInstar(urlLista: string) {
  try {
    const urlObj = new URL(urlLista);
    const baseUrlStr = urlObj.origin;

    const res = await fetch(urlLista, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' });
    if (!res.ok) throw new Error("Falha ao acessar a URL fornecida.");

    const html = await res.text();
    const $ = cheerio.load(html);

    const linksInternos: string[] = [];

    $('div.ed_edital').each((_, el) => {
      const href = $(el).find('a').first().attr('href') || '';
      if (href) {
        linksInternos.push(href.startsWith('http') ? href : `${baseUrlStr}${href}`);
      }
    });

    const dadosRaw: any[] = [];

    await Promise.all(linksInternos.map(async (link) => {
      try {
        const innerRes = await fetch(link, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' });
        if (!innerRes.ok) return;

        const innerHtml = await innerRes.text();
        const $inner = cheerio.load(innerHtml);

        const titulo = $inner('.ed_titulo_edital').text().replace(/\s+/g, ' ').trim();

        let situacao = '';
        let modalidade = '';
        let numProcesso = '';
        let inicioInscricoes = '';
        let fimInscricoes = '';

        $inner('.ed_linha_lista_detalhes').each((_, el) => {
          const nomeDetalhe = $inner(el).find('.ed_nome_detalhe').text().trim().toLowerCase();
          const valorDetalhe = $inner(el).find('.ed_descricao_detalhe').text().replace(/\s+/g, ' ').trim();

          if (nomeDetalhe.includes('situação') || nomeDetalhe.includes('situacao')) situacao = valorDetalhe;
          else if (nomeDetalhe.includes('modalidade')) modalidade = valorDetalhe;
          else if (nomeDetalhe.includes('nº do processo') || nomeDetalhe.includes('nº processo')) numProcesso = valorDetalhe;
          else if (nomeDetalhe.includes('início das inscrições') || nomeDetalhe.includes('inicio das inscricoes')) inicioInscricoes = valorDetalhe;
          else if (nomeDetalhe.includes('fim das inscrições') || nomeDetalhe.includes('fim das inscricoes')) fimInscricoes = valorDetalhe;
        });

        let descricao = $inner('#detalhes_edital .sw_conteudo_vermais').text().replace(/\s+/g, ' ').trim();
        if (!descricao) {
          descricao = $inner('#detalhes_edital .sp_descricao_sessao').text().replace(/\s+/g, ' ').trim();
        }

        const badgeQtde = $inner('#btn_arquivos_edital .ed_info_qtde_itens').text().trim();
        const qtdeArquivosBadge = parseInt(badgeQtde, 10) || 0;

        const listaArquivos: { nome: string, link: string }[] = [];
        $inner('.ed_cont_arquivos .ed_arquivo_edital').each((_, el) => {
          const aTag = $inner(el).find('a');
          const hrefDoc = aTag.attr('href') || '';
          const linkDoc = hrefDoc.startsWith('http') ? hrefDoc : `${baseUrlStr}${hrefDoc}`;

          const nomeElement = $inner(el).find('.ed_nome_arquivo').clone();
          nomeElement.find('.ed_info_tamanho_arquivo').remove();
          const nomeTexto = nomeElement.text().replace(/\s+/g, ' ').trim();

          const categoria = $inner(el).find('.ed_descricao_tipo_arquivo').text().replace(/\s+/g, ' ').trim();
          const nomeFinal = categoria ? `${categoria} - ${nomeTexto}` : nomeTexto;

          listaArquivos.push({ nome: nomeFinal, link: linkDoc });
        });

        dadosRaw.push({
          linkOrigem: link,
          titulo,
          situacao,
          modalidade,
          numProcesso,
          inicioInscricoes,
          fimInscricoes,
          descricao,
          quantidadeArquivosBadge: qtdeArquivosBadge,
          quantidadeArquivosEncontrados: listaArquivos.length,
          listaArquivos
        });

      } catch (e) {
        console.error("Erro interno no Raw Scraper: ", link);
      }
    }));

    return dadosRaw;

  } catch (error: any) {
    console.error(error);
    return { erro: error.message };
  }
}