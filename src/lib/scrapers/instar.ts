import * as cheerio from 'cheerio';
import { Edital } from '../../types';
import { ehSujeira, ehAndamentoOrfao, extrairIdConcurso } from '../filtrosGlobais';

export interface InstarConfig {
  cidade: string;
  orgao?: string;
  baseUrl: string;
  basePath?: string;
  palavrasLocais?: string[];
  excecoesPalavrasGlobais?: string[];
}

type PastaExtraida = {
  idConcurso: string;
  tituloPasta: string;
  dataTimestamp: number;
  documentos: Omit<Edital, 'ordemOriginal'>[];
};

type ConcursoInfo = {
  linkCompleto: string;
  idConcurso: string;
  tituloMain: string;
  dataCertameFormatada: string;
  dataCertameTimestamp: number;
};

// ============================================================================
// FUNÇÕES AUXILIARES
// ============================================================================

async function fetchCategoryPages(config: InstarConfig, endpoints: string[], detalhesFalhas: string[]): Promise<string[]> {
  const htmlsCategorias: string[] = [];
  const TAMANHO_LOTE_ENDPOINTS = 5;

  for (let i = 0; i < endpoints.length; i += TAMANHO_LOTE_ENDPOINTS) {
    const lote = endpoints.slice(i, i + TAMANHO_LOTE_ENDPOINTS);
    const respostas = await Promise.all(lote.map(async (url) => {
      let tentativas = 0;
      let sucesso = false;
      let htmlContent = '';
      let erroMsg = '';

      while (tentativas < 3 && !sucesso) {
        try {
          const res = await fetch(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
              'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
            }, cache: 'no-store'
          });
          if (res.ok) {
            htmlContent = await res.text();
            sucesso = true;
          } else {
            erroMsg = `HTTP ${res.status}`;
            tentativas++;
            if (tentativas < 3) await new Promise(r => setTimeout(r, 10000));
          }
        } catch (err: any) {
          erroMsg = err.message || 'fetch failed';
          tentativas++;
          if (tentativas < 3) await new Promise(r => setTimeout(r, 10000));
        }
      }

      if (!sucesso) {
        detalhesFalhas.push(`[REDE/TIMEOUT] Lista: ${url} -> ${erroMsg}`);
        return '';
      }
      return htmlContent;
    }));
    htmlsCategorias.push(...respostas);
  }
  return htmlsCategorias;
}

