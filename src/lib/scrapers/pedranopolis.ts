// src/lib/scrapers/pedranopolis.ts
import * as cheerio from 'cheerio';
import { Edital } from '../../types';
import { extrairDataDoArquivo } from '../docParser';
import { ehSujeira, extrairIdConcurso } from '../filtrosGlobais';
import { fetchHtml, extrairData } from './utils';

export async function buscarPedranopolis(): Promise<Edital[]> {
  const resultados: Edital[] = [];
  let ordemGlobal = 0;

  const endpoints = [
    { url: 'https://www.pedranopolis.sp.gov.br/paginas/portal/concursos/exercicio?id=1' },
    { url: 'https://www.pedranopolis.sp.gov.br/paginas/portal/concursos/exercicio?id=2' },
    { url: 'https://www.pedranopolis.sp.gov.br/paginas/portal/concursos/exercicio?id=3' }
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetchHtml(endpoint.url);
      if (!response.ok) continue;

      const $ = cheerio.load(response.html);
      const linksAnos: { ano: string; url: string }[] = [];

      $('a').each((_, el) => {
        const textoLink = $(el).text().trim();
        if (/^\d{4}$/.test(textoLink)) {
          const href = $(el).attr('href') || '';
          if (href) {
            linksAnos.push({ ano: textoLink, url: href.startsWith('http') ? href : `https://www.pedranopolis.sp.gov.br${href}` });
          }
        }
      });

      for (const itemAno of linksAnos) {
        try {
          const resAno = await fetchHtml(itemAno.url);
          if (!resAno.ok) continue;

          const $ano = cheerio.load(resAno.html);
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
                  if (!item.dataPdf) {
                    await new Promise(r => setTimeout(r, 5000));
                    item.dataPdf = await extrairDataDoArquivo(item.linkCompleto);
                  }
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
              let extraidaDoPdf = false;

              if (item.dataAchadaNoHtml) {
                dataFinal = item.dataFormatadaHtml;
                timestampFinal = item.dataTimestampHtml;
                dataFallback = { formatada: dataFinal, timestamp: timestampFinal };
              } else if (item.dataPdf) {
                dataFinal = item.dataPdf.formatada;
                timestampFinal = item.dataPdf.timestamp;
                dataFallback = item.dataPdf;
                extraidaDoPdf = true;
              } else {
                dataFinal = dataFallback.formatada;
                timestampFinal = dataFallback.timestamp;
              }

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
                offsetMinutos = 0; // Fica como o mais antigo!
              }

              timestampFinal += (offsetMinutos * 60000);

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
                descricao: extraidaDoPdf ? '(data extraída do pdf)' : undefined,
                metadados: undefined,
                dataPublicacao: dataFinal,
                dataTimestamp: timestampFinal,
                ordemOriginal: item.ordemGlobal
              });
            }
          }
        } catch (e: any) {
          const cause = (e as any).cause;
          const causeMsg = cause ? " - Detalhes: " + (cause.message || cause.code || JSON.stringify(cause)) : "";
          throw new Error(`Erro ao raspar ano ${itemAno.ano} de Pedranópolis` + ": " + (e as Error).message + causeMsg);
        }
      }
    } catch (e: any) {
      const cause = (e as any).cause;
      const causeMsg = cause ? " - Detalhes: " + (cause.message || cause.code || JSON.stringify(cause)) : "";
      throw new Error(`Erro ao buscar Pedranópolis na url: ${endpoint.url}` + ": " + (e as Error).message + causeMsg);
    }
  }
  return resultados;
}