// src/lib/scrapers/camaras/meridiano.ts
import * as cheerio from 'cheerio';
import { Edital } from '../../../types';
import { ehSujeira, extrairIdConcurso } from '../../filtrosGlobais';

export async function buscarCamaraMeridiano(): Promise<Edital[]> {
  const resultados: Edital[] = [];
  let ordemGlobal = 0;

  const urlLista = 'https://camarameridiano.sp.gov.br/site/concurso/';

  // 🛑 FILTRO LOCAL: Bloqueia lixos administrativos específicos dessa câmara
  const palavrasLocais = ['licitacao', 'dispensa', 'sentenca', 'contrato'];

  try {
    const res = await fetch(urlLista, { headers: { 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
        }, cache: 'no-store' });
    if (!res.ok) return [];

    const html = await res.text();
    const $ = cheerio.load(html);

    const itensParaProcessar: any[] = [];

    // O plugin WPDM (Download Manager) cria essas divs
    $('#content_wpdm_package_1 .well.c2a3').each((_, el) => {
      const $titleLink = $(el).find('.media-heading a');
      const tituloFull = $titleLink.text().replace(/\s+/g, ' ').trim();
      const hrefInner = $titleLink.attr('href') || '';

      if (!hrefInner) return;
      if (ehSujeira(tituloFull, palavrasLocais)) return;

      let idConcurso = extrairIdConcurso(tituloFull, '', true, false);
      if (!idConcurso) {
        idConcurso = tituloFull;
      }
      if (idConcurso && idConcurso.startsWith('Concurso ')) {
        idConcurso = idConcurso.replace('Concurso ', 'Concurso Público ');
      }

      let anoConcurso: number | undefined = undefined;
      const matchAno = idConcurso.match(/\/(\d{4})\b/);
      if (matchAno) anoConcurso = parseInt(matchAno[1], 10);

      itensParaProcessar.push({
        titulo: tituloFull,
        linkInner: hrefInner,
        idConcurso,
        anoConcurso
      });
    });

    // 🚀 Entra nas páginas internas para buscar a Data de Publicação Oficial
    await Promise.all(itensParaProcessar.map(async (item, index) => {
      try {
        const resInner = await fetch(item.linkInner, { headers: { 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
        }, cache: 'no-store' });
        if (!resInner.ok) return;
        const htmlInner = await resInner.text();
        const $inner = cheerio.load(htmlInner);

        // Extrai a data limpa (ex: "12/06/2024")
        const dateText = $inner('.meta-date time').text().trim();

        let dataFormatada = 'sem data';
        let dataTimestamp = 0;

        const matchDate = dateText.match(/(\d{2})\/(\d{2})\/(\d{4})/);
        if (matchDate) {
          dataFormatada = matchDate[0];
          dataTimestamp = new Date(`${matchDate[3]}-${matchDate[2]}-${matchDate[1]}T00:00:00`).getTime();
        }

        if (dataTimestamp === 0 && item.anoConcurso) {
          dataFormatada = `01/01/${item.anoConcurso}`;
          dataTimestamp = new Date(`${item.anoConcurso}-01-01T00:00:00`).getTime();
        }

        // ====================================================================
        // 🚀 A MÁGICA DA ORDENAÇÃO: 
        // O WPDM lista os mais recentes no topo. Como o nosso App coloca
        // no topo o que tem maior timestamp, nós SUBTRAIMOS minutos.
        // O index 0 (Topo) perde 0 minutos. O fundo da página perde N minutos.
        // ====================================================================
        dataTimestamp -= (index * 60000);

        // Limpeza Estética: Tira o nome do concurso do título do arquivo, 
        // pois isso já estará no nome da pasta no nosso App!
        let tituloLimpo = item.titulo;
        const prefixRegex = /^(?:Concurso\s*(?:P[úu]blico\s*)?|Processo\s*Seletivo\s*)\d{1,3}[\/\.\-]\d{4}\s*[\-\|]?\s*/i;
        tituloLimpo = tituloLimpo.replace(prefixRegex, '').trim();

        if (!tituloLimpo) tituloLimpo = 'Documento Anexo';

        ordemGlobal++;

        resultados.push({
          cidade: 'Meridiano',
          orgao: 'Câmara Municipal', // 🏛️ NOVA ORGANIZAÇÃO
          titulo: tituloLimpo,
          concurso: item.idConcurso,
          ano: item.anoConcurso,
          link: item.linkInner, // Direcionamos pra página do arquivo pois os tokens de download do WP expiram
          dataPublicacao: dataFormatada,
          dataTimestamp: dataTimestamp,
          ordemOriginal: ordemGlobal,
          linkOrigem: urlLista
        });
      } catch (e: any) { throw new Error(`Erro ao buscar detalhes da Câmara Meridiano: ${item.linkInner}`);
      }
    }));

  } catch (e) {
    console.error('Erro geral ao buscar Câmara Meridiano' + ": " + e.message); }

  return resultados;
}