import * as cheerio from 'cheerio';
import { Edital } from '../../types';
import { ehSujeira, ehRelevante, extrairIdConcurso, corrigirErrosDigitacao } from '../filtrosGlobais';
import { extrairTextoBruto, extrairDataDoArquivo } from '../docParser';
import { fetchHtml, extrairData } from './utils';

const TERMOS_OBRIGATORIOS_FERNANDOPOLIS = [
  'concurso', 'processo seletivo', 'processo de selecao', 'selecao de', 'estagiario', 'estagio',
  'atribuicao', 'contratacao', 'chamada publica', 'admissao', 'posse',
  'convocacao', 'convoca ', 'gabarito', 'resultado', 'classificacao', 'homologacao',
  'retificacao', 'rerratificacao', 'prorrogacao', 'recurso', 'respostas', 'comunicado',
  'provas', 'entrevista', 'inscricao', 'inscricoes', 'aviso', 'extrato'
];

function deveExcluirPorAno(idConcurso: string | undefined): boolean {
  if (!idConcurso) return false;
  const matchAno = idConcurso.match(/\/(\d{4})\b/);
  if (!matchAno) return false;
  const ano = parseInt(matchAno[1], 10);
  if (idConcurso.startsWith('Concurso') && ano <= 2015) return true;
  if (idConcurso.startsWith('Processo') && ano <= 2020) return true;
  return false;
}

interface PdfEncontrado {
  url: string;
  textoLink: string;
}

async function buscarDetalhesFernandopolis(url: string): Promise<{ sucesso: boolean, dataCorreta: string | null, descricaoExtra: string, pdfs: PdfEncontrado[] }> {
  const res = await fetchHtml(url, true);
  if (!res.ok) return { sucesso: false, dataCorreta: null, descricaoExtra: '', pdfs: [] };

  const $ = cheerio.load(res.html);
  let dataCorreta: string | null = null;
  
  $('time').each((_, elemento) => {
    const dataExtraida = extrairData($(elemento).text().trim());
    if (dataExtraida && !dataCorreta) dataCorreta = dataExtraida.dataFormatada;
  });

  const $main = $('main').clone();
  $main.find('aside, header, nav, script, .share__container, .horizontal--laptop').remove();

  const nomesDosLinks: string[] = [];
  const pdfsEncontrados: PdfEncontrado[] = [];

  $main.find('a').each((_, el) => {
    const href = $(el).attr('href') || '';
    
    let textoLink = $(el).text().replace(/\s+/g, ' ').trim();
    if (!textoLink || textoLink.toLowerCase() === 'download' || textoLink.toLowerCase() === 'ver') {
      textoLink = $(el).attr('title') || '';
    }

    textoLink = textoLink.replace(/^[\d\/\.\-\s]+/, '').trim();
    if (textoLink.startsWith('-')) textoLink = textoLink.substring(1).trim();

    if (href && href.match(/\.(pdf|docx?)$/i)) {
      const absoluteUrl = href.startsWith('http') ? href : `https://fernandopolis.sp.gov.br${href}`;
      let textoPdf = textoLink;
      
      if (!textoPdf) {
        try {
          const urlObj = new URL(absoluteUrl);
          const fileName = urlObj.pathname.split('/').pop() || '';
          textoPdf = decodeURIComponent(fileName) || 'Documento Anexo';
        } catch {
          textoPdf = 'Documento Anexo';
        }
      }

      if (!pdfsEncontrados.some(p => p.url === absoluteUrl)) {
        pdfsEncontrados.push({ url: absoluteUrl, textoLink: textoPdf });
      }
    }

    if (textoLink.length > 3 && !nomesDosLinks.includes(textoLink)) {
      nomesDosLinks.push(textoLink);
    }
  });

  return {
    sucesso: true,
    dataCorreta,
    descricaoExtra: nomesDosLinks.join(' | '),
    pdfs: pdfsEncontrados
  };
}

