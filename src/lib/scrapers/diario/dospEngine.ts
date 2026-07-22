import { Edital, ScraperOptions } from '../../../types';
import { ehSujeira, corrigirErrosDigitacao, extrairIdConcurso } from '../../filtrosGlobais';
import { extrairTextoDePdf } from '../../pdfParserModern';

export interface DospConfig {
  cidade: string;
  codigoDosp: number; // Ex: 4932 (Jales), 5292 (Votuporanga)
  urlDisponibilidade: string;
  dominiosOuTermos?: string[];
  anosDev?: number; // Anos limite em ambiente de desenvolvimento (padrão: 5 anos).
  anosProd?: number; // Anos limite em ambiente de produção (padrão: 90 dias / ~0.25 anos).
}

interface EdicaoDosp {
  iddo: number;
  flag_extra: number;
  data: string; // YYYY-MM-DD
  ano_do: number;
  edicao_do: string;
  pgtotal?: number;
  quantidade?: number;
}

/**
 * Normaliza o texto removendo acentos e ligaturas unicode (como 'ﬁ' -> 'fi')
 */
function normalizarTexto(str: string): string {
  return str.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Formata e limita o texto da descrição para um resumo limpo de no máximo 150 caracteres
 */
function formatarResumoDescricao(texto: string, maxLen: number = 150): string {
  if (!texto) return '';
  const limpo = texto.replace(/\s+/g, ' ').trim();
  if (limpo.length <= maxLen) return limpo;
  return limpo.substring(0, maxLen).trim() + '...';
}

/**
 * Remove o rodapé/lateral de "ENTIDADES", "EXPEDIENTE" e "ACERVO" para evitar falsos positivos
 * de órgãos ao ler nomes de outras entidades listadas no expediente do Diário Oficial.
 */
function limparRodapeEntidadesDoTexto(texto: string): string {
  const linhas = texto.split('\n');
  const linhasLimpas: string[] = [];
  for (const l of linhas) {
    const lNorm = normalizarTexto(l).replace(/\s+/g, ' ').toUpperCase().trim();
    if (/^(E\s*N\s*T\s*I\s*D\s*A\s*D\s*E\s*S|E\s*X\s*P\s*E\s*D\s*I\s*E\s*N\s*T\s*E|A\s*C\s*E\s*R\s*V\s*O)\b/.test(lNorm)) {
      break;
    }
    linhasLimpas.push(l);
  }
  return linhasLimpas.join('\n');
}

/**
 * Verifica se um título do sumário representa um Cabeçalho de Entidade/Órgão ou outra Seção Administrativa Principal
 */
function ehOutraEntidadeOuSecao(titulo: string): boolean {
  const tNorm = normalizarTexto(titulo).toLowerCase().trim();

  // Se o próprio título contiver concurso/seletivo, NÃO é "outra" seção
  if (/concurso|seletivo/i.test(tNorm)) return false;

  // 1. Entidades / Órgãos / Secretarias / Autarquias (Level 0)
  const regexEntidades = /^(poder\s+executivo|poder\s+legislativo|secretaria|funda[cç][aã]o|superintend[eê]ncia|c[aâ]mara|instituto|fundo|departamento|servi[cç]o|conselho|comiss[aã]o|empresa|autarquia|prefeitura|gabinete)/i;
  if (regexEntidades.test(tNorm)) return true;

  // 2. Seções Administrativas Principais Gerais do Diário Oficial (Level 1)
  const regexSecoesPrincipais = /^(licita[cç]|contrato|compra|terceiro\s+setor|acervo|entidade|expediente|p[aá]gina\s+\d+|contas\s+p[uú]blicas|atos?\s+oficia|atos?\s+administra|atos?\s+legis|atos?\s+de\s+pessoal|atos?\s+pessoal|advert[eê]nci|notiﬁca[cç]|notifica[cç]|veto)/i;
  if (regexSecoesPrincipais.test(tNorm)) return true;

  return false;
}

/**
 * Limpa cabeçalhos e rodapés comuns das páginas do DOSP de acordo com a cidade
 */
function limparCabecalhoRodape(
  textoPagina: string,
  numPagina: number,
  totalPaginas: number,
  config: DospConfig
): string {
  let linhas = textoPagina.split('\n');
  const termosEspecificos = (config.dominiosOuTermos || []).map(t => t.toLowerCase());

  linhas = linhas.filter((linha, idx) => {
    const l = linha.toLowerCase().trim();
    if (!l) return true;

    // Se for cabeçalho (nas primeiras 10 linhas da página)
    if (idx < 10) {
      if (l.includes('diário oficial')) return false;
      if (l.includes(`município de ${config.cidade.toLowerCase()}`) || l.includes('prefeitura municipal')) return false;
      if (l.includes('conforme lei municipal')) return false;
      if (l.includes('edição nº') || l.includes('ano x') || l.includes('ano ix') || l.includes('ano viii') || l.includes('ano vii')) return false;
      if (l.includes('página') && l.includes('de')) return false;
      if (/(segunda|terça|quarta|quinta|sexta)-feira/i.test(l)) return false;

      for (const t of termosEspecificos) {
        if (l.includes(t)) return false;
      }
    }

    // Se for rodapé (nas últimas 10 linhas da página)
    if (idx > linhas.length - 10) {
      if (l.includes('assinado digitalmente') ||
        l.includes('assinado eletronicamente') ||
        l.includes('garante a autenticidade') ||
        l.includes('conforme mp') ||
        l.includes('validade jurídica') ||
        l.includes('autoridade certificadora') ||
        l.includes('icp-brasil') ||
        l.includes('lei 14.063') ||
        l.includes('lei municipal nº')) return false;
      if (l.includes('página') && l.includes('de')) return false;
      if (l.includes(`município de ${config.cidade.toLowerCase()}`)) return false;
    }

    // Filtros globais em qualquer posição
    if (l.includes('diário oficial assinado digitalmente') ||
      l.includes('garante a autenticidade deste documento') ||
      l.includes('validade jurídica e integridade')) return false;

    return true;
  });

  return linhas.join('\n');
}

/**
 * Extrai o concurso e o ano do ato utilizando o extrator global de ID do sistema
 */
function extrairIdentificacaoConcurso(texto: string): { concurso: string, ano?: number } {
  const textoCorrigido = corrigirErrosDigitacao(texto);
  const idConcurso = extrairIdConcurso(textoCorrigido, '', true, false);

  if (idConcurso) {
    let ano: number | undefined = undefined;
    const matchAno = idConcurso.match(/\/(\d{4})\b/);
    if (matchAno) ano = parseInt(matchAno[1], 10);

    return {
      concurso: idConcurso,
      ano
    };
  }

  return { concurso: 'Não identificado' };
}

/**
 * Motor Genérico de Raspagem para qualquer cidade que utilize a API do DOSP (Imprensa Oficial Municipal)
 */
export async function buscarDospBase(config: DospConfig, opcoes?: ScraperOptions): Promise<Edital[]> {
  if (opcoes?.verificarDisponibilidade) {
    const { verificaDisponibilidade } = await import('../utils');
    await verificaDisponibilidade(config.urlDisponibilidade);
    return [];
  }

  console.log(`🤖 [${config.cidade} Diário] Iniciando raspagem segmentada via DOSP (Código ${config.codigoDosp})...`);

  const apiUrl = `https://dosp.com.br/api/index.php/filtrasecao.js/${config.codigoDosp}/6`;
  const apiRes = await fetch(apiUrl);
  if (!apiRes.ok) {
    console.error(`❌ [${config.cidade} Diário] Falha ao acessar API de seções do DOSP.`);
    return [];
  }

  const rawText = await apiRes.text();
  const startIdx = rawText.indexOf('(');
  const endIdx = rawText.lastIndexOf(')');

  if (startIdx === -1 || endIdx === -1) {
    console.error(`❌ [${config.cidade} Diário] Não foi possível fazer o parse do JSONP da API.`);
    return [];
  }

  const jsonStr = rawText.substring(startIdx + 1, endIdx);
  const jsonData = JSON.parse(jsonStr);
  const edicoes = (jsonData.data || []) as EdicaoDosp[];

  // Define janela de tempo: anosDev vs 90 dias (ou anosProd configurado) em produção
  const ehDev = process.env.NODE_ENV !== 'production';
  const anosDev = config.anosDev ?? 5;
  const anosProd = config.anosProd;
  const diasLimite = ehDev ? (anosDev * 365) : (anosProd ? Math.round(anosProd * 365) : 90);
  const limiteDataMs = Date.now() - (diasLimite * 24 * 60 * 60 * 1000);

  const edicoesFiltradas = edicoes
    .filter(edicao => {
      if (!edicao.data) return false;
      const dataEdicaoMs = new Date(`${edicao.data}T00:00:00`).getTime();
      return dataEdicaoMs >= limiteDataMs;
    })
    .sort((a, b) => b.data.localeCompare(a.data));

  const labelModo = ehDev
    ? `MODO DEV (${anosDev} ano${anosDev > 1 ? 's' : ''})`
    : (anosProd ? `PRODUÇÃO (${anosProd} ano${anosProd > 1 ? 's' : ''})` : 'PRODUÇÃO (90 dias)');

  console.log(`[${config.cidade} Diário] [${labelModo}] Edições para raspagem: ${edicoesFiltradas.length} de ${edicoes.length}`);

  const resultados: Edital[] = [];
  const errosEdicoes: string[] = [];

  // Processa cada edição em lotes de 5 para otimização de velocidade
  const TAMANHO_LOTE = 5;
  for (let i = 0; i < edicoesFiltradas.length; i += TAMANHO_LOTE) {
    const lote = edicoesFiltradas.slice(i, i + TAMANHO_LOTE);

    await Promise.all(lote.map(async (edicao) => {
      const iddo = edicao.iddo;
      const totalPaginas = edicao.pgtotal || 20;
      const base64Id = Buffer.from(iddo.toString()).toString('base64');
      const urlPdf = `https://dosp.com.br/exibe_do.php?i=${base64Id}`;

      try {
        const response = await fetch(urlPdf);
        if (!response.ok) {
          errosEdicoes.push(`Edição ${edicao.edicao_do} (HTTP ${response.status})`);
          return;
        }

        const buffer = Buffer.from(await response.arrayBuffer());

        // 1. Identifica dinamicamente qual página contém o Sumário (Página 1 ou 2)
        let paginaSumario = 1;
        let textoPaginaSumario = await extrairTextoDePdf(buffer, { fPagina: 1, lPagina: 1, layout: false });

        if (!/sumário|sumario/i.test(normalizarTexto(textoPaginaSumario)) && totalPaginas > 1) {
          const textoPag2 = await extrairTextoDePdf(buffer, { fPagina: 2, lPagina: 2, layout: false });
          if (/sumário|sumario/i.test(normalizarTexto(textoPag2))) {
            paginaSumario = 2;
            textoPaginaSumario = textoPag2;
          }
        }

        const rawLinhas = textoPaginaSumario
          .split('\n')
          .map(l => l.trim())
          .filter(l =>
            l &&
            !/^Página\s+\d+(\s+de\s+\d+)?$/i.test(l) &&
            !/^[\.\…\_\-\s]+$/.test(l) &&
            !/(segunda|terça|quarta|quinta|sexta)-feira/i.test(l) &&
            !/^Ano\s+[IXVMLCD]+/i.test(l) &&
            !/^Edição\s+nº/i.test(l)
          );

        // Isola as linhas do bloco SUMÁRIO
        const sumarioLines: string[] = [];
        let inSumario = false;

        for (const l of rawLinhas) {
          const lNorm = normalizarTexto(l);
          if (lNorm === 'SUMARIO' || lNorm.startsWith('SUMARIO')) {
            inSumario = true;
            continue;
          }

          if (inSumario && (lNorm.includes('ACERVO') || lNorm.includes('ENTIDADES') || lNorm.includes('EXPEDIENTE') || lNorm.startsWith('O DIARIO OFICIAL'))) {
            break;
          }

          if (inSumario) {
            sumarioLines.push(l);
          }
        }

        // Extrai pares de (título, página) das linhas do sumário
        const itensSumario: { titulo: string; pagina: number }[] = [];
        const titulosBuffer: string[] = [];
        const paginasBuffer: number[] = [];

        for (let idxL = 0; idxL < sumarioLines.length; idxL++) {
          const linha = sumarioLines[idxL];

          const match = linha.match(/^(.*?)\s*[\.\…\_\-]{2,}\s*(\d+)$/) || linha.match(/^(.+?)\s+(\d+)$/);
          if (match && !/^\d+$/.test(match[1].trim())) {
            const tit = match[1].replace(/[\.\…\_\-]+$/, '').trim();
            const pag = parseInt(match[2], 10);
            if (tit && !isNaN(pag) && pag <= totalPaginas + 10) {
              itensSumario.push({ titulo: tit, pagina: pag });
              continue;
            }
          }

          if (/^\d+$/.test(linha)) {
            paginasBuffer.push(parseInt(linha, 10));
          } else {
            titulosBuffer.push(linha);
          }

          if (titulosBuffer.length > 0 && titulosBuffer.length === paginasBuffer.length) {
            for (let k = 0; k < titulosBuffer.length; k++) {
              if (paginasBuffer[k] <= totalPaginas + 10) {
                itensSumario.push({ titulo: titulosBuffer[k], pagina: paginasBuffer[k] });
              }
            }
            titulosBuffer.length = 0;
            paginasBuffer.length = 0;
          }
        }

        if (titulosBuffer.length > 0 && titulosBuffer.length === paginasBuffer.length) {
          for (let k = 0; k < titulosBuffer.length; k++) {
            if (paginasBuffer[k] <= totalPaginas + 10) {
              itensSumario.push({ titulo: titulosBuffer[k], pagina: paginasBuffer[k] });
            }
          }
        }

        // Localiza e extrai TODAS as subseções de Concursos no sumário
        const subsecoesAto: { titulo: string; pagInicio: number; pagFim: number; orgaoSumario: string }[] = [];
        let entidadeAtual = 'Prefeitura';

        for (let i = 0; i < itensSumario.length; i++) {
          const item = itensSumario[i];
          const tNorm = normalizarTexto(item.titulo).toLowerCase().trim();

          if (/poder\s+legislativo|c[aâ]mara/i.test(tNorm)) {
            entidadeAtual = 'Câmara Municipal';
          } else if (/poder\s+executivo|prefeitura|secretaria|funda[cç]|superintend|instituto|gabinete/i.test(tNorm)) {
            entidadeAtual = 'Prefeitura';
          }

          if (/concurso|seletivo/i.test(tNorm)) {
            const orgaoDestaSecao = entidadeAtual;
            let j = i + 1;
            let encontrouSubItem = false;

            while (j < itensSumario.length) {
              const proximoItem = itensSumario[j];
              if (ehOutraEntidadeOuSecao(proximoItem.titulo)) {
                break;
              }

              let pagFim = totalPaginas;
              if (j + 1 < itensSumario.length) {
                pagFim = Math.max(proximoItem.pagina, itensSumario[j + 1].pagina - 1);
              }

              subsecoesAto.push({
                titulo: proximoItem.titulo,
                pagInicio: proximoItem.pagina,
                pagFim,
                orgaoSumario: orgaoDestaSecao
              });
              encontrouSubItem = true;
              j++;
            }

            if (!encontrouSubItem) {
              let pagFim = totalPaginas;
              if (i + 1 < itensSumario.length) {
                pagFim = Math.max(item.pagina, itensSumario[i + 1].pagina - 1);
              }
              subsecoesAto.push({
                titulo: item.titulo,
                pagInicio: item.pagina,
                pagFim,
                orgaoSumario: orgaoDestaSecao
              });
            }

            i = Math.max(i, j - 1);
          }
        }

        if (subsecoesAto.length === 0) {
          subsecoesAto.push({
            titulo: 'Concursos Públicos/Processos Seletivos',
            pagInicio: 1,
            pagFim: totalPaginas,
            orgaoSumario: 'Prefeitura'
          });
        }

        let atoIndex = 0;
        for (const atoSub of subsecoesAto) {
          atoIndex++;
          const pagInicio = atoSub.pagInicio;
          const pagFim = atoSub.pagFim;

          const pagLimite = Math.min(pagInicio + 1, pagFim);
          const textoPaginasRaw = await extrairTextoDePdf(buffer, { fPagina: pagInicio, lPagina: pagLimite, layout: true });
          const ato = limparCabecalhoRodape(textoPaginasRaw, pagInicio, totalPaginas, config);

          if (!ato || ato.trim().length < 50) continue;

          const textoCorrigido = corrigirErrosDigitacao(ato);
          const ehLixo = ehSujeira(textoCorrigido.toLowerCase(), [], urlPdf);

          if (!ehLixo) {
            const { concurso, ano } = extrairIdentificacaoConcurso(ato);

            let tituloFinal = atoSub.titulo.trim();
            if (tituloFinal) {
              tituloFinal = tituloFinal.charAt(0).toUpperCase() + tituloFinal.slice(1);
            } else {
              tituloFinal = 'Edital';
            }

            const textoCorpoLimpo = limparRodapeEntidadesDoTexto(ato);
            // Verifica apenas o cabeçalho do documento (primeiras 10 linhas) para não capturar citações ao TCESP nos anexos
            const primeirasLinhasCorpo = textoCorpoLimpo.split('\n').slice(0, 10).join('\n');
            const ehLegislativoNoCabecalho = /c[aâ]mara\s+municipal|poder\s+legislativo/i.test(primeirasLinhasCorpo);
            const ehLegislativoNoSumario = atoSub.orgaoSumario === 'Câmara Municipal';
            const orgao = (ehLegislativoNoSumario || ehLegislativoNoCabecalho) ? 'Câmara Municipal' : 'Prefeitura';

            const partesData = edicao.data.split('-');
            const anoPublicacao = partesData[0];
            const dataPublicacao = `${partesData[2]}/${partesData[1]}/${partesData[0]}`;
            const dataTimestamp = new Date(`${edicao.data}T00:00:00`).getTime();

            let concursoFinal = concurso;
            if (!concursoFinal || concursoFinal === 'Não identificado' || concursoFinal.trim() === '') {
              concursoFinal = 'Outros';
            }

            const anoFinal = ano || parseInt(anoPublicacao, 10);

            const sufixoAto = subsecoesAto.length > 1 ? `&ato=${atoIndex}` : '';
            const linkFinal = `${urlPdf}#page=${pagInicio}${sufixoAto}`;

            resultados.push({
              cidade: config.cidade,
              orgao,
              titulo: tituloFinal,
              link: linkFinal,
              descricao: formatarResumoDescricao(ato, 150),
              concurso: concursoFinal,
              ano: anoFinal,
              dataPublicacao,
              dataTimestamp,
              linkOrigem: urlPdf,
              fonte: 'diario'
            });
          }
        }

      } catch (e: any) {
        console.error(`[${config.cidade} Diário] Erro ao ler a edição ${edicao.edicao_do}:`, e.message || e);
        errosEdicoes.push(`Edição ${edicao.edicao_do} (${e.message || 'Erro'})`);
      }
    }));
  }

  console.log(`[${config.cidade} Diário] Concluído! Atos oficiais extraídos: ${resultados.length}`);
  if (errosEdicoes.length > 0) {
    console.warn(`[${config.cidade} Diário] Avisos: Falha ao ler ${errosEdicoes.length} edições (${errosEdicoes.join(', ')})`);
  }

  resultados.sort((a, b) => b.dataTimestamp - a.dataTimestamp);

  resultados.forEach((res, index) => {
    res.ordemOriginal = index + 1;
  });

  return resultados;
}
