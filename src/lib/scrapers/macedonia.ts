import * as cheerio from 'cheerio';
import { Edital } from '../../types';
import { ehSujeira, extrairIdConcurso } from '../filtrosGlobais';

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

  // Aumentamos o limite de páginas para garantir folga (o loop vai abortar sozinho bem antes)
  for (let pagina = 1; pagina <= 30; pagina++) {
    if (encontrouAlvoDeParada) break;

    try {
      const response = await fetch(`https://www.macedonia.sp.gov.br/servicos/concursos?&pagina=${pagina}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        cache: 'no-store'
      });

      if (!response.ok) continue;

      const html = await response.text();
      const $ = cheerio.load(html);
      const links = $('h3 a').toArray();

      if (links.length === 0) {
        break; // Se a página vier vazia, a paginação da prefeitura acabou.
      }

      for (const elemento of links) {
        let titulo = $(elemento).text().trim();
        const href = $(elemento).attr('href') || '';
        const linkCompleto = href.startsWith('http') ? href : `https://www.macedonia.sp.gov.br${href}`;

        // 🛑 A CONDIÇÃO DE PARADA (Alvo estabelecido por você)
        const ehOLinkAlvo = linkCompleto.includes('/edital-de-abertura-concurso-publico-n0012022--fiscal-municipal-de-tributos6');

        if (ehSujeira(titulo, [], linkCompleto)) {
          if (ehOLinkAlvo) { encontrouAlvoDeParada = true; break; }
          continue;
        }

        ordemGlobal++;

        let dataFormatada = 'sem data';
        let dataTimestamp = 0;
        let dataEncontrada = false;

        // Tenta achar a data no título (Ex: 09.08.2023 ou 09/08/2023)
        const matchTitle = titulo.match(/\b(\d{2})[\.\/](\d{2})[\.\/](\d{4}|\d{2})\b/);

        if (matchTitle) {
          const dia = matchTitle[1];
          const mes = matchTitle[2];
          const anoStr = matchTitle[3];
          const anoData = anoStr.length === 2 ? `20${anoStr}` : anoStr;

          dataFormatada = `${dia}/${mes}/${anoData}`;
          dataTimestamp = new Date(`${anoData}-${mes}-${dia}T00:00:00`).getTime();
          dataEncontrada = true;

          // Limpeza do Título: Retira a data do nome para ficar mais elegante no Card
          titulo = titulo.replace(/\b\d{2}[\.\/]\d{2}[\.\/](?:\d{4}|\d{2})\b/g, '').trim();
        }

        // Se não achou a data no título, baixa o PDF e extrai de dentro dele!
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
          } catch (e) {
            // Ignora erro de rede no PDF e segue
          }
        }

        // ==============================================================
        // 🗂️ O AGRUPAMENTO: Extração da Chave do Concurso
        // ==============================================================
        let idConcurso = extrairIdConcurso(titulo, '', true, false);

        // 🚑 MISSÃO DE RESGATE HTML: Se o título for só "Convocação 03", acessa a página e lê o texto
        if (!idConcurso) {
          try {
            const resNoticia = await fetch(linkCompleto, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'force-cache' });
            if (resNoticia.ok) {
              const htmlNoticia = await resNoticia.text();
              const $noticia = cheerio.load(htmlNoticia);

              $noticia('script, style, nav, header, footer').remove();
              $noticia('p, div, br, li, span, strong, b').append(' ');

              const textoDaNoticia = $noticia('body').text().replace(/\s+/g, ' ').trim();

              // No resgate, aplicamos o Strict Mode para garantir a exatidão
              idConcurso = extrairIdConcurso(textoDaNoticia, '', false, true);
            }
          } catch (e) { }
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
          concurso: idConcurso, // <--- INJETADO
          ano: anoConcurso,     // <--- INJETADO
          link: linkCompleto,
          dataPublicacao: dataFormatada,
          dataTimestamp: dataTimestamp,
          ordemOriginal: ordemGlobal
        });

        // 🛑 Ativa o break se for o alvo! (Ele para a execução de todos os links que vierem abaixo deste)
        if (ehOLinkAlvo) {
          encontrouAlvoDeParada = true;
          break;
        }
      }
    } catch (e) {
      console.error(`Erro ao buscar Macedônia na página ${pagina}`, e);
    }
  }

  return resultados;
}