async function processarLoteDetalhes(lote: any[], resultados: Edital[], detalhesFalhas: string[]) {
  await Promise.all(lote.map(async (item) => {
    const detalhes = await buscarDetalhesFernandopolis(item.linkCompleto);
    
    if (!detalhes.sucesso) {
      detalhesFalhas.push(`[DETALHE FALHOU] ${item.linkCompleto}`);
      return;
    }

    let baseTimestamp = 0;
    if (detalhes.dataCorreta) {
      const parsedData = extrairData(detalhes.dataCorreta);
      if (parsedData) baseTimestamp = parsedData.dataTimestamp;
    }

    const descricaoFinalBase = [item.textoAoRedor, detalhes.descricaoExtra].filter(Boolean).join(' - ');
    let baseIdConcurso = extrairIdConcurso(item.titulo, descricaoFinalBase);
    
    item.editaisExpandidos = [];

    if (detalhes.pdfs.length === 0) {
      item.editaisExpandidos.push({
        descricaoFinal: descricaoFinalBase,
        idConcursoExtracao: baseIdConcurso,
        dataPublicacao: detalhes.dataCorreta || 'sem data',
        dataTimestamp: baseTimestamp,
        linkCorrigido: item.linkCompleto
      });
    } else {
      for (const pdf of detalhes.pdfs) {
        let pdfDataPublicacao = detalhes.dataCorreta || 'sem data';
        let pdfTimestamp = baseTimestamp;
        let pdfIdConcurso = baseIdConcurso;

        const dataDoc = await extrairDataDoArquivo(pdf.url);
        if (dataDoc) {
          pdfDataPublicacao = dataDoc.formatada;
          pdfTimestamp = dataDoc.timestamp;
        }

        if (!pdfIdConcurso) {
          const textoDoPdf = await extrairTextoBruto(pdf.url);
          if (textoDoPdf) {
            const textoCorrigido = corrigirErrosDigitacao(textoDoPdf);
            pdfIdConcurso = extrairIdConcurso(textoCorrigido, '');
          }
        }

        const descricaoPdf = [item.textoAoRedor, pdf.textoLink].filter(Boolean).join(' - ');

        item.editaisExpandidos.push({
          descricaoFinal: descricaoPdf,
          idConcursoExtracao: pdfIdConcurso,
          dataPublicacao: pdfDataPublicacao,
          dataTimestamp: pdfTimestamp,
          linkCorrigido: pdf.url
        });
      }
    }
  }));
}

