// src/lib/scrapers/camaras/indiapora.ts
import * as cheerio from 'cheerio';
import { Edital } from '../../../types';
import { ehSujeira, extrairIdConcurso } from '../../filtrosGlobais';

export async function buscarCamaraIndiapora(): Promise<Edital[]> {
  const resultados: Edital[] = [];
  let ordemGlobal = 0;

  const baseUrl = 'https://www.indiapora.sp.leg.br';
  let chegouNoFim = false;

  const basePath = '/transparencia/concursos';
  const pastasParaProcessar: any[] = [];

  try {
    // 1. PAGINAÇÃO DO PORTAL PLONE (b_start:int)
    for (let pagina = 1; pagina <= 3; pagina++) {
      if (chegouNoFim) break;

      const offset = (pagina - 1) * 30;
      const urlLista = pagina === 1 ? `${baseUrl}${basePath}` : `${baseUrl}${basePath}?b_start:int=${offset}`;

      const res = await fetch(urlLista, { headers: { 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
        }, cache: 'no-store' });
      if (!res.ok) {
        chegouNoFim = true;
        break;
      }

      const html = await res.text();
      const $ = cheerio.load(html);

      let itensLista = $('#content-core div.item').toArray();
      if (itensLista.length === 0) itensLista = $('.list-item').toArray();
      if (itensLista.length === 0) itensLista = $('article').toArray();

      if (itensLista.length === 0) {
        chegouNoFim = true;
        break;
      }

      for (const el of itensLista) {
        let $link = $(el).find('h2.headline a');
        if ($link.length === 0) $link = $(el).find('h3 a, h2 a, h4 a, .card-title a');
        if ($link.length === 0) $link = $(el).find('a').first();

        const tituloPasta = $link.text().replace(/\s+/g, ' ').trim();
        const hrefPasta = $link.attr('href') || '';
        const rawTextItem = $(el).text().replace(/\s+/g, ' ').trim();

        // 🛑 REGRA ESTRITA: O título da pasta deve começar com "Concurso Público"
        if (!tituloPasta.toUpperCase().startsWith('CONCURSO PÚBLICO')) continue;

        let anoConcurso: number | undefined = undefined;
        const matchAno = tituloPasta.match(/\/(\d{4})\b/);
        if (matchAno) anoConcurso = parseInt(matchAno[1], 10);

        // 🛑 REGRA ESTRITA: Apenas a partir de 2019
        if (anoConcurso && anoConcurso < 2019) continue;

        if (ehSujeira(tituloPasta)) continue;

        let dataCapaFormatada = 'sem data';
        let dataCapaTimestamp = 0;

        const matchCapa = rawTextItem.match(/(?:publicado|última modificação)[\s:\-]*(\d{2}\/\d{2}\/\d{4})/i);
        if (matchCapa) {
          const partesData = matchCapa[1].split('/');
          dataCapaFormatada = matchCapa[1];
          dataCapaTimestamp = new Date(`${partesData[2]}-${partesData[1]}-${partesData[0]}T00:00:00`).getTime();
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
          anoConcurso,
          dataCapaFormatada,
          dataCapaTimestamp
        });
      }

      const proximaPagina = $('.next a').length > 0 || $('.pagination .page-link[rel="next"]').length > 0;
      if (!proximaPagina) {
        chegouNoFim = true;
      }
    }

    // 2. PROCESSAR PÁGINAS INTERNAS COM O "LEITOR CONTÍNUO"
    await Promise.all(pastasParaProcessar.map(async (pasta) => {
      try {
        const resInner = await fetch(pasta.linkCompletoPasta, { headers: { 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
        }, cache: 'no-store' });
        if (!resInner.ok) return;

        const htmlInner = await resInner.text();
        const $inner = cheerio.load(htmlInner);

        const $contentCore = $inner('#content-core');
        if ($contentCore.length === 0) return;

        const arquivosList: any[] = [];
        let currentArquivo: any = null;

        // =========================================================================
        // 🚀 O LEITOR SEMÂNTICO: Navega em cada nó mantendo o texto colado!
        // =========================================================================
        function traverseNodes(node: any) {
          if (node.type === 'tag' && node.name === 'a') {
            const href = node.attribs?.href || '';
            const hrefLimpo = href.toLowerCase().split('?')[0].split('#')[0];

            // Se achar a tag com /view, fecha o arquivo atual e começa o próximo!
            if (hrefLimpo.endsWith('/view')) {
              if (currentArquivo) arquivosList.push(currentArquivo);

              currentArquivo = {
                href: href,
                titulo: $inner(node).text().replace(/\s+/g, ' ').trim(),
                rawText: '' // Tudo que vier depois dele vai cair aqui
              };
              return; // 🛑 Impede que o texto do link "vaze" para o rawText
            }
          }

          // Se for qualquer texto (mesmo dentro de <p> ou outros <a>), joga no arquivo atual!
          if (node.type === 'text' && currentArquivo) {
            currentArquivo.rawText += ' ' + node.data;
          }

          if (node.children) {
            node.children.forEach(traverseNodes);
          }
        }

        $contentCore[0].childNodes.forEach(traverseNodes);
        if (currentArquivo) arquivosList.push(currentArquivo);

        // 3. Montar os resultados
        arquivosList.forEach((arq, i) => {
          const hrefDoc = arq.href;
          let tituloDoc = arq.titulo;
          const linkDoc = hrefDoc.startsWith('http') ? hrefDoc : `${baseUrl}${hrefDoc}`;

          let rawTextAfter = arq.rawText.replace(/\s+/g, ' ').trim();

          let dataDocFormatada = pasta.dataCapaFormatada;
          let dataDocTimestamp = pasta.dataCapaTimestamp;

          // Extrai data
          const matchPub = rawTextAfter.match(/publicado\s+(\d{2}\/\d{2}\/\d{4})/i);
          const matchMod = rawTextAfter.match(/última modificação\s+(\d{2}\/\d{2}\/\d{4})/i);
          const matchFinal = matchPub || matchMod;

          if (matchFinal) {
            const partesData = matchFinal[1].split('/');
            dataDocFormatada = matchFinal[1];
            dataDocTimestamp = new Date(`${partesData[2]}-${partesData[1]}-${partesData[0]}T00:00:00`).getTime();
          }

          // 🧹 Limpador de Metadados: Apaga data e autor e deixa a Descrição Pura
          let descricaoDoc = rawTextAfter
            .replace(/(?:publicado|última modificação)[\s:\-]*\d{2}\/\d{2}\/\d{4}(?:\s+\d{2}h\d{2})?[,;\s]*/ig, '')
            .replace(/por\s+india\s*por[aã]/ig, '')
            .replace(/por\s+indiapor[aã]/ig, '') // Variação junta
            .replace(/^[,\-\s—]+/, '') // Limpa traços e vírgulas inúteis no começo
            .trim();

          if (!tituloDoc) tituloDoc = 'Documento Anexo';
          if (ehSujeira(tituloDoc, [], linkDoc)) return;

          // Inversão Temporal para o Feed
          dataDocTimestamp += (i * 60000);
          ordemGlobal++;

          resultados.push({
            cidade: 'Indiaporã',
            orgao: 'Câmara Municipal',
            titulo: tituloDoc,
            descricao: descricaoDoc || undefined,
            concurso: pasta.idConcurso,
            ano: pasta.anoConcurso,
            link: linkDoc,
            dataPublicacao: dataDocFormatada,
            dataTimestamp: dataDocTimestamp,
            ordemOriginal: ordemGlobal,
            linkOrigem: pasta.linkCompletoPasta
          });
        });

      } catch (error: any) { throw new Error(`Erro ao ler página interna da Câmara de Indiaporã: ${pasta.linkCompletoPasta}` + ": " + error.message); }
    }));

  } catch (error: any) { throw new Error('Erro geral ao buscar Câmara Indiaporã' + ": " + error.message); }

  return resultados;
}