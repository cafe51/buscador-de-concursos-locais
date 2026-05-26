'use server'

import * as cheerio from 'cheerio';

export type Discrepancia = {
  cidade: string;
  concurso: string;
  linkOrigem: string;
  qtdNossa: number;
  qtdSite: number;
  linksOrigem: string[];
};

export async function auditarQuantidadesInstar(grupos: { nome: string, cidade: string, linksOrigem: string[], qtdNossa: number, temRestricao?: boolean }[]): Promise<Discrepancia[]> {
  const discrepancias: Discrepancia[] = [];
  const TAMANHO_LOTE = 10;

  console.log(`\n===================================================`);
  console.log(`🕵️ INICIANDO AUDITORIA EM ${grupos.length} PASTAS INSTAR...`);
  console.log(`===================================================`);

  for (let i = 0; i < grupos.length; i += TAMANHO_LOTE) {
    const lote = grupos.slice(i, i + TAMANHO_LOTE);

    await Promise.all(lote.map(async (grupo) => {
      if (grupo.temRestricao) return;

      let qtdSiteTotal = 0;
      let temInstar = false;

      for (const link of grupo.linksOrigem) {
        if (link && link.includes('/portal/editais/')) {
          temInstar = true;
          try {
            const res = await fetch(link, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' });
            if (res.ok) {
              const html = await res.text();
              const $ = cheerio.load(html);
              const textoBadge = $('#btn_arquivos_edital .ed_info_qtde_itens').text().trim();
              if (textoBadge) {
                qtdSiteTotal += parseInt(textoBadge, 10);
              }
            }
          } catch (e) { }
        }
      }

      if (temInstar && qtdSiteTotal > 0 && qtdSiteTotal !== grupo.qtdNossa) {
        discrepancias.push({
          cidade: grupo.cidade,
          concurso: grupo.nome,
          linkOrigem: grupo.linksOrigem[0] || '',
          qtdNossa: grupo.qtdNossa,
          qtdSite: qtdSiteTotal,
          linksOrigem: grupo.linksOrigem
        });
      }
    }));
  }

  console.log(`✅ AUDITORIA CONCLUÍDA! ${discrepancias.length} discrepâncias encontradas.\n`);
  return discrepancias;
}

export async function extrairDadosRawInstar(urlLista: string) {
  try {
    const urlObj = new URL(urlLista);
    const baseUrlStr = urlObj.origin;

    const res = await fetch(urlLista, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' });
    if (!res.ok) throw new Error("Falha ao acessar a URL fornecida.");

    const html = await res.text();
    const $ = cheerio.load(html);

    const linksInternos: string[] = [];

    $('div.ed_edital').each((_, el) => {
      const href = $(el).find('a').first().attr('href') || '';
      if (href) {
        linksInternos.push(href.startsWith('http') ? href : `${baseUrlStr}${href}`);
      }
    });

    const dadosRaw: any[] = [];

    await Promise.all(linksInternos.map(async (link) => {
      try {
        const innerRes = await fetch(link, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' });
        if (!innerRes.ok) return;

        const innerHtml = await innerRes.text();
        const $inner = cheerio.load(innerHtml);

        const titulo = $inner('.ed_titulo_edital').text().replace(/\s+/g, ' ').trim();

        let situacao = '';
        let modalidade = '';
        let numProcesso = '';
        let inicioInscricoes = '';
        let fimInscricoes = '';

        $inner('.ed_linha_lista_detalhes').each((_, el) => {
          const nomeDetalhe = $inner(el).find('.ed_nome_detalhe').text().trim().toLowerCase();
          const valorDetalhe = $inner(el).find('.ed_descricao_detalhe').text().replace(/\s+/g, ' ').trim();

          if (nomeDetalhe.includes('situação') || nomeDetalhe.includes('situacao')) situacao = valorDetalhe;
          else if (nomeDetalhe.includes('modalidade')) modalidade = valorDetalhe;
          else if (nomeDetalhe.includes('nº do processo') || nomeDetalhe.includes('nº processo')) numProcesso = valorDetalhe;
          else if (nomeDetalhe.includes('início das inscrições') || nomeDetalhe.includes('inicio das inscricoes')) inicioInscricoes = valorDetalhe;
          else if (nomeDetalhe.includes('fim das inscrições') || nomeDetalhe.includes('fim das inscricoes')) fimInscricoes = valorDetalhe;
        });

        let descricao = $inner('#detalhes_edital .sw_conteudo_vermais').text().replace(/\s+/g, ' ').trim();
        if (!descricao) {
          descricao = $inner('#detalhes_edital .sp_descricao_sessao').text().replace(/\s+/g, ' ').trim();
        }

        const badgeQtde = $inner('#btn_arquivos_edital .ed_info_qtde_itens').text().trim();
        const qtdeArquivosBadge = parseInt(badgeQtde, 10) || 0;

        const listaArquivos: { nome: string, link: string }[] = [];
        $inner('.ed_cont_arquivos .ed_arquivo_edital').each((_, el) => {
          const aTag = $inner(el).find('a');
          const hrefDoc = aTag.attr('href') || '';
          const linkDoc = hrefDoc.startsWith('http') ? hrefDoc : `${baseUrlStr}${hrefDoc}`;

          const nomeElement = $inner(el).find('.ed_nome_arquivo').clone();
          nomeElement.find('.ed_info_tamanho_arquivo').remove();
          const nomeTexto = nomeElement.text().replace(/\s+/g, ' ').trim();

          const categoria = $inner(el).find('.ed_descricao_tipo_arquivo').text().replace(/\s+/g, ' ').trim();
          const nomeFinal = categoria ? `${categoria} - ${nomeTexto}` : nomeTexto;

          listaArquivos.push({ nome: nomeFinal, link: linkDoc });
        });

        dadosRaw.push({
          linkOrigem: link,
          titulo,
          situacao,
          modalidade,
          numProcesso,
          inicioInscricoes,
          fimInscricoes,
          descricao,
          quantidadeArquivosBadge: qtdeArquivosBadge,
          quantidadeArquivosEncontrados: listaArquivos.length,
          listaArquivos
        });

      } catch (e) {
        console.error("Erro interno no Raw Scraper: ", link);
      }
    }));

    return dadosRaw;

  } catch (error: any) {
    console.error(error);
    return { erro: error.message };
  }
}