export async function buscarFernandopolis(opcoes?: import('../../types').ScraperOptions): Promise<Edital[]> {
  if (opcoes?.verificarDisponibilidade) {
    const { verificaDisponibilidade } = await import('./utils');
    await verificaDisponibilidade('https://fernandopolis.sp.gov.br');
    return [];
  }

  const resultados: Edital[] = [];
  let ordemGlobal = 0;
  let encontrouAlvoDeParada = false;
  const itensBrutos: { 
    titulo: string, 
    linkCompleto: string, 
    textoAoRedor: string, 
    ordem: number,
    editaisExpandidos?: {
      descricaoFinal?: string;
      idConcursoExtracao?: string;
      dataPublicacao: string;
      dataTimestamp: number;
      linkCorrigido: string;
    }[]
  }[] = [];
  const detalhesFalhas: string[] = [];

  for (let loteInicio = 1; loteInicio <= 50; loteInicio += 2) {
    if (encontrouAlvoDeParada) break;

    const promessasPaginas = [];
    for (let pagina = loteInicio; pagina < loteInicio + 2 && pagina <= 50; pagina++) {
      promessasPaginas.push(
        fetchHtml(`https://fernandopolis.sp.gov.br/publicacoes/?categoria=concurso&pagina=${pagina}`)
          .then(res => ({ pagina, html: res.ok ? res.html : '' }))
      );
    }

    const paginasBaixadas = await Promise.all(promessasPaginas);
    paginasBaixadas.sort((a, b) => a.pagina - b.pagina);

    for (const pag of paginasBaixadas) {
      if (!pag.html) {
        if (!encontrouAlvoDeParada) detalhesFalhas.push(`[PÁGINA FALHOU] Pagina ${pag.pagina}`);
        continue;
      }
      if (encontrouAlvoDeParada) continue;

      const $ = cheerio.load(pag.html);
      $('h3 a').each((_, elemento) => {
        const titulo = $(elemento).text().trim();
        const href = $(elemento).attr('href') || '';
        const linkCompleto = href.startsWith('http') ? href : `https://fernandopolis.sp.gov.br${href}`;
        const textoAoRedor = $(elemento).parent().parent().text().replace(titulo, '').replace(/\s+/g, ' ').trim();
        const textoParaAnalise = `${titulo} ${textoAoRedor}`;

        const ehOLinkAlvo = linkCompleto.includes('/concurso/edital-normativo-do-concurso-publico-no-012018-7933');

        if (ehSujeira(textoParaAnalise, [], linkCompleto) || !ehRelevante(textoParaAnalise, TERMOS_OBRIGATORIOS_FERNANDOPOLIS)) {
          if (ehOLinkAlvo) { encontrouAlvoDeParada = true; return false; }
          return true;
        }

        const idConcursoPreliminar = extrairIdConcurso(titulo, textoAoRedor);
        if (deveExcluirPorAno(idConcursoPreliminar)) {
          if (ehOLinkAlvo) { encontrouAlvoDeParada = true; return false; }
          return true;
        }

        ordemGlobal++;
        itensBrutos.push({ titulo, linkCompleto, textoAoRedor, ordem: ordemGlobal });

        if (ehOLinkAlvo) {
          encontrouAlvoDeParada = true;
          return false;
        }
      });
    }
  }

  const TAMANHO_LOTE = 3;
  for (let i = 0; i < itensBrutos.length; i += TAMANHO_LOTE) {
    const lote = itensBrutos.slice(i, i + TAMANHO_LOTE);
    await processarLoteDetalhes(lote, resultados, detalhesFalhas);
  }

  // Passada 2: Fallback bottom-up do idConcurso em todos os filhos gerados
  let fallbackIdConcurso = '';
  for (let i = itensBrutos.length - 1; i >= 0; i--) {
    const item = itensBrutos[i];
    if (!item.editaisExpandidos) continue;
    
    for (let j = item.editaisExpandidos.length - 1; j >= 0; j--) {
      const filho = item.editaisExpandidos[j];
      if (filho.idConcursoExtracao) {
        fallbackIdConcurso = filho.idConcursoExtracao;
      } else if (fallbackIdConcurso) {
        filho.idConcursoExtracao = fallbackIdConcurso;
      }
    }
  }

  // Passada 3: Filtragem final e montagem dos resultados
  for (const item of itensBrutos) {
    if (!item.editaisExpandidos) continue;
    
    for (const filho of item.editaisExpandidos) {
      if (deveExcluirPorAno(filho.idConcursoExtracao)) continue;

      let anoConcurso: number | undefined = undefined;
      if (filho.idConcursoExtracao) {
        const matchAno = filho.idConcursoExtracao.match(/\/(\d{4})\b/);
        if (matchAno) anoConcurso = parseInt(matchAno[1], 10);
      }

      const tagsMetadados: string[] = [];
      const textoCompletoPesquisa = `${item.titulo} ${filho.descricaoFinal || ''}`.toUpperCase();

      if (textoCompletoPesquisa.includes('SME') || textoCompletoPesquisa.includes('SECRETARIA MUNICIPAL DA EDUCAÇÃO') || textoCompletoPesquisa.includes('SECRETARIA MUNICIPAL DE EDUCACAO')) tagsMetadados.push('Educação');
      if (textoCompletoPesquisa.includes('SMRH') || textoCompletoPesquisa.includes('RECURSOS HUMANOS')) tagsMetadados.push('Recursos Humanos');
      if (textoCompletoPesquisa.includes('SMEL') || textoCompletoPesquisa.includes('ESPORTES E LAZER')) tagsMetadados.push('Esportes e Lazer');
      if (textoCompletoPesquisa.includes('SMCT') || textoCompletoPesquisa.includes('CULTURA E TURISMO')) tagsMetadados.push('Cultura e Turismo');
      if (textoCompletoPesquisa.includes('SMS ') || textoCompletoPesquisa.includes('SECRETARIA MUNICIPAL DE SAUDE') || textoCompletoPesquisa.includes('SECRETARIA MUNICIPAL DE SAÚDE')) tagsMetadados.push('Saúde');
      if (textoCompletoPesquisa.includes('SMAS') || textoCompletoPesquisa.includes('ASSISTENCIA SOCIAL') || textoCompletoPesquisa.includes('ASSISTÊNCIA SOCIAL')) tagsMetadados.push('Assistência Social');
      if (textoCompletoPesquisa.includes('CISARF')) tagsMetadados.push('Consórcio CISARF');

      resultados.push({
        cidade: 'Fernandópolis',
        orgao: 'Prefeitura',
        titulo: item.titulo,
        link: filho.linkCorrigido,
        descricao: filho.descricaoFinal,
        concurso: filho.idConcursoExtracao,
        ano: anoConcurso,
        metadados: tagsMetadados.length > 0 ? tagsMetadados : undefined,
        dataPublicacao: filho.dataPublicacao,
        dataTimestamp: filho.dataTimestamp,
        ordemOriginal: item.ordem
      });
    }
  }

  if (detalhesFalhas.length > 0) {
    const msg = `Conexão instável (${detalhesFalhas.length} falhas em Fernandópolis)`;
    if (resultados.length === 0) throw new Error(msg);
    else throw Object.assign(new Error(msg), { dadosParciais: resultados });
  }

  return resultados;
}