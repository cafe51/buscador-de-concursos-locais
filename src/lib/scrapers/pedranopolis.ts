import * as cheerio from 'cheerio';
import { Edital } from '../../types';
import { extrairDataDoArquivo } from '../docParser';

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
      const response = await fetch(endpoint.url, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' });
      if (!response.ok) continue;

      const html = await response.text();
      const $ = cheerio.load(html);
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
          const resAno = await fetch(itemAno.url, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' });
          if (!resAno.ok) continue;

          const htmlAno = await resAno.text();
          const $ano = cheerio.load(htmlAno);
          const headersCards = $ano('.card-header').toArray();

          for (const headerEl of headersCards) {
            const metadado = $ano(headerEl).find('h4.card-title a').text().replace(/\s+/g, ' ').trim();
            const linksPdfs = $ano(headerEl).parent().find('div.card-body ul.list.list-icons.list-primary.list-side-borders li a').toArray();

            // -------------------------------------------------------------
            // FASE 1: Extração inicial do DOM e identificação dos links
            // -------------------------------------------------------------
            const itensBrutos: any[] = [];
            for (const el of linksPdfs) {
              ordemGlobal++;
              const textoLinkInteiro = $ano(el).text().replace(/\s+/g, ' ').trim();
              let tituloLimpo = $ano(el).find('strong').text().replace(/\s+/g, ' ').trim();
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
                ordemGlobal, tituloLimpo, linkCompleto, metadado,
                dataAchadaNoHtml, dataFormatadaHtml, dataTimestampHtml, dataPdf: null
              });
            }

            // -------------------------------------------------------------
            // FASE 2: Processamento em Lotes (Baixar PDFs em blocos de 8)
            // -------------------------------------------------------------
            const TAMANHO_LOTE = 8;
            for (let i = 0; i < itensBrutos.length; i += TAMANHO_LOTE) {
              const lote = itensBrutos.slice(i, i + TAMANHO_LOTE);
              // O Promise.all dispara os 8 downloads ao mesmo tempo
              await Promise.all(lote.map(async (item) => {
                if (!item.dataAchadaNoHtml) {
                  item.dataPdf = await extrairDataDoArquivo(item.linkCompleto);
                }
              }));
            }

            // -------------------------------------------------------------
            // FASE 3: Aplicação Sequencial do Fallback (O pulo do gato)
            // -------------------------------------------------------------
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
                // Caiu aqui? É imagem! Usa o fallback instantaneamente da memória.
                dataFinal = dataFallback.formatada;
                timestampFinal = dataFallback.timestamp;
              }

              resultados.push({
                cidade: 'Pedranópolis',
                orgao: 'Prefeitura',
                titulo: item.tituloLimpo,
                link: item.linkCompleto,
                metadados: item.metadado || undefined,
                dataPublicacao: dataFinal,
                dataTimestamp: timestampFinal,
                ordemOriginal: item.ordemGlobal
              });
            }
          }
        } catch (e) {
          console.error(`Erro ao raspar ano ${itemAno.ano} de Pedranópolis`, e);
        }
      }
    } catch (e) {
      console.error(`Erro ao buscar Pedranópolis na url: ${endpoint.url}`, e);
    }
  }
  return resultados;
}