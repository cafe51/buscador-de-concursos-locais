import * as cheerio from 'cheerio';
import { Edital } from '../../types';
import { ehSujeira, extrairIdConcurso } from '../filtrosGlobais';
import { fetchHtml, extrairData } from './utils';

export interface WeblineConfig {
  cidade: string;
  orgao?: string;
  baseUrl: string;
  urlBusca: string;
  limiteDataTimestamp?: number;
  corteAno?: number;
}

type ItemWebline = {
  tituloLimpo: string;
  linkCompleto: string;
  dataFormatada: string;
  dataTimestamp: number;
  ordemGlobal: number;
  idConcursoInicial: string | undefined;
};

async function processarItensPagina(itens: ItemWebline[], config: WeblineConfig, orgao: string): Promise<Edital[]> {
  const resultados: Edital[] = [];

  await Promise.all(itens.map(async (item) => {
    let idConcurso = item.idConcursoInicial;
    let descartarCard = false;

    if (!idConcurso) {
      const resNoticia = await fetchHtml(item.linkCompleto, true); // force cache
      if (resNoticia.ok) {
        const $noticia = cheerio.load(resNoticia.html);

        let $conteudo = $noticia('.WordSection1');
        if ($conteudo.length === 0) $conteudo = $noticia('#cont-noticia');
        if ($conteudo.length === 0) $conteudo = $noticia('body');

        $conteudo.find('script, style, nav, header, footer').remove();
        $conteudo.find('p, div, br, li, span, strong, b').append(' ');

        const textoDaNoticia = $conteudo.text().replace(/\s+/g, ' ').trim();

        if (textoDaNoticia.toLowerCase().includes('processo seletivo simplificado')) {
          descartarCard = true;
        } else {
          idConcurso = extrairIdConcurso(textoDaNoticia, '', false, true);
        }
      }
    }

    if (descartarCard) return;

    let anoConcurso: number | undefined = undefined;
    if (idConcurso) {
      const matchAno = idConcurso.match(/\/(\d{4})\b/);
      if (matchAno) anoConcurso = parseInt(matchAno[1], 10);
    }

    if (config.corteAno && anoConcurso && anoConcurso <= config.corteAno) {
      return;
    }

    resultados.push({
      cidade: config.cidade,
      orgao: orgao,
      titulo: item.tituloLimpo,
      concurso: idConcurso,
      ano: anoConcurso,
      link: item.linkCompleto,
      dataPublicacao: item.dataFormatada,
      dataTimestamp: item.dataTimestamp,
      ordemOriginal: item.ordemGlobal,
      linkOrigem: item.linkCompleto
    });
  }));

  return resultados;
}

export async function buscarWeblineBase(config: WeblineConfig): Promise<Edital[]> {
  const resultados: Edital[] = [];
  let ordemGlobal = 0;
  let chegouNoFim = false;
  const orgao = config.orgao || 'Prefeitura';

  for (let loteInicio = 1; ; loteInicio += 20) {
    if (chegouNoFim) break;

    const promessas = [];
    for (let pagina = loteInicio; pagina < loteInicio + 20; pagina++) {
      promessas.push(
        fetchHtml(`${config.baseUrl}${config.urlBusca}&pg=${pagina}`).then(res => ({ pagina, html: res.ok ? res.html : '' }))
      );
    }

    const paginasBaixadas = await Promise.all(promessas);
    paginasBaixadas.sort((a, b) => a.pagina - b.pagina);

    for (const pag of paginasBaixadas) {
      if (!pag.html || chegouNoFim) continue;

      const $ = cheerio.load(pag.html);
      const elementosTabela = $('td[id^="col_titulo_noticia_"]').toArray();

      if (elementosTabela.length === 0) {
        chegouNoFim = true;
        break;
      }

      const itensDestaPagina: ItemWebline[] = [];

      for (const elemento of elementosTabela) {
        const dataRaw = $(elemento).find('span.sub-data').text().trim();
        const dataProcessada = extrairData(dataRaw) || { dataFormatada: 'sem data', dataTimestamp: 0 };
        
        if (config.limiteDataTimestamp && dataProcessada.dataTimestamp > 0 && dataProcessada.dataTimestamp < config.limiteDataTimestamp) {
          chegouNoFim = true;
          break;
        }

        const cloneTd = $(elemento).clone();
        cloneTd.find('span.sub-data').remove();
        cloneTd.find('br').replaceWith(' ');
        const tituloLimpo = cloneTd.text().replace(/\s+/g, ' ').trim();

        if (ehSujeira(tituloLimpo)) continue;

        const linkData = $(elemento).closest('tr').attr('data-linknoticia');
        let linkCompleto = `${config.baseUrl}${config.urlBusca}&pg=${pag.pagina}`;

        if (linkData) {
          if (linkData.startsWith('http')) {
            linkCompleto = linkData;
          } else {
            const isIndex2 = config.urlBusca.includes('index2.php');
            const prefixo = isIndex2 && linkData.startsWith('?') ? '/index2.php' : '/';
            const linkLimpo = linkData.startsWith('/') ? linkData.substring(1) : linkData;
            linkCompleto = linkData.startsWith('?') ? `${config.baseUrl}${prefixo}${linkData}` : `${config.baseUrl}/${linkLimpo}`;
          }
        }

        if (tituloLimpo) {
          ordemGlobal++;
          itensDestaPagina.push({
            tituloLimpo,
            linkCompleto,
            dataFormatada: dataProcessada.dataFormatada,
            dataTimestamp: dataProcessada.dataTimestamp,
            ordemGlobal,
            idConcursoInicial: extrairIdConcurso(tituloLimpo, '', true, false)
          });
        }
      }

      const resultadosPagina = await processarItensPagina(itensDestaPagina, config, orgao);
      resultados.push(...resultadosPagina);
    }
  }

  return resultados;
}