// src/app/actions.ts
'use server'

import * as cheerio from 'cheerio';
import { Edital } from '../types';
import { put, list } from '@vercel/blob';

import { buscarFernandopolis } from '../lib/scrapers/fernandopolis';
import { buscarCamaraFernandopolis } from '../lib/scrapers/camaras/fernandopolis'
  ;
import { buscarVotuporanga } from '../lib/scrapers/votuporanga';
import { buscarCamaraVotuporanga } from '../lib/scrapers/camaras/votuporanga';

import { buscarOuroeste } from '../lib/scrapers/ouroeste';
import { buscarMacedonia } from '../lib/scrapers/macedonia';
import { buscarPedranopolis } from '../lib/scrapers/pedranopolis';
import { buscarEstrela } from '../lib/scrapers/estrela';

import { buscarMeridiano } from '../lib/scrapers/meridiano';
import { buscarCamaraMeridiano } from '../lib/scrapers/camaras/meridiano';

import { buscarSaoJoao } from '../lib/scrapers/saojoao';

import { buscarJales } from '../lib/scrapers/jales';
import { buscarCamaraJales } from '../lib/scrapers/camaras/jales';

import { buscarUrania } from '../lib/scrapers/urania';
import { buscarDolcinopolis } from '../lib/scrapers/dolcinopolis';

import { buscarMiraEstrela } from '../lib/scrapers/miraestrela';
import { buscarCamaraMiraEstrela } from '../lib/scrapers/camaras/miraestrela';

import { buscarIndiapora } from '../lib/scrapers/indiapora';
import { buscarCamaraIndiapora } from '../lib/scrapers/camaras/indiapora';

import { buscarAlvaresFlorence } from '../lib/scrapers/alvaresflorence';

import { buscarParisi } from '../lib/scrapers/parisi';
import { buscarCamaraParisi } from '../lib/scrapers/camaras/parisi';

import { buscarValentimGentil } from '../lib/scrapers/valentimgentil';
import { buscarVitoriaBrasil } from '../lib/scrapers/vitoriabrasil';

import { buscarGuaraniDOeste } from '../lib/scrapers/guaranidoeste';
import { buscarPontalinda } from '../lib/scrapers/pontalinda';

