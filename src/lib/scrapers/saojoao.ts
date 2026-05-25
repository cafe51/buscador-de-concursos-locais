// src/lib/scrapers/saojoao.ts
import * as cheerio from 'cheerio';
import { Edital } from '../../types';
import { extrairDataDoArquivo } from '../docParser';
import { ehSujeira, extrairIdConcurso } from '../filtrosGlobais';

export async function buscarSaoJoao(): Promise<Edital[]> {
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
        const res = await fetch(ep.url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
          }, cache: 'no-store'
        });
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
            linksAnos.push({ ano: textoLink, url: href.startsWith('http') ? href : `https://sjduaspontes.sp.gov.br${href}` });
          }
        }
      });
    }

    const linksAnosUnicos = Array.from(new Map(linksAnos.map(item => [item.url, item])).values());

    const paginasAnosBaixadas = await Promise.all(linksAnosUnicos.map(async (item) => {
      try {
        const res = await fetch(item.url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
          }, cache: 'no-store'
        });
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
          const linkCompleto = href.startsWith('http') ? href : `https://sjduaspontes.sp.gov.br${href}`;

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

        // Passada 1: Propagação de baixo para cima (do mais antigo para o mais novo)
        // Como o site normalmente exibe do mais novo (topo) pro mais antigo (fundo),
        // iterar de baixo pra cima permite que um item sem data herde a data do item anterior a ele no tempo.
        for (let i = itensBrutos.length - 1; i >= 0; i--) {
          const item = itensBrutos[i];
          if (item.dataAchadaNoHtml) {
            item.dataFinalResolvida = { formatada: item.dataFormatadaHtml, timestamp: item.dataTimestampHtml };
            dataFallback = item.dataFinalResolvida;
          } else if (item.dataPdf) {
            item.dataFinalResolvida = item.dataPdf;
            dataFallback = item.dataFinalResolvida;
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
            metadados: undefined,
            dataPublicacao: dataFinal,
            dataTimestamp: timestampFinal,
            ordemOriginal: item.ordemGlobal
          });
        }
      }
    }
  } catch (e: any) { throw new Error(`Erro geral ao buscar São João das Duas Pontes` + ": " + (e as Error).message); }

  return resultados;
}