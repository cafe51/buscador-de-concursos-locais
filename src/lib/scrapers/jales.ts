import * as cheerio from 'cheerio';
import { Edital } from '../../types';
import { ehSujeira } from '../filtrosGlobais';

export async function buscarJales(): Promise<Edital[]> {
  const resultados: Edital[] = [];
  let ordemGlobal = 0;

  const linksProcessados = new Set<string>();

  for (let pagina = 1; pagina <= 2; pagina++) {
    try {
      const urlLista = `https://www.jales.sp.gov.br/cidadao/concursos-e-processos-seletivos?&pagina=${pagina}`;
      const res = await fetch(urlLista, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' });

      if (!res.ok) continue;

      const html = await res.text();
      const $ = cheerio.load(html);

      const concursosPage: { tituloConcurso: string, urlInterna: string }[] = [];

      $('a.list-item__link').each((_, el) => {
        const tituloConcurso = $(el).text().replace(/\s+/g, ' ').trim();
        const href = $(el).attr('href') || '';

        if (href) {
          const urlInterna = href.startsWith('http') ? href : `https://www.jales.sp.gov.br${href}`;
          concursosPage.push({ tituloConcurso, urlInterna });
        }
      });

      for (const concurso of concursosPage) {
        // 🛡️ O ESCUDO AQUI: Se o concurso principal for "Pregão 01/2024", pula ele todo!
        if (ehSujeira(concurso.tituloConcurso)) continue;

        try {
          const resInner = await fetch(concurso.urlInterna, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' });
          if (!resInner.ok) continue;

          const htmlInner = await resInner.text();
          const $inner = cheerio.load(htmlInner);

          const $areaConteudo = $inner('main, article, .content, .container').first();
          const $escopo = $areaConteudo.length ? $areaConteudo : $inner('body');

          $escopo.find('a').each((_, el) => {
            const fileHref = $inner(el).attr('href') || '';
            if (!fileHref || fileHref.startsWith('#') || fileHref.includes('javascript:')) return;

            let textoLink = $inner(el).text().replace(/\s+/g, ' ').trim();
            textoLink = textoLink.replace(/^[\d\/\.\-\s]+/, '').trim();

            let tituloArquivo = textoLink;
            const palavrasGenericas = ['download', 'ver', 'anexo', 'clique aqui', 'acessar'];

            if (!tituloArquivo || palavrasGenericas.includes(tituloArquivo.toLowerCase())) {
              let textoPai = $inner(el).parent().text().replace(/\s+/g, ' ').trim();
              tituloArquivo = textoPai.replace(/^[\d\/\.\-\s]+/, '').trim();
            }

            if (!tituloArquivo || palavrasGenericas.includes(tituloArquivo.toLowerCase())) {
              const attrTitle = $inner(el).attr('title') || '';
              if (attrTitle.includes(' ') && attrTitle.length > 5) {
                tituloArquivo = attrTitle;
              }
            }

            tituloArquivo = tituloArquivo.replace(/^[\d\/\.\-\s]+/, '').trim();
            if (tituloArquivo.startsWith('-')) {
              tituloArquivo = tituloArquivo.substring(1).trim();
            }
            if (tituloArquivo.length < 3) return;

            // 🛡️ O ESCUDO AQUI TAMBÉM: Para anexos individuais que fujam à regra
            if (ehSujeira(tituloArquivo)) return;

            const textoPaiData = $inner(el).parent().text().replace(/\s+/g, ' ').trim();
            const matchData = textoPaiData.match(/(\d{2})\/(\d{2})\/(\d{4})/);

            if (matchData) {
              const linkCompleto = fileHref.startsWith('http') ? fileHref : `https://www.jales.sp.gov.br${fileHref}`;

              if (linksProcessados.has(linkCompleto)) return;
              linksProcessados.add(linkCompleto);

              const dataFormatada = matchData[0];
              const dataTimestamp = new Date(`${matchData[3]}-${matchData[2]}-${matchData[1]}T00:00:00`).getTime();

              ordemGlobal++;

              resultados.push({
                cidade: 'Jales',
                orgao: 'Prefeitura',
                titulo: tituloArquivo,
                // 💡 ATUALIZADO: Usando Colchetes [] para adequar ao Array de Metadados
                metadados: concurso.tituloConcurso ? [concurso.tituloConcurso] : undefined,
                link: linkCompleto,
                dataPublicacao: dataFormatada,
                dataTimestamp: dataTimestamp,
                ordemOriginal: ordemGlobal
              });
            }
          });

        } catch (e) {
          console.error(`Erro ao raspar a página interna: ${concurso.tituloConcurso}`, e);
        }
      }

    } catch (e) {
      console.error(`Erro ao buscar Jales na página ${pagina}`, e);
    }
  }
  return resultados;
}