// src/lib/scrapers/webline.ts
import * as cheerio from 'cheerio';
import { Edital } from '../../types';
import { ehSujeira, extrairIdConcurso } from '../filtrosGlobais';

export interface WeblineConfig {
  cidade: string;
  orgao?: string;
  baseUrl: string;
  urlBusca: string;
  limiteDataTimestamp?: number; // Ex: Parar a busca quando chegar em 2019
  corteAno?: number; // Ex: Não enviar para a tela os de 2018 pra baixo
}

export async function buscarWeblineBase(config: WeblineConfig): Promise<Edital[]> {
  const resultados: Edital[] = [];
  let ordemGlobal = 0;
  let chegouNoFim = false;

  const orgao = config.orgao || 'Prefeitura';

  // 🚀 LOTE AUMENTADO: Pede 20 páginas de uma vez só!
  for (let loteInicio = 1; ; loteInicio += 20) {
    if (chegouNoFim) break;

    const promessas = [];

    for (let pagina = loteInicio; pagina < loteInicio + 20; pagina++) {
      promessas.push(
        fetch(`${config.baseUrl}${config.urlBusca}&pg=${pagina}`, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' })
          .then(async (res) => {
            if (!res.ok) return { pagina, html: '' };
            return { pagina, html: await res.text() };
          })
          .catch(() => ({ pagina, html: '' }))
      );
    }

    const paginasBaixadas = await Promise.all(promessas);
    paginasBaixadas.sort((a, b) => a.pagina - b.pagina);

    for (const pag of paginasBaixadas) {
      if (!pag.html) continue;
      if (chegouNoFim) break;

      const $ = cheerio.load(pag.html);
      const elementosTabela = $('td[id^="col_titulo_noticia_"]').toArray();

      if (elementosTabela.length === 0) {
        chegouNoFim = true;
        break;
      }

      const itensDestaPagina: any[] = [];

      for (const elemento of elementosTabela) {
        const dataRaw = $(elemento).find('span.sub-data').text().trim();
        let dataFormatada = 'sem data';
        let dataTimestamp = 0;

        const matchData = dataRaw.match(/(\d{2})\/(\d{2})\/(\d{4})/);
        if (matchData) {
          dataFormatada = matchData[0];
          dataTimestamp = new Date(`${matchData[3]}-${matchData[2]}-${matchData[1]}T00:00:00`).getTime();
        }

        // Se passamos a data limite configurada para a cidade, abortamos a busca global
        if (config.limiteDataTimestamp && dataTimestamp > 0 && dataTimestamp < config.limiteDataTimestamp) {
          chegouNoFim = true;
          break;
        }

        const cloneTd = $(elemento).clone();
        cloneTd.find('span.sub-data').remove();
        cloneTd.find('br').replaceWith(' ');
        const tituloLimpo = cloneTd.text().replace(/\s+/g, ' ').trim();

        if (ehSujeira(tituloLimpo)) continue;

        const linkData = $(elemento).closest('tr').attr('data-linknoticia');
        let linkCompleto = '';

        if (linkData) {
          if (linkData.startsWith('http')) {
            linkCompleto = linkData;
          } else {
            // Algumas cidades usam index2.php, outras apenas a raiz. Adequamos o link!
            const isIndex2 = config.urlBusca.includes('index2.php');
            const prefixo = isIndex2 && linkData.startsWith('?') ? '/index2.php' : '/';
            const linkLimpo = linkData.startsWith('/') ? linkData.substring(1) : linkData;

            linkCompleto = linkData.startsWith('?') ? `${config.baseUrl}${prefixo}${linkData}` : `${config.baseUrl}/${linkLimpo}`;
          }
        } else {
          linkCompleto = `${config.baseUrl}${config.urlBusca}&pg=${pag.pagina}`;
        }

        if (tituloLimpo) {
          ordemGlobal++;
          const idConcursoInicial = extrairIdConcurso(tituloLimpo, '', true, false);

          itensDestaPagina.push({
            tituloLimpo,
            linkCompleto,
            dataFormatada,
            dataTimestamp,
            ordemGlobal,
            idConcursoInicial
          });
        }
      }

      // ⚡ O TURBO: Processa todos os resgates de HTML desta página ao mesmo tempo!
      await Promise.all(itensDestaPagina.map(async (item) => {
        let idConcurso = item.idConcursoInicial;
        let descartarCard = false;

        if (!idConcurso) {
          try {
            const resNoticia = await fetch(item.linkCompleto, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'force-cache' });

            if (resNoticia.ok) {
              const htmlNoticia = await resNoticia.text();
              const $noticia = cheerio.load(htmlNoticia);

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
          } catch (e) { }
        }

        if (descartarCard) return;

        let anoConcurso: number | undefined = undefined;
        if (idConcurso) {
          const matchAno = idConcurso.match(/\/(\d{4})\b/);
          if (matchAno) anoConcurso = parseInt(matchAno[1], 10);
        }

        // 🛑 REGRA DE CORTE EXCLUSIVA DA CIDADE (Ex: Não exibir <= 2018)
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
    }
  }

  return resultados;
}