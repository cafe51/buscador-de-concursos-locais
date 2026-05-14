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
      const response = await fetch(endpoint.url, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' });
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

          const headersCards = $ano('.card-header').toArray();

          for (const headerEl of headersCards) {
            const metadado = $ano(headerEl).find('h4.card-title a').text().replace(/\s+/g, ' ').trim();

            const $paiDoCard = $ano(headerEl).parent();
            const linksPdfs = $paiDoCard.find('div.card-body ul.list.list-icons.list-primary.list-side-borders li a').toArray();

            let dataFallback = {
              formatada: `01/01/${itemAno.ano}`,
              timestamp: new Date(`${itemAno.ano}-01-01T00:00:00`).getTime()
            };

            for (const el of linksPdfs) {
              ordemGlobal++;

              const textoLinkInteiro = $ano(el).text().replace(/\s+/g, ' ').trim();
              let tituloLimpo = $ano(el).find('strong').text().replace(/\s+/g, ' ').trim();

              const href = $ano(el).attr('href') || '';
              const linkCompleto = href.startsWith('http') ? href : `https://www.pedranopolis.sp.gov.br${href}`;

              let dataFormatada = 'sem data';
              let dataTimestamp = 0;
              let dataAchadaNoHtml = false;

              // 1. TENTA ACHAR A DATA DIRETAMENTE NO TEXTO DO LINK (Ex: 10/09/2019 ou 10.09.2019)
              const matchDataTexto = textoLinkInteiro.match(/\b(\d{2})[\/\.](\d{2})[\/\.](\d{4})\b/);

              if (matchDataTexto) {
                dataFormatada = `${matchDataTexto[1]}/${matchDataTexto[2]}/${matchDataTexto[3]}`;
                dataTimestamp = new Date(`${matchDataTexto[3]}-${matchDataTexto[2]}-${matchDataTexto[1]}T00:00:00`).getTime();
                dataAchadaNoHtml = true;
              }

              // LIMPEZA DO TÍTULO: Retira "(296 KB)" e ">>> (Publicado em ...)" para o card ficar elegante
              tituloLimpo = tituloLimpo
                .replace(/>>>\s*\(?Publicado em.*?\)?/i, '')
                .replace(/\b\d{2}[\/\.]\d{2}[\/\.]\d{4}\b/g, '') // remove a data solta do titulo
                .trim();

              // Remove hífens sobrando no final (se houver)
              if (tituloLimpo.endsWith('-')) {
                tituloLimpo = tituloLimpo.slice(0, -1).trim();
              }

              if (dataAchadaNoHtml) {
                // Se achou no HTML, NÃO BAIXA O PDF. Apenas atualiza o Fallback!
                dataFallback = { formatada: dataFormatada, timestamp: dataTimestamp };
              } else {
                // Se não achou, vai baixar o PDF
                const dataDoArquivo = await extrairDataDoArquivo(linkCompleto);
                if (dataDoArquivo) {
                  dataFormatada = dataDoArquivo.formatada;
                  dataTimestamp = dataDoArquivo.timestamp;
                  dataFallback = dataDoArquivo;
                } else {
                  // Se também não achou no PDF, usa a data do arquivo anterior
                  dataFormatada = dataFallback.formatada;
                  dataTimestamp = dataFallback.timestamp;
                }
              }

              resultados.push({
                cidade: 'Pedranópolis',
                orgao: 'Prefeitura',
                titulo: tituloLimpo,
                link: linkCompleto,
                metadados: metadado || undefined,
                dataPublicacao: dataFormatada,
                dataTimestamp: dataTimestamp,
                ordemOriginal: ordemGlobal
              });
            }
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