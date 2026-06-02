// src/lib/scrapers/santasalete.ts
import * as cheerio from 'cheerio';
import { Edital } from '../../types';
import { ehSujeira, extrairIdConcurso, corrigirErrosDigitacao } from '../filtrosGlobais';
import { fetchHtml, extrairData } from './utils';

export async function buscarSantaSalete(): Promise<Edital[]> {
  const resultados: Edital[] = [];
  const baseUrl = 'https://www.santasalete.sp.gov.br';
  const mainUrl = `${baseUrl}/consultas/concursos-e-processo-seletivo`;
  let ordemGlobal = 0;

  try {
    const res = await fetchHtml(mainUrl);
    if (!res.ok) return [];

    const $ = cheerio.load(res.html);
    const pastas: any[] = [];

    // 1. Coletar as Pastas Anuais (2025, 2024, 2022)
    $('article.list-item').each((_, el) => {
      const $link = $(el).find('.list-item__title a');
      const tituloPasta = $link.text().trim();
      const href = $link.attr('href');
      const textoData = $(el).find('p').text().trim();

      if (!href) return;

      let dataCapaTimestamp = 0;
      const dataExtraida = extrairData(textoData);
      if (dataExtraida) {
        dataCapaTimestamp = dataExtraida.dataTimestamp;
      }

      pastas.push({
        tituloPasta,
        linkCompleto: href.startsWith('http') ? href : `${baseUrl}${href}`,
        dataCapaTimestamp
      });
    });

    // 2. Processar páginas internas (Com Leitura Linear Inteligente)
    await Promise.all(pastas.map(async (pasta) => {
      try {
        const resInner = await fetchHtml(pasta.linkCompleto);
        if (!resInner.ok) return;
        const $inner = cheerio.load(resInner.html);

        let $conteudo = $inner('.page-content');
        if ($conteudo.length === 0) $conteudo = $inner('main');

        let currentContestId = '';
        let currentContestBlocked = false;
        let docIndex = 0;

        const linksProcessados = new Set<string>();

        // 🚀 O LEITOR DE CIMA PARA BAIXO (Depth-First Traversal)
        $conteudo.find('h2, h3, h4, p, a').each((_, el) => {
          const tagName = el.tagName.toLowerCase();

          // 🧠 Detecta as divisórias de Concursos (Títulos)
          if (['h2', 'h3', 'h4', 'p'].includes(tagName)) {
            const texto = $inner(el).text().replace(/\s+/g, ' ').trim();
            const textoUpper = texto.toUpperCase();

            // Se a frase mencionar um certame, o robô troca de "Prancheta"
            if (textoUpper.includes('CONCURSO') || textoUpper.includes('PROCESSO SELETIVO') || textoUpper.includes('PROCESSO SIMPLIFICADO')) {
              if (ehSujeira(texto)) {
                currentContestBlocked = true;
              } else {
                currentContestBlocked = false;

                let idExtraido = extrairIdConcurso(corrigirErrosDigitacao(texto), '');

                // 🚀 ADICIONADO: O desambiguador semântico de fallback
                if (!idExtraido) {
                  const modalidade = textoUpper.includes('CONCURSO') ? 'Concurso Público' : 'Processo Seletivo';
                  const anoPasta = pasta.tituloPasta; // Ex: "2025"
                  idExtraido = `${modalidade} 01/${anoPasta}`;
                }

                // Padronização e Limpeza
                

                // Exceção de Estagiário
                if (textoUpper.includes('ESTAGI')) {
                  if (!idExtraido.includes('(Estagiários)')) {
                    idExtraido += ' (Estagiários)';
                  }
                }

                currentContestId = idExtraido;
              }
            }
          }

          // 📄 Processa os Links de Documentos
          if (tagName === 'a') {
            if (currentContestBlocked) return;

            const href = $inner(el).attr('href') || '';
            const hrefLower = href.toLowerCase();

            const isDoc = hrefLower.endsWith('.pdf') || hrefLower.endsWith('.doc') || hrefLower.endsWith('.docx') || hrefLower.includes('wp-content/uploads') || hrefLower.includes('ecrie.com.br');
            if (!isDoc) return;

            const linkCompleto = href.startsWith('http') ? href : `${baseUrl}${href}`;
            if (linksProcessados.has(linkCompleto)) return;
            linksProcessados.add(linkCompleto);

            let tituloDoc = $inner(el).text().replace(/\s+/g, ' ').trim();
            if (!tituloDoc || tituloDoc.toLowerCase() === 'download') {
              tituloDoc = $inner(el).attr('title') || 'Documento Anexo';
            }

            if (ehSujeira(tituloDoc, [], linkCompleto)) return;

            let docTimestamp = pasta.dataCapaTimestamp;
            let docDataFormatada = 'sem data';

            const dataExtraidaDoc = extrairData(tituloDoc);
            if (dataExtraidaDoc) {
              docDataFormatada = dataExtraidaDoc.dataFormatada;
              docTimestamp = dataExtraidaDoc.dataTimestamp;
              tituloDoc = tituloDoc.replace(/\b\d{2}[\/\.]\d{2}[\/\.]\d{4}\b/g, '').trim();
            } else if (pasta.dataCapaTimestamp > 0) {
              const d = new Date(pasta.dataCapaTimestamp);
              docDataFormatada = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
            }

            // Inversão de Ordem no Feed (O 1º arquivo fica na base, o último no topo)
            docTimestamp += (docIndex * 60000);
            docIndex++;
            ordemGlobal++;

            const idReal = currentContestId || `Concursos ${pasta.tituloPasta}`;
            let anoExtraido: number | undefined;
            const matchAno = idReal.match(/\/(\d{4})\b/);
            if (matchAno) anoExtraido = parseInt(matchAno[1], 10);

            tituloDoc = tituloDoc.replace(/^[\d\/\.\-\s\|]+/, '').trim();

            resultados.push({
              cidade: 'Santa Salete',
              orgao: 'Prefeitura',
              titulo: tituloDoc || 'Documento',
              concurso: idReal,
              ano: anoExtraido,
              link: linkCompleto,
              dataPublicacao: docDataFormatada,
              dataTimestamp: docTimestamp,
              ordemOriginal: ordemGlobal,
              linkOrigem: pasta.linkCompleto
            });
          }
        });

      } catch (e: any) {
        throw new Error(`Erro ao processar página interna de Santa Salete: ${pasta.linkCompleto}`);
      }
    }));

  } catch (e) {
    console.error(`Erro geral em Santa Salete` + ": " + (e as Error).message);
  }

  return resultados;
}