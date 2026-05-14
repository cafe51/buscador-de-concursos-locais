import * as cheerio from 'cheerio';
import { Edital } from '../../types';

export async function buscarMeridiano(): Promise<Edital[]> {
  const resultados: Edital[] = [];
  let ordemGlobal = 0;

  try {
    const urlBase = 'https://meridiano.sp.gov.br/concursos/?ces_tipo=concurso-publico';
    const resBase = await fetch(urlBase, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' });

    if (!resBase.ok) return [];

    const htmlBase = await resBase.text();
    const $base = cheerio.load(htmlBase);

    // MUDANÇA 1: Agora guardamos não apenas o Link, mas também o Ano correspondente a ele
    const linksAnos: { url: string; ano: number }[] = [];

    $base('a.ces-card').each((_, el) => {
      const textoAno = $base(el).find('.ces-text').text().trim();
      const numeroAno = parseInt(textoAno, 10);

      if (!isNaN(numeroAno) && numeroAno >= 2022) {
        const href = $base(el).attr('href');
        if (href) {
          const linkCompleto = href.startsWith('http') ? href : `https://meridiano.sp.gov.br${href}`;
          linksAnos.push({ url: linkCompleto, ano: numeroAno });
        }
      }
    });

    // 2. NÍVEL 2: Entrar na página de cada Ano
    for (const itemAno of linksAnos) {
      try {
        const resAno = await fetch(itemAno.url, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' });
        if (!resAno.ok) continue;

        const htmlAno = await resAno.text();
        const $ano = cheerio.load(htmlAno);

        const concursosDesteAno: { metadado: string, urlDetalhes: string }[] = [];

        $ano('.ces-card-item').each((_, el) => {
          const metadado = $ano(el).find('h3.ces-item-title').text().replace(/\s+/g, ' ').trim();
          const href = $ano(el).find('a.ces-btn-primary').attr('href') || '';

          if (href && metadado) {
            const urlDetalhes = href.startsWith('http') ? href : `https://meridiano.sp.gov.br${href}`;
            concursosDesteAno.push({ metadado, urlDetalhes });
          }
        });

        // 3. NÍVEL 3: Entrar em "Ver Detalhes"
        for (const concurso of concursosDesteAno) {
          try {
            const resDet = await fetch(concurso.urlDetalhes, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' });
            if (!resDet.ok) continue;

            const htmlDet = await resDet.text();
            const $det = cheerio.load(htmlDet);

            $det('#ces-arquivos .ces-timeline-item').each((_, el) => {
              ordemGlobal++;

              const dataRaw = $det(el).find('.ces-timeline-date').text().trim();
              const titulo = $det(el).find('.ces-timeline-title').text().replace(/\s+/g, ' ').trim();
              const href = $det(el).find('a.ces-timeline-link').attr('href') || '';

              if (!href) return;

              const linkCompleto = href.startsWith('http') ? href : `https://meridiano.sp.gov.br${href}`;

              let dataFormatada = 'sem data';
              let dataTimestamp = 0;

              // MUDANÇA 2: A regra de exceção para o ano de 2022
              if (itemAno.ano === 2022) {
                dataFormatada = '01/03/2022';
                dataTimestamp = new Date('2022-03-01T00:00:00').getTime();
              } else {
                // Comportamento normal para os outros anos
                const matchData = dataRaw.match(/(\d{2})\/(\d{2})\/(\d{4})/);
                if (matchData) {
                  dataFormatada = matchData[0];
                  dataTimestamp = new Date(`${matchData[3]}-${matchData[2]}-${matchData[1]}T00:00:00`).getTime();
                }
              }

              resultados.push({
                cidade: 'Meridiano',
                orgao: 'Prefeitura',
                titulo: titulo,
                link: linkCompleto,
                metadados: concurso.metadado,
                dataPublicacao: dataFormatada,
                dataTimestamp: dataTimestamp,
                ordemOriginal: ordemGlobal
              });
            });

          } catch (e) {
            console.error(`Erro ao acessar detalhes do concurso: ${concurso.metadado}`, e);
          }
        }

      } catch (e) {
        console.error(`Erro ao acessar página de ano: ${itemAno.url}`, e);
      }
    }

  } catch (e) {
    console.error('Erro geral ao buscar Meridiano', e);
  }

  return resultados;
}