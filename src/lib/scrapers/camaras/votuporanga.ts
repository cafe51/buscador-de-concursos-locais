// src/lib/scrapers/camaras/votuporanga.ts
import * as cheerio from 'cheerio';
import { Edital } from '../../../types';
import { ehSujeira, extrairIdConcurso } from '../../filtrosGlobais';

export async function buscarCamaraVotuporanga(): Promise<Edital[]> {
  const resultados: Edital[] = [];
  let ordemGlobal = 0;

  const urlPagina = 'https://camaravotuporanga.sp.gov.br/2023/04/17/concursos/';

  try {
    // 🚀 INJEÇÃO DE HEADERS: Disfarça a requisição para não ser bloqueada pelo Cloudflare/Firewall
    const res = await fetch(urlPagina, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
      },
      cache: 'no-store'
    });

    if (!res.ok) {
      console.log(`🛑 [Câmara Votuporanga] Erro HTTP ${res.status}`);
      return [];
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    // 🚀 CAÇA A DIV CORRETA: Tenta pegar pela classe de texto do tema Newspaper
    const $blocosTexto = $('.tdb_single_content .tdb-block-inner.td-fix-index');

    if ($blocosTexto.length === 0) {
      console.log('🛑 [Câmara Votuporanga] Nenhuma div de conteúdo encontrada.');
      return [];
    }

    let currentContestId = '';
    let currentAno: number | undefined = undefined;
    let blockContest = false;
    let lastTextBuffer = '';
    const documentosBrutos: any[] = [];

    // =========================================================================
    // 🚀 O LEITOR SEMÂNTICO (Lê de cima para baixo, entendendo o contexto!)
    // =========================================================================
    function traverseNodes(node: any) {
      if (node.type === 'text') {
        // Acumula textos soltos (ex: datas que ficam fora dos links)
        lastTextBuffer += node.data;
      } else if (node.type === 'tag') {
        const tagName = node.name.toLowerCase();

        // 1. DETECTOR DE NOVOS CONCURSOS (A prancheta do robô)
        if (['strong', 'b', 'h1', 'h2', 'h3', 'h4', 'h5', 'p'].includes(tagName)) {
          const nodeText = $(node).text().replace(/\s+/g, ' ').trim();
          const upper = nodeText.toUpperCase();

          if (upper.includes('CONCURSO') || upper.includes('PROCESSO SELETIVO')) {
            const idExtracted = extrairIdConcurso(nodeText, '', true, false);
            if (idExtracted) {
              currentContestId = idExtracted;

              if (currentContestId.startsWith('Concurso ') && !currentContestId.includes('Público')) {
                currentContestId = currentContestId.replace('Concurso ', 'Concurso Público ');
              }

              const matchAno = currentContestId.match(/\/(\d{4})/);
              if (matchAno) currentAno = parseInt(matchAno[1], 10);

              // 🛑 REGRA ESTRITA: Ignora concursos anteriores a 2019
              blockContest = currentAno ? currentAno < 2019 : false;
            }
          }
        }

        // 2. DETECTOR DE ARQUIVOS DE DOWNLOAD
        if (tagName === 'a') {
          const href = node.attribs?.href || '';

          if (href && !href.startsWith('#')) {
            const isDoc = href.toLowerCase().endsWith('.pdf') || href.toLowerCase().endsWith('.doc') || href.toLowerCase().endsWith('.docx');

            if (isDoc && !blockContest && currentContestId) {
              // Limpa o título do documento de traços e pontos no início
              let tituloDoc = $(node).text().replace(/^[^a-zA-Z0-9À-ÿ]+/, '').trim();
              if (!tituloDoc) tituloDoc = 'Documento Anexo';

              const linkDoc = href.startsWith('http') ? href : `https://camaravotuporanga.sp.gov.br${href}`;

              if (!ehSujeira(tituloDoc, [], linkDoc)) {
                let dataFormatada = 'sem data';
                let dataTimestamp = 0;

                // Puxa a data do texto que estava logo ANTES do link (ex: "22/03/2024 - ")
                const matchData = lastTextBuffer.match(/\b(\d{2})[\/\.](\d{2})[\/\.](\d{4})\b/);
                if (matchData) {
                  dataFormatada = `${matchData[1]}/${matchData[2]}/${matchData[3]}`;
                  dataTimestamp = new Date(`${matchData[3]}-${matchData[2]}-${matchData[1]}T00:00:00`).getTime();
                } else if (currentAno) {
                  // Fallback de Data
                  dataFormatada = `01/01/${currentAno}`;
                  dataTimestamp = new Date(`${currentAno}-01-01T00:00:00`).getTime();
                }

                documentosBrutos.push({
                  titulo: tituloDoc,
                  concurso: currentContestId,
                  ano: currentAno,
                  link: linkDoc,
                  dataFormatada,
                  dataTimestamp
                });
              }
            }
          }
          // Zera o buffer após passar por um link, para não injetar a mesma data no próximo!
          lastTextBuffer = '';
        }

        // Entra nos nós filhos (recursão)
        if (node.children) {
          node.children.forEach(traverseNodes);
        }

        // Se o robô encontrou uma quebra de bloco (<br>, <hr>, <p>), ele também limpa o lixo do buffer
        if (['br', 'p', 'div', 'hr', 'table', 'li'].includes(tagName)) {
          lastTextBuffer = '';
        }
      }
    }

    // Dispara a leitura passando o conteúdo mestre!
    $blocosTexto.each((_, block) => {
      block.childNodes.forEach(traverseNodes);
    });

    // ==============================================================
    // 🚀 MONTAGEM FINAL E ORDENAÇÃO
    // ==============================================================
    documentosBrutos.forEach((doc, index) => {
      // Como os mais novos estão no topo visualmente, subtraímos os minutos com base no Index
      // O item do topo (index 0) perderá 0 minutos e ficará no topo da nossa aplicação!
      doc.dataTimestamp -= (index * 60000);
      ordemGlobal++;

      resultados.push({
        cidade: 'Votuporanga',
        orgao: 'Câmara Municipal',
        titulo: doc.titulo,
        descricao: undefined,
        concurso: doc.concurso,
        ano: doc.ano,
        link: doc.link,
        dataPublicacao: doc.dataFormatada,
        dataTimestamp: doc.dataTimestamp,
        ordemOriginal: ordemGlobal,
        linkOrigem: urlPagina
      });
    });

  } catch (error: any) { throw new Error('Erro geral ao buscar Câmara Votuporanga' + ": " + error.message); }

  return resultados;
}