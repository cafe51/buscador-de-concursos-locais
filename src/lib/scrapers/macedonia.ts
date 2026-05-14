import * as cheerio from 'cheerio';
import { Edital } from '../../types';

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

  for (let pagina = 1; pagina <= 2; pagina++) {
    try {
      const response = await fetch(`https://www.macedonia.sp.gov.br/servicos/concursos?&pagina=${pagina}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        cache: 'no-store'
      });

      if (!response.ok) continue;

      const html = await response.text();
      const $ = cheerio.load(html);
      const links = $('h3 a').toArray();

      for (const elemento of links) {
        ordemGlobal++;

        const titulo = $(elemento).text().trim();
        const href = $(elemento).attr('href') || '';
        const linkCompleto = href.startsWith('http') ? href : `https://www.macedonia.sp.gov.br${href}`;

        let dataFormatada = 'sem data';
        let dataTimestamp = 0;
        let dataEncontrada = false;

        const matchTitle = titulo.match(/\b(\d{2})[\.\/](\d{2})[\.\/](\d{4}|\d{2})\b/);

        if (matchTitle) {
          const dia = matchTitle[1];
          const mes = matchTitle[2];
          const anoStr = matchTitle[3];
          const ano = anoStr.length === 2 ? `20${anoStr}` : anoStr;

          dataFormatada = `${dia}/${mes}/${ano}`;
          dataTimestamp = new Date(`${ano}-${mes}-${dia}T00:00:00`).getTime();
          dataEncontrada = true;
        }

        if (!dataEncontrada) {
          try {
            const resPage = await fetch(linkCompleto, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'force-cache' });
            if (resPage.ok) {
              const htmlPage = await resPage.text();
              const $page = cheerio.load(htmlPage);

              const pdfLinks = $page('a[href$=".pdf"]').toArray();

              for (const pdfEl of pdfLinks) {
                const pdfHref = $page(pdfEl).attr('href') || '';
                const matchPdf = pdfHref.match(regexDataPdf);

                if (matchPdf) {
                  const dia = parseInt(matchPdf[1], 10);
                  const mes = parseInt(matchPdf[2], 10);
                  const ano = matchPdf[3];

                  if (dia >= 1 && dia <= 31 && mes >= 1 && mes <= 12) {
                    const diaF = dia.toString().padStart(2, '0');
                    const mesF = mes.toString().padStart(2, '0');

                    dataFormatada = `${diaF}/${mesF}/${ano}`;
                    dataTimestamp = new Date(`${ano}-${mesF}-${diaF}T00:00:00`).getTime();
                    dataEncontrada = true;
                    break;
                  }
                }
              }
            }
          } catch (e) {
            // Ignora e segue
          }
        }

        // Objecto enxuto: TypeScript sabe que 'descricao' e 'metadados' são undefined
        resultados.push({
          cidade: 'Macedônia',
          orgao: 'Prefeitura',
          titulo: titulo,
          link: linkCompleto,
          dataPublicacao: dataFormatada,
          dataTimestamp: dataTimestamp,
          ordemOriginal: ordemGlobal
        });
      }
    } catch (e) {
      console.error(`Erro ao buscar Macedônia na página ${pagina}`, e);
    }
  }

  return resultados;
}