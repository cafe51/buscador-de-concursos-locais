// src/lib/scrapers/fernandopolis.ts
import * as cheerio from 'cheerio';
import { Edital } from '../../types';
import { ehSujeira, ehRelevante, extrairIdConcurso, corrigirErrosDigitacao } from '../filtrosGlobais';
import { extrairTextoBruto } from '../docParser';

const TERMOS_OBRIGATORIOS_FERNANDOPOLIS = [
  'concurso', 'processo seletivo', 'processo de selecao', 'selecao de', 'estagiario', 'estagio',
  'atribuicao', 'contratacao', 'chamada publica', 'admissao', 'posse',
  'convocacao', 'convoca ', 'gabarito', 'resultado', 'classificacao', 'homologacao',
  'retificacao', 'rerratificacao', 'prorrogacao', 'recurso', 'respostas', 'comunicado',
  'provas', 'entrevista', 'inscricao', 'inscricoes', 'aviso', 'extrato'
];

// ==============================================================
// 🛑 REGRA DE CORTE DE ANOS
// ==============================================================
function deveExcluirPorAno(idConcurso: string | undefined): boolean {
  if (!idConcurso) return false; // Se não tem certeza, não exclui ainda. Deixa pro PDF resolver.

  const matchAno = idConcurso.match(/\/(\d{4})\b/);
  if (!matchAno) return false;

  const ano = parseInt(matchAno[1], 10);

  // Regra 1: Excluir Concursos de 2015 ou menos
  if (idConcurso.startsWith('Concurso') && ano <= 2015) return true;

  // Regra 2: Excluir Processos Seletivos de 2020 ou menos
  if (idConcurso.startsWith('Processo') && ano <= 2020) return true;

  return false;
}

async function buscarDetalhesFernandopolis(url: string): Promise<{ dataCorreta: string | null, descricaoExtra: string, urlPrimeiroPdf: string | null }> {
  try {
    const response = await fetch(url, { 
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
      }, 
      cache: 'force-cache' 
    });
    if (!response.ok) return { dataCorreta: null, descricaoExtra: '', urlPrimeiroPdf: null };

    const html = await response.text();
    const $ = cheerio.load(html);

    let dataCorreta: string | null = null;
    $('time').each((_, elemento) => {
      const match = $(elemento).text().trim().match(/\b(\d{2}\/\d{2}\/\d{4})\b/);
      if (match && !dataCorreta) dataCorreta = match[1];
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
      dataCorreta,
      descricaoExtra: nomesDosLinks.join(' | '),
      urlPrimeiroPdf
    };
  } catch {
    return { dataCorreta: null, descricaoExtra: '', urlPrimeiroPdf: null };
  }
}

export async function buscarFernandopolis(): Promise<Edital[]> {
  const resultados: Edital[] = [];
  let ordemGlobal = 0;
  let encontrouAlvoDeParada = false;

  const itensBrutos: { titulo: string, linkCompleto: string, textoAoRedor: string, ordem: number }[] = [];

  // FASE 1: Coleta em Lotes de 5 páginas
  for (let loteInicio = 1; loteInicio <= 50; loteInicio += 5) {
    if (encontrouAlvoDeParada) break;

    const promessasPaginas = [];

    for (let pagina = loteInicio; pagina < loteInicio + 5 && pagina <= 50; pagina++) {
      promessasPaginas.push(
        fetch(`https://fernandopolis.sp.gov.br/publicacoes/?categoria=concurso&pagina=${pagina}`, {
          headers: { 
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
          }, 
          cache: 'no-store'
        })
          .then(async (res) => {
            if (!res.ok) return { pagina, html: '' };
            return { pagina, html: await res.text() };
          })
          .catch(() => ({ pagina, html: '' }))
      );
    }

    const paginasBaixadas = await Promise.all(promessasPaginas);
    paginasBaixadas.sort((a, b) => a.pagina - b.pagina);

    for (const pag of paginasBaixadas) {
      if (!pag.html || encontrouAlvoDeParada) continue;

      const $ = cheerio.load(pag.html);

      $('h3 a').each((_, elemento) => {
        const titulo = $(elemento).text().trim();
        const href = $(elemento).attr('href') || '';
        const linkCompleto = href.startsWith('http') ? href : `https://fernandopolis.sp.gov.br${href}`;
        const textoAoRedor = $(elemento).parent().parent().text().replace(titulo, '').replace(/\s+/g, ' ').trim();
        const textoParaAnalise = `${titulo} ${textoAoRedor}`;

        // O LINK ALVO ATUALIZADO
        const ehOLinkAlvo = linkCompleto.includes('/concurso/edital-normativo-do-concurso-publico-no-012018-7933');

        if (ehSujeira(textoParaAnalise, [], linkCompleto)) {
          if (ehOLinkAlvo) { encontrouAlvoDeParada = true; return false; }
          return true;
        }

        if (!ehRelevante(textoParaAnalise, TERMOS_OBRIGATORIOS_FERNANDOPOLIS)) {
          if (ehOLinkAlvo) { encontrouAlvoDeParada = true; return false; }
          return true;
        }

        // 🚑 O PULO DO GATO: Tenta descobrir a chave de concurso pela "capa".
        const idConcursoPreliminar = extrairIdConcurso(titulo, textoAoRedor);

        // Se já descobriu a chave e ela for um concurso/seletivo velho demais, PULA!
        // Não vai nem para a fila do Fase 2. Economiza tempo precioso de requisição.
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

  // FASE 2: Lotes reduzidos para não ativar firewall/Cloudflare
  const TAMANHO_LOTE = 5;

  for (let i = 0; i < itensBrutos.length; i += TAMANHO_LOTE) {
    const lote = itensBrutos.slice(i, i + TAMANHO_LOTE);

    await Promise.all(lote.map(async (item) => {
      const detalhes = await buscarDetalhesFernandopolis(item.linkCompleto);

      let timestamp = 0;
      if (detalhes.dataCorreta) {
        const partes = detalhes.dataCorreta.split('/');
        timestamp = new Date(`${partes[2]}-${partes[1]}-${partes[0]}T00:00:00`).getTime();
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

      // 🚑 2º VERIFICAÇÃO DE IDADE: 
      // Se a Fase 1 não achou o ID do concurso, mas o resgate de PDF aqui da Fase 2 achou 
      // e é um concurso velho, NÓS ABORTAMOS O CARD (não enviamos pro 'resultados')!
      if (deveExcluirPorAno(idConcurso)) {
        return; // Pula o resto da execução do .map para esse item
      }

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

      resultados.push({
        cidade: 'Fernandópolis',
        orgao: 'Prefeitura',
        titulo: item.titulo,
        link: item.linkCompleto,
        descricao: descricaoFinal || undefined,
        concurso: idConcurso,
        ano: anoConcurso,
        metadados: tagsMetadados.length > 0 ? tagsMetadados : undefined,
        dataPublicacao: detalhes.dataCorreta || 'sem data',
        dataTimestamp: timestamp,
        ordemOriginal: item.ordem
      });
    }));
  }

  return resultados;
}