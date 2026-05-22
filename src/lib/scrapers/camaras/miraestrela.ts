// src/lib/scrapers/camaras/miraestrela.ts
import * as cheerio from 'cheerio';
import { Edital } from '../../../types';
import { ehSujeira, extrairIdConcurso } from '../../filtrosGlobais';

export async function buscarCamaraMiraEstrela(): Promise<Edital[]> {
  const resultados: Edital[] = [];
  const baseUrl = 'https://www.camaramiraestrela.sp.gov.br';
  const urlInicial = `${baseUrl}/?pag=T0RZPU9EYz1PR009T1RrPU9EWT1PVEE9T1dFPQ==&view=LIST-EDT&tipo=7`;
  let ordemGlobal = 0;

  try {
    // 1. ACESSA A PÁGINA INICIAL E BUSCA OS ANOS
    const resAnos = await fetch(urlInicial, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' });
    if (!resAnos.ok) return [];

    const htmlAnos = await resAnos.text();
    const $anos = cheerio.load(htmlAnos);

    const linksAnos: string[] = [];
    $anos('.anoAcess a').each((_, el) => {
      const href = $anos(el).attr('href') || '';
      if (href) linksAnos.push(href.startsWith('http') ? href : `${baseUrl}/${href.replace(/^\//, '')}`);
    });

    // 2. ENTRA NAS PÁGINAS DE CADA ANO E PEGA OS LINKS DE DETALHES DOS CONCURSOS
    const linksConcursos = new Set<string>();

    await Promise.all(linksAnos.map(async (urlAno) => {
      try {
        const resLista = await fetch(urlAno, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' });
        if (!resLista.ok) return;
        const htmlLista = await resLista.text();
        const $lista = cheerio.load(htmlLista);

        // Procura os botões "Clique aqui para saber mais detalhes"
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
        const resDetalhes = await fetch(urlConcurso, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' });
        if (!resDetalhes.ok) return;
        const htmlDetalhes = await resDetalhes.text();
        const $ = cheerio.load(htmlDetalhes);

        // Extrai as informações da Tabela Principal (Capa)
        const tituloBruto = $('.tituloPagina').first().text().replace(/\s+/g, ' ').trim();
        const dataCriacaoStr = $('#linha_data td').last().text().trim();
        const ementa = $('#linha_assunto td').last().text().replace(/\s+/g, ' ').trim();
        const numProcesso = $('#linha_n_processo td').last().text().trim();

        const textoParaAnalise = `${tituloBruto} ${ementa}`;

        // 🛑 FILTRO GLOBAL: Se a ementa tiver "Simplificado", bloqueia a página toda!
        if (ehSujeira(textoParaAnalise, [])) return;

        // Monta o ID do Concurso
        let idConcurso = extrairIdConcurso(ementa, '', true, false);
        if (!idConcurso) {
          const matchAno = numProcesso.match(/\/(\d{4})|-(\d{4})/);
          const anoExt = matchAno ? (matchAno[1] || matchAno[2]) : new Date().getFullYear();
          idConcurso = `Concurso Público 01/${anoExt}`;
        }
        if (idConcurso.startsWith('Concurso ')) {
          idConcurso = idConcurso.replace('Concurso ', 'Concurso Público ');
        }

        let anoConcurso: number | undefined;
        const mAno = idConcurso.match(/\/(\d{4})\b/);
        if (mAno) anoConcurso = parseInt(mAno[1], 10);

        // Converte a data da Capa para Timestamp
        let baseFormatada = 'sem data';
        let baseTimestamp = 0;
        const matchData = dataCriacaoStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
        if (matchData) {
          baseFormatada = matchData[0];
          baseTimestamp = new Date(`${matchData[3]}-${matchData[2]}-${matchData[1]}T00:00:00`).getTime();
        }

        // Função local para transformar o <form> de download em um Link <a>
        const extrairLinkDoFormulario = ($form: cheerio.Cheerio<any>): string | null => {
          if ($form.length === 0) return null;
          const action = $form.attr('action') || 'indexAjax.php';
          const params = new URLSearchParams();
          $form.find('input[type="hidden"]').each((_, input) => {
            const name = $(input).attr('name');
            const val = $(input).attr('value');
            if (name && val) params.append(name, val);
          });
          const queryCompleta = params.toString();
          return `${baseUrl}/${action}${action.includes('?') ? '&' : '?'}${queryCompleta}`;
        };

        const documentosDestaPasta: any[] = [];

        // ==========================================
        // A) CAPTURA O EDITAL PRINCIPAL (TABELA 1)
        // ==========================================
        const $formCapa = $('#linha_arq form');
        const linkEditalPrincipal = extrairLinkDoFormulario($formCapa);

        if (linkEditalPrincipal) {
          documentosDestaPasta.push({
            titulo: 'Edital de Abertura',
            descricao: ementa, // Coloca a Ementa como descrição
            link: linkEditalPrincipal,
            dataFormatada: baseFormatada,
            // 🚀 Subtrai 2 minutos para garantir que o Edital Principal fique no fundo da pasta
            dataTimestamp: baseTimestamp > 0 ? baseTimestamp - 120000 : 0
          });
        }

        // ==========================================
        // B) CAPTURA OS DOCUMENTOS RELACIONADOS (TABELA 2)
        // ==========================================
        let temRelacionados = false;
        $('h3').each((_, h3) => {
          if ($(h3).text().toUpperCase().includes('DOCUMENTOS RELACIONADOS')) {
            temRelacionados = true;
            const $tabelaDocs = $(h3).next('table');

            $tabelaDocs.find('tbody tr').each((indexDoc, tr) => {
              const docEmenta = $(tr).find('td[id^="col_ementa"]').text().replace(/\s+/g, ' ').trim();
              const docDataStr = $(tr).find('td[id^="col_data"]').text().trim();
              const $formDoc = $(tr).find('td[id^="col_arq"] form');

              const docLink = extrairLinkDoFormulario($formDoc);

              if (docLink && !ehSujeira(docEmenta)) {
                let docDataF = baseFormatada;
                let docTime = baseTimestamp;

                const matchDocD = docDataStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
                if (matchDocD) {
                  docDataF = matchDocD[0];
                  docTime = new Date(`${matchDocD[3]}-${matchDocD[2]}-${matchDocD[1]}T00:00:00`).getTime();
                }

                // 🚀 Bônus de tempo inverso: Os primeiros da tabela (mais novos) ganham mais minutos!
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
          }
        });

        // Se o concurso não tem Edital Principal nem anexos, joga fora a pasta
        if (documentosDestaPasta.length === 0) return;

        // Salva todos os documentos extraídos
        documentosDestaPasta.forEach(doc => {
          ordemGlobal++;
          resultados.push({
            cidade: 'Mira Estrela',
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
        console.error(`Erro ao processar a página interna de Mira Estrela (Câmara): ${urlConcurso}`);
      }
    }));

  } catch (e: any) { throw new Error(`Erro geral ao buscar Câmara de Mira Estrela` + ": " + e.message); }

  return resultados;
}