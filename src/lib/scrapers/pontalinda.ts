// src/lib/scrapers/pontalinda.ts
import * as cheerio from 'cheerio';
import { Edital } from '../../types';
import { ehSujeira, extrairIdConcurso } from '../filtrosGlobais';
import { fetchHtml, extrairData } from './utils';

export async function buscarPontalinda(): Promise<Edital[]> {
  const resultados: Edital[] = [];
  let ordemGlobal = 0;

  const baseUrl = 'https://www.pontalinda.sp.gov.br';
  let chegouNoFim = false;

  const basePath = '/consulta/concursos';
  const pastasParaProcessar: any[] = [];

  try {
    for (let pagina = 1; pagina <= 5; pagina++) {
      if (chegouNoFim) break;

      const urlLista = pagina === 1 ? `${baseUrl}${basePath}` : `${baseUrl}${basePath}?pagina=${pagina}`;

      const res = await fetchHtml(urlLista);

      if (!res.ok) {
        console.log(`\n🛑 [PONTALINDA] Falha de acesso à lista (Status ${res.status}): ${urlLista}`);
        chegouNoFim = true;
        break;
      }

      const $ = cheerio.load(res.html);

      // 🚀 SELETORES RESILIENTES
      let itensLista = $('ul.list li.list-item').toArray();
      if (itensLista.length === 0) itensLista = $('.list-item').toArray();
      if (itensLista.length === 0) itensLista = $('article').toArray();

      if (itensLista.length === 0) {
        chegouNoFim = true;
        break;
      }

      for (const el of itensLista) {
        let $link = $(el).find('h3.list-item__title a');
        if ($link.length === 0) $link = $(el).find('h3 a, h2 a, h4 a, .card-title a');
        if ($link.length === 0) $link = $(el).find('a').first();

        const tituloPasta = $link.text().replace(/\s+/g, ' ').trim();
        const hrefPasta = $link.attr('href') || '';
        const textoPublicado = $(el).find('p').text().trim();

        if (!tituloPasta || tituloPasta.toLowerCase().includes('não houve') || tituloPasta.toLowerCase().includes('nao houve')) continue;
        if (ehSujeira(tituloPasta)) continue;

        let dataCapaFormatada = 'sem data';
        let dataCapaTimestamp = 0;

        const dataExtraida = extrairData(textoPublicado);
        if (dataExtraida) {
          dataCapaFormatada = dataExtraida.dataFormatada;
          dataCapaTimestamp = dataExtraida.dataTimestamp;
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

      const proximaPagina = $('.pagination .next').length > 0 || $('.pagination .page-link[rel="next"]').length > 0;
      if (!proximaPagina && pagina === 1 && itensLista.length > 0) {
        chegouNoFim = true;
      }
    }

    if (pastasParaProcessar.length === 0) {
      console.log("\n🛑 [PONTALINDA] 0 PASTAS IDENTIFICADAS PARA PROCESSAR!");
      return resultados;
    }

    await Promise.all(pastasParaProcessar.map(async (pasta) => {
      try {
        const resInner = await fetchHtml(pasta.linkCompletoPasta);
        if (!resInner.ok) return;

        const $inner = cheerio.load(resInner.html);

        let $conteudo = $inner('article');
        if ($conteudo.length === 0) $conteudo = $inner('main');
        if ($conteudo.length === 0) $conteudo = $inner('.page-content');
        if ($conteudo.length === 0) $conteudo = $inner('body');

        let anoConcurso: number | undefined = undefined;
        const matchAno = pasta.idConcurso.match(/\/(\d{4})\b/);
        if (matchAno) anoConcurso = parseInt(matchAno[1], 10);

        const linksProcessados = new Set<string>();

        $conteudo.find('a').each((index, aEl) => {
          const hrefDoc = $inner(aEl).attr('href') || '';

          if (!hrefDoc || hrefDoc.startsWith('#') || hrefDoc.includes('javascript:') || hrefDoc.includes('mailto:')) return;

          const hrefDocLower = hrefDoc.toLowerCase();
          const isDoc = hrefDocLower.includes('.pdf') ||
            hrefDocLower.includes('.doc') ||
            hrefDocLower.includes('download') ||
            hrefDocLower.includes('/arquivo/');

          if (!isDoc) return;

          const linkDoc = hrefDoc.startsWith('http') ? hrefDoc : `${baseUrl}${hrefDoc}`;
          if (linksProcessados.has(linkDoc)) return;
          linksProcessados.add(linkDoc);

          let tituloDoc = $inner(aEl).text().replace(/\s+/g, ' ').trim();
          const textoPai = $inner(aEl).parent().text().replace(/\s+/g, ' ').trim();

          const palavrasGenericas = ['download', 'ver', 'anexo', 'clique aqui', 'acessar', 'arquivo', 'edital', 'link'];
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

          const dataExtraidaDoc = extrairData(textoPai);
          if (dataExtraidaDoc) {
            dataDocFormatada = dataExtraidaDoc.dataFormatada;
            dataDocTimestamp = dataExtraidaDoc.dataTimestamp;
          }

          if (dataDocTimestamp === 0 && anoConcurso) {
            dataDocFormatada = `01/01/${anoConcurso}`;
            dataDocTimestamp = new Date(`${anoConcurso}-01-01T00:00:00`).getTime();
          }

          dataDocTimestamp += (index * 60000);

          ordemGlobal++;

          resultados.push({
            cidade: 'Pontalinda',
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

      } catch (error: any) {
        const cause = (error as any).cause;
        const causeMsg = cause ? " - Detalhes: " + (cause.message || cause.code || JSON.stringify(cause)) : "";
        throw new Error(`Erro ao ler página interna de Pontalinda: ${pasta.linkCompletoPasta}` + ": " + (error as Error).message + causeMsg);
      }
    }));

  } catch (error: any) {
    const cause = (error as any).cause;
    const causeMsg = cause ? " - Detalhes: " + (cause.message || cause.code || JSON.stringify(cause)) : "";
    throw new Error('Erro geral ao buscar Pontalinda' + ": " + (error as Error).message + causeMsg);
  }

  return resultados;
}