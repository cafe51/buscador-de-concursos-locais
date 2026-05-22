// src/lib/scrapers/santasalete.ts
import * as cheerio from 'cheerio';
import { Edital } from '../../types';
import { ehSujeira, extrairIdConcurso, corrigirErrosDigitacao } from '../filtrosGlobais';

export async function buscarSantaSalete(): Promise<Edital[]> {
  const resultados: Edital[] = [];
  const baseUrl = 'https://www.santasalete.sp.gov.br';
  const mainUrl = `${baseUrl}/consultas/concursos-e-processo-seletivo`;
  let ordemGlobal = 0;

  try {
    const res = await fetch(mainUrl, { headers: { 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
        }, cache: 'no-store' });
    if (!res.ok) return [];

    const html = await res.text();
    const $ = cheerio.load(html);
    const pastas: any[] = [];

    // 1. Coletar as Pastas Anuais (2025, 2024, 2022)
    $('article.list-item').each((_, el) => {
      const $link = $(el).find('.list-item__title a');
      const tituloPasta = $link.text().trim();
      const href = $link.attr('href');
      const textoData = $(el).find('p').text().trim();

      if (!href) return;

      let dataCapaTimestamp = 0;
      const matchCapa = textoData.match(/\b(\d{2})[\/\.](\d{2})[\/\.](\d{4})\b/);
      if (matchCapa) {
        dataCapaTimestamp = new Date(`${matchCapa[3]}-${matchCapa[2]}-${matchCapa[1]}T00:00:00`).getTime();
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
        const resInner = await fetch(pasta.linkCompleto, { headers: { 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
        }, cache: 'no-store' });
        if (!resInner.ok) return;
        const htmlInner = await resInner.text();
        const $inner = cheerio.load(htmlInner);

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
                // Se a prefeitura esqueceu de pôr número na capa (ex: os estagiários de 2025),
                // nós criamos o ID com a modalidade + ano da pasta mãe!
                if (!idExtraido) {
                  const modalidade = textoUpper.includes('CONCURSO') ? 'Concurso Público' : 'Processo Seletivo';
                  const anoPasta = pasta.tituloPasta; // Ex: "2025"
                  idExtraido = `${modalidade} 01/${anoPasta}`;
                }

                // Padronização e Limpeza
                if (idExtraido.startsWith('Concurso ')) {
                  idExtraido = idExtraido.replace('Concurso ', 'Concurso Público ');
                }

                // Exceção de Estagiário (Seguindo o precedente do Instar)
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

            const matchDataNome = tituloDoc.match(/\b(\d{2})[\.\/](\d{2})[\.\/](\d{4})\b/);
            if (matchDataNome) {
              docDataFormatada = `${matchDataNome[1]}/${matchDataNome[2]}/${matchDataNome[3]}`;
              docTimestamp = new Date(`${matchDataNome[3]}-${matchDataNome[2]}-${matchDataNome[1]}T00:00:00`).getTime();
              tituloDoc = tituloDoc.replace(matchDataNome[0], '').trim();
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

      } catch (e: any) { throw new Error(`Erro ao processar página interna de Santa Salete: ${pasta.linkCompleto}`);
      }
    }));

  } catch (e) {
    console.error(`Erro geral em Santa Salete` + ": " + e.message); }

  return resultados;
}