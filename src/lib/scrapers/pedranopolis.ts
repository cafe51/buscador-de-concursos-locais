import * as cheerio from 'cheerio';
import { Edital } from '../../types';
import { extrairDataDoArquivo } from '../docParser';

export async function buscarPedranopolis(): Promise<Edital[]> {
  const resultados: Edital[] = [];
  let ordemGlobal = 0;

  const endpoints = [
    { url: 'https://www.pedranopolis.sp.gov.br/paginas/portal/concursos/exercicio?id=1' },
    { url: 'https://www.pedranopolis.sp.gov.br/paginas/portal/concursos/exercicio?id=2' },
    { url: 'https://www.pedranopolis.sp.gov.br/paginas/portal/concursos/exercicio?id=3' }
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

      $('a').each((_, el) => {
        const textoLink = $(el).text().trim();
        if (/^\d{4}$/.test(textoLink)) {
          const href = $(el).attr('href') || '';
          if (href) {
            const linkCompleto = href.startsWith('http') ? href : `https://www.pedranopolis.sp.gov.br${href}`;
            linksAnos.push({ ano: textoLink, url: linkCompleto });
          }
        }
      });

      for (const itemAno of linksAnos) {
        try {
          const resAno = await fetch(itemAno.url, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' });
          if (!resAno.ok) continue;

          const htmlAno = await resAno.text();
          const $ano = cheerio.load(htmlAno);

          const linksPdfs = $ano('div.card-body ul.list.list-icons.list-primary.list-side-borders li a').toArray();

          // AQUI ESTÁ A LÓGICA DO ITEM ANTERIOR: 
          // Inicia usando 01/01/ANO provisório. Se o primeiro PDF falhar, usa isso.
          // Se o primeiro PDF for sucesso, essa variável é atualizada para os próximos!
          let dataFallback = {
            formatada: `01/01/${itemAno.ano}`,
            timestamp: new Date(`${itemAno.ano}-01-01T00:00:00`).getTime()
          };

          // Usamos 'for of' porque PRECISAR processar de forma sequencial para pegar a data do anterior
          for (const el of linksPdfs) {
            ordemGlobal++;

            const tituloRaw = $ano(el).find('strong').text();
            const tituloLimpo = tituloRaw.replace(/\s+/g, ' ').trim();

            const href = $ano(el).attr('href') || '';
            const linkCompleto = href.startsWith('http') ? href : `https://www.pedranopolis.sp.gov.br${href}`;

            // Faz a mágica! Baixa a primeira página do arquivo e tenta achar "8 de novembro de 2021"
            const dataDoArquivo = await extrairDataDoArquivo(linkCompleto);

            if (dataDoArquivo) {
              // Deu certo! Atualizamos a variável de fallback. 
              // Agora, se o PRÓXIMO link for uma imagem pura, ele vai usar a data deste que acabou de dar certo!
              dataFallback = dataDoArquivo;
            }

            resultados.push({
              cidade: 'Pedranópolis',
              orgao: 'Prefeitura',
              titulo: tituloLimpo,
              link: linkCompleto,
              dataPublicacao: dataDoArquivo ? dataDoArquivo.formatada : dataFallback.formatada,
              dataTimestamp: dataDoArquivo ? dataDoArquivo.timestamp : dataFallback.timestamp,
              ordemOriginal: ordemGlobal
            });
          }
        } catch (e) {
          console.error(`Erro ao raspar ano ${itemAno.ano} de Pedranópolis`, e);
        }
      }
    } catch (e) {
      console.error(`Erro ao buscar Pedranópolis na url: ${endpoint.url}`, e);
    }
  }

  return resultados;
}