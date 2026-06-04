import * as cheerio from 'cheerio';
import { Edital } from '../../types';
import { ehSujeira, extrairIdConcurso } from '../filtrosGlobais';
import { fetchHtml, extrairData, limparTituloDoc } from './utils';

export async function buscarDolcinopolis(opcoes?: import('../../types').ScraperOptions): Promise<Edital[]> {
  if (opcoes?.verificarDisponibilidade) {
    const { verificaDisponibilidade } = await import('./utils');
    await verificaDisponibilidade('https://dolcinopolis.sp.gov.br');
    return [];
  }

  const resultados: Edital[] = [];
  let ordemGlobal = 0;

  const baseUrl = 'https://dolcinopolis.sp.gov.br';
  let chegouNoFim = false;
  const basePath = '/transparencia/concursos';
  const pastasParaProcessar: any[] = [];

  try {
    for (let pagina = 1; pagina <= 5; pagina++) {
      if (chegouNoFim) break;

      const urlLista = pagina === 1 ? `${baseUrl}${basePath}` : `${baseUrl}${basePath}?pagina=${pagina}`;
      const res = await fetchHtml(urlLista);
      
      if (!res.ok) {
        chegouNoFim = true;
        break;
      }

      const $ = cheerio.load(res.html);
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

        const dataProcessada = extrairData(textoPublicado) || { dataFormatada: 'sem data', dataTimestamp: 0 };
        const linkCompletoPasta = hrefPasta.startsWith('http') ? hrefPasta : `${baseUrl}${hrefPasta}`;
        let idConcurso = extrairIdConcurso(tituloPasta, '', true, false) || tituloPasta;

        pastasParaProcessar.push({
          tituloPasta,
          linkCompletoPasta,
          idConcurso,
          dataCapaFormatada: dataProcessada.dataFormatada,
          dataCapaTimestamp: dataProcessada.dataTimestamp
        });
      }

      const proximaPagina = $('.pagination .next').length > 0;
      if (!proximaPagina && pagina === 1 && itensLista.length > 0) {
        chegouNoFim = true;
      }
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

          const isDoc = hrefDoc.toLowerCase().endsWith('.pdf') ||
            hrefDoc.toLowerCase().endsWith('.doc') ||
            hrefDoc.toLowerCase().endsWith('.docx') ||
            hrefDoc.toLowerCase().includes('download');

          if (!isDoc) return;

          const linkDoc = hrefDoc.startsWith('http') ? hrefDoc : `${baseUrl}${hrefDoc}`;
          if (linksProcessados.has(linkDoc)) return;
          linksProcessados.add(linkDoc);

          let tituloDoc = $inner(aEl).text();
          const textoPai = $inner(aEl).parent().text().replace(/\s+/g, ' ').trim();
          
          tituloDoc = limparTituloDoc(tituloDoc, $inner(aEl).attr('title') || textoPai);
          if (!tituloDoc) tituloDoc = 'Documento Anexo';
          if (ehSujeira(tituloDoc, [], linkDoc)) return;

          let dataDocFormatada = pasta.dataCapaFormatada;
          let dataDocTimestamp = pasta.dataCapaTimestamp;

          const matchDataDoc = extrairData(textoPai);
          if (matchDataDoc) {
            dataDocFormatada = matchDataDoc.dataFormatada;
            dataDocTimestamp = matchDataDoc.dataTimestamp;
          }

          if (dataDocTimestamp === 0 && anoConcurso) {
            dataDocFormatada = `01/01/${anoConcurso}`;
            dataDocTimestamp = new Date(`${anoConcurso}-01-01T00:00:00`).getTime();
          }

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

      } catch (error: any) {
        const cause = (error as any).cause;
        const causeMsg = cause ? " - Detalhes: " + (cause.message || cause.code || JSON.stringify(cause)) : "";
        throw new Error(`Erro ao ler página interna de Dolcinópolis: ${pasta.linkCompletoPasta}` + ": " + (error as Error).message + causeMsg);
      }
    }));

  } catch (error: any) {
    const cause = (error as any).cause;
    const causeMsg = cause ? " - Detalhes: " + (cause.message || cause.code || JSON.stringify(cause)) : "";
    throw new Error('Erro geral ao buscar Dolcinópolis' + ": " + (error as Error).message + causeMsg);
  }

  return resultados;
}