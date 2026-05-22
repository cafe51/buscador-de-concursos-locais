// src/lib/scrapers/meridiano.ts
import * as cheerio from 'cheerio';
import { Edital } from '../../types';
import { ehSujeira, extrairIdConcurso } from '../filtrosGlobais';

export async function buscarMeridiano(): Promise<Edital[]> {
  const resultados: Edital[] = [];
  let ordemGlobal = 0;

  try {
    const todosOsConcursos: { metadado: string, urlDetalhes: string, anoOriginal: number }[] = [];

    // ==============================================================
    // 1. BUSCA CONCURSOS PÚBLICOS (2022 em diante)
    // ==============================================================
    const urlBaseConcurso = 'https://meridiano.sp.gov.br/concursos/?ces_tipo=concurso-publico';
    const resBaseC = await fetch(urlBaseConcurso, { headers: { 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
        }, cache: 'no-store' });

    if (resBaseC.ok) {
      const htmlBaseC = await resBaseC.text();
      const $baseC = cheerio.load(htmlBaseC);
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
        try {
          const res = await fetch(item.url, { headers: { 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
        }, cache: 'no-store' });
          return { ...item, html: res.ok ? await res.text() : '' };
        } catch { return { ...item, html: '' }; }
      }));

      for (const pagAno of paginasAnosC) {
        if (!pagAno.html) continue;
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
      try {
        const res = await fetch(item.url, { headers: { 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
        }, cache: 'no-store' });
        return { ...item, html: res.ok ? await res.text() : '' };
      } catch { return { ...item, html: '' }; }
    }));

    for (const pagAno of paginasAnosS) {
      if (!pagAno.html) continue;
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
    // 3. FASE DE DETALHES (PARALELIZADO EM LOTES DE 10)
    // ==============================================================
    const TAMANHO_LOTE = 10;

    for (let i = 0; i < todosOsConcursos.length; i += TAMANHO_LOTE) {
      const lote = todosOsConcursos.slice(i, i + TAMANHO_LOTE);

      const detalhesHtml = await Promise.all(lote.map(async (concurso) => {
        try {
          const res = await fetch(concurso.urlDetalhes, { headers: { 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
        }, cache: 'no-store' });
          return { ...concurso, html: res.ok ? await res.text() : '' };
        } catch { return { ...concurso, html: '' }; }
      }));

      for (const detalhe of detalhesHtml) {
        if (!detalhe.html) continue;

        const $det = cheerio.load(detalhe.html);

        const tituloParaAvaliar = detalhe.metadado.replace(/SIMPLIFICADO|CURR[IÍ]CULO/ig, '');
        if (ehSujeira(tituloParaAvaliar)) continue;

        const idConcurso = extrairIdConcurso(detalhe.metadado, '');
        let anoConcurso = detalhe.anoOriginal;
        if (idConcurso) {
          const matchAno = idConcurso.match(/\/(\d{4})\b/);
          if (matchAno) anoConcurso = parseInt(matchAno[1], 10);
        }

        const arquivosDesteConcurso: any[] = [];
        const datasEncontradas = new Set<string>();

        $det('#ces-arquivos .ces-timeline-item').each((_, el) => {
          const dataRaw = $det(el).find('.ces-timeline-date').text().trim();
          const tituloOriginal = $det(el).find('.ces-timeline-title').text().replace(/\s+/g, ' ').trim();

          const tituloSemSimplificado = tituloOriginal.replace(/SIMPLIFICADO|CURR[IÍ]CULO/ig, '');
          if (ehSujeira(tituloSemSimplificado)) return;

          const href = $det(el).find('a.ces-timeline-link').attr('href') || '';
          if (!href) return;

          let dataFormatada = '';
          let dataTimestamp = 0;

          const matchData = dataRaw.match(/(\d{2})\/(\d{2})\/(\d{4})/);
          if (matchData) {
            dataFormatada = matchData[0];
            dataTimestamp = new Date(`${matchData[3]}-${matchData[2]}-${matchData[1]}T00:00:00`).getTime();
            datasEncontradas.add(dataFormatada);
          }

          arquivosDesteConcurso.push({ titulo: tituloOriginal, href, dataFormatada, dataTimestamp });
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
            // O primeiro item (index 0) fica com 23:59. O segundo (index 1) fica com 23:58.
            // O sort global vai colocar o 23:59 em cima do 23:58!
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

  } catch (e: any) { throw new Error('Erro geral ao buscar Meridiano' + ": " + e.message); }

  return resultados;
}