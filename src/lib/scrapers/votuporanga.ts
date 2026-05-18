import * as cheerio from 'cheerio';
import { Edital } from '../../types';
import { ehSujeira } from '../filtrosGlobais';

export async function buscarVotuporanga(): Promise<Edital[]> {
  const resultados: Edital[] = [];
  let ordemGlobal = 0;

  const endpoints = [
    { status: 'Aberto', url: 'https://www.votuporanga.sp.gov.br/portal/editais/1/3/0/0/0/0/0/0/Aberto/numero-ano-processo-decrescente/0' },
    { status: 'Em Andamento', url: 'https://www.votuporanga.sp.gov.br/portal/editais/1/3/0/0/0/0/0/0/Em%20Andamento/numero-ano-processo-decrescente/0' },
    { status: 'Em Julgamento', url: 'https://www.votuporanga.sp.gov.br/portal/editais/1/3/0/0/0/0/0/0/Em%20Julgamento/numero-ano-processo-decrescente/0' },
    { status: 'Homologado', url: 'https://www.votuporanga.sp.gov.br/portal/editais/1/3/0/0/0/0/0/0/Homologado/numero-ano-processo-decrescente/0' }
  ];

  for (const item of endpoints) {
    try {
      const response = await fetch(item.url, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' });
      if (!response.ok) continue;

      const html = await response.text();
      const $ = cheerio.load(html);

      const concursosParaBaixar: any[] = [];

      // FASE 1: Coleta a "Capa das Pastas" na página principal
      $('div.ed_edital').each((_, elemento) => {
        const tituloMain = $(elemento).find('.ed_titulo_edital').text().trim();
        const descricaoMain = $(elemento).find('.ed_descricao_edital').text().trim();

        const href = $(elemento).find('a').first().attr('href') || '';
        const linkCompleto = href.startsWith('http') ? href : `https://www.votuporanga.sp.gov.br${href}`;

        // 🛡️ ESCUDO: Se a capa for de licitação, pula na hora
        if (ehSujeira(`${tituloMain} ${descricaoMain}`, [], linkCompleto)) return;

        // 3. CAPTURA A MODALIDADE PARA MONTAR A CHAVE DO CONCURSO
        let modalidadeRaw = '';
        $(elemento).find('.ed_area_info_modalidade_situacao span.sw_lato_bold').each((_, spanEl) => {
          if ($(spanEl).text().includes('Modalidade:')) {
            modalidadeRaw = $(spanEl).next('span').text().trim(); // Pega "Processo Seletivo" ou "Concurso Público"
          }
        });

        // Tira a palavra "Público" para padronizar ("Concurso Público" vira só "Concurso")
        let modalidade = modalidadeRaw.replace(/P[UÚ]BLICO/ig, '').trim();
        if (!modalidade) modalidade = 'Processo Seletivo'; // Fallback de segurança

        // Extrai o número do Título (Ex: de "Nº 01/2025" pega "01/2025")
        let numeroFormatado = '';
        const matchNum = tituloMain.match(/(\d{1,3})[\s\/\-_]+(\d{2}|\d{4})\b/);
        if (matchNum) {
          const num = parseInt(matchNum[1], 10).toString().padStart(2, '0');
          let ano = matchNum[2];
          if (ano.length === 2) ano = `20${ano}`;
          numeroFormatado = `${num}/${ano}`;
        }

        // Monta a chave final: "Processo Seletivo 01/2025"
        const idConcurso = numeroFormatado ? `${modalidade} ${numeroFormatado}` : tituloMain;

        concursosParaBaixar.push({
          linkCompleto,
          idConcurso,
          status: item.status,
          tituloMain
        });
      });

      // FASE 2: Entra na página de cada Concurso e varre os Arquivos Reais
      for (const concurso of concursosParaBaixar) {
        try {
          const resInner = await fetch(concurso.linkCompleto, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' });
          if (!resInner.ok) continue;

          const htmlInner = await resInner.text();
          const $inner = cheerio.load(htmlInner);

          // Pega todos os cards de documentos dentro da div mãe
          $inner('.ed_cont_arquivos .ed_arquivo_edital').each((_, el) => {
            const aTag = $inner(el).find('a');
            const hrefDoc = aTag.attr('href') || '';
            if (!hrefDoc) return;

            const linkDoc = hrefDoc.startsWith('http') ? hrefDoc : `https://www.votuporanga.sp.gov.br${hrefDoc}`;

            // 🛡️ ESCUDO DO PDF
            if (ehSujeira('', [], linkDoc)) return;

            // 2. INVERSÃO DE TÍTULO E DESCRIÇÃO
            const nomeElement = $inner(el).find('.ed_nome_arquivo');
            const nomeTexto = nomeElement.clone().children().remove().end().text().replace(/\s+/g, ' ').trim();
            const tamanhoTexto = nomeElement.find('.ed_info_tamanho_arquivo').text().replace(/\s+/g, ' ').trim();

            // A antiga "Categoria" agora é o nosso Título Principal!
            let categoriaTitulo = $inner(el).find('.ed_descricao_tipo_arquivo').text().replace(/\s+/g, ' ').trim();
            if (!categoriaTitulo) categoriaTitulo = 'Atualização / Documento';

            // O antigo Título (nome + KB) agora é a nossa Descrição!
            const descricaoArquivo = tamanhoTexto ? `${nomeTexto} (${tamanhoTexto})` : nomeTexto;

            // 🛡️ ESCUDO FINAL: Valida o texto que extraímos para garantir que não é licitação
            if (ehSujeira(descricaoArquivo)) return;

            // Extração da Data
            const dataSpan = $inner(el).find('.ed_data_hora_arquivo span').first().text().trim();
            let dataTimestamp = 0;
            let dataFormatada = 'sem data';

            const matchData = dataSpan.match(/(\d{2})\/(\d{2})\/(\d{4})/);
            if (matchData) {
              dataFormatada = matchData[0];
              dataTimestamp = new Date(`${matchData[3]}-${matchData[2]}-${matchData[1]}T00:00:00`).getTime();
            }

            ordemGlobal++;

            // GERA O CARD!
            resultados.push({
              cidade: 'Votuporanga',
              orgao: 'Prefeitura',
              titulo: categoriaTitulo,       // Título = "Convocações", "Gabaritos", etc
              descricao: descricaoArquivo,   // Descrição = "Convocação nº 22 (PDF - 116 KB)"
              concurso: concurso.idConcurso, // Chave 🗂️ "Processo Seletivo 01/2025"
              link: linkDoc,
              metadados: undefined,          // 1. Metadado ("Processo nº 3/2023") removido!
              statusGeral: concurso.status,  // Pílula 📌 Aberto / Homologado
              dataPublicacao: dataFormatada,
              dataTimestamp: dataTimestamp,
              ordemOriginal: ordemGlobal
            });
          });

        } catch (e) {
          console.error(`Erro ao raspar a página interna de Votuporanga: ${concurso.linkCompleto}`, e);
        }
      }

    } catch (e) {
      console.error(`Erro ao buscar Votuporanga (${item.status})`, e);
    }
  }
  return resultados;
}