function parseConcursosList(htmls: string[], config: InstarConfig): ConcursoInfo[] {
  const concursosParaBaixar: ConcursoInfo[] = [];
  const linksProcessados = new Set<string>();
  const palavrasLocais = config.palavrasLocais || [];
  const excecoesGlobais = config.excecoesPalavrasGlobais || [];

  for (const html of htmls) {
    if (!html) continue;
    const $ = cheerio.load(html);

    $('div.ed_edital').each((_, elemento) => {
      let postagemRaw = '';
      const $divPostagem = $(elemento).find('.ed_cont_postagem_edital span.sw_lato');

      if ($divPostagem.length > 0 && $divPostagem.text().trim() !== '') {
        postagemRaw = $divPostagem.text().trim();
      } else {
        postagemRaw = $(elemento).find('.ed_cont_realizacao_edital').text().trim();
      }

      let dataCertameFormatada = 'sem data';
      let dataCertameTimestamp = 0;

      const matchPostagem = postagemRaw.match(/(\d{2})\/(\d{2})\/(\d{4})/);
      if (matchPostagem) {
        const anoPostagem = parseInt(matchPostagem[3], 10);
        if (anoPostagem < 2019) return;
        dataCertameFormatada = matchPostagem[0];
        dataCertameTimestamp = new Date(`${matchPostagem[3]}-${matchPostagem[2]}-${matchPostagem[1]}T00:00:00`).getTime();
      }

      const href = $(elemento).find('a').first().attr('href') || '';
      const linkCompleto = href.startsWith('http') ? href : `${config.baseUrl}${href}`;

      if (linksProcessados.has(linkCompleto)) return;
      linksProcessados.add(linkCompleto);

      const tituloMain = $(elemento).find('.ed_titulo_edital').text().replace(/\s+/g, ' ').trim();
      const descricaoMain = $(elemento).find('.ed_descricao_edital').text().replace(/\s+/g, ' ').trim();
      const textoParaAvaliar = `${tituloMain} ${descricaoMain}`;

      if (ehSujeira(textoParaAvaliar, palavrasLocais, linkCompleto, excecoesGlobais)) return;
      if (ehAndamentoOrfao(tituloMain, descricaoMain)) return;

      let idConcurso = extrairIdConcurso(tituloMain, descricaoMain, true, false);

      if (!idConcurso) {
        let modalidadeRaw = '';
        let numProcesso = '';

        $(elemento).find('.ed_area_info_modalidade_situacao span.sw_lato_bold').each((_, spanEl) => {
          if ($(spanEl).text().includes('Modalidade:')) {
            modalidadeRaw = $(spanEl).next('span').text().trim();
          }
        });

        $(elemento).find('.ed_area_info_numero_processo span.sw_lato_bold').each((_, spanEl) => {
          if ($(spanEl).text().includes('Nº Processo:')) {
            numProcesso = $(spanEl).next('span').text().trim();
          }
        });

        let modalidade = modalidadeRaw.replace(/P[UÚ]BLICO/ig, '').trim();
        if (!modalidade) modalidade = 'Processo Seletivo';

        if (numProcesso) {
          const matchNum = numProcesso.match(/(\d{1,3})[\s\/\-_]+(\d{2}|\d{4})\b/);
          if (matchNum) {
            const num = parseInt(matchNum[1], 10).toString().padStart(2, '0');
            let ano = matchNum[2];
            if (ano.length === 2) ano = `20${ano}`;
            idConcurso = `${modalidade} ${num}/${ano}`;
          }
        }

        if (!idConcurso) idConcurso = tituloMain;
      }

      if (idConcurso && idConcurso.startsWith('Concurso ')) {
        idConcurso = idConcurso.replace('Concurso ', 'Concurso Público ');
      }

      if (idConcurso) {
        const upperTitulo = tituloMain.toUpperCase();
        if (upperTitulo.includes('ESTAGI') || upperTitulo.includes('ESTÁGI')) {
          idConcurso += ' (Estagiários)';
        }
      }

      concursosParaBaixar.push({
        linkCompleto,
        idConcurso,
        tituloMain,
        dataCertameFormatada,
        dataCertameTimestamp
      });
    });
  }
  return concursosParaBaixar;
}

