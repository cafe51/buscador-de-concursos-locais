// src/lib/scrapers/instar.ts
import * as cheerio from 'cheerio';
import { Edital } from '../../types';
import { ehSujeira, ehAndamentoOrfao, extrairIdConcurso } from '../filtrosGlobais';

export interface InstarConfig {
  cidade: string;
  orgao?: string;
  baseUrl: string;
  basePath?: string;
  palavrasLocais?: string[];
}

export async function buscarInstarBase(config: InstarConfig): Promise<Edital[]> {
  const resultados: Edital[] = [];
  let ordemGlobal = 0;

  const orgao = config.orgao || 'Prefeitura';
  const basePath = config.basePath || '/portal/editais/1/3/0/0/0/0/0/0/';
  const palavrasLocais = config.palavrasLocais || [];

  // ✅ Status 'Encerrado' devidamente adicionado
  const statuses = ['Aberto', 'Em%20Andamento', 'Em%20Julgamento', 'Homologado', 'Encerrado'];

  // 🚀 O SEGREDO DA PAGINAÇÃO PROFUNDA
  // Portais Instar ocultam os concursos mais velhos (como os de 2022) nas páginas seguintes.
  // Como o tamanho da página pode ser 10, 12, ou por ID de página (1, 2), 
  // geramos os offsets exatos para "varrer" o histórico até ~100 itens por status!
  const offsets = [0, 1, 2, 3, 4, 10, 12, 20, 24, 30, 36, 40, 48, 50, 60, 72, 80, 90, 100];

  const endpoints: string[] = [];
  statuses.forEach(status => {
    offsets.forEach(offset => {
      endpoints.push(`${config.baseUrl}${basePath}${status}/numero-ano-processo-decrescente/${offset}`);
    });
  });

  try {
    const htmlsCategorias: string[] = [];
    const TAMANHO_LOTE_ENDPOINTS = 20;

    // Dispara as buscas das dezenas de páginas em lotes para não estourar o firewall da Prefeitura
    for (let i = 0; i < endpoints.length; i += TAMANHO_LOTE_ENDPOINTS) {
      const lote = endpoints.slice(i, i + TAMANHO_LOTE_ENDPOINTS);
      const respostas = await Promise.all(lote.map(async (url) => {
        try {
          const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' });
          return res.ok ? await res.text() : '';
        } catch { return ''; }
      }));
      htmlsCategorias.push(...respostas);
    }

    const concursosParaBaixar: any[] = [];
    const linksProcessados = new Set<string>();

    // 🛡️ O linksProcessados garante que se lermos o mesmo edital em duas páginas diferentes, ele não duplica!
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

        const matchPostagem = postagemRaw.match(/(\d{2})\/(\d{2})\/(\d{4})/);
        if (matchPostagem) {
          const anoPostagem = parseInt(matchPostagem[3], 10);
          if (anoPostagem < 2019) return;

          dataCertameFormatada = matchPostagem[0];
          dataCertameTimestamp = new Date(`${matchPostagem[3]}-${matchPostagem[2]}-${matchPostagem[1]}T00:00:00`).getTime();
        }

        const href = $(elemento).find('a').first().attr('href') || '';
        const linkCompleto = href.startsWith('http') ? href : `${config.baseUrl}${href}`;

        // Impede duplicações de sobreposição de páginas
        if (linksProcessados.has(linkCompleto)) return;
        linksProcessados.add(linkCompleto);

        const tituloMain = $(elemento).find('.ed_titulo_edital').text().replace(/\s+/g, ' ').trim();
        const descricaoMain = $(elemento).find('.ed_descricao_edital').text().replace(/\s+/g, ' ').trim();
        const textoParaAvaliar = `${tituloMain} ${descricaoMain}`;

        if (ehSujeira(textoParaAvaliar, palavrasLocais, linkCompleto)) return;
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

          if (!idConcurso) {
            idConcurso = tituloMain;
          }
        }

        if (idConcurso && idConcurso.startsWith('Concurso ')) {
          idConcurso = idConcurso.replace('Concurso ', 'Concurso Público ');
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

    const TAMANHO_LOTE = 15;

    for (let i = 0; i < concursosParaBaixar.length; i += TAMANHO_LOTE) {
      const lote = concursosParaBaixar.slice(i, i + TAMANHO_LOTE);

      await Promise.all(lote.map(async (concurso) => {
        try {
          const resInner = await fetch(concurso.linkCompleto, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' });
          if (!resInner.ok) return;

          const htmlInner = await resInner.text();
          const $inner = cheerio.load(htmlInner);

          // ==============================================================
          // 🛡️ O ESCUDO DE FASE 2: Avalia a aba "Detalhes" por completo!
          // ==============================================================
          const textoAbaDetalhes = $inner('#detalhes_edital').text().replace(/\s+/g, ' ').trim();

          if (ehSujeira(textoAbaDetalhes, palavrasLocais, concurso.linkCompleto)) {
            return;
          }

          let concursoContaminado = false;
          const documentosTemporarios: any[] = [];

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

            let tituloFinal = '';
            let descricaoFinal = '';

            if (categoriaTitulo) {
              tituloFinal = categoriaTitulo;
              descricaoFinal = tamanhoTexto ? `${nomeTexto} (${tamanhoTexto})` : nomeTexto;
            } else {
              tituloFinal = nomeTexto || 'Documento Anexo';
              descricaoFinal = tamanhoTexto ? `(${tamanhoTexto})` : '';
            }

            if (ehSujeira(`${tituloFinal} ${descricaoFinal}`, palavrasLocais, linkDoc)) {
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

          if (concursoContaminado) return;

          let anoConcurso: number | undefined = undefined;
          if (concurso.idConcurso) {
            const matchAno = concurso.idConcurso.match(/\/(\d{4})\b/);
            if (matchAno) anoConcurso = parseInt(matchAno[1], 10);
          }

          documentosTemporarios.forEach((doc) => {
            ordemGlobal++;
            resultados.push({
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
              ordemOriginal: ordemGlobal,
              linkOrigem: concurso.linkCompleto // 🚀 Guardamos a referência! (Opcional)
            });
          });

        } catch (e) {
          console.error(`Erro ao raspar a página interna de ${config.cidade}: ${concurso.linkCompleto}`, e);
        }
      }));
    }

  } catch (e) {
    console.error(`Erro geral ao buscar via InstarBase (${config.cidade})`, e);
  }

  return resultados;
}