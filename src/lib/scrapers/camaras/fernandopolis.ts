// src/lib/scrapers/camaras/fernandopolis.ts
import * as cheerio from 'cheerio';
import { Edital } from '../../../types';
import { ehSujeira, extrairIdConcurso } from '../../filtrosGlobais';

export async function buscarCamaraFernandopolis(): Promise<Edital[]> {
  const resultados: Edital[] = [];
  const baseUrl = 'https://camarafernandopolis.sp.gov.br';
  const urlInicial = `${baseUrl}/?pag=T0RZPU9EYz1PR009T1RrPU9EWT1PVEE9T1dFPQ==&view=LISTA_EDITAIS&tp=2`;
  let ordemGlobal = 0;

  try {
    // 1. ACESSA A PÁGINA INICIAL E BUSCA OS ANOS
    const resAnos = await fetch(urlInicial, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
      }, cache: 'no-store'
    });
    if (!resAnos.ok) return [];

    const htmlAnos = await resAnos.text();
    const $anos = cheerio.load(htmlAnos);

    const linksAnos: string[] = [];
    // O html de Fernandopolis tem links de anos soltos nas TDs da tabela
    $anos('table tbody tr td a').each((_, el) => {
      const href = $anos(el).attr('href') || '';
      if (href && href.includes('ano=')) {
        linksAnos.push(href.startsWith('http') ? href : `${baseUrl}/${href.replace(/^\//, '')}`);
      }
    });

    // 2. ENTRA NAS PÁGINAS DE CADA ANO E PEGA OS LINKS DE DETALHES
    const linksConcursos = new Set<string>();

    await Promise.all(linksAnos.map(async (urlAno) => {
      try {
        const resLista = await fetch(urlAno, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
          }, cache: 'no-store'
        });
        if (!resLista.ok) return;
        const htmlLista = await resLista.text();
        const $lista = cheerio.load(htmlLista);

        $lista('a').each((_, aEl) => {
          const textoLink = $lista(aEl).text().trim().toLowerCase();
          if (textoLink.includes('clique aqui para saber mais detalhes')) {
            const hrefConcurso = $lista(aEl).attr('href') || '';
            if (hrefConcurso) {
              linksConcursos.add(hrefConcurso.startsWith('http') ? hrefConcurso : `${baseUrl}/${hrefConcurso.replace(/^\//, '')}`);
            }
          }
        });
      } catch (e) { }
    }));

    // 3. ENTRA NA PÁGINA DE DETALHES DE CADA CONCURSO
    await Promise.all(Array.from(linksConcursos).map(async (urlConcurso) => {
      try {
        const resDetalhes = await fetch(urlConcurso, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
          }, cache: 'no-store'
        });
        if (!resDetalhes.ok) return;
        const htmlDetalhes = await resDetalhes.text();
        const $ = cheerio.load(htmlDetalhes);

        const tituloBruto = $('.tituloPagina').first().text().replace(/\s+/g, ' ').trim();
        // Em Fernandópolis, a ementa não tem classe/id no td, vamos pegar pela label:
        let ementa = '';
        let numProcesso = '';
        let dataCriacaoStr = '';

        $('table tbody tr').each((_, tr) => {
          const textLinha = $(tr).text().replace(/\s+/g, ' ').trim();
          if (textLinha.includes('Nº do Edital:')) numProcesso = $(tr).find('td').last().text().trim();
          if (textLinha.includes('Data de Criação:')) dataCriacaoStr = $(tr).find('td').last().text().trim();
          if (textLinha.includes('Ementa:')) ementa = $(tr).find('td').last().text().replace(/\s+/g, ' ').trim();
        });

        const textoParaAnalise = `${tituloBruto} ${ementa}`;

        // 🛑 FILTRO GLOBAL: Se a ementa tiver sujeira (como "Simplificado"), bloqueia
        if (ehSujeira(textoParaAnalise, [])) return;

        let idConcurso = extrairIdConcurso(ementa, '', true, false);
        if (!idConcurso) {
          const matchAno = numProcesso.match(/\/(\d{4})|-(\d{4})/);
          const anoExt = matchAno ? (matchAno[1] || matchAno[2]) : new Date().getFullYear();
          idConcurso = `Concurso Público 01/${anoExt}`;
        }
        if (idConcurso.startsWith('Concurso ')) {
          idConcurso = idConcurso.replace('Concurso ', 'Concurso Público ');
        }

        // Verifica se é de estagiários
        if (ementa.toUpperCase().includes('ESTAGI')) {
          if (!idConcurso.includes('(Estagiários)')) idConcurso += ' (Estagiários)';
        }

        let anoConcurso: number | undefined;
        const mAno = idConcurso.match(/\/(\d{4})\b/);
        if (mAno) anoConcurso = parseInt(mAno[1], 10);

        let baseFormatada = 'sem data';
        let baseTimestamp = 0;
        const matchData = dataCriacaoStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
        if (matchData) {
          baseFormatada = matchData[0];
          baseTimestamp = new Date(`${matchData[3]}-${matchData[2]}-${matchData[1]}T00:00:00`).getTime();
        }

        // ==============================================================
        // 🚀 O NOVO EXTRATOR DE FORMULÁRIO (Usando a API URL Nativa)
        // ==============================================================
        const extrairLinkDoFormulario = ($form: cheerio.Cheerio<any>): string | null => {
          if ($form.length === 0) return null;
          let action = $form.attr('action') || 'indexAjax.php';

          // Garante que é uma URL absoluta
          if (!action.startsWith('http')) {
            action = `${baseUrl}/${action.replace(/^\//, '')}`;
          }

          try {
            const urlObj = new URL(action);

            $form.find('input[type="hidden"]').each((_, input) => {
              const name = $(input).attr('name');
              const val = $(input).attr('value');
              if (name && val) {
                // O método set substitui parâmetros duplicados!
                urlObj.searchParams.set(name, val);
              }
            });

            // Limpa o ":443//" bizarro da url original deles e devolve limpo
            return urlObj.toString().replace(':443//', '/');
          } catch (e) {
            return null;
          }
        };

        const documentosDestaPasta: any[] = [];

        // ==========================================
        // A) CAPTURA O EDITAL PRINCIPAL (TABELA 1)
        // ==========================================
        let $formCapa: cheerio.Cheerio<any> | null = null;
        $('table tbody tr').each((_, tr) => {
          if ($(tr).text().includes('Arquivo Edital:')) {
            $formCapa = $(tr).find('form');
          }
        });

        if ($formCapa) {
          const linkEditalPrincipal = extrairLinkDoFormulario($formCapa);
          if (linkEditalPrincipal) {
            documentosDestaPasta.push({
              titulo: 'Edital de Abertura',
              descricao: ementa,
              link: linkEditalPrincipal,
              dataFormatada: baseFormatada,
              dataTimestamp: baseTimestamp > 0 ? baseTimestamp - 120000 : 0
            });
          }
        }

        // ==========================================
        // B) CAPTURA OS DOCUMENTOS RELACIONADOS (TABELAS EXTRAS)
        // ==========================================
        $('#listarmodificativos table tbody tr, #listardocumentos table tbody tr').each((indexDoc, tr) => {
          const tds = $(tr).find('td').toArray();
          if (tds.length < 3) return;

          const docEmenta = $(tds[0]).text().replace(/\s+/g, ' ').trim();
          const docDataStr = $(tds[1]).text().trim();
          const $formDoc = $(tds[2]).find('form');

          const docLink = extrairLinkDoFormulario($formDoc);

          if (docLink && !ehSujeira(docEmenta)) {
            let docDataF = baseFormatada;
            let docTime = baseTimestamp;

            const matchDocD = docDataStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
            if (matchDocD) {
              docDataF = matchDocD[0];
              docTime = new Date(`${matchDocD[3]}-${matchDocD[2]}-${matchDocD[1]}T00:00:00`).getTime();
            }

            docTime += ((50 - indexDoc) * 60000);

            documentosDestaPasta.push({
              titulo: docEmenta || 'Documento Anexo',
              descricao: undefined,
              link: docLink,
              dataFormatada: docDataF,
              dataTimestamp: docTime
            });
          }
        });

        if (documentosDestaPasta.length === 0) return;

        documentosDestaPasta.forEach(doc => {
          ordemGlobal++;
          resultados.push({
            cidade: 'Fernandópolis',
            orgao: 'Câmara Municipal',
            titulo: doc.titulo,
            descricao: doc.descricao,
            concurso: idConcurso,
            ano: anoConcurso,
            link: doc.link,
            dataPublicacao: doc.dataFormatada,
            dataTimestamp: doc.dataTimestamp,
            ordemOriginal: ordemGlobal,
            linkOrigem: urlConcurso
          });
        });

      } catch (error) {
        console.error(`Erro ao processar a página interna de Fernandópolis (Câmara): ${urlConcurso}`);
      }
    }));

  } catch (e: any) { throw new Error(`Erro geral ao buscar Câmara de Fernandópolis` + ": " + (e as Error).message); }

  return resultados;
}