import { buscarSantaSalete } from '../lib/scrapers/santasalete';

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
  'Fernandópolis (Câmara)': buscarCamaraFernandopolis,
  'Votuporanga': buscarVotuporanga,
  'Votuporanga (Câmara)': buscarCamaraVotuporanga,
  'Ouroeste': buscarOuroeste,
  'Jales': buscarJales,
  'Jales (Câmara)': buscarCamaraJales,
  'Macedônia': buscarMacedonia,
  "Estrela d'Oeste": buscarEstrela,
  'Meridiano': buscarMeridiano,
  'Meridiano (Câmara)': buscarCamaraMeridiano,
  'São João das Duas Pontes': buscarSaoJoao,
  'Pedranópolis': buscarPedranopolis,
  'Mira Estrela': buscarMiraEstrela,
  'Mira Estrela (Câmara)': buscarCamaraMiraEstrela,
  'Indiaporã': buscarIndiapora,
  'Indiaporã (Câmara)': buscarCamaraIndiapora,
  'Álvares Florence': buscarAlvaresFlorence,
  'Parisi': buscarParisi,
  'Parisi (Câmara)': buscarCamaraParisi,
  'Valentim Gentil': buscarValentimGentil,
  'Vitória Brasil': buscarVitoriaBrasil,
  "Guarani d'Oeste": buscarGuaraniDOeste,
  'Urânia': buscarUrania,
  'Dolcinópolis': buscarDolcinopolis,
  'Pontalinda': buscarPontalinda,
  'Santa Salete': buscarSantaSalete,
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
    const tamanhoFixoTempo = 5;
    const tamanhoFixoNome = 30;
    const nomeFormatado = `[${nomeCidade}]`.padEnd(tamanhoFixoNome, ' ');
    const tempoFormatado = tempoGasto.padEnd(tamanhoFixoTempo, ' ');

    if (e.dadosParciais) {
      console.log(`🟡 ${nomeFormatado} AVISO \t| Tempo: ${tempoFormatado}s \t| Itens extraídos: ${e.dadosParciais.length} \t| Motivo: ${motivo}`);
      return { sucesso: false, cidade: nomeCidade, dados: e.dadosParciais, motivo };
    }

    console.error(`🔴 ${nomeFormatado} FALHOU \t| Tempo: ${tempoFormatado}s \t| Motivo: ${motivo}`);

    return { sucesso: false, cidade: nomeCidade, dados: [], motivo };
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
    falhas: resultado.sucesso ? [] : [`${resultado.cidade} (${resultado.motivo})`]
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
    const tarefas = [
      () => rodarComProtecao('Fernandópolis', buscarFernandopolis),
      () => rodarComProtecao('Fernandópolis (Câmara)', buscarCamaraFernandopolis),
      () => rodarComProtecao('Jales', buscarJales),
      () => rodarComProtecao('Câmara Jales', buscarCamaraJales),
      () => rodarComProtecao('Macedônia', buscarMacedonia),
      () => rodarComProtecao("Estrela d'Oeste", buscarEstrela),
      () => rodarComProtecao("Guarani d'Oeste", buscarGuaraniDOeste),
      () => rodarComProtecao('Meridiano', buscarMeridiano),
      () => rodarComProtecao('Meridiano (Câmara)', buscarCamaraMeridiano),
      () => rodarComProtecao('São João das Duas Pontes', buscarSaoJoao),
      () => rodarComProtecao('Pedranópolis', buscarPedranopolis),
      () => rodarComProtecao('Votuporanga', buscarVotuporanga),
      () => rodarComProtecao('Votuporanga (Câmara)', buscarCamaraVotuporanga),
      () => rodarComProtecao('Ouroeste', buscarOuroeste),
      () => rodarComProtecao('Mira Estrela', buscarMiraEstrela),
      () => rodarComProtecao('Mira Estrela (Câmara)', buscarCamaraMiraEstrela),
      () => rodarComProtecao('Indiaporã', buscarIndiapora),
      () => rodarComProtecao('Indiaporã (Câmara)', buscarCamaraIndiapora),
      () => rodarComProtecao('Álvares Florence', buscarAlvaresFlorence),
      () => rodarComProtecao('Parisi', buscarParisi),
      () => rodarComProtecao('Parisi (Câmara)', buscarCamaraParisi),
      () => rodarComProtecao('Valentim Gentil', buscarValentimGentil),
      () => rodarComProtecao('Vitória Brasil', buscarVitoriaBrasil),
      () => rodarComProtecao('Urânia', buscarUrania),
      () => rodarComProtecao('Dolcinópolis', buscarDolcinopolis),
      () => rodarComProtecao('Pontalinda', buscarPontalinda),
      () => rodarComProtecao('Santa Salete', buscarSantaSalete)
    ];

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
    console.error("ERRO GRAVE NA BUSCA:", e); throw new Error("Erro grave ao processar as buscas.");
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

// ==============================================================
// ☁️ VERCEL BLOB: BANCO DE DADOS
// ==============================================================

// Puxa o JSON de 1.6MB da nuvem em milissegundos
// ==============================================================
// ☁️ VERCEL BLOB: BANCO DE DADOS
// ==============================================================

