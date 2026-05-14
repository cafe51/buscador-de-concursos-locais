import * as cheerio from 'cheerio';
import { Edital } from '../../types';

export async function buscarVotuporanga(): Promise<Edital[]> {
  const resultados: Edital[] = [];
  let ordemGlobal = 0;

  const endpoints = [
    { status: 'Aberto', url: 'https://www.votuporanga.sp.gov.br/portal/editais/1/3/0/0/0/0/0/0/Aberto/numero-ano-processo-decrescente/0' },
    { status: 'Em Andamento', url: 'https://www.votuporanga.sp.gov.br/portal/editais/1/3/0/0/0/0/0/0/Em%20Andamento/numero-ano-processo-decrescente/0' },
    { status: 'Em Julgamento', url: 'https://www.votuporanga.sp.gov.br/portal/editais/1/3/0/0/0/0/0/0/Em%20Julgamento/numero-ano-processo-decrescente/0' },
    { status: 'Homologado', url: 'https://www.votuporanga.sp.gov.br/portal/editais/1/3/0/0/0/0/0/0/Homologado/numero-ano-processo-decrescente/0' }
  ];

  for (const item of endpoints) {
    try {
      const response = await fetch(item.url, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' });
      if (!response.ok) continue;

      const html = await response.text();
      const $ = cheerio.load(html);

      $('div.ed_edital').each((_, elemento) => {
        ordemGlobal++;

        const titulo = $(elemento).find('.ed_titulo_edital').text().trim();
        const descricao = $(elemento).find('.ed_descricao_edital').text().trim();
        const href = $(elemento).find('a').first().attr('href') || '';
        const linkCompleto = href.startsWith('http') ? href : `https://www.votuporanga.sp.gov.br${href}`;

        let processoInfo = $(elemento).find('.ed_area_info_numero_processo').text().replace(/\s+/g, ' ').trim();
        processoInfo = processoInfo.replace('Nº Processo:', 'Processo nº ');

        const dataRaw = $(elemento).find('.ed_cont_postagem_edital span.sw_lato').text().trim();
        let dataTimestamp = 0;
        let dataFormatada = 'sem data';

        const matchData = dataRaw.match(/(\d{2})\/(\d{2})\/(\d{4})/);
        if (matchData) {
          dataFormatada = matchData[0];
          dataTimestamp = new Date(`${matchData[3]}-${matchData[2]}-${matchData[1]}T00:00:00`).getTime();
        }

        resultados.push({
          cidade: 'Votuporanga',
          orgao: 'Prefeitura',
          titulo: titulo,
          descricao: descricao || undefined,
          link: linkCompleto,
          metadados: processoInfo || undefined, // Removeu o fallback "Edital", se vier vazio não renderiza
          statusGeral: item.status,
          dataPublicacao: dataFormatada,
          dataTimestamp: dataTimestamp,
          ordemOriginal: ordemGlobal
        });
      });
    } catch (e) {
      console.error(`Erro ao buscar Votuporanga (${item.status})`, e);
    }
  }
  return resultados;
}