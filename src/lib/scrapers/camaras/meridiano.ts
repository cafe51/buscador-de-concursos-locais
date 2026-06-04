// src/lib/scrapers/camaras/meridiano.ts
import * as cheerio from 'cheerio';
import { Edital } from '../../../types';
import { ehSujeira, extrairIdConcurso } from '../../filtrosGlobais';
import { fetchHtml } from '../utils';

export async function buscarCamaraMeridiano(opcoes?: import('../../../types').ScraperOptions): Promise<Edital[]> {
  if (opcoes?.verificarDisponibilidade) {
    const { verificaDisponibilidade } = await import('../utils');
    await verificaDisponibilidade('https://camarameridiano.sp.gov.br/');
    return [];
  }

  const resultados: Edital[] = [];
  let ordemGlobal = 0;

  const urlLista = 'https://camarameridiano.sp.gov.br/site/concurso/';

  // 🛑 FILTRO LOCAL: Bloqueia lixos administrativos específicos dessa câmara
  const palavrasLocais = ['licitacao', 'dispensa', 'sentenca', 'contrato'];

  try {
    const res = await fetchHtml(urlLista, false, 15000);
    if (!res.ok) return [];

    const html = res.html;
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
    const TAMANHO_LOTE = 5;
    for (let i = 0; i < itensParaProcessar.length; i += TAMANHO_LOTE) {
      const lote = itensParaProcessar.slice(i, i + TAMANHO_LOTE);

      await Promise.all(lote.map(async (item, loteIndex) => {
        const index = i + loteIndex;
        try {
          const resInner = await fetchHtml(item.linkInner, false, 15000);
          if (!resInner.ok) return;
          const htmlInner = resInner.html;
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
        } catch (e: any) {
          throw new Error(`Erro ao buscar detalhes da Câmara Meridiano: ${item.linkInner}`);
        }
      }));
    }

  } catch (e) {
    console.error('Erro geral ao buscar Câmara Meridiano' + ": " + (e as Error).message);
  }

  return resultados;
}