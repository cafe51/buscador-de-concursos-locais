// src/lib/scrapers/dolcinopolis.ts
import * as cheerio from 'cheerio';
import { Edital } from '../../types';
import { ehSujeira, extrairIdConcurso } from '../filtrosGlobais';

export async function buscarDolcinopolis(): Promise<Edital[]> {
  const resultados: Edital[] = [];
  let ordemGlobal = 0;

  const baseUrl = 'https://dolcinopolis.sp.gov.br';
  let chegouNoFim = false;

  const basePath = '/transparencia/concursos';
  const pastasParaProcessar: any[] = [];

  try {
    // 1. PAGINAÇÃO PREVENTIVA
    for (let pagina = 1; pagina <= 5; pagina++) {
      if (chegouNoFim) break;

      const urlLista = pagina === 1 ? `${baseUrl}${basePath}` : `${baseUrl}${basePath}?pagina=${pagina}`;

      const res = await fetch(urlLista, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' });
      if (!res.ok) {
        chegouNoFim = true;
        break;
      }

      const html = await res.text();
      const $ = cheerio.load(html);

      const itensLista = $('ul.list li.list-item').toArray();

      if (itensLista.length === 0) {
        chegouNoFim = true;
        break;
      }

      for (const el of itensLista) {
        const tituloPasta = $(el).find('h3.list-item__title a').text().replace(/\s+/g, ' ').trim();
        const hrefPasta = $(el).find('h3.list-item__title a').attr('href') || '';
        const textoPublicado = $(el).find('p').text().trim();

        if (tituloPasta.toLowerCase().includes('não houve') || tituloPasta.toLowerCase().includes('nao houve')) continue;

        if (ehSujeira(tituloPasta)) continue;

        let dataCapaFormatada = 'sem data';
        let dataCapaTimestamp = 0;

        const matchCapa = textoPublicado.match(/\b(\d{1,2})[\/\.](\d{2})[\/\.](\d{4})\b/);
        if (matchCapa) {
          const dia = matchCapa[1].padStart(2, '0');
          const mes = matchCapa[2];
          const ano = matchCapa[3];
          dataCapaFormatada = `${dia}/${mes}/${ano}`;
          dataCapaTimestamp = new Date(`${ano}-${mes}-${dia}T00:00:00`).getTime();
        }

        const linkCompletoPasta = hrefPasta.startsWith('http') ? hrefPasta : `${baseUrl}${hrefPasta}`;

        let idConcurso = extrairIdConcurso(tituloPasta, '', true, false);
        if (!idConcurso) {
          idConcurso = tituloPasta;
        }

        pastasParaProcessar.push({
          tituloPasta,
          linkCompletoPasta,
          idConcurso,
          dataCapaFormatada,
          dataCapaTimestamp
        });
      }

      const proximaPagina = $('.pagination .next').length > 0;
      if (!proximaPagina && pagina === 1 && itensLista.length > 0) {
        chegouNoFim = true;
      }
    }

    // 2. PROCESSAR PÁGINAS INTERNAS (PARALELIZADO)
    await Promise.all(pastasParaProcessar.map(async (pasta) => {
      try {
        const resInner = await fetch(pasta.linkCompletoPasta, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' });
        if (!resInner.ok) return;

        const htmlInner = await resInner.text();
        const $inner = cheerio.load(htmlInner);

        let $conteudo = $inner('article');
        if ($conteudo.length === 0) $conteudo = $inner('main');
        if ($conteudo.length === 0) $conteudo = $inner('.page-content');
        if ($conteudo.length === 0) $conteudo = $inner('body');

        let anoConcurso: number | undefined = undefined;
        const matchAno = pasta.idConcurso.match(/\/(\d{4})\b/);
        if (matchAno) anoConcurso = parseInt(matchAno[1], 10);

        const linksProcessados = new Set<string>();

        // 🚀 ATENÇÃO: Pegamos o 'index' (0, 1, 2...) que dita a ordem de cima para baixo no HTML
        $conteudo.find('a').each((index, aEl) => {
          const hrefDoc = $inner(aEl).attr('href') || '';

          if (!hrefDoc || hrefDoc.startsWith('#') || hrefDoc.includes('javascript:') || hrefDoc.includes('mailto:')) return;

          const isDoc = hrefDoc.toLowerCase().endsWith('.pdf') ||
            hrefDoc.toLowerCase().endsWith('.doc') ||
            hrefDoc.toLowerCase().endsWith('.docx') ||
            hrefDoc.toLowerCase().includes('download');

          if (!isDoc) return;

          const linkDoc = hrefDoc.startsWith('http') ? hrefDoc : `${baseUrl}${hrefDoc}`;
          if (linksProcessados.has(linkDoc)) return;
          linksProcessados.add(linkDoc);

          let tituloDoc = $inner(aEl).text().replace(/\s+/g, ' ').trim();
          const textoPai = $inner(aEl).parent().text().replace(/\s+/g, ' ').trim();

          const palavrasGenericas = ['download', 'ver', 'anexo', 'clique aqui', 'acessar', 'arquivo', 'edital'];
          if (!tituloDoc || palavrasGenericas.includes(tituloDoc.toLowerCase())) {
            tituloDoc = $inner(aEl).attr('title') || textoPai.replace(tituloDoc, '').trim();
          }

          if (!tituloDoc) tituloDoc = 'Documento Anexo';

          tituloDoc = tituloDoc.replace(/^[\d\/\.\-\s\|]+/, '').trim();
          if (tituloDoc.startsWith('-') || tituloDoc.startsWith('|')) {
            tituloDoc = tituloDoc.substring(1).trim();
          }

          if (ehSujeira(tituloDoc, [], linkDoc)) return;

          let dataDocFormatada = pasta.dataCapaFormatada;
          let dataDocTimestamp = pasta.dataCapaTimestamp;

          const matchDataDoc = textoPai.match(/\b(\d{1,2})[\/\.](\d{2})[\/\.](\d{4})\b/);
          if (matchDataDoc) {
            const dia = matchDataDoc[1].padStart(2, '0');
            const mes = matchDataDoc[2];
            const ano = matchDataDoc[3];
            dataDocFormatada = `${dia}/${mes}/${ano}`;
            dataDocTimestamp = new Date(`${ano}-${mes}-${dia}T00:00:00`).getTime();
          }

          if (dataDocTimestamp === 0 && anoConcurso) {
            dataDocFormatada = `01/01/${anoConcurso}`;
            dataDocTimestamp = new Date(`${anoConcurso}-01-01T00:00:00`).getTime();
          }

          // ====================================================================
          // 🚀 A MÁGICA DA ORDENAÇÃO: Inversão temporal!
          // Multiplicamos o index do HTML por 60000ms (1 minuto).
          // Os itens que aparecem no fundo da tela original ficarão "minutos no futuro",
          // garantindo que apareçam no topo do nosso App!
          // ====================================================================
          dataDocTimestamp += (index * 60000);

          ordemGlobal++;

          resultados.push({
            cidade: 'Dolcinópolis',
            orgao: 'Prefeitura',
            titulo: tituloDoc,
            descricao: undefined,
            concurso: pasta.idConcurso,
            ano: anoConcurso,
            link: linkDoc,
            dataPublicacao: dataDocFormatada,
            dataTimestamp: dataDocTimestamp,
            ordemOriginal: ordemGlobal,
            linkOrigem: pasta.linkCompletoPasta
          });

        });

      } catch (error: any) { throw new Error(`Erro ao ler página interna de Dolcinópolis: ${pasta.linkCompletoPasta}` + ": " + error.message); }
    }));

  } catch (error: any) { throw new Error('Erro geral ao buscar Dolcinópolis' + ": " + error.message); }

  return resultados;
}