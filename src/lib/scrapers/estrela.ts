import * as cheerio from 'cheerio';
import { Edital } from '../../types';
import { ehSujeira, extrairIdConcurso } from '../filtrosGlobais';

export async function buscarEstrela(): Promise<Edital[]> {
  const resultados: Edital[] = [];
  let ordemGlobal = 0;

  const urlsBase = [
    'https://www.pmestrela.sp.gov.br/?pag=T0RNPU9UZz1PVFk9T0RnPU9EWT1OelU9T1RZPU9XUT1PVEk9T0dVPU9UUT1PR1U9WVRBPQ==&palavraChave=Processo%20Seletivo',
    'https://www.pmestrela.sp.gov.br/?pag=T0RNPU9UZz1PVFk9T0RnPU9EWT1OelU9T1RZPU9XUT1PVEk9T0dVPU9UUT1PR1U9WVRBPQ==&palavraChave=Concurso%20P%C3%BAblico'
  ];

  for (const urlBase of urlsBase) {
    let chegouNoFim = false; // O nosso Freio Automático

    // Processa em LOTES de 10 páginas por vez
    for (let loteInicio = 1; loteInicio <= 40; loteInicio += 10) {
      if (chegouNoFim) break;

      const promessas = [];

      // Dispara 10 downloads simultâneos
      for (let pagina = loteInicio; pagina < loteInicio + 10 && pagina <= 40; pagina++) {
        promessas.push(
          fetch(`${urlBase}&pg=${pagina}`, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' })
            .then(async (res) => {
              if (!res.ok) return { pagina, html: '' };
              return { pagina, html: await res.text() };
            })
            .catch(() => ({ pagina, html: '' }))
        );
      }

      // Espera todas as 10 páginas do lote atual baixarem
      const paginasBaixadas = await Promise.all(promessas);

      // ORDENAÇÃO: Como a página 5 pode baixar antes da 2, precisamos reordenar o array 
      // pelo número da página antes de raspar. Assim a nossa ordemGlobal não embaralha os cards!
      paginasBaixadas.sort((a, b) => a.pagina - b.pagina);

      for (const pag of paginasBaixadas) {
        if (!pag.html) continue;

        const $ = cheerio.load(pag.html);
        const itensTabela = $('td[id^="col_titulo_noticia_"]');

        // Se a tabela vier vazia, significa que a paginação da prefeitura acabou!
        // Aciona o freio e quebra o loop
        if (itensTabela.length === 0) {
          chegouNoFim = true;
          break;
        }

        itensTabela.each((_, elemento) => {
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

          // 🛡️ O ESCUDO
          if (ehSujeira(tituloLimpo)) return;

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

            const idConcurso = extrairIdConcurso(tituloLimpo, '');
            let anoConcurso: number | undefined = undefined;

            if (idConcurso) {
              const matchAno = idConcurso.match(/\/(\d{4})\b/);
              if (matchAno) anoConcurso = parseInt(matchAno[1], 10);
            }

            resultados.push({
              cidade: "Estrela d'Oeste",
              orgao: 'Prefeitura',
              titulo: tituloLimpo,
              concurso: idConcurso,
              ano: anoConcurso,
              link: linkCompleto,
              dataPublicacao: dataFormatada,
              dataTimestamp: dataTimestamp,
              ordemOriginal: ordemGlobal
            });
          }
        });
      }
    }
  }

  return resultados;
}