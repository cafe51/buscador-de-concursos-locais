// src/lib/scrapers/jales.ts
import * as cheerio from 'cheerio';
import { Edital } from '../../types';
import { ehSujeira, extrairIdConcurso } from '../filtrosGlobais';

export async function buscarJales(): Promise<Edital[]> {
  const resultados: Edital[] = [];
  let ordemGlobal = 0;

  const linksProcessados = new Set<string>();
  const todosOsConcursos: { tituloConcurso: string, urlInterna: string }[] = [];

  let chegouNoFim = false;

  try {
    // ==============================================================
    // 🚀 FASE 1: PAGINAÇÃO INFINITA (Lotes de 5)
    // ==============================================================
    for (let loteInicio = 1; ; loteInicio += 5) {
      if (chegouNoFim) break;

      const promessasPaginas = [];

      for (let pagina = loteInicio; pagina < loteInicio + 5; pagina++) {
        const urlLista = `https://www.jales.sp.gov.br/cidadao/concursos-e-processos-seletivos?&pagina=${pagina}`;
        promessasPaginas.push(
          fetch(urlLista, { headers: { 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
        }, cache: 'no-store' })
            .then(async (res) => ({ pagina, html: res.ok ? await res.text() : '' }))
            .catch(() => ({ pagina, html: '' }))
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

    // ==============================================================
    // 🚀 FASE 2: PROCESSAMENTO PARALELO (Lotes de 15)
    // ==============================================================
    const TAMANHO_LOTE = 15;

    for (let i = 0; i < todosOsConcursos.length; i += TAMANHO_LOTE) {
      const lote = todosOsConcursos.slice(i, i + TAMANHO_LOTE);

      const detalhesHtml = await Promise.all(lote.map(async (concurso) => {
        try {
          const res = await fetch(concurso.urlInterna, { headers: { 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
        }, cache: 'no-store' });
          return { ...concurso, html: res.ok ? await res.text() : '' };
        } catch {
          return { ...concurso, html: '' };
        }
      }));

      // ==============================================================
      // 🧩 FASE 3: LEITURA ESTRUTURADA E EXTRAÇÃO COM CORREÇÃO DE DIAS
      // ==============================================================
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

          // 🌟 A CORREÇÃO DE "PRIMEIRO": Troca "1º/", "1°/" ou "1o/" por "01/"
          textoDoParagrafo = textoDoParagrafo.replace(/1[º°o]\s*[\/\.]/gi, '01/');

          $inner(pEl).find('a').each((_, aEl) => {
            const fileHref = $inner(aEl).attr('href') || '';
            if (!fileHref || fileHref.startsWith('#') || fileHref.includes('javascript:')) return;

            const linkCompleto = fileHref.startsWith('http') ? fileHref : `https://www.jales.sp.gov.br${fileHref}`;

            if (linksProcessados.has(linkCompleto)) return;
            linksProcessados.add(linkCompleto);

            let tituloArquivo = $inner(aEl).text().replace(/\s+/g, ' ').trim();

            // 🌟 APLICA A CORREÇÃO NO TÍTULO TAMBÉM (Para o limpador funcionar)
            tituloArquivo = tituloArquivo.replace(/1[º°o]\s*[\/\.]/gi, '01/');

            const palavrasGenericas = ['download', 'ver', 'anexo', 'clique aqui', 'acessar'];

            if (!tituloArquivo || palavrasGenericas.includes(tituloArquivo.toLowerCase())) {
              tituloArquivo = $inner(aEl).attr('title') || textoDoParagrafo;
            }
            if (/^[\d\/\.\-\s]+$/.test(tituloArquivo)) {
              tituloArquivo = $inner(aEl).attr('title') || textoDoParagrafo;
            }

            // LIMPEZA CIRÚRGICA DO TÍTULO
            tituloArquivo = tituloArquivo.replace(/(Concurso P[úu]blico|Processo Seletivo).*?[\-\|]/i, '').trim();
            // 🌟 AGORA ACEITA 1 DÍGITO NO DIA TAMBÉM (\d{1,2})
            tituloArquivo = tituloArquivo.replace(/\b\d{1,2}[\/\.]\d{2}[\/\.]\d{4}\b/g, '').trim();

            tituloArquivo = tituloArquivo.replace(/^[\d\/\.\-\s\|]+/, '').trim();
            if (tituloArquivo.startsWith('-') || tituloArquivo.startsWith('|')) {
              tituloArquivo = tituloArquivo.substring(1).trim();
            }

            if (tituloArquivo.length < 3) return;
            if (ehSujeira(tituloArquivo)) return;

            // EXTRAÇÃO DA DATA
            let dataFormatada = '';
            let dataTimestamp = 0;

            // 🌟 AGORA ACEITA DIA COM 1 OU 2 DÍGITOS (\d{1,2})
            const matchData = textoDoParagrafo.match(/(\d{1,2})[\/\.](\d{2})[\/\.](\d{4})/);

            if (matchData) {
              const dia = matchData[1].padStart(2, '0'); // Se vier "5", transforma em "05"
              const mes = matchData[2];
              const ano = matchData[3];
              dataFormatada = `${dia}/${mes}/${ano}`;
              dataTimestamp = new Date(`${ano}-${mes}-${dia}T00:00:00`).getTime();
            }

            arquivosDesteConcurso.push({
              titulo: tituloArquivo,
              link: linkCompleto,
              dataFormatada,
              dataTimestamp
            });
          });
        });

        // ==============================================================
        // 🚑 LÓGICA DE RESGATE DE DATAS FALTANTES
        // ==============================================================
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

  } catch (e: any) { throw new Error(`Erro geral ao buscar Jales` + ": " + e.message); }

  return resultados;
}