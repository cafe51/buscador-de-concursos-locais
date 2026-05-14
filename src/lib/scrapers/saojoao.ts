import * as cheerio from 'cheerio';
import { Edital } from '../../types';
import { extrairDataDoArquivo } from '../docParser';

export async function buscarSaoJoao(): Promise<Edital[]> {
  const resultados: Edital[] = [];
  let ordemGlobal = 0;

  // Os 4 links base que você mapeou
  const endpoints = [
    { url: 'https://sjduaspontes.sp.gov.br/paginas/portal/concursos/exercicio?id=1' }, // Em Andamento
    { url: 'https://sjduaspontes.sp.gov.br/paginas/portal/concursos/exercicio?id=2' }, // Em Convocação
    { url: 'https://sjduaspontes.sp.gov.br/paginas/portal/concursos/exercicio?id=3' }, // Encerrado
    { url: 'https://sjduaspontes.sp.gov.br/paginas/portal/concursos/exercicio?id=4' }  // Futuros
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint.url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        cache: 'no-store'
      });

      if (!response.ok) continue;

      const html = await response.text();
      const $ = cheerio.load(html);

      const linksAnos: { ano: string; url: string }[] = [];

      // Busca os links que são apenas 4 dígitos numéricos (os Anos)
      $('a').each((_, el) => {
        const textoLink = $(el).text().trim();
        if (/^\d{4}$/.test(textoLink)) {
          const href = $(el).attr('href') || '';
          if (href) {
            const linkCompleto = href.startsWith('http') ? href : `https://sjduaspontes.sp.gov.br${href}`;
            linksAnos.push({ ano: textoLink, url: linkCompleto });
          }
        }
      });

      // Entra em cada ano encontrado
      for (const itemAno of linksAnos) {
        try {
          const resAno = await fetch(itemAno.url, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' });
          if (!resAno.ok) continue;

          const htmlAno = await resAno.text();
          const $ano = cheerio.load(htmlAno);

          const linksPdfs = $ano('div.card-body ul.list.list-icons.list-primary.list-side-borders li a').toArray();

          // Fallback (data do anterior): Começa com 01/01/ANO
          let dataFallback = {
            formatada: `01/01/${itemAno.ano}`,
            timestamp: new Date(`${itemAno.ano}-01-01T00:00:00`).getTime()
          };

          for (const el of linksPdfs) {
            ordemGlobal++;

            const tituloRaw = $ano(el).find('strong').text();
            const tituloLimpo = tituloRaw.replace(/\s+/g, ' ').trim();

            const href = $ano(el).attr('href') || '';
            const linkCompleto = href.startsWith('http') ? href : `https://sjduaspontes.sp.gov.br${href}`;

            // Extrai a data baixando e lendo a página 1 do PDF
            const dataDoArquivo = await extrairDataDoArquivo(linkCompleto);

            // Atualiza o fallback se der sucesso
            if (dataDoArquivo) {
              dataFallback = dataDoArquivo;
            }

            resultados.push({
              cidade: 'São João das Duas Pontes',
              orgao: 'Prefeitura',
              titulo: tituloLimpo,
              link: linkCompleto,
              dataPublicacao: dataDoArquivo ? dataDoArquivo.formatada : dataFallback.formatada,
              dataTimestamp: dataDoArquivo ? dataDoArquivo.timestamp : dataFallback.timestamp,
              ordemOriginal: ordemGlobal
            });
          }
        } catch (e) {
          console.error(`Erro ao raspar ano ${itemAno.ano} de São João das Duas Pontes`, e);
        }
      }
    } catch (e) {
      console.error(`Erro ao buscar São João das Duas Pontes na url: ${endpoint.url}`, e);
    }
  }

  return resultados;
}