export async function carregarDoBanco(): Promise<Edital[]> {
  try {
    const { blobs } = await list();
    const file = blobs.find(b => b.pathname === 'editais.json');

    if (!file) return [];

    const res = await fetch(file.downloadUrl, {
      cache: 'no-store',
      headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` }
    });

    if (!res.ok) {
      console.error("Erro HTTP ao baixar o banco:", res.status, res.statusText);
      return [];
    }

    const dados = await res.json();
    return dados;
  } catch (e) {
    console.error("Erro ao ler do Vercel Blob:", e);
    return [];
  }
}

// 🚀 NOVA FUNÇÃO: Sincronização Inteligente (Upsert) ou Substituição Total
export async function sincronizarBanco(novosEditais: Edital[], substituirTudo: boolean = false): Promise<{ sucesso: boolean, adicionados: number, atualizados: string[] }> {
  try {
    console.log("\n===================================================");
    if (substituirTudo) {
      console.log("☁️ CRIANDO NOVO BANCO NA NUVEM (SUBSTITUIÇÃO TOTAL)...");
    } else {
      console.log("☁️ SINCRONIZANDO COM A NUVEM...");
    }
    console.log("===================================================");

    // Se for substituir tudo, ignoramos o banco antigo.
    const editaisAntigos = substituirTudo ? [] : await carregarDoBanco();

    const mapaFinal = new Map<string, Edital>();
    const relatorioAtualizacoes: string[] = [];
    const relatorioAdicoes: string[] = [];
    let qtdeAdicionados = 0;

    // 1. Alimenta o mapa com os dados antigos (Garante que se o scraper falhar, o dado velho sobrevive!)
    editaisAntigos.forEach(e => mapaFinal.set(e.link, e));

    // 2. Processa os dados novos
    novosEditais.forEach(novo => {
      const antigo = mapaFinal.get(novo.link);

      if (antigo) {
        // Compara os dois para ver se algo mudou
        const alteracoes: string[] = [];
        const chavesParaIgnorar = ['ordemOriginal', 'dataTimestamp']; // Ignora mudanças de milissegundos da ordenação

        (Object.keys(novo) as Array<keyof Edital>).forEach(key => {
          if (!chavesParaIgnorar.includes(key)) {
            // Transforma em string para comparar até mesmo os Arrays
            const valNovo = JSON.stringify(novo[key] || '');
            const valAntigo = JSON.stringify(antigo[key] || '');

            if (valNovo !== valAntigo) {
              alteracoes.push(`${key}: '${antigo[key] || 'vazio'}' ➔ '${novo[key] || 'vazio'}'`);
            }
          }
        });

        if (alteracoes.length > 0) {
          relatorioAtualizacoes.push(
            `\n   🏢 [${novo.cidade}] 📄 "${novo.titulo}"` +
            `\n   🔗 Link: ${novo.link}` +
            `\n   🔄 Mudanças: ${alteracoes.join(' | ')}`
          );
        }
      } else {
        qtdeAdicionados++;
        relatorioAdicoes.push(
          `\n   ✨ [${novo.cidade}] 📄 "${novo.titulo}"` +
          `\n   🔗 Link: ${novo.link}`
        );
      }

      // Salva ou Sobrescreve o item no mapa consolidado
      mapaFinal.set(novo.link, novo);
    });

    // 3. Monta o array final e reordena tudo cronologicamente
    const listaFinal = Array.from(mapaFinal.values());
    listaFinal.sort((a, b) => {
      if (b.dataTimestamp !== a.dataTimestamp) return b.dataTimestamp - a.dataTimestamp;
      return (a.ordemOriginal || 0) - (b.ordemOriginal || 0);
    });

    // 4. Faz o Upload com permissão de Sobrescrita
    console.log(`☁️ Enviando pacote consolidado (${listaFinal.length} itens) para o Vercel Blob...`);
    await put('editais.json', JSON.stringify(listaFinal), {
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: true, // 🚀 CORREÇÃO DO ERRO DA VERCEL
      contentType: 'application/json'
    });

    console.log(`✅ Upload concluído!`);
    console.log(`📈 Novos Editais Adicionados: ${qtdeAdicionados}`);
    console.log(`🔄 Editais Atualizados: ${relatorioAtualizacoes.length}`);

    if (relatorioAdicoes.length > 0 && !substituirTudo) {
      console.log("\n🆕 Relatório de Adições:");
      relatorioAdicoes.forEach(log => console.log(log));
    }

    if (relatorioAtualizacoes.length > 0) {
      console.log("\n📝 Relatório de Alterações:");
      relatorioAtualizacoes.forEach(log => console.log(log));
    }
    console.log("===================================================\n");

    return { sucesso: true, adicionados: qtdeAdicionados, atualizados: relatorioAtualizacoes };
  } catch (e) {
    console.error("Erro na sincronização com Vercel Blob:", e);
    return { sucesso: false, adicionados: 0, atualizados: [] };
  }
}