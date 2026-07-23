import * as cheerio from 'cheerio';
import { ScraperOptions, Edital } from '../../../types';
import { extrairTextoDePdf } from '../../pdfParserModern';
import { extrairIdConcurso, corrigirErrosDigitacao, ehSujeira } from '../../filtrosGlobais';
import dns from 'dns';

// Força IPv4 nativo para evitar stalls de handshake SSL comuns no Diário Transparente
dns.setDefaultResultOrder('ipv4first');

// Termos indicativos de potenciais editais de certame no sumário
const REGEX_CANDIDATO_CERTAME = /(?:edital\s+de\s+)?(?:convoca[çc][ãa]o|classifica[çc][ãa]o|homologa[çc][ãa]o|gabarito|abertura|inscri[çc][ãa]o|deferimento|resultado|atribui[çc][ãa]o)|processo\s+seletivo|concurso\s+p[uú]blico/i;
const REGEX_IGNORAR_SUMARIO = /infra[çc][ãa]o|tr[âa]nsito|multa|postura|fiscaliza[çc][ãa]o|cultural|licita[çc][ãa]o|preg[ãa]o|contrato|decreto|audi[êe]ncia|ppa|ldo|ata|leil[ãa]o/i;

async function baixarBufferPdf(url: string, retries = 3): Promise<Buffer> {
  for (let i = 0; i < retries; i++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const arrayBuffer = await res.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (err: any) {
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, 500 * (i + 1)));
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error(`Falha ao baixar PDF após ${retries} tentativas: ${url}`);
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

/**
 * Busca a lista de edições do Diário Oficial de Fernandópolis publicadas no Diário Transparente.
 */
export async function buscarEdicoesDiarioFernandopolis(
  opcoes?: ScraperOptions & { keyword?: string; anosDev?: number; anosProd?: number }
): Promise<EdicaoDiarioTransparente[]> {
  const keyword = opcoes?.keyword ?? 'concurso público';
  const url = `https://diariotransparente.com.br/publicacoes/frame/spfernandopolispm?entityId=&keyword=${encodeURIComponent(keyword)}&publishDateIni=&publishDateEnd=`;
  
  console.log(`🤖 [Fernandópolis Diário] Solicitando edições via fetch: ${url}`);

  let html = '';
  try {
    const res = await fetch(url);
    html = await res.text();
  } catch (err: any) {
    console.error(`❌ [Fernandópolis Diário] Falha na requisição:`, err.message);
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

  const ehDev = process.env.NODE_ENV !== 'production';
  const anosDev = opcoes?.anosDev ?? 1; // 1 ano em modo de desenvolvimento
  const anosProd = opcoes?.anosProd;
  const diasLimite = ehDev ? Math.round(anosDev * 365) : (anosProd ? Math.round(anosProd * 365) : 90);
  const limiteDataMs = Date.now() - (diasLimite * 24 * 60 * 60 * 1000);

  const edicoesFiltradas = edicoes
    .filter(e => e.dataTimestamp >= limiteDataMs)
    .sort((a, b) => b.dataTimestamp - a.dataTimestamp);

  console.log(`[Fernandópolis Diário] Edições filtradas (${ehDev ? `DEV: ${anosDev} ano(s)` : `PROD: ${diasLimite} dias`}): ${edicoesFiltradas.length} de ${edicoes.length}`);

  return edicoesFiltradas;
}

/**
 * Isola estritamente a seção do SUMÁRIO (entre "SUMÁRIO" e o início de "ENTIDADES:", "EXPEDIENTE" ou "Página X de Y").
 */
export function isolarTextoSumario(textoPaginas: string): string {
  const matchInicio = textoPaginas.match(/SUMÁRIO/i);
  if (!matchInicio) return textoPaginas;

  const textoAposInicio = textoPaginas.slice(matchInicio.index);
  const matchFim = textoAposInicio.search(/ENTIDADES:|EXPEDIENTE|Página\s+\d+\s+de/i);
  if (matchFim !== -1) {
    return textoAposInicio.slice(0, matchFim);
  }
  return textoAposInicio;
}

/**
 * Extrai blocos do sumário pré-filtrados como candidatos de certame para leitura otimizada no Fallback.
 */
export function extrairBlocosCandidatosSumario(textoSumarioBruto: string): { titulo: string; pagina: number }[] {
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

  for (const b of blocos) {
    const textoCompleto = b.linhas.join(' ');
    const textoCorrigido = corrigirErrosDigitacao(textoCompleto);
    const textoLower = textoCorrigido.toLowerCase();

    // Descarta ruídos conhecidos antes de abrir qualquer página do PDF
    if (REGEX_IGNORAR_SUMARIO.test(textoLower) || ehSujeira(textoLower, [], '')) {
      continue;
    }

    // Apenas títulos que remetam a editais/atos de concursos são mantidos
    if (!REGEX_CANDIDATO_CERTAME.test(textoCorrigido)) {
      continue;
    }

    resultados.push({
      titulo: textoCompleto,
      pagina: b.pagina
    });
  }

  return resultados;
}

/**
 * Faz o parse do bloco SUMÁRIO das páginas iniciais (Páginas 1 a 3) do Diário Oficial.
 */
export function parseSumarioFernandopolis(textoSumarioBruto: string, urlPdf: string = ''): { titulo: string; concurso: string; pagina: number }[] {
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

  for (const b of blocos) {
    const textoCompletoBloco = b.linhas.join(' ');
    const textoCorrigido = corrigirErrosDigitacao(textoCompletoBloco);

    if (ehSujeira(textoCorrigido.toLowerCase(), [], urlPdf)) {
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

    resultados.push({
      titulo: tituloEdital,
      concurso: idConcurso || 'Outros',
      pagina: b.pagina
    });
  }

  return resultados;
}

/**
 * Scraper Principal do Diário Oficial de Fernandópolis.
 * - Fast Path: Se o sumário contiver "concurso público" ou "processo seletivo", extrai direto do sumário (0 páginas extras lidas).
 * - Fallback Path (Otimizado): Se o sumário não contiver os termos explícitos, lê APENAS as páginas dos blocos
 *   pré-filtrados como candidatos a certames, ignorando posturas, multas, decretos e licitações.
 */
export async function buscarFernandopolisDiario(opcoes?: ScraperOptions): Promise<Edital[]> {
  if (opcoes?.verificarDisponibilidade) {
    const { verificaDisponibilidade } = await import('../utils');
    await verificaDisponibilidade('https://diariotransparente.com.br/publicacoes/frame/spfernandopolispm');
    return [];
  }

  console.log(`🤖 [Fernandópolis Diário] Iniciando raspagem paralela via nativa (fetch)...`);

  const edicoes = await buscarEdicoesDiarioFernandopolis(opcoes);
  const resultados: Edital[] = [];

  const TAMANHO_LOTE = 8; 
  for (let i = 0; i < edicoes.length; i += TAMANHO_LOTE) {
    const lote = edicoes.slice(i, i + TAMANHO_LOTE);

    await Promise.all(lote.map(async (edicao) => {
      try {
        const buffer = await baixarBufferPdf(edicao.urlPdf);

        const textoBruto = await extrairTextoDePdf(buffer, { fPagina: 1, lPagina: 3, layout: false });
        const textoSumario = isolarTextoSumario(textoBruto);
        
        const temCertameDiretoNoSumario = /concurso\s+p[uú]blico|processo\s+seletivo/i.test(textoSumario);

        if (temCertameDiretoNoSumario) {
          // Fast Path: Parse direto do Sumário (Ultra-rápido)
          const atosEncontrados = parseSumarioFernandopolis(textoSumario, edicao.urlPdf);

          atosEncontrados.forEach((ato, atoIdx) => {
            const sufixoAto = atosEncontrados.length > 1 ? `&ato=${atoIdx + 1}` : '';
            const linkFinal = `${edicao.urlVisualizar}#page=${ato.pagina}${sufixoAto}`;

            let anoCertame = parseInt(edicao.data.split('-')[0], 10);
            const matchAnoConcurso = ato.concurso.match(/\/(\d{4})/);
            if (matchAnoConcurso) {
              anoCertame = parseInt(matchAnoConcurso[1], 10);
            }

            resultados.push({
              cidade: 'Fernandópolis',
              orgao: 'Prefeitura',
              titulo: ato.titulo,
              link: linkFinal,
              descricao: ato.titulo,
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
          const blocosCandidatos = extrairBlocosCandidatosSumario(textoBruto);

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

                // Se não houver ID de concurso válido ou for sujeira, descarta
                if (ehSujeira(textoPagina.toLowerCase(), [], edicao.urlPdf) || !idConcurso || idConcurso === 'Outros') {
                  continue;
                }

                const linkFinal = `${edicao.urlVisualizar}#page=${bloco.pagina}`;

                let anoCertame = parseInt(edicao.data.split('-')[0], 10);
                const matchAnoConcurso = idConcurso.match(/\/(\d{4})/);
                if (matchAnoConcurso) {
                  anoCertame = parseInt(matchAnoConcurso[1], 10);
                }

                resultados.push({
                  cidade: 'Fernandópolis',
                  orgao: 'Prefeitura',
                  titulo: bloco.titulo,
                  link: linkFinal,
                  descricao: bloco.titulo,
                  concurso: idConcurso,
                  ano: anoCertame,
                  dataPublicacao: edicao.dataFormatted,
                  dataTimestamp: edicao.dataTimestamp,
                  linkOrigem: edicao.urlVisualizar,
                  fonte: 'diario'
                });
              }
            } catch (errPage: any) {
              console.error(`❌ [Fernandópolis Diário Fallback] Erro ao ler página ${bloco.pagina} da edição ${edicao.edicao}:`, errPage.message || errPage);
            }
          }
        }
      } catch (err: any) {
        console.error(`❌ [Fernandópolis Diário] Erro ao ler a edição ${edicao.edicao}:`, err.message || err);
      }
    }));
  }

  resultados.sort((a, b) => b.dataTimestamp - a.dataTimestamp);
  resultados.forEach((res, idx) => {
    res.ordemOriginal = idx + 1;
  });

  console.log(`[Fernandópolis Diário] Raspagem concluída! Total de editais extraídos: ${resultados.length}`);
  return resultados;
}
