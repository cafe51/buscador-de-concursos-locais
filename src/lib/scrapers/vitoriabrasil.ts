// src/lib/scrapers/vitoriabrasil.ts
import * as cheerio from 'cheerio';
import { Edital } from '../../types';
import { ehSujeira, extrairIdConcurso, corrigirErrosDigitacao } from '../filtrosGlobais';
import { extrairTextoBruto } from '../docParser';
import { fetchHtml, extrairData } from './utils';

type PastaExtraida = {
  idConcurso: string;
  tituloPasta: string;
  dataTimestamp: number;
  documentos: Omit<Edital, 'ordemOriginal'>[];
};

export async function buscarVitoriaBrasil(): Promise<Edital[]> {
  const resultados: Edital[] = [];
  const pastasExtraidas: PastaExtraida[] = [];

  const baseUrl = 'https://www.vitoriabrasil.sp.gov.br';
  const basePath = '/portal/editais/1/3/0/0/0/0/0/0/';
  const orgao = 'Prefeitura';
  const palavrasLocais: string[] = [];

  const statuses = ['Aberto', 'Em%20Andamento', 'Em%20Julgamento', 'Homologado', 'Encerrado'];
  const offsets = [0, 1, 2, 3, 4, 10, 12, 20, 24, 30, 36, 40, 48, 50, 60, 72, 80, 90, 100];

  const endpoints: string[] = [];
  statuses.forEach(status => {
    offsets.forEach(offset => {
      endpoints.push(`${baseUrl}${basePath}${status}/numero-ano-processo-decrescente/${offset}`);
    });
  });

  try {
    const htmlsCategorias: string[] = [];
    const TAMANHO_LOTE_ENDPOINTS = 20;

    for (let i = 0; i < endpoints.length; i += TAMANHO_LOTE_ENDPOINTS) {
      const lote = endpoints.slice(i, i + TAMANHO_LOTE_ENDPOINTS);
      const respostas = await Promise.all(lote.map(async (url) => {
        try {
          const res = await fetchHtml(url);
          return res.ok ? res.html : '';
        } catch { return ''; }
      }));
      htmlsCategorias.push(...respostas);
    }

    const concursosParaBaixar: any[] = [];
    const linksProcessados = new Set<string>();

    for (const html of htmlsCategorias) {
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
        let anoPostagemDetectado: number | undefined = undefined;

        const dataExtraida = extrairData(postagemRaw);
        if (dataExtraida) {
          const anoPostagem = parseInt(dataExtraida.dataFormatada.split('/')[2], 10);
          if (anoPostagem < 2019) return;
          anoPostagemDetectado = anoPostagem;

          dataCertameFormatada = dataExtraida.dataFormatada;
          dataCertameTimestamp = dataExtraida.dataTimestamp;
        }

        const href = $(elemento).find('a').first().attr('href') || '';
        const linkCompleto = href.startsWith('http') ? href : `${baseUrl}${href}`;

        if (linksProcessados.has(linkCompleto)) return;
        linksProcessados.add(linkCompleto);

        const tituloMain = $(elemento).find('.ed_titulo_edital').text().replace(/\s+/g, ' ').trim();
        let descricaoMain = $(elemento).find('.ed_descricao_edital').text().replace(/\s+/g, ' ').trim();

        const textoParaAvaliar = `${tituloMain} ${descricaoMain}`;
        if (ehSujeira(textoParaAvaliar, palavrasLocais, linkCompleto)) return;

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

        let isFragmentado = false;
        let idAgrupamento = extrairIdConcurso(tituloMain, descricaoMain, true, false);

        if (!idAgrupamento) {
          isFragmentado = true;
          let anoFragmento = anoPostagemDetectado;

          if (!anoFragmento && numProcesso) {
            const matchAno = numProcesso.match(/\/(\d{4})\b/);
            if (matchAno) anoFragmento = parseInt(matchAno[1], 10);
          }

          const descCurta = descricaoMain ? descricaoMain.substring(0, 50).replace(/\|/g, '') : '';
          idAgrupamento = `TEMPORARIO|${modalidade}|${anoFragmento || 'Anterior'}|${descCurta}`;
        }

        concursosParaBaixar.push({
          linkCompleto,
          idConcurso: idAgrupamento,
          tituloMain,
          descricaoOriginal: descricaoMain,
          dataCertameFormatada,
          dataCertameTimestamp,
          anoConcurso: anoPostagemDetectado,
          isFragmentado
        });
      });
    }

    const TAMANHO_LOTE = 15;

    for (let i = 0; i < concursosParaBaixar.length; i += TAMANHO_LOTE) {
      const lote = concursosParaBaixar.slice(i, i + TAMANHO_LOTE);

      await Promise.all(lote.map(async (concurso) => {
        try {
          const resInner = await fetchHtml(concurso.linkCompleto);
          if (!resInner.ok) return;

          const htmlInner = resInner.html;
          const $inner = cheerio.load(htmlInner);

          const $abaDetalhesClone = $inner('#detalhes_edital').clone();
          $abaDetalhesClone.find('.vinc_area_slide_pessoas_vinculadas').remove();
          const textoAbaDetalhes = $abaDetalhesClone.text().replace(/\s+/g, ' ').trim();

          if (ehSujeira(textoAbaDetalhes, palavrasLocais, concurso.linkCompleto)) return;

          let concursoContaminado = false;
          const documentosTemporarios: any[] = [];

          let requerLogin = false;
          $inner('.itn_btn_login').each((_, el) => {
            const textoAlerta = $inner(el).text().toLowerCase();
            if (textoAlerta.includes('logado') || textoAlerta.includes('necessário')) requerLogin = true;
          });

          let anoExtraidoDoId = concurso.anoConcurso;
          if (!anoExtraidoDoId && concurso.idConcurso) {
            const matchAnoId = concurso.idConcurso.match(/\/(\d{4})\b/);
            if (matchAnoId) anoExtraidoDoId = parseInt(matchAnoId[1], 10);
          }

          if (requerLogin) {
            documentosTemporarios.push({
              titulo: '⚠️ Acesso Restrito (Requer Login)',
              descricao: 'A prefeitura exige cadastro no portal para visualizar os arquivos. Clique para acessar.',
              link: concurso.linkCompleto,
              dataFormatada: concurso.dataCertameFormatada,
              dataTimestamp: concurso.dataCertameTimestamp,
              finalIdConcurso: concurso.idConcurso
            });
          } else {
            const arquivosInternos = $inner('.ed_cont_arquivos .ed_arquivo_edital').toArray();

            for (const el of arquivosInternos) {
              const aTag = $inner(el).find('a');
              const hrefDoc = aTag.attr('href') || '';
              if (!hrefDoc) continue;

              let linkDoc = hrefDoc.startsWith('http') ? hrefDoc : `${baseUrl}${hrefDoc}`;

              // 🚀 BUSCA DO LINK VERDADEIRO IMEDIATA
              if (linkDoc.includes('/download/')) {
                let tentativas = 0;
                let sucesso = false;

                while (tentativas < 2 && !sucesso) {
                  try {
                    const resLink = await fetchHtml(linkDoc);

                    if (resLink.ok) {
                      const match = resLink.html.match(/<meta\s+http-equiv=["']refresh["']\s+content=["']0;\s*url=([^"']+)["']/i);
                      if (match && match[1]) {
                        let trueUrl = match[1];
                        if (trueUrl.startsWith('/')) {
                          trueUrl = `${baseUrl}${trueUrl}`;
                        } else if (!trueUrl.startsWith('http')) {
                          trueUrl = `${baseUrl}/${trueUrl}`;
                        }
                        linkDoc = trueUrl;
                      }
                      sucesso = true;
                    } else {
                      tentativas++;
                      await new Promise(r => setTimeout(r, 800));
                    }
                  } catch (e) {
                    tentativas++;
                    await new Promise(r => setTimeout(r, 800));
                  }
                }
              }

              let tituloFinal = '';
              let descricaoFinal = '';

              if (concurso.isFragmentado) {
                tituloFinal = concurso.tituloMain;
              } else {
                const nomeElement = $inner(el).find('.ed_nome_arquivo').clone();
                const tamanhoTexto = nomeElement.find('.ed_info_tamanho_arquivo').text().replace(/\s+/g, ' ').trim();
                nomeElement.find('.ed_info_tamanho_arquivo').remove();

                const nomeTexto = nomeElement.text().replace(/\s+/g, ' ').trim();
                const categoriaTitulo = $inner(el).find('.ed_descricao_tipo_arquivo').text().replace(/\s+/g, ' ').trim();

                if (categoriaTitulo) {
                  tituloFinal = categoriaTitulo;
                  descricaoFinal = tamanhoTexto ? `${nomeTexto} (${tamanhoTexto})` : nomeTexto;
                } else {
                  tituloFinal = nomeTexto || 'Documento Anexo';
                  descricaoFinal = tamanhoTexto ? `(${tamanhoTexto})` : '';
                }
              }

              if (ehSujeira(`${tituloFinal} ${descricaoFinal}`, palavrasLocais, linkDoc)) {
                concursoContaminado = true;
                break;
              }

              // A resolução do ID para concursos fragmentados foi centralizada
              // na Fase 2 (pós-agrupamento) para evitar resultados inconsistentes
              // entre documentos do mesmo grupo quando a leitura de PDF falha.
              let idResolvido = concurso.idConcurso;

              if (!concurso.isFragmentado && idResolvido.startsWith('Concurso ')) {
                idResolvido = idResolvido.replace('Concurso ', 'Concurso Público ');
              }

              const dataSpan = $inner(el).find('.ed_data_hora_arquivo span').first().text().trim();
              let dataFormatada = 'sem data';
              let dataTimestamp = 0;

              const dataExtraidaDoc = extrairData(dataSpan);
              if (dataExtraidaDoc) {
                dataFormatada = dataExtraidaDoc.dataFormatada;
                dataTimestamp = dataExtraidaDoc.dataTimestamp;
              } else if (concurso.dataCertameTimestamp > 0) {
                dataFormatada = concurso.dataCertameFormatada;
                dataTimestamp = concurso.dataCertameTimestamp;
              } else {
                const fallbackAno = anoExtraidoDoId || new Date().getFullYear();
                dataFormatada = `01/01/${fallbackAno}`;
                dataTimestamp = new Date(`${fallbackAno}-01-01T00:00:00`).getTime();
              }

              documentosTemporarios.push({
                titulo: tituloFinal,
                descricao: descricaoFinal,
                link: linkDoc,
                dataFormatada,
                dataTimestamp,
                finalIdConcurso: idResolvido
              });
            }
          }

          if (concursoContaminado) return;

          const idParaAglutinacao = concurso.isFragmentado
            ? concurso.idConcurso
            : (documentosTemporarios[0]?.finalIdConcurso || concurso.idConcurso);

          const docsDaPasta = documentosTemporarios.map(doc => ({
            cidade: 'Vitória Brasil',
            orgao: orgao,
            titulo: doc.titulo,
            descricao: doc.descricao || undefined,
            concurso: doc.finalIdConcurso,
            ano: anoExtraidoDoId,
            link: doc.link,
            metadados: undefined,
            statusGeral: undefined,
            dataPublicacao: doc.dataFormatada,
            dataTimestamp: doc.dataTimestamp,
            linkOrigem: concurso.linkCompleto
          }));

          pastasExtraidas.push({
            idConcurso: idParaAglutinacao,
            tituloPasta: concurso.tituloMain,
            dataTimestamp: concurso.dataCertameTimestamp || (docsDaPasta[0]?.dataTimestamp || 0),
            documentos: docsDaPasta
          });

        } catch (e: any) {
          const cause = (e as any).cause;
          const causeMsg = cause ? " - Detalhes: " + (cause.message || cause.code || JSON.stringify(cause)) : "";
          throw new Error(`Erro ao raspar a página interna de Vitória Brasil: ${concurso.linkCompleto}` + ": " + (e as Error).message + causeMsg);
        }
      }));
    }

    const pastasAgrupadas = new Map<string, PastaExtraida[]>();

    for (const pasta of pastasExtraidas) {
      if (!pastasAgrupadas.has(pasta.idConcurso)) {
        pastasAgrupadas.set(pasta.idConcurso, []);
      }
      pastasAgrupadas.get(pasta.idConcurso)!.push(pasta);
    }

    let ordemGlobal = 0;

    for (let [idGrupo, pastasDoConcurso] of pastasAgrupadas.entries()) {

      let idDefinitivo = idGrupo;

      if (idGrupo.startsWith('TEMPORARIO|')) {
        const partes = idGrupo.split('|');
        const fallbackName = `${partes[1]} ${partes[2] === 'Anterior' ? '' : partes[2]}`.trim();
        let idReal: string | undefined = undefined;

        buscaPdf: for (const pasta of pastasDoConcurso) {
          for (const doc of pasta.documentos) {
            if (doc.link.endsWith('.pdf') || doc.link.includes('download')) {
              try {
                let textoPdf = await extrairTextoBruto(doc.link);
                // Retentativa em caso de falha de rede/timeout
                if (!textoPdf) {
                  await new Promise(r => setTimeout(r, 1000));
                  textoPdf = await extrairTextoBruto(doc.link);
                }
                if (textoPdf) {
                  const cleanTexto = textoPdf.replace(/\s+/g, ' ');

                  // 1. Tenta o filtro global normal
                  let idExtraido = extrairIdConcurso(corrigirErrosDigitacao(cleanTexto), '');

                  // 2. Fallback Rústico
                  if (!idExtraido) {
                    const matchRustico = cleanTexto.match(/(Processo\s*Seletivo|Concurso\s*P[uú]blico)[^\d]{0,80}?(\d{1,3})\s*[\/\-]\s*(\d{4})/i);
                    if (matchRustico) {
                      const tipo = matchRustico[1].toLowerCase().includes('concurso') ? 'Concurso Público' : 'Processo Seletivo';
                      idExtraido = `${tipo} ${matchRustico[2].padStart(2, '0')}/${matchRustico[3]}`;
                    }
                  }

                  // 3. Fallback Espaçado
                  if (!idExtraido) {
                    const textoSemEspacos = cleanTexto.replace(/\s+/g, '');
                    const matchEspacado = textoSemEspacos.match(/(PROCESSOSELETIVO|CONCURSOP[UÚ]BLICO)[^\d]{0,50}?(\d{1,3})[\/\.\-](\d{4})/i);
                    if (matchEspacado) {
                      const tipo = matchEspacado[1].toUpperCase().includes('CONCURSO') ? 'Concurso Público' : 'Processo Seletivo';
                      idExtraido = `${tipo} ${matchEspacado[2].padStart(2, '0')}/${matchEspacado[3]}`;
                    }
                  }

                  if (idExtraido) {
                    idReal = idExtraido;
                    break buscaPdf;
                  }
                }
              } catch (e) { }
            }
          }
        }

        idDefinitivo = idReal || fallbackName;
        if (idDefinitivo.startsWith('Concurso ')) {
          idDefinitivo = idDefinitivo.replace('Concurso ', 'Concurso Público ');
        }
      }

      pastasDoConcurso.sort((a, b) => {
        if (a.dataTimestamp !== b.dataTimestamp) return a.dataTimestamp - b.dataTimestamp;
        if (a.documentos.length !== b.documentos.length) return b.documentos.length - a.documentos.length;
        // Desempate determinístico pelo título da pasta
        return a.tituloPasta.localeCompare(b.tituloPasta);
      });

      for (let i = 0; i < pastasDoConcurso.length; i++) {
        const pastaAtual = pastasDoConcurso[i];
        const isPrincipal = (i === 0);

        for (const doc of pastaAtual.documentos) {

          doc.concurso = idDefinitivo;

          if (!isPrincipal) {
            const marcador = "(*) ";
            if (doc.descricao) {
              doc.descricao = `${marcador}${pastaAtual.tituloPasta} - ${doc.descricao}`;
            } else {
              doc.descricao = `${marcador}${pastaAtual.tituloPasta}`;
            }
          }

          ordemGlobal++;
          resultados.push({
            ...doc,
            ordemOriginal: ordemGlobal
          });
        }
      }
    }

  } catch (e: any) {
    const cause = (e as any).cause;
    const causeMsg = cause ? " - Detalhes: " + (cause.message || cause.code || JSON.stringify(cause)) : "";
    throw new Error(`Erro geral ao buscar Vitória Brasil` + ": " + (e as Error).message + causeMsg);
  }

  return resultados;
}