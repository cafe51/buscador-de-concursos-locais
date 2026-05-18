import * as cheerio from 'cheerio';
import { Edital } from '../../types';
import { ehSujeira, extrairIdConcurso } from '../filtrosGlobais';

export async function buscarMeridiano(): Promise<Edital[]> {
  const resultados: Edital[] = [];
  let ordemGlobal = 0;

  try {
    const urlBase = 'https://meridiano.sp.gov.br/concursos/?ces_tipo=concurso-publico';
    const resBase = await fetch(urlBase, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' });

    if (!resBase.ok) return [];

    const htmlBase = await resBase.text();
    const $base = cheerio.load(htmlBase);

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

    // ==============================================================
    // 🚀 FASE 1: BAIXA TODAS AS PÁGINAS DE "ANOS" AO MESMO TEMPO
    // ==============================================================
    const paginasAnos = await Promise.all(linksAnos.map(async (item) => {
      try {
        const res = await fetch(item.url, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' });
        if (!res.ok) return { ...item, html: '' };
        return { ...item, html: await res.text() };
      } catch {
        return { ...item, html: '' };
      }
    }));

    const todosOsConcursos: { metadado: string, urlDetalhes: string, anoOriginal: number }[] = [];

    // Lê os links dos concursos de dentro dos HTMLs que baixamos
    for (const pagAno of paginasAnos) {
      if (!pagAno.html) continue;
      const $ano = cheerio.load(pagAno.html);

      $ano('.ces-card-item').each((_, el) => {
        const metadado = $ano(el).find('h3.ces-item-title').text().replace(/\s+/g, ' ').trim();
        if (ehSujeira(metadado)) return;

        const href = $ano(el).find('a.ces-btn-primary').attr('href') || '';
        if (href && metadado) {
          const urlDetalhes = href.startsWith('http') ? href : `https://meridiano.sp.gov.br${href}`;
          todosOsConcursos.push({ metadado, urlDetalhes, anoOriginal: pagAno.ano });
        }
      });
    }

    // ==============================================================
    // 🚀 FASE 2: BAIXA OS DETALHES DOS CONCURSOS EM LOTES (Batches)
    // ==============================================================
    const TAMANHO_LOTE = 10;

    for (let i = 0; i < todosOsConcursos.length; i += TAMANHO_LOTE) {
      const lote = todosOsConcursos.slice(i, i + TAMANHO_LOTE);

      // Dispara 10 downloads de páginas de detalhes ao mesmo tempo!
      const detalhesHtml = await Promise.all(lote.map(async (concurso) => {
        try {
          const res = await fetch(concurso.urlDetalhes, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' });
          if (!res.ok) return { ...concurso, html: '' };
          return { ...concurso, html: await res.text() };
        } catch {
          return { ...concurso, html: '' };
        }
      }));

      // ==============================================================
      // 🧩 FASE 3: LÊ O HTML SEQUENCIALMENTE PARA MANTER A ORDEM GLOBAL
      // ==============================================================
      for (const detalhe of detalhesHtml) {
        if (!detalhe.html) continue;

        const $det = cheerio.load(detalhe.html);

        // Extrai a Chave do Concurso (Ex: "Concurso 01/2022")
        const idConcurso = extrairIdConcurso(detalhe.metadado, '');
        let anoConcurso: number | undefined = undefined;
        if (idConcurso) {
          const matchAno = idConcurso.match(/\/(\d{4})\b/);
          if (matchAno) anoConcurso = parseInt(matchAno[1], 10);
        }

        $det('#ces-arquivos .ces-timeline-item').each((_, el) => {
          const dataRaw = $det(el).find('.ces-timeline-date').text().trim();
          const tituloOriginal = $det(el).find('.ces-timeline-title').text().replace(/\s+/g, ' ').trim();

          if (ehSujeira(tituloOriginal)) return;

          const href = $det(el).find('a.ces-timeline-link').attr('href') || '';
          if (!href) return;

          const linkCompleto = href.startsWith('http') ? href : `https://meridiano.sp.gov.br${href}`;

          let dataFormatada = 'sem data';
          let dataTimestamp = 0;
          let tituloFinal = tituloOriginal;

          // REGRA DE EXCEÇÃO PARA O ANO DE 2022
          if (detalhe.anoOriginal === 2022) {
            dataFormatada = '01/03/2022';
            dataTimestamp = new Date('2022-03-01T00:00:00').getTime();

            let nomeArquivo = href.split('/').pop() || '';
            nomeArquivo = decodeURIComponent(nomeArquivo);
            nomeArquivo = nomeArquivo.replace(/\.pdf$/i, '').replace(/\.docx?$/i, '');
            nomeArquivo = nomeArquivo.replace(/-/g, ' ').trim();

            if (nomeArquivo) tituloFinal = nomeArquivo;
          } else {
            const matchData = dataRaw.match(/(\d{2})\/(\d{2})\/(\d{4})/);
            if (matchData) {
              dataFormatada = matchData[0];
              dataTimestamp = new Date(`${matchData[3]}-${matchData[2]}-${matchData[1]}T00:00:00`).getTime();
            }
          }

          ordemGlobal++;

          resultados.push({
            cidade: 'Meridiano',
            orgao: 'Prefeitura',
            titulo: tituloFinal,
            link: linkCompleto,
            concurso: idConcurso,
            ano: anoConcurso,
            metadados: undefined,
            dataPublicacao: dataFormatada,
            dataTimestamp: dataTimestamp,
            ordemOriginal: ordemGlobal
          });
        });
      }
    }

  } catch (e) {
    console.error('Erro geral ao buscar Meridiano', e);
  }

  return resultados;
}