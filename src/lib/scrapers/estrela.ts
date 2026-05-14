import * as cheerio from 'cheerio';
import { Edital } from '../../types';

export async function buscarEstrela(): Promise<Edital[]> {
  const resultados: Edital[] = [];
  let ordemGlobal = 0;

  // As duas URLs de busca (Apenas a URL base, sem a página)
  const urlsBase = [
    'https://www.pmestrela.sp.gov.br/?pag=T0RNPU9UZz1PVFk9T0RnPU9EWT1OelU9T1RZPU9XUT1PVEk9T0dVPU9UUT1PR1U9WVRBPQ==&palavraChave=Processo%20Seletivo',
    'https://www.pmestrela.sp.gov.br/?pag=T0RNPU9UZz1PVFk9T0RnPU9EWT1OelU9T1RZPU9XUT1PVEk9T0dVPU9UUT1PR1U9WVRBPQ==&palavraChave=Concurso%20P%C3%BAblico'
  ];

  for (const urlBase of urlsBase) {
    // Buscar da página 1 até a 10 de CADA UMA das categorias
    for (let pagina = 1; pagina <= 10; pagina++) {
      try {
        const response = await fetch(`${urlBase}&pg=${pagina}`, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          cache: 'no-store'
        });

        // Se a requisição falhar (ex: página não existe mais), ele simplesmente pula
        if (!response.ok) continue;

        const html = await response.text();
        const $ = cheerio.load(html);

        // O SEGREDO MÁGICO: Busca QUALQUER 'td' cujo ID "comece com" ( ^= ) 'col_titulo_noticia_'
        $('td[id^="col_titulo_noticia_"]').each((_, elemento) => {
          ordemGlobal++;

          // 1. Extração da Data (Lendo o span com a classe sub-data)
          const dataRaw = $(elemento).find('span.sub-data').text().trim(); // Ex: "13/05/2026 - 15:30"
          let dataFormatada = 'sem data';
          let dataTimestamp = 0;

          // Usamos Regex para pinçar só a data, ignorando o horário
          const matchData = dataRaw.match(/(\d{2})\/(\d{2})\/(\d{4})/);
          if (matchData) {
            dataFormatada = matchData[0];
            dataTimestamp = new Date(`${matchData[3]}-${matchData[2]}-${matchData[1]}T00:00:00`).getTime();
          }

          // 2. Extração do Título (Removendo o span da data de dentro do TD)
          const cloneTd = $(elemento).clone(); // Clonamos para não estragar o HTML original
          cloneTd.find('span.sub-data').remove(); // Apagamos a data
          cloneTd.find('br').replaceWith(' '); // Trocamos o <br> por um espaço
          const tituloLimpo = cloneTd.text().replace(/\s+/g, ' ').trim(); // Limpa os espaços mortos

          // 3. Extração do Link
          // Normalmente o link está dentro da TR pai, ou dentro da própria TD.
          // Isso procura qualquer link (<a>) que esteja associado a essa linha da tabela.
          let href = $(elemento).find('a').attr('href') || $(elemento).closest('tr').find('a').attr('href') || '';

          // Ajusta se for um link relativo da prefeitura
          let linkCompleto = '';
          if (href) {
            linkCompleto = href.startsWith('http') ? href : `https://www.pmestrela.sp.gov.br/${href.replace(/^\//, '')}`;
          } else {
            // Caso raríssimo de o link estar camuflado no Javascript, salvamos o link da página em que ele está
            linkCompleto = `${urlBase}&pg=${pagina}`;
          }

          // Se achou um título (o que significa que a TD não era uma célula vazia)
          if (tituloLimpo) {
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