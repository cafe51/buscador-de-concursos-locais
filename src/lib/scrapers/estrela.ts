import * as cheerio from 'cheerio';
import { Edital } from '../../types';
import { ehSujeira } from '../filtrosGlobais';

export async function buscarEstrela(): Promise<Edital[]> {
  const resultados: Edital[] = [];
  let ordemGlobal = 0;

  const urlsBase = [
    'https://www.pmestrela.sp.gov.br/?pag=T0RNPU9UZz1PVFk9T0RnPU9EWT1OelU9T1RZPU9XUT1PVEk9T0dVPU9UUT1PR1U9WVRBPQ==&palavraChave=Processo%20Seletivo',
    'https://www.pmestrela.sp.gov.br/?pag=T0RNPU9UZz1PVFk9T0RnPU9EWT1OelU9T1RZPU9XUT1PVEk9T0dVPU9UUT1PR1U9WVRBPQ==&palavraChave=Concurso%20P%C3%BAblico'
  ];

  for (const urlBase of urlsBase) {
    for (let pagina = 1; pagina <= 10; pagina++) {
      try {
        const response = await fetch(`${urlBase}&pg=${pagina}`, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          cache: 'no-store'
        });

        if (!response.ok) continue;

        const html = await response.text();
        const $ = cheerio.load(html);

        $('td[id^="col_titulo_noticia_"]').each((_, elemento) => {
          const dataRaw = $(elemento).find('span.sub-data').text().trim();
          let dataFormatada = 'sem data';
          let dataTimestamp = 0;

          const matchData = dataRaw.match(/(\d{2})\/(\d{2})\/(\d{4})/);
          if (matchData) {
            dataFormatada = matchData[0];
            dataTimestamp = new Date(`${matchData[3]}-${matchData[2]}-${matchData[1]}T00:00:00`).getTime();
          }

          const cloneTd = $(elemento).clone();
          cloneTd.find('span.sub-data').remove();
          cloneTd.find('br').replaceWith(' ');
          const tituloLimpo = cloneTd.text().replace(/\s+/g, ' ').trim();

          // 🛡️ O ESCUDO AQUI: Ignora licitações
          if (ehSujeira(tituloLimpo)) return;

          let href = $(elemento).find('a').attr('href') || $(elemento).closest('tr').find('a').attr('href') || '';
          let linkCompleto = '';
          if (href) {
            linkCompleto = href.startsWith('http') ? href : `https://www.pmestrela.sp.gov.br/${href.replace(/^\//, '')}`;
          } else {
            linkCompleto = `${urlBase}&pg=${pagina}`;
          }

          if (tituloLimpo) {
            ordemGlobal++;
            resultados.push({
              cidade: "Estrela d'Oeste",
              orgao: 'Prefeitura',
              titulo: tituloLimpo,
              link: linkCompleto,
              dataPublicacao: dataFormatada,
              dataTimestamp: dataTimestamp,
              ordemOriginal: ordemGlobal
            });
          }
        });

      } catch (e) {
        console.error(`Erro ao raspar Estrela d'Oeste na URL base, página ${pagina}`, e);
      }
    }
  }
  return resultados;
}