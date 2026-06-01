import * as cheerio from 'cheerio';
import { Edital } from '../../types';
import { ehSujeira, ehRelevante, extrairIdConcurso, corrigirErrosDigitacao } from '../filtrosGlobais';
import { extrairTextoBruto } from '../docParser';
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

async function buscarDetalhesFernandopolis(url: string): Promise<{ sucesso: boolean, dataCorreta: string | null, descricaoExtra: string, urlPrimeiroPdf: string | null }> {
  const res = await fetchHtml(url, true);
  if (!res.ok) return { sucesso: false, dataCorreta: null, descricaoExtra: '', urlPrimeiroPdf: null };

  const $ = cheerio.load(res.html);
  let dataCorreta: string | null = null;
  
  $('time').each((_, elemento) => {
    const dataExtraida = extrairData($(elemento).text().trim());
    if (dataExtraida && !dataCorreta) dataCorreta = dataExtraida.dataFormatada;
  });

  const $main = $('main').clone();
  $main.find('aside, header, nav, script, .share__container, .horizontal--laptop').remove();

  const nomesDosLinks: string[] = [];
  let urlPrimeiroPdf: string | null = null;

  $main.find('a').each((_, el) => {
    const href = $(el).attr('href') || '';
    if (href && href.toLowerCase().endsWith('.pdf') && !urlPrimeiroPdf) {
      urlPrimeiroPdf = href.startsWith('http') ? href : `https://fernandopolis.sp.gov.br${href}`;
    }

    let textoLink = $(el).text().replace(/\s+/g, ' ').trim();
    if (!textoLink || textoLink.toLowerCase() === 'download' || textoLink.toLowerCase() === 'ver') {
      textoLink = $(el).attr('title') || '';
    }

    textoLink = textoLink.replace(/^[\d\/\.\-\s]+/, '').trim();
    if (textoLink.startsWith('-')) textoLink = textoLink.substring(1).trim();

    if (textoLink.length > 3 && !nomesDosLinks.includes(textoLink)) {
      nomesDosLinks.push(textoLink);
    }
  });

  return {
    sucesso: true,
    dataCorreta,
    descricaoExtra: nomesDosLinks.join(' | '),
    urlPrimeiroPdf
  };
}

