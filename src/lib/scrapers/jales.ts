import * as cheerio from 'cheerio';
import { Edital } from '../../types';
import { ehSujeira, extrairIdConcurso } from '../filtrosGlobais';
import { fetchHtml, extrairData, limparTituloDoc } from './utils';

export async function buscarJales(opcoes?: import('../../types').ScraperOptions): Promise<Edital[]> {
  if (opcoes?.verificarDisponibilidade) {
    const { verificaDisponibilidade } = await import('./utils');
    await verificaDisponibilidade('https://www.jales.sp.gov.br/');
    return [];
  }

  const resultados: Edital[] = [];
  let ordemGlobal = 0;
  const linksProcessados = new Set<string>();
  const todosOsConcursos: { tituloConcurso: string, urlInterna: string }[] = [];
  let chegouNoFim = false;

  try {
    for (let loteInicio = 1; ; loteInicio += 5) {
      if (chegouNoFim) break;

      const promessasPaginas = [];
      for (let pagina = loteInicio; pagina < loteInicio + 5; pagina++) {
        const urlLista = `https://www.jales.sp.gov.br/cidadao/concursos-e-processos-seletivos?&pagina=${pagina}`;
        promessasPaginas.push(
          fetchHtml(urlLista).then(res => ({ pagina, html: res.ok ? res.html : '' }))
        );
      }

      const paginasBaixadas = await Promise.all(promessasPaginas);
      paginasBaixadas.sort((a, b) => a.pagina - b.pagina);

      for (const pag of paginasBaixadas) {
        if (!pag.html || chegouNoFim) continue;

        const $ = cheerio.load(pag.html);
        const links = $('a.list-item__link').toArray();

        if (links.length === 0) {
          chegouNoFim = true;
          break;
        }

        for (const el of links) {
          const tituloConcurso = $(el).text().replace(/\s+/g, ' ').trim();
          const href = $(el).attr('href') || '';

          if (ehSujeira(tituloConcurso)) continue;

          if (href) {
            const urlInterna = href.startsWith('http') ? href : `https://www.jales.sp.gov.br${href}`;
            todosOsConcursos.push({ tituloConcurso, urlInterna });
          }
        }
      }
    }

    const TAMANHO_LOTE = 15;

    for (let i = 0; i < todosOsConcursos.length; i += TAMANHO_LOTE) {
      const lote = todosOsConcursos.slice(i, i + TAMANHO_LOTE);

      const detalhesHtml = await Promise.all(lote.map(async (concurso) => {
        const res = await fetchHtml(concurso.urlInterna);
        return { ...concurso, html: res.ok ? res.html : '' };
      }));

      for (const detalhe of detalhesHtml) {
        if (!detalhe.html) continue;

        const $inner = cheerio.load(detalhe.html);
        let $main = $inner('main');
        if ($main.length === 0) $main = $inner('article');
        if ($main.length === 0) $main = $inner('body');

        const idConcurso = extrairIdConcurso(detalhe.tituloConcurso, '', true, false);
        let anoConcurso: number | undefined = undefined;

        if (idConcurso) {
          const matchAno = idConcurso.match(/\/(\d{4})\b/);
          if (matchAno) anoConcurso = parseInt(matchAno[1], 10);
        }

        const arquivosDesteConcurso: any[] = [];

        $main.find('p').each((_, pEl) => {
          let textoDoParagrafo = $inner(pEl).text().replace(/\s+/g, ' ').trim();

          $inner(pEl).find('a').each((_, aEl) => {
            const fileHref = $inner(aEl).attr('href') || '';
            if (!fileHref || fileHref.startsWith('#') || fileHref.includes('javascript:')) return;

            const linkCompleto = fileHref.startsWith('http') ? fileHref : `https://www.jales.sp.gov.br${fileHref}`;

            if (linksProcessados.has(linkCompleto)) return;
            linksProcessados.add(linkCompleto);

            let tituloArquivo = $inner(aEl).text();
            tituloArquivo = limparTituloDoc(tituloArquivo, $inner(aEl).attr('title') || textoDoParagrafo);

            if (tituloArquivo.length < 3 || ehSujeira(tituloArquivo)) return;

            const dataParsed = extrairData(textoDoParagrafo);
            
            arquivosDesteConcurso.push({
              titulo: tituloArquivo,
              link: linkCompleto,
              dataFormatada: dataParsed ? dataParsed.dataFormatada : '',
              dataTimestamp: dataParsed ? dataParsed.dataTimestamp : 0
            });
          });
        });

        let dataMaisAntiga = Infinity;
        for (const arq of arquivosDesteConcurso) {
          if (arq.dataTimestamp > 0 && arq.dataTimestamp < dataMaisAntiga) {
            dataMaisAntiga = arq.dataTimestamp;
          }
        }

        if (dataMaisAntiga === Infinity) {
          dataMaisAntiga = new Date(`${anoConcurso || new Date().getFullYear()}-01-01T00:00:00`).getTime();
        }

        for (const arq of arquivosDesteConcurso) {
          let timestampFinal = arq.dataTimestamp;

          if (timestampFinal === 0) {
            const tituloUpper = arq.titulo.toUpperCase();
            const UM_DIA_MS = 86400000;

            if (tituloUpper.includes('EDITAL')) {
              timestampFinal = dataMaisAntiga - (2 * UM_DIA_MS);
            } else if (tituloUpper.includes('INSCRI')) {
              timestampFinal = dataMaisAntiga - (1 * UM_DIA_MS);
            } else {
              timestampFinal = dataMaisAntiga;
            }

            const d = new Date(timestampFinal);
            const dia = d.getDate().toString().padStart(2, '0');
            const mes = (d.getMonth() + 1).toString().padStart(2, '0');
            const ano = d.getFullYear();
            arq.dataFormatada = `${dia}/${mes}/${ano}`;
            arq.dataTimestamp = timestampFinal;
          }

          ordemGlobal++;
          resultados.push({
            cidade: 'Jales',
            orgao: 'Prefeitura',
            titulo: arq.titulo,
            concurso: idConcurso,
            ano: anoConcurso,
            link: arq.link,
            dataPublicacao: arq.dataFormatada,
            dataTimestamp: arq.dataTimestamp,
            ordemOriginal: ordemGlobal
          });
        }
      }
    }

  } catch (e: any) {
    const cause = (e as any).cause;
    const causeMsg = cause ? " - Detalhes: " + (cause.message || cause.code || JSON.stringify(cause)) : "";
    throw new Error(`Erro geral ao buscar Jales` + ": " + (e as Error).message + causeMsg);
  }

  return resultados;
}