// src/lib/scrapers/instar.ts
import * as cheerio from 'cheerio';
import { Edital } from '../../types';
import { ehSujeira } from '../filtrosGlobais';

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

  const statuses = ['Aberto', 'Em%20Andamento', 'Em%20Julgamento', 'Homologado'];
  const endpoints = statuses.map(status => `${config.baseUrl}${basePath}${status}/numero-ano-processo-decrescente/0`);

  try {
    // ==============================================================
    // 🚀 FASE 1: Baixa as 4 categorias ao mesmo tempo
    // ==============================================================
    const htmlsCategorias = await Promise.all(endpoints.map(async (url) => {
      try {
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' });
        return res.ok ? await res.text() : '';
      } catch { return ''; }
    }));

    const concursosParaBaixar: any[] = [];
    const linksProcessados = new Set<string>();

    for (const html of htmlsCategorias) {
      if (!html) continue;
      const $ = cheerio.load(html);

      $('div.ed_edital').each((_, elemento) => {

        // 🛑 REGRA DE CORTE DE ANO E EXTRAÇÃO DE DATA BASE
        const postagemRaw = $(elemento).find('.ed_cont_postagem_edital span.sw_lato').text().trim();
        let dataCertameFormatada = 'sem data';
        let dataCertameTimestamp = 0;

        const matchPostagem = postagemRaw.match(/(\d{2})\/(\d{2})\/(\d{4})/);
        if (matchPostagem) {
          const anoPostagem = parseInt(matchPostagem[3], 10);
          // Ignora certames lançados antes de 2019
          if (anoPostagem < 2019) return;

          dataCertameFormatada = matchPostagem[0];
          dataCertameTimestamp = new Date(`${matchPostagem[3]}-${matchPostagem[2]}-${matchPostagem[1]}T00:00:00`).getTime();
        }

        const tituloMain = $(elemento).find('.ed_titulo_edital').text().trim();
        const descricaoMain = $(elemento).find('.ed_descricao_edital').text().trim();

        const href = $(elemento).find('a').first().attr('href') || '';
        const linkCompleto = href.startsWith('http') ? href : `${config.baseUrl}${href}`;

        if (linksProcessados.has(linkCompleto)) return;
        linksProcessados.add(linkCompleto);

        // 🛡️ O ESCUDO GLOBAL DA PASTA
        if (ehSujeira(`${tituloMain} ${descricaoMain}`, palavrasLocais, linkCompleto)) return;

        let modalidadeRaw = '';
        $(elemento).find('.ed_area_info_modalidade_situacao span.sw_lato_bold').each((_, spanEl) => {
          if ($(spanEl).text().includes('Modalidade:')) {
            modalidadeRaw = $(spanEl).next('span').text().trim();
          }
        });

        let modalidade = modalidadeRaw.replace(/P[UÚ]BLICO/ig, '').trim();
        if (!modalidade) modalidade = 'Processo Seletivo';

        let numeroFormatado = '';
        const matchNum = tituloMain.match(/(\d{1,3})[\s\/\-_]+(\d{2}|\d{4})\b/);
        if (matchNum) {
          const num = parseInt(matchNum[1], 10).toString().padStart(2, '0');
          let ano = matchNum[2];
          if (ano.length === 2) ano = `20${ano}`;
          numeroFormatado = `${num}/${ano}`;
        }

        const idConcurso = numeroFormatado ? `${modalidade} ${numeroFormatado}` : tituloMain;

        concursosParaBaixar.push({
          linkCompleto,
          idConcurso,
          tituloMain,
          dataCertameFormatada, // <--- Guardamos a data do Certame aqui
          dataCertameTimestamp  // <--- para servir de Fallback depois!
        });
      });
    }

    // ==============================================================
    // 🚀 FASE 2: Processamento das Páginas Internas em Lotes de 15
    // ==============================================================
    const TAMANHO_LOTE = 15;

    for (let i = 0; i < concursosParaBaixar.length; i += TAMANHO_LOTE) {
      const lote = concursosParaBaixar.slice(i, i + TAMANHO_LOTE);

      await Promise.all(lote.map(async (concurso) => {
        try {
          const resInner = await fetch(concurso.linkCompleto, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' });
          if (!resInner.ok) return;

          const htmlInner = await resInner.text();
          const $inner = cheerio.load(htmlInner);

          $inner('.ed_cont_arquivos .ed_arquivo_edital').each((_, el) => {
            const aTag = $inner(el).find('a');
            const hrefDoc = aTag.attr('href') || '';
            if (!hrefDoc) return;

            const linkDoc = hrefDoc.startsWith('http') ? hrefDoc : `${config.baseUrl}${hrefDoc}`;

            // 🛡️ ESCUDO DO PDF
            if (ehSujeira('', palavrasLocais, linkDoc)) return;

            // 🌟 CORREÇÃO ESTRUTURAL DO NOME DO ARQUIVO E SUAS VARIAÇÕES
            const nomeElement = $inner(el).find('.ed_nome_arquivo').clone();
            const tamanhoTexto = nomeElement.find('.ed_info_tamanho_arquivo').text().replace(/\s+/g, ' ').trim();

            // Remove estritamente o tamanho, preservando as tags <strong> ou <b> caso existam!
            nomeElement.find('.ed_info_tamanho_arquivo').remove();
            const nomeTexto = nomeElement.text().replace(/\s+/g, ' ').trim();

            const categoriaTitulo = $inner(el).find('.ed_descricao_tipo_arquivo').text().replace(/\s+/g, ' ').trim();

            let tituloFinal = '';
            let descricaoFinal = '';

            // Se tem categoria (Ex: "Edital Resumido"), a gente inverte e o nome vira descrição.
            if (categoriaTitulo) {
              tituloFinal = categoriaTitulo;
              descricaoFinal = tamanhoTexto ? `${nomeTexto} (${tamanhoTexto})` : nomeTexto;
            } else {
              // Se NÃO tem categoria, o nome próprio (Ex: "EDITAL") vira Título! E a descrição recebe só o tamanho.
              tituloFinal = nomeTexto || 'Documento Anexo';
              descricaoFinal = tamanhoTexto ? `(${tamanhoTexto})` : '';
            }

            // 🛡️ ESCUDO FINAL: Valida o texto que extraímos para garantir que não é licitação disfarçada
            if (ehSujeira(`${tituloFinal} ${descricaoFinal}`, palavrasLocais)) return;

            // 📅 EXTRAÇÃO DA DATA (Com o Novo Fallback sem Download)
            const dataSpan = $inner(el).find('.ed_data_hora_arquivo span').first().text().trim();
            let dataFormatada = 'sem data';
            let dataTimestamp = 0;

            const matchData = dataSpan.match(/(\d{2})\/(\d{2})\/(\d{4})/);

            if (matchData) {
              // Achou a data perfeitamente no Card
              dataFormatada = matchData[0];
              dataTimestamp = new Date(`${matchData[3]}-${matchData[2]}-${matchData[1]}T00:00:00`).getTime();
            } else {
              // A DATA TAVA VAZIA NO CARD! Usa a data da postagem original do Concurso
              dataFormatada = concurso.dataCertameFormatada;
              dataTimestamp = concurso.dataCertameTimestamp;
            }

            let anoConcurso: number | undefined = undefined;
            if (concurso.idConcurso) {
              const matchAno = concurso.idConcurso.match(/\/(\d{4})\b/);
              if (matchAno) anoConcurso = parseInt(matchAno[1], 10);
            }

            ordemGlobal++;

            resultados.push({
              cidade: config.cidade,
              orgao: orgao,
              titulo: tituloFinal,
              descricao: descricaoFinal || undefined,
              concurso: concurso.idConcurso,
              ano: anoConcurso,
              link: linkDoc,
              metadados: undefined,
              statusGeral: undefined,
              dataPublicacao: dataFormatada,
              dataTimestamp: dataTimestamp,
              ordemOriginal: ordemGlobal
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