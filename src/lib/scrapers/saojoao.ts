// src/lib/scrapers/saojoao.ts
import * as cheerio from 'cheerio';
import { Edital } from '../../types';
import { extrairDataDoArquivo } from '../docParser';
import { ehSujeira, extrairIdConcurso } from '../filtrosGlobais';
import { fetchHtml, extrairData } from './utils';

export async function buscarSaoJoao(opcoes?: import('../../types').ScraperOptions): Promise<Edital[]> {
  if (opcoes?.verificarDisponibilidade) {
    const { verificaDisponibilidade } = await import('./utils');
    await verificaDisponibilidade('https://sjduaspontes.sp.gov.br/');
    return [];
  }

  const resultados: Edital[] = [];
  let ordemGlobal = 0;

  const endpoints = [
    { url: 'https://sjduaspontes.sp.gov.br/paginas/portal/concursos/exercicio?id=1' },
    { url: 'https://sjduaspontes.sp.gov.br/paginas/portal/concursos/exercicio?id=2' },
    { url: 'https://sjduaspontes.sp.gov.br/paginas/portal/concursos/exercicio?id=3' },
    { url: 'https://sjduaspontes.sp.gov.br/paginas/portal/concursos/exercicio?id=4' }
  ];

  try {
    const htmlsCategorias = await Promise.all(endpoints.map(async (ep) => {
      try {
        const res = await fetchHtml(ep.url);
        return res.ok ? res.html : '';
      } catch { return ''; }
    }));

    const linksAnos: { ano: string; url: string }[] = [];

    for (const html of htmlsCategorias) {
      if (!html) continue;
      const $ = cheerio.load(html);
      $('a').each((_, el) => {
        const textoLink = $(el).text().trim();
        if (/^\d{4}$/.test(textoLink)) {
          const href = $(el).attr('href') || '';
          if (href) {
            linksAnos.push({ ano: textoLink, url: href.startsWith('http') ? href : `https://sjduaspontes.sp.gov.br${href}` });
          }
        }
      });
    }

    const linksAnosUnicos = Array.from(new Map(linksAnos.map(item => [item.url, item])).values());

    const paginasAnosBaixadas = await Promise.all(linksAnosUnicos.map(async (item) => {
      try {
        const res = await fetchHtml(item.url);
        return { ...item, html: res.ok ? res.html : '' };
      } catch { return { ...item, html: '' }; }
    }));

    for (const itemAno of paginasAnosBaixadas) {
      if (!itemAno.html) continue;

      const $ano = cheerio.load(itemAno.html);
      const headersCards = $ano('.card-header').toArray();

      for (const headerEl of headersCards) {
        const metadadoRaw = $ano(headerEl).find('h4.card-title a').text().replace(/\s+/g, ' ').trim();
        if (ehSujeira(metadadoRaw)) continue;

        const linksPdfs = $ano(headerEl).parent().find('div.card-body ul.list.list-icons.list-primary.list-side-borders li a').toArray();
        const itensBrutos: any[] = [];

        for (const el of linksPdfs) {
          const textoLinkInteiro = $ano(el).text().replace(/\s+/g, ' ').trim();
          let tituloLimpo = $ano(el).find('strong').text().replace(/\s+/g, ' ').trim();

          if (ehSujeira(tituloLimpo)) continue;

          ordemGlobal++;
          const href = $ano(el).attr('href') || '';
          const linkCompleto = href.startsWith('http') ? href : `https://sjduaspontes.sp.gov.br${href}`;

          let dataAchadaNoHtml = false;
          let dataFormatadaHtml = '';
          let dataTimestampHtml = 0;

          const dataExtraida = extrairData(textoLinkInteiro);
          if (dataExtraida) {
            dataFormatadaHtml = dataExtraida.dataFormatada;
            dataTimestampHtml = dataExtraida.dataTimestamp;
            dataAchadaNoHtml = true;
          }

          tituloLimpo = tituloLimpo.replace(/>>>\s*\(?Publicado em.*?\)?/i, '').replace(/\b\d{2}[\/\.]\d{2}[\/\.]\d{4}\b/g, '').trim();
          if (tituloLimpo.endsWith('-')) tituloLimpo = tituloLimpo.slice(0, -1).trim();

          itensBrutos.push({
            ordemGlobal, tituloLimpo, linkCompleto, metadadoRaw,
            dataAchadaNoHtml, dataFormatadaHtml, dataTimestampHtml, dataPdf: null
          });
        }

        const TAMANHO_LOTE = 8;
        for (let i = 0; i < itensBrutos.length; i += TAMANHO_LOTE) {
          const lote = itensBrutos.slice(i, i + TAMANHO_LOTE);
          await Promise.all(lote.map(async (item) => {
            if (!item.dataAchadaNoHtml) {
              item.dataPdf = await extrairDataDoArquivo(item.linkCompleto);
            }
          }));
        }

        let dataFallback = {
          formatada: `01/01/${itemAno.ano}`,
          timestamp: new Date(`${itemAno.ano}-01-01T00:00:00`).getTime()
        };

        // Passada 1: Propagação de baixo para cima
        for (let i = itensBrutos.length - 1; i >= 0; i--) {
          const item = itensBrutos[i];
          item.extraidaDoPdf = false;
          if (item.dataAchadaNoHtml) {
            item.dataFinalResolvida = { formatada: item.dataFormatadaHtml, timestamp: item.dataTimestampHtml };
            dataFallback = item.dataFinalResolvida;
          } else if (item.dataPdf) {
            item.dataFinalResolvida = item.dataPdf;
            dataFallback = item.dataFinalResolvida;
            item.extraidaDoPdf = true;
          } else {
            item.dataFinalResolvida = { ...dataFallback };
          }
        }

        // Passada 2: Inserção dos resultados com ordenação de horário sintético
        for (const item of itensBrutos) {
          let dataFinal = item.dataFinalResolvida.formatada;
          let timestampFinal = item.dataFinalResolvida.timestamp;

          // ==============================================================
          // ⏱️ LÓGICA DE ORDENAÇÃO INTUITIVA (Horário Sintético)
          // ==============================================================
          let offsetMinutos = 30; // Padrão fica no meio do dia
          const tituloUpper = item.tituloLimpo.toUpperCase();

          if (tituloUpper.includes('CONVOCA')) {
            offsetMinutos = 50;
          } else if (tituloUpper.includes('HOMOLOGA')) {
            offsetMinutos = 40;
          } else if (tituloUpper.includes('GABARITO') || tituloUpper.includes('RESULTADO')) {
            offsetMinutos = 20;
          } else if (tituloUpper.includes('INSCRI')) {
            offsetMinutos = 10;
          } else if (tituloUpper.includes('EDITAL') || tituloUpper.includes('NORMATIVO') || tituloUpper.includes('ABERTURA')) {
            offsetMinutos = 0;
          }

          timestampFinal += (offsetMinutos * 60000);

          const idConcurso = extrairIdConcurso(item.metadadoRaw, '', true, false);
          let anoConcurso: number | undefined = undefined;

          if (idConcurso) {
            const matchAno = idConcurso.match(/\/(\d{4})\b/);
            if (matchAno) anoConcurso = parseInt(matchAno[1], 10);
          }

          resultados.push({
            cidade: 'São João das Duas Pontes',
            orgao: 'Prefeitura',
            titulo: item.tituloLimpo,
            link: item.linkCompleto,
            concurso: idConcurso,
            ano: anoConcurso,
            descricao: item.extraidaDoPdf ? '(data extraída do pdf)' : undefined,
            metadados: undefined,
            dataPublicacao: dataFinal,
            dataTimestamp: timestampFinal,
            ordemOriginal: item.ordemGlobal
          });
        }
      }
    }
  } catch (e: any) {
    const cause = (e as any).cause;
    const causeMsg = cause ? " - Detalhes: " + (cause.message || cause.code || JSON.stringify(cause)) : "";
    throw new Error(`Erro geral ao buscar São João das Duas Pontes` + ": " + (e as Error).message + causeMsg);
  }

  return resultados;
}