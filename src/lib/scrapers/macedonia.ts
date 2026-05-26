// src/lib/scrapers/macedonia.ts
import * as cheerio from 'cheerio';
import { Edital } from '../../types';
import { ehSujeira, extrairIdConcurso } from '../filtrosGlobais';
import { fetchHtml, extrairData } from './utils';

export async function buscarMacedonia(): Promise<Edital[]> {
  const resultados: Edital[] = [];

  const anoAtual = new Date().getFullYear();
  const anosPermitidos = [];
  for (let y = 2020; y <= anoAtual; y++) {
    anosPermitidos.push(y);
  }

  const regexAnos = anosPermitidos.join('|');
  const regexDataPdf = new RegExp(`(\\d{2})(\\d{2})(${regexAnos})`);

  let ordemGlobal = 0;
  let encontrouAlvoDeParada = false;

  const itensBrutos: { titulo: string, linkCompleto: string, ordemOriginal: number }[] = [];

  // ==============================================================
  // 🚀 FASE 1: PAGINAÇÃO EM LOTES (Busca as páginas de 5 em 5)
  // ==============================================================
  for (let loteInicio = 1; loteInicio <= 30; loteInicio += 5) {
    if (encontrouAlvoDeParada) break;

    const promessasPaginas = [];

    // Dispara 5 downloads simultâneos
    for (let pagina = loteInicio; pagina < loteInicio + 5 && pagina <= 30; pagina++) {
      promessasPaginas.push(
        fetchHtml(`https://www.macedonia.sp.gov.br/servicos/concursos?&pagina=${pagina}`)
          .then((res) => ({ pagina, html: res.ok ? res.html : '' }))
          .catch(() => ({ pagina, html: '' }))
      );
    }

    const paginasBaixadas = await Promise.all(promessasPaginas);

    // Reordena para garantir que a ordem global dos itens não se perca!
    paginasBaixadas.sort((a, b) => a.pagina - b.pagina);

    for (const pag of paginasBaixadas) {
      if (!pag.html || encontrouAlvoDeParada) continue;

      const $ = cheerio.load(pag.html);
      const links = $('h3 a').toArray();

      if (links.length === 0) {
        encontrouAlvoDeParada = true;
        break;
      }

      for (const elemento of links) {
        const titulo = $(elemento).text().trim();
        const href = $(elemento).attr('href') || '';
        const linkCompleto = href.startsWith('http') ? href : `https://www.macedonia.sp.gov.br${href}`;

        const ehOLinkAlvo = linkCompleto.includes('/edital-de-abertura-concurso-publico-n0012022--fiscal-municipal-de-tributos6');

        if (ehSujeira(titulo, [], linkCompleto)) {
          if (ehOLinkAlvo) { encontrouAlvoDeParada = true; break; }
          continue;
        }

        ordemGlobal++;

        // Em vez de processar agora, guardamos no array para fazer em lote!
        itensBrutos.push({ titulo, linkCompleto, ordemOriginal: ordemGlobal });

        if (ehOLinkAlvo) {
          encontrouAlvoDeParada = true;
          break;
        }
      }
    }
  }

  // ==============================================================
  // 🚀 FASE 2: PROCESSAMENTO PARALELO DE DADOS FALTANTES
  // ==============================================================
  const TAMANHO_LOTE = 15;

  for (let i = 0; i < itensBrutos.length; i += TAMANHO_LOTE) {
    const lote = itensBrutos.slice(i, i + TAMANHO_LOTE);

    await Promise.all(lote.map(async (item) => {
      let titulo = item.titulo;
      let dataFormatada = 'sem data';
      let dataTimestamp = 0;
      let dataEncontrada = false;

      // 1. Tentativa de Data no Título
      const dataExtraida = extrairData(titulo);
      if (dataExtraida) {
        dataFormatada = dataExtraida.dataFormatada;
        dataTimestamp = dataExtraida.dataTimestamp;
        dataEncontrada = true;

        const matchTitle = titulo.match(/\b\d{1,2}[\.\/\-]\d{2}[\.\/\-]\d{4}\b/);
        if (matchTitle) {
          titulo = titulo.replace(matchTitle[0], '').trim();
        }
      } else {
        // Fallback para datas com anos de 2 dígitos que extrairData não pega
        const matchTitle2 = titulo.match(/\b(\d{2})[\.\/](\d{2})[\.\/](\d{2})\b/);
        if (matchTitle2) {
          const dia = matchTitle2[1];
          const mes = matchTitle2[2];
          const anoData = `20${matchTitle2[3]}`;

          dataFormatada = `${dia}/${mes}/${anoData}`;
          dataTimestamp = new Date(`${anoData}-${mes}-${dia}T00:00:00`).getTime();
          dataEncontrada = true;

          titulo = titulo.replace(matchTitle2[0], '').trim();
        }
      }

      // 2. Tentativa de Chave de Concurso
      let idConcurso = extrairIdConcurso(titulo, '', true, false);

      // 3. 🚑 MISSÃO DE RESGATE (Se a data falhou OU o IdConcurso falhou)
      // Fazemos UM único fetch para buscar as duas coisas ao mesmo tempo!
      if (!dataEncontrada || !idConcurso) {
        try {
          const resPage = await fetchHtml(item.linkCompleto, true); // Macedonia usa force-cache no resgate
          if (resPage.ok) {
            const $page = cheerio.load(resPage.html);

            // Resgate da Data
            if (!dataEncontrada) {
              const pdfLinks = $page('a[href$=".pdf"]').toArray();
              for (const pdfEl of pdfLinks) {
                const pdfHref = $page(pdfEl).attr('href') || '';
                const matchPdf = pdfHref.match(regexDataPdf);

                if (matchPdf) {
                  const dia = parseInt(matchPdf[1], 10);
                  const mes = parseInt(matchPdf[2], 10);
                  const anoData = matchPdf[3];

                  if (dia >= 1 && dia <= 31 && mes >= 1 && mes <= 12) {
                    const diaF = dia.toString().padStart(2, '0');
                    const mesF = mes.toString().padStart(2, '0');
                    dataFormatada = `${diaF}/${mesF}/${anoData}`;
                    dataTimestamp = new Date(`${anoData}-${mesF}-${diaF}T00:00:00`).getTime();
                    dataEncontrada = true;
                    break;
                  }
                }
              }
            }

            // Resgate do ID Concurso
            if (!idConcurso) {
              $page('script, style, nav, header, footer').remove();
              $page('p, div, br, li, span, strong, b').append(' ');
              const textoDaNoticia = $page('body').text().replace(/\s+/g, ' ').trim();
              idConcurso = extrairIdConcurso(textoDaNoticia, '', false, true);
            }
          }
        } catch (e) {
          // Ignora erro de rede no PDF e segue
        }
      }

      let anoConcurso: number | undefined = undefined;
      if (idConcurso) {
        const matchAno = idConcurso.match(/\/(\d{4})\b/);
        if (matchAno) anoConcurso = parseInt(matchAno[1], 10);
      }

      resultados.push({
        cidade: 'Macedônia',
        orgao: 'Prefeitura',
        titulo: titulo,
        concurso: idConcurso,
        ano: anoConcurso,
        link: item.linkCompleto,
        dataPublicacao: dataFormatada,
        dataTimestamp: dataTimestamp,
        ordemOriginal: item.ordemOriginal
      });
    }));
  }

  return resultados;
}