async function processarLoteDetalhes(lote: any[], resultados: Edital[], detalhesFalhas: string[]) {
  await Promise.all(lote.map(async (item) => {
    const detalhes = await buscarDetalhesFernandopolis(item.linkCompleto);
    
    if (!detalhes.sucesso) {
      detalhesFalhas.push(`[DETALHE FALHOU] ${item.linkCompleto}`);
      return;
    }

    let timestamp = 0;
    if (detalhes.dataCorreta) {
      const parsedData = extrairData(detalhes.dataCorreta);
      if (parsedData) timestamp = parsedData.dataTimestamp;
    }

    const descricaoFinal = [item.textoAoRedor, detalhes.descricaoExtra].filter(Boolean).join(' - ');
    let idConcurso = extrairIdConcurso(item.titulo, descricaoFinal);

    if (!idConcurso && detalhes.urlPrimeiroPdf) {
      const textoDoPdf = await extrairTextoBruto(detalhes.urlPrimeiroPdf);
      if (textoDoPdf) {
        const textoCorrigido = corrigirErrosDigitacao(textoDoPdf);
        idConcurso = extrairIdConcurso(textoCorrigido, '');
      }
    }

    // A exclusão por ano agora será feita na etapa final após o fallback
    // if (deveExcluirPorAno(idConcurso)) return;

    let anoConcurso: number | undefined = undefined;
    if (idConcurso) {
      const matchAno = idConcurso.match(/\/(\d{4})\b/);
      if (matchAno) anoConcurso = parseInt(matchAno[1], 10);
    }

    const tagsMetadados: string[] = [];
    const textoCompletoPesquisa = `${item.titulo} ${descricaoFinal}`.toUpperCase();

    if (textoCompletoPesquisa.includes('SME') || textoCompletoPesquisa.includes('SECRETARIA MUNICIPAL DA EDUCAÇÃO') || textoCompletoPesquisa.includes('SECRETARIA MUNICIPAL DE EDUCACAO')) tagsMetadados.push('Educação');
    if (textoCompletoPesquisa.includes('SMRH') || textoCompletoPesquisa.includes('RECURSOS HUMANOS')) tagsMetadados.push('Recursos Humanos');
    if (textoCompletoPesquisa.includes('SMEL') || textoCompletoPesquisa.includes('ESPORTES E LAZER')) tagsMetadados.push('Esportes e Lazer');
    if (textoCompletoPesquisa.includes('SMCT') || textoCompletoPesquisa.includes('CULTURA E TURISMO')) tagsMetadados.push('Cultura e Turismo');
    if (textoCompletoPesquisa.includes('SMS ') || textoCompletoPesquisa.includes('SECRETARIA MUNICIPAL DE SAUDE') || textoCompletoPesquisa.includes('SECRETARIA MUNICIPAL DE SAÚDE')) tagsMetadados.push('Saúde');
    if (textoCompletoPesquisa.includes('SMAS') || textoCompletoPesquisa.includes('ASSISTENCIA SOCIAL') || textoCompletoPesquisa.includes('ASSISTÊNCIA SOCIAL')) tagsMetadados.push('Assistência Social');
    if (textoCompletoPesquisa.includes('CISARF')) tagsMetadados.push('Consórcio CISARF');

    item.idConcursoExtracao = idConcurso;
    item.anoConcursoExtracao = anoConcurso;
    item.descricaoFinal = descricaoFinal || undefined;
    item.tagsMetadados = tagsMetadados.length > 0 ? tagsMetadados : undefined;
    item.dataPublicacao = detalhes.dataCorreta || 'sem data';
    item.dataTimestamp = timestamp;
  }));
}

export async function buscarFernandopolis(): Promise<Edital[]> {
  const resultados: Edital[] = [];
  let ordemGlobal = 0;
  let encontrouAlvoDeParada = false;
  const itensBrutos: { 
    titulo: string, 
    linkCompleto: string, 
    textoAoRedor: string, 
    ordem: number,
    idConcursoExtracao?: string,
    anoConcursoExtracao?: number,
    descricaoFinal?: string,
    tagsMetadados?: string[],
    dataPublicacao?: string,
    dataTimestamp?: number
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

  // Passada 2: Fallback bottom-up do idConcurso
  let fallbackIdConcurso = '';
  for (let i = itensBrutos.length - 1; i >= 0; i--) {
    const item = itensBrutos[i];
    if (item.idConcursoExtracao) {
      fallbackIdConcurso = item.idConcursoExtracao;
    } else if (fallbackIdConcurso) {
      item.idConcursoExtracao = fallbackIdConcurso;
      const matchAno = fallbackIdConcurso.match(/\/(\d{4})\b/);
      if (matchAno) item.anoConcursoExtracao = parseInt(matchAno[1], 10);
    }
  }

  // Passada 3: Filtragem final e montagem dos resultados
  for (const item of itensBrutos) {
    if (deveExcluirPorAno(item.idConcursoExtracao)) continue;

    resultados.push({
      cidade: 'Fernandópolis',
      orgao: 'Prefeitura',
      titulo: item.titulo,
      link: item.linkCompleto,
      descricao: item.descricaoFinal,
      concurso: item.idConcursoExtracao,
      ano: item.anoConcursoExtracao,
      metadados: item.tagsMetadados,
      dataPublicacao: item.dataPublicacao || 'sem data',
      dataTimestamp: item.dataTimestamp || 0,
      ordemOriginal: item.ordem
    });
  }

  if (detalhesFalhas.length > 0) {
    const msg = `Conexão instável (${detalhesFalhas.length} falhas em Fernandópolis)`;
    if (resultados.length === 0) throw new Error(msg);
    else throw Object.assign(new Error(msg), { dadosParciais: resultados });
  }

  return resultados;
}