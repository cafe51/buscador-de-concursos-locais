import * as cheerio from 'cheerio';
import { Edital } from '../../types';
import { ehSujeira, extrairIdConcurso } from '../filtrosGlobais';

export async function buscarEstrela(): Promise<Edital[]> {
  const resultados: Edital[] = [];
  let ordemGlobal = 0;

  const urlBase = 'https://www.pmestrela.sp.gov.br/?pag=T0RNPU9UZz1PVFk9T0RnPU9EWT1OelU9T1RZPU9XUT1PVEk9T0dVPU9UUT1PR1U9WVRBPQ==&palavraChave=Concurso%20P%C3%BAblico';

  let chegouNoFim = false;
  const LIMITE_DATA_TIMESTAMP = new Date('2019-09-13T00:00:00').getTime();

  // 🚀 LOTE AUMENTADO: Pede 20 páginas de uma vez só!
  for (let loteInicio = 1; ; loteInicio += 20) {
    if (chegouNoFim) break;

    const promessas = [];

    for (let pagina = loteInicio; pagina < loteInicio + 20; pagina++) {
      promessas.push(
        fetch(`${urlBase}&pg=${pagina}`, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' })
          .then(async (res) => {
            if (!res.ok) return { pagina, html: '' };
            return { pagina, html: await res.text() };
          })
          .catch(() => ({ pagina, html: '' }))
      );
    }

    const paginasBaixadas = await Promise.all(promessas);
    paginasBaixadas.sort((a, b) => a.pagina - b.pagina);

    for (const pag of paginasBaixadas) {
      if (!pag.html) continue;
      if (chegouNoFim) break;

      const $ = cheerio.load(pag.html);
      const elementosTabela = $('td[id^="col_titulo_noticia_"]').toArray();

      if (elementosTabela.length === 0) {
        chegouNoFim = true;
        break;
      }

      // Prepara os itens da página atual para serem processados SIMULTANEAMENTE
      const itensDestaPagina: any[] = [];

      for (const elemento of elementosTabela) {
        const dataRaw = $(elemento).find('span.sub-data').text().trim();
        let dataFormatada = 'sem data';
        let dataTimestamp = 0;

        const matchData = dataRaw.match(/(\d{2})\/(\d{2})\/(\d{4})/);
        if (matchData) {
          dataFormatada = matchData[0];
          dataTimestamp = new Date(`${matchData[3]}-${matchData[2]}-${matchData[1]}T00:00:00`).getTime();
        }

        if (dataTimestamp > 0 && dataTimestamp < LIMITE_DATA_TIMESTAMP) {
          chegouNoFim = true;
          break;
        }

        const cloneTd = $(elemento).clone();
        cloneTd.find('span.sub-data').remove();
        cloneTd.find('br').replaceWith(' ');
        const tituloLimpo = cloneTd.text().replace(/\s+/g, ' ').trim();

        if (ehSujeira(tituloLimpo)) continue;

        const linkData = $(elemento).closest('tr').attr('data-linknoticia');
        let linkCompleto = '';

        if (linkData) {
          const urlLimpa = linkData.startsWith('/') ? linkData.substring(1) : linkData;
          linkCompleto = `https://www.pmestrela.sp.gov.br/${urlLimpa}`;
        } else {
          linkCompleto = `${urlBase}&pg=${pag.pagina}`;
        }

        if (tituloLimpo) {
          ordemGlobal++;
          const idConcursoInicial = extrairIdConcurso(tituloLimpo, '', true, false);

          // Guarda no array temporário para paralelizar depois
          itensDestaPagina.push({
            tituloLimpo,
            linkCompleto,
            dataFormatada,
            dataTimestamp,
            ordemGlobal,
            idConcursoInicial
          });
        }
      }

      // ⚡ O TURBO: Processa todos os resgates de HTML desta página ao mesmo tempo!
      await Promise.all(itensDestaPagina.map(async (item) => {
        let idConcurso = item.idConcursoInicial;
        let descartarCard = false;

        if (!idConcurso) {
          try {
            const resNoticia = await fetch(item.linkCompleto, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'force-cache' });

            if (resNoticia.ok) {
              const htmlNoticia = await resNoticia.text();
              const $noticia = cheerio.load(htmlNoticia);

              let $conteudo = $noticia('.WordSection1');
              if ($conteudo.length === 0) $conteudo = $noticia('#cont-noticia');
              if ($conteudo.length === 0) $conteudo = $noticia('body');

              $conteudo.find('script, style, nav, header, footer').remove();
              $conteudo.find('p, div, br, li, span, strong, b').append(' ');

              const textoDaNoticia = $conteudo.text().replace(/\s+/g, ' ').trim();

              if (textoDaNoticia.toLowerCase().includes('processo seletivo simplificado')) {
                descartarCard = true;
              } else {
                idConcurso = extrairIdConcurso(textoDaNoticia, '', false, true);
              }
            }
          } catch (e) {
            // Falha de rede, ignora
          }
        }

        if (descartarCard) return; // Sai do map()

        let anoConcurso: number | undefined = undefined;
        if (idConcurso) {
          const matchAno = idConcurso.match(/\/(\d{4})\b/);
          if (matchAno) anoConcurso = parseInt(matchAno[1], 10);
        }

        // 🛑 REGRA DE 2018: Se o concurso for de 2018 (ou mais antigo), aborta o card!
        if (anoConcurso && anoConcurso <= 2018) {
          return; // Sai do map() e não salva nos resultados
        }

        resultados.push({
          cidade: "Estrela d'Oeste",
          orgao: 'Prefeitura',
          titulo: item.tituloLimpo,
          concurso: idConcurso,
          ano: anoConcurso,
          link: item.linkCompleto,
          dataPublicacao: item.dataFormatada,
          dataTimestamp: item.dataTimestamp,
          ordemOriginal: item.ordemGlobal
        });
      }));

    }
  }

  return resultados;
}