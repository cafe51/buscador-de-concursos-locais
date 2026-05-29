// src/lib/scrapers/meridiano.ts
import * as cheerio from 'cheerio';
import { Edital } from '../../types';
import { ehSujeira, extrairIdConcurso } from '../filtrosGlobais';
import { fetchHtml, extrairData } from './utils';

export async function buscarMeridiano(): Promise<Edital[]> {
  const resultados: Edital[] = [];
  let ordemGlobal = 0;
  const detalhesFalhas: string[] = [];

  try {
    const todosOsConcursos: { metadado: string, urlDetalhes: string, anoOriginal: number }[] = [];

    // ==============================================================
    // 1. BUSCA CONCURSOS PÚBLICOS (2022 em diante)
    // ==============================================================
    const urlBaseConcurso = 'https://meridiano.sp.gov.br/concursos/?ces_tipo=concurso-publico';
    const resBaseC = await fetchHtml(urlBaseConcurso);

    if (resBaseC.ok) {
      const $baseC = cheerio.load(resBaseC.html);
      const linksAnosC: { url: string; ano: number }[] = [];

      $baseC('a.ces-card').each((_, el) => {
        const textoAno = $baseC(el).find('.ces-text').text().trim();
        const numeroAno = parseInt(textoAno, 10);
        if (!isNaN(numeroAno) && numeroAno >= 2022) {
          const href = $baseC(el).attr('href') || '';
          if (href) linksAnosC.push({ url: href.startsWith('http') ? href : `https://meridiano.sp.gov.br${href}`, ano: numeroAno });
        }
      });

      const paginasAnosC = await Promise.all(linksAnosC.map(async (item) => {
        const res = await fetchHtml(item.url);
        return { ...item, html: res.ok ? res.html : '' };
      }));

      for (const pagAno of paginasAnosC) {
        if (!pagAno.html) {
          detalhesFalhas.push(`[PÁGINA ANO FALHOU] ${pagAno.url}`);
          continue;
        }
        const $ano = cheerio.load(pagAno.html);
        $ano('.ces-card-item').each((_, el) => {
          const metadado = $ano(el).find('h3.ces-item-title').text().replace(/\s+/g, ' ').trim();
          const href = $ano(el).find('a.ces-btn-primary').attr('href') || '';
          if (href && metadado) {
            todosOsConcursos.push({ metadado, urlDetalhes: href.startsWith('http') ? href : `https://meridiano.sp.gov.br${href}`, anoOriginal: pagAno.ano });
          }
        });
      }
    }

    // ==============================================================
    // 2. BUSCA PROCESSOS SELETIVOS (2026 a 2023)
    // ==============================================================
    const anosSeletivo = [2026, 2025, 2024, 2023];
    const urlsSeletivo = anosSeletivo.map(ano => ({ ano, url: `https://meridiano.sp.gov.br/concursos/?ces_tipo=processo-seletivo&ces_ano=${ano}` }));

    const paginasAnosS = await Promise.all(urlsSeletivo.map(async (item) => {
      const res = await fetchHtml(item.url);
      return { ...item, html: res.ok ? res.html : '' };
    }));

    for (const pagAno of paginasAnosS) {
      if (!pagAno.html) {
        detalhesFalhas.push(`[PÁGINA ANO FALHOU] ${pagAno.url}`);
        continue;
      }
      const $ano = cheerio.load(pagAno.html);
      $ano('.ces-card-item').each((_, el) => {
        const metadado = $ano(el).find('h3.ces-item-title').text().replace(/\s+/g, ' ').trim();
        const href = $ano(el).find('a.ces-btn-primary').attr('href') || '';
        if (href && metadado) {
          todosOsConcursos.push({ metadado, urlDetalhes: href.startsWith('http') ? href : `https://meridiano.sp.gov.br${href}`, anoOriginal: pagAno.ano });
        }
      });
    }

    // ==============================================================
    // 3. FASE DE DETALHES (PARALELIZADO EM LOTES DE 5)
    // ==============================================================
    const TAMANHO_LOTE = 5;

    for (let i = 0; i < todosOsConcursos.length; i += TAMANHO_LOTE) {
      const lote = todosOsConcursos.slice(i, i + TAMANHO_LOTE);

      const detalhesHtml = await Promise.all(lote.map(async (concurso) => {
        const res = await fetchHtml(concurso.urlDetalhes);
        return { ...concurso, html: res.ok ? res.html : '' };
      }));

      for (const detalhe of detalhesHtml) {
        if (!detalhe.html) {
          detalhesFalhas.push(`[DETALHE FALHOU] ${detalhe.urlDetalhes}`);
          continue;
        }

        const $det = cheerio.load(detalhe.html);

        const tituloParaAvaliar = detalhe.metadado.replace(/SIMPLIFICADO|CURR[IÍ]CULO/ig, '');
        if (ehSujeira(tituloParaAvaliar)) continue;

        const idConcurso = extrairIdConcurso(detalhe.metadado, '');
        let anoConcurso = detalhe.anoOriginal;
        if (idConcurso) {
          const matchAno = idConcurso.match(/\/(\d{4})\b/);
          if (matchAno) anoConcurso = parseInt(matchAno[1], 10);
        }

        let arquivosDesteConcurso: any[] = [];

        $det('#ces-arquivos .ces-timeline-item').each((_, el) => {
          const dataRaw = $det(el).find('.ces-timeline-date').text().trim();
          const tituloOriginal = $det(el).find('.ces-timeline-title').text().replace(/\s+/g, ' ').trim();

          const tituloSemSimplificado = tituloOriginal.replace(/SIMPLIFICADO|CURR[IÍ]CULO/ig, '');
          if (ehSujeira(tituloSemSimplificado)) return;

          const href = $det(el).find('a.ces-timeline-link').attr('href') || '';
          if (!href) return;

          let dataFormatada = '';
          let dataTimestamp = 0;

          const dataExtraida = extrairData(dataRaw);
          if (dataExtraida) {
            dataFormatada = dataExtraida.dataFormatada;
            dataTimestamp = dataExtraida.dataTimestamp;
          }

          arquivosDesteConcurso.push({ titulo: tituloOriginal, href, dataFormatada, dataTimestamp });
        });

        // Remover duplicatas de link (mesmo arquivo publicado de novo por engano), mantendo o mais antigo
        const arquivosDedup = new Map<string, any>();
        for (const arq of arquivosDesteConcurso) {
          const existente = arquivosDedup.get(arq.href);
          if (!existente) {
            arquivosDedup.set(arq.href, arq);
          } else {
            // Se o atual for mais antigo (ou igual, mas aparece mais abaixo na página), substitui
            if (arq.dataTimestamp > 0 && (existente.dataTimestamp === 0 || arq.dataTimestamp <= existente.dataTimestamp)) {
              arquivosDedup.delete(arq.href);
              arquivosDedup.set(arq.href, arq);
            }
          }
        }
        arquivosDesteConcurso = Array.from(arquivosDedup.values());

        const datasEncontradas = new Set<string>();
        arquivosDesteConcurso.forEach(arq => {
          if (arq.dataFormatada) {
            datasEncontradas.add(arq.dataFormatada);
          }
        });

        // ==============================================================
        // 🚨 O ALGORITMO DETETIVE DE MASS UPLOADS
        // ==============================================================
        let isMassUpload = false;

        datasEncontradas.delete('sem data');
        datasEncontradas.delete('');

        if (arquivosDesteConcurso.length > 0 && datasEncontradas.size === 1) {
          const dataUnica = Array.from(datasEncontradas)[0];
          const anoDaDataUnica = parseInt(dataUnica.split('/')[2], 10);
          if (anoDaDataUnica > anoConcurso) {
            isMassUpload = true;
          }
        }

        // Criamos o tempo base no final do dia 01/01 para ir subtraindo
        const timestampBaseSintetico = new Date(`${anoConcurso}-01-01T23:59:59`).getTime();

        // Passamos o 'index' no loop para saber a posição original no HTML
        arquivosDesteConcurso.forEach((arq, index) => {
          const linkCompleto = arq.href.startsWith('http') ? arq.href : `https://meridiano.sp.gov.br${arq.href}`;

          let finalDataFormatada = arq.dataFormatada;
          let finalDataTimestamp = arq.dataTimestamp;
          let finalTitulo = arq.titulo;

          if (isMassUpload || finalDataFormatada === '' || finalDataFormatada === 'sem data') {
            finalDataFormatada = `01/01/${anoConcurso}`;

            // 🕒 O PULO DO GATO: Subtrai 1 minuto (60000ms) para cada nível que descemos no HTML!
            finalDataTimestamp = timestampBaseSintetico - (index * 60000);

            let nomeArquivo = arq.href.split('/').pop() || '';
            nomeArquivo = decodeURIComponent(nomeArquivo).replace(/\.pdf$/i, '').replace(/\.docx?$/i, '').replace(/-/g, ' ').trim();
            if (nomeArquivo) finalTitulo = nomeArquivo;
          }

          ordemGlobal++;

          resultados.push({
            cidade: 'Meridiano',
            orgao: 'Prefeitura',
            titulo: finalTitulo,
            link: linkCompleto,
            concurso: idConcurso,
            ano: anoConcurso,
            metadados: undefined,
            dataPublicacao: finalDataFormatada,
            dataTimestamp: finalDataTimestamp,
            ordemOriginal: ordemGlobal
          });
        });
      }
    }

  } catch (e: any) {
    if (e.dadosParciais || detalhesFalhas.length > 0) throw e;
    const cause = (e as any).cause;
    const causeMsg = cause ? " - Detalhes: " + (cause.message || cause.code || JSON.stringify(cause)) : "";
    throw new Error('Erro geral ao buscar Meridiano' + ": " + (e as Error).message + causeMsg);
  }

  if (detalhesFalhas.length > 0) {
    const msg = `Conexão instável (${detalhesFalhas.length} falhas em Meridiano)`;
    if (resultados.length === 0) throw new Error(msg);
    else throw Object.assign(new Error(msg), { dadosParciais: resultados });
  }

  return resultados;
}