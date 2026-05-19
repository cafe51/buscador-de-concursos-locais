import * as cheerio from 'cheerio';
import { Edital } from '../../types';
import { extrairDataDoArquivo } from '../docParser';
import { ehSujeira, extrairIdConcurso } from '../filtrosGlobais';

export async function buscarPedranopolis(): Promise<Edital[]> {
  const resultados: Edital[] = [];
  let ordemGlobal = 0;

  const endpoints = [
    { url: 'https://www.pedranopolis.sp.gov.br/paginas/portal/concursos/exercicio?id=1' },
    { url: 'https://www.pedranopolis.sp.gov.br/paginas/portal/concursos/exercicio?id=2' },
    { url: 'https://www.pedranopolis.sp.gov.br/paginas/portal/concursos/exercicio?id=3' }
  ];

  try {
    // 🚀 FASE 1: Baixa as categorias ao mesmo tempo
    const htmlsCategorias = await Promise.all(endpoints.map(async (ep) => {
      try {
        const res = await fetch(ep.url, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' });
        return res.ok ? await res.text() : '';
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
            linksAnos.push({ ano: textoLink, url: href.startsWith('http') ? href : `https://www.pedranopolis.sp.gov.br${href}` });
          }
        }
      });
    }

    const linksAnosUnicos = Array.from(new Map(linksAnos.map(item => [item.url, item])).values());

    // 🚀 FASE 2: Baixa os HTMLs dos anos ao mesmo tempo
    const paginasAnosBaixadas = await Promise.all(linksAnosUnicos.map(async (item) => {
      try {
        const res = await fetch(item.url, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' });
        return { ...item, html: res.ok ? await res.text() : '' };
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
          const linkCompleto = href.startsWith('http') ? href : `https://www.pedranopolis.sp.gov.br${href}`;

          let dataAchadaNoHtml = false;
          let dataFormatadaHtml = '';
          let dataTimestampHtml = 0;

          const matchDataTexto = textoLinkInteiro.match(/\b(\d{2})[\/\.](\d{2})[\/\.](\d{4})\b/);
          if (matchDataTexto) {
            dataFormatadaHtml = `${matchDataTexto[1]}/${matchDataTexto[2]}/${matchDataTexto[3]}`;
            dataTimestampHtml = new Date(`${matchDataTexto[3]}-${matchDataTexto[2]}-${matchDataTexto[1]}T00:00:00`).getTime();
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

        for (const item of itensBrutos) {
          let dataFinal = 'sem data';
          let timestampFinal = 0;

          if (item.dataAchadaNoHtml) {
            dataFinal = item.dataFormatadaHtml;
            timestampFinal = item.dataTimestampHtml;
            dataFallback = { formatada: dataFinal, timestamp: timestampFinal };
          } else if (item.dataPdf) {
            dataFinal = item.dataPdf.formatada;
            timestampFinal = item.dataPdf.timestamp;
            dataFallback = item.dataPdf;
          } else {
            dataFinal = dataFallback.formatada;
            timestampFinal = dataFallback.timestamp;
          }

          const idConcurso = extrairIdConcurso(item.metadadoRaw, '', true, false);
          let anoConcurso: number | undefined = undefined;

          if (idConcurso) {
            const matchAno = idConcurso.match(/\/(\d{4})\b/);
            if (matchAno) anoConcurso = parseInt(matchAno[1], 10);
          }

          resultados.push({
            cidade: 'Pedranópolis',
            orgao: 'Prefeitura',
            titulo: item.tituloLimpo,
            link: item.linkCompleto,
            concurso: idConcurso,
            ano: anoConcurso,
            metadados: undefined,
            dataPublicacao: dataFinal,
            dataTimestamp: timestampFinal,
            ordemOriginal: item.ordemGlobal
          });
        }
      }
    }
  } catch (e) {
    console.error(`Erro geral ao buscar Pedranópolis`, e);
  }

  return resultados;
}