import * as cheerio from 'cheerio';
import { ScraperOptions, Edital } from '../../../types';
import { extrairTextoDePdf } from '../../pdfParserModern';
import { extrairIdConcurso, corrigirErrosDigitacao, ehSujeira } from '../../filtrosGlobais';
import dns from 'dns';

// Força IPv4 nativo para evitar stalls de handshake SSL comuns no Diário Transparente
dns.setDefaultResultOrder('ipv4first');

export interface DiarioTransparenteConfig {
  cidade: string;
  slugEntidade: string; // Ex: 'spfernandopolispm' ou 'sppedranopolispm'
  orgaoDefault?: string; // Ex: 'Prefeitura'
  urlsPesquisa?: string[]; // Se não fornecido, constrói automaticamente com keyword=concurso+público
  excecoesSujeira?: string[]; // Ex: ['simplificado']
  anosDev?: number; // Padrão: 1 ano (365 dias) em dev
  anosProd?: number; // Padrão: 90 dias (~0.25 anos) em produção
}

export interface EdicaoDiarioTransparente {
  id: string;
  data: string; // YYYY-MM-DD
  dataFormatted: string; // DD/MM/YYYY
  dataTimestamp: number;
  edicao: string;
  entidade: string;
  paginas: number;
  urlPdf: string;
  urlVisualizar: string;
}

// Termos indicativos de potenciais editais de certame no sumário
const REGEX_CANDIDATO_CERTAME = /(?:edital\s+de\s+)?(?:convoca[çc][ãa]o|classifica[çc][ãa]o|homologa[çc][ãa]o|gabarito|abertura|inscri[çc][ãa]o|deferimento|resultado|atribui[çc][ãa]o)|processo\s+seletivo|concurso\s+p[uú]blico/i;
const REGEX_IGNORAR_SUMARIO = /infra[çc][ãa]o|tr[âa]nsito|multa|postura|fiscaliza[çc][ãa]o|cultural|licita[çc][ãa]o|preg[ãa]o|contrato|decreto|audi[êe]ncia|ppa|ldo|ata|leil[ãa]o/i;

