import * as cheerio from 'cheerio';
import { Edital } from '../../types';

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

            // --- A NOVA LÓGICA DE TÍTULO V2 (À PROVA DE HASHES) ---

            // 1. Pegamos o texto visível real da tag <a>
            let textoLink = $inner(el).text().replace(/\s+/g, ' ').trim();

            // 2. Tiramos a data ou traços do começo do texto
            textoLink = textoLink.replace(/^[\d\/\.\-\s]+/, '').trim();

            let tituloArquivo = textoLink;
            const palavrasGenericas = ['download', 'ver', 'anexo', 'clique aqui', 'acessar'];

            // 3. Se o texto ficou vazio (era só uma data) ou é genérico ("Download"), vamos ler o parágrafo pai!
            if (!tituloArquivo || palavrasGenericas.includes(tituloArquivo.toLowerCase())) {
              let textoPai = $inner(el).parent().text().replace(/\s+/g, ' ').trim();
              // Limpa a data do começo do parágrafo
              tituloArquivo = textoPai.replace(/^[\d\/\.\-\s]+/, '').trim();
            }

            // 4. Se o parágrafo todo falhar, tentamos o 'title', MAS SÓ se parecer uma frase de verdade (tiver espaços)
            if (!tituloArquivo || palavrasGenericas.includes(tituloArquivo.toLowerCase())) {
              const attrTitle = $inner(el).attr('title') || '';
              if (attrTitle.includes(' ') && attrTitle.length > 5) {
                tituloArquivo = attrTitle;
              }
            }

            // 5. Faxina final de sujeiras que sobraram no começo
            tituloArquivo = tituloArquivo.replace(/^[\d\/\.\-\s]+/, '').trim();
            if (tituloArquivo.startsWith('-')) {
              tituloArquivo = tituloArquivo.substring(1).trim();
            }

            // Se for um link sem texto útil de verdade, ignoramos
            if (tituloArquivo.length < 3) return;

            // --- FIM DA LÓGICA ---

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
                metadados: concurso.tituloConcurso,
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