async function resolveTrueDownloadLink(docLink: string, baseUrl: string): Promise<string> {
  if (!docLink || !docLink.includes('/download/')) return docLink;

  let tentativas = 0;
  let sucesso = false;
  let resolvedLink = docLink;

  while (tentativas < 2 && !sucesso) {
    try {
      const resLink = await fetch(resolvedLink, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        }, cache: 'no-store'
      });

      if (resLink.ok) {
        const textLink = await resLink.text();
        const match = textLink.match(/<meta\s+http-equiv=["']refresh["']\s+content=["']0;\s*url=([^"']+)["']/i);
        if (match && match[1]) {
          let trueUrl = match[1];
          if (trueUrl.startsWith('/')) {
            trueUrl = `${baseUrl}${trueUrl}`;
          } else if (!trueUrl.startsWith('http')) {
            trueUrl = `${baseUrl}/${trueUrl}`;
          }
          resolvedLink = trueUrl;
        }
        sucesso = true;
      } else {
        tentativas++;
        await new Promise(r => setTimeout(r, 10000));
      }
    } catch (e) {
      tentativas++;
      await new Promise(r => setTimeout(r, 10000));
    }
  }
  return resolvedLink;
}

// ============================================================================
// FUNÇÃO PRINCIPAL
// ============================================================================

export async function buscarInstarBase(config: InstarConfig): Promise<Edital[]> {
  const resultados: Edital[] = [];
  const pastasExtraidas: PastaExtraida[] = [];
  const detalhesFalhas: string[] = [];

  const orgao = config.orgao || 'Prefeitura';
  const basePath = config.basePath || '/portal/editais/1/3/0/0/0/0/0/0/';
  const palavrasLocais = config.palavrasLocais || [];
  const excecoesGlobais = config.excecoesPalavrasGlobais || [];

  const statuses = ['Aberto', 'Em%20Andamento', 'Em%20Julgamento', 'Homologado', 'Encerrado'];
  const offsets = [0, 1, 2, 3, 4, 10, 12, 20, 24, 30, 36, 40, 48, 50, 60, 72, 80, 90, 100];

  const endpoints: string[] = [];
  statuses.forEach(status => {
    offsets.forEach(offset => {
      endpoints.push(`${config.baseUrl}${basePath}${status}/numero-ano-processo-decrescente/${offset}`);
    });
  });

  try {
    const htmlsCategorias = await fetchCategoryPages(config, endpoints, detalhesFalhas);
    const concursosParaBaixar = parseConcursosList(htmlsCategorias, config);

    const TAMANHO_LOTE = 3;

    for (let i = 0; i < concursosParaBaixar.length; i += TAMANHO_LOTE) {
      const lote = concursosParaBaixar.slice(i, i + TAMANHO_LOTE);

      await Promise.all(lote.map(async (concurso) => {
        try {
          let resInner: Response | undefined = undefined;
          let tentativasPasta = 0;
          let pastaSucesso = false;

          while (tentativasPasta < 3 && !pastaSucesso) {
            try {
              resInner = await fetch(concurso.linkCompleto, {
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                }, cache: 'no-store'
              });
              if (resInner.ok) pastaSucesso = true;
              else {
                tentativasPasta++;
                await new Promise(r => setTimeout(r, 10000));
              }
            } catch (e) {
              tentativasPasta++;
              await new Promise(r => setTimeout(r, 10000));
            }
          }

          if (!resInner || !resInner.ok) {
            detalhesFalhas.push(`[HTTP/REDE FALHA] Pasta Interna: ${concurso.linkCompleto}`);
            return;
          }

          const htmlInner = await resInner.text();
          const $inner = cheerio.load(htmlInner);

          const $abaDetalhesClone = $inner('#detalhes_edital').clone();
          $abaDetalhesClone.find('.vinc_area_slide_pessoas_vinculadas').remove();
          const textoAbaDetalhes = $abaDetalhesClone.text().replace(/\s+/g, ' ').trim();

          if (ehSujeira(textoAbaDetalhes, palavrasLocais, concurso.linkCompleto, excecoesGlobais)) return;

          let concursoContaminado = false;
          const documentosTemporarios: any[] = [];
          let requerLogin = false;

          $inner('.itn_btn_login').each((_, el) => {
            const textoAlerta = $inner(el).text().toLowerCase();
            if (textoAlerta.includes('logado') || textoAlerta.includes('necessário')) requerLogin = true;
          });

          if (requerLogin) {
            documentosTemporarios.push({
              titulo: '⚠️ Acesso Restrito (Requer Login)',
              descricao: 'A prefeitura exige cadastro no portal para visualizar os arquivos. Clique para acessar.',
              link: concurso.linkCompleto,
              dataFormatada: concurso.dataCertameFormatada,
              dataTimestamp: concurso.dataCertameTimestamp
            });
          } else {
            $inner('.ed_cont_arquivos .ed_arquivo_edital').each((_, el) => {
              const aTag = $inner(el).find('a');
              const hrefDoc = aTag.attr('href') || '';
              if (!hrefDoc) return;

              const linkDoc = hrefDoc.startsWith('http') ? hrefDoc : `${config.baseUrl}${hrefDoc}`;
              const nomeElement = $inner(el).find('.ed_nome_arquivo').clone();
              const tamanhoTexto = nomeElement.find('.ed_info_tamanho_arquivo').text().replace(/\s+/g, ' ').trim();
              nomeElement.find('.ed_info_tamanho_arquivo').remove();

              const nomeTexto = nomeElement.text().replace(/\s+/g, ' ').trim();
              const categoriaTitulo = $inner(el).find('.ed_descricao_tipo_arquivo').text().replace(/\s+/g, ' ').trim();

              let tituloFinal = categoriaTitulo || nomeTexto || 'Documento Anexo';
              let descricaoFinal = categoriaTitulo ? (tamanhoTexto ? `${nomeTexto} (${tamanhoTexto})` : nomeTexto) : (tamanhoTexto ? `(${tamanhoTexto})` : '');

              if (ehSujeira(`${tituloFinal} ${descricaoFinal}`, palavrasLocais, linkDoc, excecoesGlobais)) {
                concursoContaminado = true;
                return false;
              }

              const dataSpan = $inner(el).find('.ed_data_hora_arquivo span').first().text().trim();
              let dataFormatada = 'sem data';
              let dataTimestamp = 0;
              const matchData = dataSpan.match(/(\d{2})\/(\d{2})\/(\d{4})/);

              if (matchData) {
                dataFormatada = matchData[0];
                dataTimestamp = new Date(`${matchData[3]}-${matchData[2]}-${matchData[1]}T00:00:00`).getTime();
              } else {
                dataFormatada = concurso.dataCertameFormatada;
                dataTimestamp = concurso.dataCertameTimestamp;
              }

              documentosTemporarios.push({
                titulo: tituloFinal,
                descricao: descricaoFinal,
                link: linkDoc,
                dataFormatada,
                dataTimestamp
              });
            });
          }

          if (documentosTemporarios.length > 0) {
            for (const doc of documentosTemporarios) {
              doc.link = await resolveTrueDownloadLink(doc.link, config.baseUrl);
            }
          }

          if (concursoContaminado) return;

          let anoConcurso: number | undefined = undefined;
          if (concurso.idConcurso) {
            const matchAno = concurso.idConcurso.match(/\/(\d{4})\b/);
            if (matchAno) anoConcurso = parseInt(matchAno[1], 10);
          }

          const docsDaPasta = documentosTemporarios.map(doc => ({
            cidade: config.cidade,
            orgao: orgao,
            titulo: doc.titulo,
            descricao: doc.descricao || undefined,
            concurso: concurso.idConcurso,
            ano: anoConcurso,
            link: doc.link,
            metadados: undefined,
            statusGeral: undefined,
            dataPublicacao: doc.dataFormatada,
            dataTimestamp: doc.dataTimestamp,
            linkOrigem: concurso.linkCompleto
          }));

          pastasExtraidas.push({
            idConcurso: concurso.idConcurso || concurso.tituloMain,
            tituloPasta: concurso.tituloMain,
            dataTimestamp: concurso.dataCertameTimestamp,
            documentos: docsDaPasta
          });

        } catch (e: any) {
          detalhesFalhas.push(`[EXCEÇÃO CÓDIGO] Pasta Interna: ${concurso.linkCompleto} -> ${e.message}`);
        }
      }));
    }

    const pastasAgrupadas = new Map<string, PastaExtraida[]>();
    for (const pasta of pastasExtraidas) {
      if (!pastasAgrupadas.has(pasta.idConcurso)) pastasAgrupadas.set(pasta.idConcurso, []);
      pastasAgrupadas.get(pasta.idConcurso)!.push(pasta);
    }

    let ordemGlobal = 0;
    for (const pastasDoConcurso of pastasAgrupadas.values()) {
      pastasDoConcurso.sort((a, b) => {
        if (a.dataTimestamp !== b.dataTimestamp) return a.dataTimestamp - b.dataTimestamp;
        return b.documentos.length - a.documentos.length;
      });

      for (let i = 0; i < pastasDoConcurso.length; i++) {
        const pastaAtual = pastasDoConcurso[i];
        const isPrincipal = (i === 0);

        for (const doc of pastaAtual.documentos) {
          if (!isPrincipal) {
            const marcador = "(*) ";
            if (doc.descricao) {
              doc.descricao = `${marcador}${pastaAtual.tituloPasta} - ${doc.descricao}`;
            } else {
              doc.descricao = `${marcador}${pastaAtual.tituloPasta}`;
            }
          }
          ordemGlobal++;
          resultados.push({ ...doc, ordemOriginal: ordemGlobal });
        }
      }
    }

    if (detalhesFalhas.length > 0) {
      console.log(`\n⚠️ [DETETIVE INSTAR - ${config.cidade}] Foram detectadas ${detalhesFalhas.length} falhas:`);
      detalhesFalhas.forEach(f => console.log(`   -> ${f}`));

      const msg = `Conexão instável (${detalhesFalhas.length} falhas)`;
      if (resultados.length === 0) throw new Error(msg);
      else throw Object.assign(new Error(msg), { dadosParciais: resultados });
    }

  } catch (e: any) {
    if (e.dadosParciais || detalhesFalhas.length > 0) throw e;
    const cause = (e as any).cause;
    const causeMsg = cause ? " - Detalhes: " + (cause.message || cause.code || JSON.stringify(cause)) : "";
    throw new Error(`Erro geral no InstarBase: ${(e as Error).message}` + causeMsg);
  }

  return resultados;
}