async function baixarBufferPdf(url: string, retries = 4): Promise<Buffer> {
  for (let i = 0; i < retries; i++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 35000);
    try {
      const res = await fetch(url, { signal: controller.signal, cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const arrayBuffer = await res.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (err: any) {
      if (i === retries - 1) throw err;
      const backoffMs = (1000 * (i + 1)) + Math.floor(Math.random() * 500);
      await new Promise(r => setTimeout(r, backoffMs));
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error(`Falha ao baixar PDF após ${retries} tentativas: ${url}`);
}

/**
 * Requisita uma URL de frame do Diário Transparente e raspa a lista de edições.
 */
async function buscarEdicoesPorUrl(url: string): Promise<EdicaoDiarioTransparente[]> {
  let html = '';
  try {
    const res = await fetch(url, { cache: 'no-store' });
    html = await res.text();
  } catch (err: any) {
    console.error(`❌ [Diário Transparente] Falha na requisição (${url}):`, err.message);
    return [];
  }

  const $ = cheerio.load(html);
  const edicoes: EdicaoDiarioTransparente[] = [];

  $('article.post').each((_, element) => {
    const downloadHref = $(element).find('div.col-icon a').attr('href') || '';
    const visualizarHref = $(element).find('h3 a').attr('href') || '';

    const metas: Record<string, string> = {};
    $(element).find('ul.meta li').each((_, li) => {
      const label = $(li).find('span').text().replace(':', '').trim();
      const val = $(li).clone().children().remove().end().text().trim();
      if (label) metas[label] = val;
    });

    const matchLink = downloadHref.match(/\/(\d{4}-\d{2}-\d{2})\/(\d+)/);
    const dataIso = matchLink ? matchLink[1] : '';
    const id = matchLink ? matchLink[2] : '';

    if (downloadHref && dataIso) {
      const [ano, mes, dia] = dataIso.split('-');
      const dataFormatted = `${dia}/${mes}/${ano}`;
      const dataTimestamp = new Date(`${dataIso}T00:00:00`).getTime();

      edicoes.push({
        id,
        data: dataIso,
        dataFormatted,
        dataTimestamp,
        edicao: metas['Edição'] || '',
        entidade: metas['Entidade'] || 'Executivo',
        paginas: parseInt(metas['Páginas'] || '0', 10),
        urlPdf: `https://diariotransparente.com.br${downloadHref}`,
        urlVisualizar: `https://diariotransparente.com.br${visualizarHref}`
      });
    }
  });

  return edicoes;
}

/**
 * Busca e mescla todas as edições do Diário Transparente conforme a configuração do município.
 */
export async function buscarEdicoesDiarioTransparente(
  config: DiarioTransparenteConfig,
  opcoes?: ScraperOptions
): Promise<EdicaoDiarioTransparente[]> {
  const urls = config.urlsPesquisa && config.urlsPesquisa.length > 0
    ? config.urlsPesquisa
    : [`https://diariotransparente.com.br/publicacoes/frame/${config.slugEntidade}?entityId=&keyword=concurso+p%C3%BAblico&publishDateIni=&publishDateEnd=`];

  const listasEdicoes = await Promise.all(urls.map(url => buscarEdicoesPorUrl(url)));

  // Mescla edições desduplicando por ID ou urlPdf
  const mapaEdicoes = new Map<string, EdicaoDiarioTransparente>();
  listasEdicoes.flat().forEach(e => {
    mapaEdicoes.set(e.id || e.urlPdf, e);
  });

  const edicoesMescladas = Array.from(mapaEdicoes.values());

  const ehDev = process.env.NODE_ENV !== 'production';
  const anosDev = opcoes?.anosDev ?? config.anosDev ?? 1;
  const anosProd = opcoes?.anosProd ?? config.anosProd;
  const diasLimite = ehDev ? Math.round(anosDev * 365) : (anosProd ? Math.round(anosProd * 365) : 90);
  const limiteDataMs = Date.now() - (diasLimite * 24 * 60 * 60 * 1000);

  const edicoesFiltradas = edicoesMescladas
    .filter(e => e.dataTimestamp >= limiteDataMs)
    .sort((a, b) => b.dataTimestamp - a.dataTimestamp);

  console.log(`[${config.cidade} Diário] Edições filtradas unificadas (${ehDev ? `DEV: ${anosDev} ano(s)` : `PROD: ${diasLimite} dias`}): ${edicoesFiltradas.length} de ${edicoesMescladas.length}`);

  return edicoesFiltradas;
}

/**
 * Isola estritamente a seção do SUMÁRIO (entre "SUMÁRIO" e o início de "ENTIDADES:", "EXPEDIENTE" ou "ACERVO").
 * Se a palavra "SUMÁRIO" for encontrada, suporta sumários extensos de múltiplas páginas (páginas 1 a 3).
 * Se a palavra "SUMÁRIO" NÃO for encontrada, aplica a restrição à Página 1 para evitar que textos de matérias vazem.
 */
export function isolarTextoSumario(textoPaginas: string): string {
  let text = textoPaginas;

  const matchInicio = text.match(/SUM[ÁA]RIO/i);
  if (matchInicio) {
    // Quando existe o título explícito "SUMÁRIO", inicia dele (mantém suporte a sumários longos de 2 a 3 páginas)
    text = text.slice(matchInicio.index);
  } else {
    // Fallback: Quando NÃO existe o título "SUMÁRIO", limita estritamente ao conteúdo da Página 1
    const partesPagina = text.split(/Página\s+1\s+de/i);
    text = partesPagina[0] || text;

    const matchCabecalho = text.match(/\(?Este\s+documento\s+cont[ée]m\s+\d+\s+p[áa]ginas?\)?/i);
    if (matchCabecalho && matchCabecalho.index !== undefined) {
      text = text.slice(matchCabecalho.index + matchCabecalho[0].length);
    }
  }

  // Corta o final do sumário onde iniciam os metadados do jornal (EXPEDIENTE, ACERVO, ENTIDADE:)
  const matchFim = text.search(/EXPEDIENTE|ACERVO|ENTIDAD(?:E|ES):/i);
  if (matchFim !== -1) {
    return text.slice(0, matchFim);
  }
  return text;
}

/**
 * Limpa o título do bloco/edital extraído do sumário ou do corpo do diário.
 * Remove cabeçalhos e vinhetas indesejadas como "SUMÁRIO", "PODER EXECUTIVO DE [CIDADE]", "(Este documento contém X páginas)", "Ano I - Edição 0.801", etc.
 */
export function limparTituloEdital(titulo: string, nomeCidade: string): string {
  if (!titulo) return '';

  let limpo = titulo;

  // 1. Remove "Ano I - Edição 0.801" ou variações de cabeçalho da edição
  limpo = limpo.replace(/Ano\s+[IVXLCDM]+\s*-\s*Edi[çc][ãa]o\s+[\d\.]+/gi, '');

  // 2. Remove "SUMÁRIO" (case-insensitive)
  limpo = limpo.replace(/\bSUM[ÁA]RIO\b/gi, '');

  // 3. Remove "(Este documento contém X páginas)" (case-insensitive, acentos opcionais)
  limpo = limpo.replace(/\(?Este\s+documento\s+cont[ée]m\s+\d+\s+p[áa]ginas?\)?/gi, '');

  // 4. Remove "PODER EXECUTIVO DE [CIDADE]" (flexível com acentuação e caixa alta/baixa)
  const padraoCidade = nomeCidade
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split('')
    .map(ch => {
      if (/[aA]/i.test(ch)) return '[aáàãâAÁÀÃÂ]';
      if (/[eE]/i.test(ch)) return '[eéèêEÉÈÊ]';
      if (/[iI]/i.test(ch)) return '[iíìîIÍÌÎ]';
      if (/[oO]/i.test(ch)) return '[oóòõôOÓÒÕÔ]';
      if (/[uU]/i.test(ch)) return '[uúùûUÚÙÛ]';
      if (/[cC]/i.test(ch)) return '[cçCÇ]';
      return ch;
    })
    .join('');

  const regexPoderExecutivo = new RegExp(`PODER\\s+EXECUTIVO\\s+(?:DE\\s+)?${padraoCidade}`, 'gi');
  limpo = limpo.replace(regexPoderExecutivo, '');

  // 5. Remove cabeçalhos genéricos de seção que acabam grudando no início do bloco
  limpo = limpo.replace(/ATOS\s+(?:DO\s+)?PODER\s+EXECUTIVO/gi, '');
  limpo = limpo.replace(/(?:SETOR|ÁREA)\s+DE\s+PESSOAL(?:\s*-\s*RH)?/gi, '');
  limpo = limpo.replace(/ATOS\s+(?:ADMINISTRATIVOS|OFICIAIS)/gi, '');

  // Limpa espaços extras e pontuação solta no início/fim
  limpo = limpo.replace(/\s+/g, ' ').replace(/^[\s\-–—:]+/, '').replace(/[\s\-–—:]+$/, '').trim();

  return limpo || titulo;
}

// Alias para manter compatibilidade com importações anteriores
export const limparTituloBlocoFallback = limparTituloEdital;

/**
 * Extrai blocos do sumário pré-filtrados como candidatos de certame para leitura otimizada no Fallback.
 */
export function extrairBlocosCandidatosSumario(
  textoSumarioBruto: string,
  config: DiarioTransparenteConfig
): { titulo: string; pagina: number }[] {
  const textoSumario = isolarTextoSumario(textoSumarioBruto);
  const linhas = textoSumario
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !/^Página\s+\d+/i.test(l) && !/Diário Oficial/i.test(l));

  const blocos: { linhas: string[]; pagina: number }[] = [];
  let bufferLinhas: string[] = [];

  for (const linha of linhas) {
    const matchPagina = linha.match(/^(.*?)\s*[\.\…\_\-]{2,}\s*(\d+)$/) || linha.match(/^(.+?)\s+(\d+)$/);

    if (matchPagina) {
      const textoParte = matchPagina[1].replace(/[\.\…\_\-]+$/, '').trim();
      const pag = parseInt(matchPagina[2], 10);

      if (textoParte) {
        bufferLinhas.push(textoParte);
      }

      blocos.push({
        linhas: [...bufferLinhas],
        pagina: pag
      });

      bufferLinhas = [];
    } else {
      bufferLinhas.push(linha);
    }
  }

  const resultados: { titulo: string; pagina: number }[] = [];
  const excecoes = config.excecoesSujeira ?? ['simplificado'];

  for (const b of blocos) {
    const textoCompleto = b.linhas.join(' ');
    const tituloLimpo = limparTituloBlocoFallback(textoCompleto, config.cidade);
    const textoCorrigido = corrigirErrosDigitacao(tituloLimpo);
    const textoLower = textoCorrigido.toLowerCase();

    if (REGEX_IGNORAR_SUMARIO.test(textoLower) || ehSujeira(textoLower, [], '', excecoes)) {
      continue;
    }

    if (!REGEX_CANDIDATO_CERTAME.test(textoCorrigido)) {
      continue;
    }

    resultados.push({
      titulo: tituloLimpo,
      pagina: b.pagina
    });
  }

  return resultados;
}

/**
 * Faz o parse do bloco SUMÁRIO das páginas iniciais (Páginas 1 a 3) do Diário Oficial.
 */
export function parseSumarioDiarioTransparente(
  textoSumarioBruto: string,
  urlPdf: string = '',
  config: DiarioTransparenteConfig
): { titulo: string; concurso: string; pagina: number }[] {
  const textoSumario = isolarTextoSumario(textoSumarioBruto);

  if (!/concurso\s+p[uú]blico|processo\s+seletivo/i.test(textoSumario)) {
    return [];
  }

  const linhas = textoSumario
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !/^Página\s+\d+/i.test(l) && !/Diário Oficial/i.test(l));

  const blocos: { linhas: string[]; pagina: number }[] = [];
  let bufferLinhas: string[] = [];

  for (const linha of linhas) {
    const matchPagina = linha.match(/^(.*?)\s*[\.\…\_\-]{2,}\s*(\d+)$/) || linha.match(/^(.+?)\s+(\d+)$/);

    if (matchPagina) {
      const textoParte = matchPagina[1].replace(/[\.\…\_\-]+$/, '').trim();
      const pag = parseInt(matchPagina[2], 10);

      if (textoParte) {
        bufferLinhas.push(textoParte);
      }

      blocos.push({
        linhas: [...bufferLinhas],
        pagina: pag
      });

      bufferLinhas = [];
    } else {
      bufferLinhas.push(linha);
    }
  }

  const resultados: { titulo: string; concurso: string; pagina: number }[] = [];
  const excecoes = config.excecoesSujeira ?? ['simplificado'];

  for (const b of blocos) {
    const textoCompletoBloco = b.linhas.join(' ');
    const textoCorrigido = corrigirErrosDigitacao(textoCompletoBloco);

    if (ehSujeira(textoCorrigido.toLowerCase(), [], urlPdf, excecoes)) {
      continue;
    }

    const ehConcursoOuSeletivo = /concurso\s+p[uú]blico|processo\s+seletivo/i.test(textoCorrigido);
    if (!ehConcursoOuSeletivo) continue;

    let idConcurso = extrairIdConcurso(textoCorrigido, '', true, false);

    if (!idConcurso) {
      const matchLocal = textoCorrigido.match(/(concurso\s+p[uú]blico|processo\s+seletivo(?:\s+simplificado)?)\s*(?:n[oº°.]*)?\s*(\d{1,3}\/\d{2,4})/i);
      if (matchLocal) {
        const tipo = matchLocal[1].toLowerCase().includes('concurso') ? 'Concurso Público' : 'Processo Seletivo';
        idConcurso = `${tipo} ${matchLocal[2]}`;
      }
    }

    let tituloEdital = textoCompletoBloco;
    const matchTitulo = textoCompletoBloco.match(/(EDITAL DE [^.]+?)(?=\s*(?:PROCESSO SELETIVO|CONCURSO PÚBLICO|$))/i) ||
                        textoCompletoBloco.match(/(“?EDITAL [^.]+?)(?=\s*(?:PROCESSO SELETIVO|CONCURSO PÚBLICO|$))/i);
    
    if (matchTitulo) {
      tituloEdital = matchTitulo[1].trim();
    }

    tituloEdital = limparTituloEdital(tituloEdital, config.cidade);

    resultados.push({
      titulo: tituloEdital,
      concurso: idConcurso || 'Outros',
      pagina: b.pagina
    });
  }

  return resultados;
}

/**
 * Motor Genérico Principal para Raspagem de Cidades no Diário Transparente.
 */
export async function executarScraperDiarioTransparente(
  config: DiarioTransparenteConfig,
  opcoes?: ScraperOptions
): Promise<Edital[]> {
  if (opcoes?.verificarDisponibilidade) {
    const { verificaDisponibilidade } = await import('../utils');
    const urlFrame = `https://diariotransparente.com.br/publicacoes/frame/${config.slugEntidade}`;
    await verificaDisponibilidade(urlFrame);
    return [];
  }

  console.log(`🤖 [${config.cidade} Diário] Iniciando raspagem paralela via motor Diário Transparente...`);

  const edicoes = await buscarEdicoesDiarioTransparente(config, opcoes);
  const resultados: Edital[] = [];
  const excecoes = config.excecoesSujeira ?? ['simplificado'];
  const orgao = config.orgaoDefault ?? 'Prefeitura';

  // Lote de 5 conexões paralelas por cidade para evitar ultrapassar limites de sockets simultâneos do servidor público
  const TAMANHO_LOTE = 5; 
  for (let i = 0; i < edicoes.length; i += TAMANHO_LOTE) {
    const lote = edicoes.slice(i, i + TAMANHO_LOTE);

    await Promise.all(lote.map(async (edicao) => {
      try {
        const buffer = await baixarBufferPdf(edicao.urlPdf);

        // Lê as páginas 1 a 3 do PDF para análise do sumário
        const textoBrutoInicial = await extrairTextoDePdf(buffer, { fPagina: 1, lPagina: 3, layout: false });
        const textoSumario = isolarTextoSumario(textoBrutoInicial);
        
        const temCertameDiretoNoSumario = /concurso\s+p[uú]blico|processo\s+seletivo/i.test(textoSumario);

        if (temCertameDiretoNoSumario) {
          // Fast Path: Parse direto do Sumário (Ultra-rápido)
          const atosEncontrados = parseSumarioDiarioTransparente(textoSumario, edicao.urlPdf, config);

          atosEncontrados.forEach((ato, atoIdx) => {
            const sufixoAto = atosEncontrados.length > 1 ? `&ato=${atoIdx + 1}` : '';
            const linkFinal = `${edicao.urlVisualizar}#page=${ato.pagina}${sufixoAto}`;

            let anoCertame = parseInt(edicao.data.split('-')[0], 10);
            const matchAnoConcurso = ato.concurso.match(/\/(\d{4})/);
            if (matchAnoConcurso) {
              anoCertame = parseInt(matchAnoConcurso[1], 10);
            }

            const tituloLimpo = limparTituloEdital(ato.titulo, config.cidade);

            resultados.push({
              cidade: config.cidade,
              orgao,
              titulo: tituloLimpo,
              link: linkFinal,
              descricao: tituloLimpo,
              concurso: ato.concurso,
              ano: anoCertame,
              dataPublicacao: edicao.dataFormatted,
              dataTimestamp: edicao.dataTimestamp,
              linkOrigem: edicao.urlVisualizar,
              fonte: 'diario'
            });
          });
        } else {
          // Fallback Path Otimizado: Filtra blocos candidatos e lê APENAS as páginas necessárias
          const blocosCandidatos = extrairBlocosCandidatosSumario(textoBrutoInicial, config);

          for (const bloco of blocosCandidatos) {
            try {
              const textoPagina = await extrairTextoDePdf(buffer, { fPagina: bloco.pagina, lPagina: bloco.pagina, layout: false });
              const temCertameNaPagina = /concurso\s+p[uú]blico|processo\s+seletivo/i.test(textoPagina);

              if (temCertameNaPagina) {
                let idConcurso = extrairIdConcurso(textoPagina, '', true, false);
                if (!idConcurso) {
                  const matchLocal = textoPagina.match(/(concurso\s+p[uú]blico|processo\s+seletivo(?:\s+simplificado)?)\s*(?:n[oº°.]*)?\s*(\d{1,3}\/\d{2,4})/i);
                  if (matchLocal) {
                    const tipo = matchLocal[1].toLowerCase().includes('concurso') ? 'Concurso Público' : 'Processo Seletivo';
                    idConcurso = `${tipo} ${matchLocal[2]}`;
                  }
                }

                if (ehSujeira(textoPagina.toLowerCase(), [], edicao.urlPdf, excecoes) || !idConcurso || idConcurso === 'Outros') {
                  continue;
                }

                const linkFinal = `${edicao.urlVisualizar}#page=${bloco.pagina}`;

                let anoCertame = parseInt(edicao.data.split('-')[0], 10);
                const matchAnoConcurso = idConcurso.match(/\/(\d{4})/);
                if (matchAnoConcurso) {
                  anoCertame = parseInt(matchAnoConcurso[1], 10);
                }

                const tituloFinal = limparTituloBlocoFallback(bloco.titulo, config.cidade);

                resultados.push({
                  cidade: config.cidade,
                  orgao,
                  titulo: tituloFinal,
                  link: linkFinal,
                  descricao: tituloFinal,
                  concurso: idConcurso,
                  ano: anoCertame,
                  dataPublicacao: edicao.dataFormatted,
                  dataTimestamp: edicao.dataTimestamp,
                  linkOrigem: edicao.urlVisualizar,
                  fonte: 'diario'
                });
              }
            } catch (errPage: any) {
              console.error(`❌ [${config.cidade} Diário Fallback] Erro ao ler página ${bloco.pagina} da edição ${edicao.edicao}:`, errPage.message || errPage);
            }
          }
        }
      } catch (err: any) {
        console.error(`❌ [${config.cidade} Diário] Erro ao ler a edição ${edicao.edicao}:`, err.message || err);
      }
    }));
  }

  resultados.sort((a, b) => b.dataTimestamp - a.dataTimestamp);
  resultados.forEach((res, idx) => {
    res.ordemOriginal = idx + 1;
  });

  console.log(`[${config.cidade} Diário] Raspagem concluída! Total de editais extraídos: ${resultados.length}`);
  return resultados;
}
