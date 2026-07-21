import { Edital, ScraperOptions } from '../../../types';
import { ehSujeira, corrigirErrosDigitacao, extrairIdConcurso } from '../../filtrosGlobais';
import { extrairTextoDePdf } from '../../pdfParserModern';

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
 * Limpa cabeçalhos e rodapés comuns das páginas do DOSP de Jales
 */
function limparCabecalhoRodape(textoPagina: string, numPagina: number, totalPaginas: number): string {
  let linhas = textoPagina.split('\n');

  linhas = linhas.filter((linha, idx) => {
    const l = linha.toLowerCase().trim();
    if (!l) return true;

    // Se for cabeçalho (nas primeiras 10 linhas da página)
    if (idx < 10) {
      if (l.includes('diário oficial')) return false;
      if (l.includes('município de jales') || l.includes('prefeitura municipal')) return false;
      if (l.includes('conforme lei municipal') && l.includes('4.663')) return false;
      if (l.includes('www.jales.sp.gov.br')) return false;
      if (l.includes('imprensaoficialmunicipal.com.br/jales')) return false;
      if (l.includes('edição nº') || l.includes('ano x') || l.includes('ano ix') || l.includes('ano xi')) return false;
      if (l.includes('página') && l.includes('de')) return false;
      if (/(segunda|terça|quarta|quinta|sexta)-feira/i.test(l)) return false;
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
      if (l.includes('município de jales')) return false;
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
 * Scraper definitivo do Diário Oficial de Jales (DOSP)
 * Coleta concursos e processos seletivos dos últimos 2 anos.
 * Analisa o sumário da Edição (Página 1) para identificar subseções e intervalos de páginas exatos por ato.
 */
export async function buscarJalesDiario(opcoes?: ScraperOptions): Promise<Edital[]> {
  if (opcoes?.verificarDisponibilidade) {
    const { verificaDisponibilidade } = await import('../utils');
    await verificaDisponibilidade('https://www.imprensaoficialmunicipal.com.br/jales');
    return [];
  }

  console.log(`🤖 [Jales Diário] Iniciando raspagem segmentada via Diário Oficial...`);

  // 1. Busca edições correspondentes à seção de Concursos na API do DOSP
  const apiRes = await fetch('https://dosp.com.br/api/index.php/filtrasecao.js/4932/6');
  if (!apiRes.ok) {
    console.error('❌ [Jales Diário] Falha ao acessar API de seções do DOSP.');
    return [];
  }

  const rawText = await apiRes.text();
  const startIdx = rawText.indexOf('(');
  const endIdx = rawText.lastIndexOf(')');

  if (startIdx === -1 || endIdx === -1) {
    console.error('❌ [Jales Diário] Não foi possível fazer o parse do JSONP da API.');
    return [];
  }

  const jsonStr = rawText.substring(startIdx + 1, endIdx);
  const jsonData = JSON.parse(jsonStr);
  const edicoes = (jsonData.data || []) as EdicaoDosp[];

  // Define janela de tempo: 5 anos (1825 dias) em desenvolvimento vs 3 meses (90 dias) em produção
  const ehDev = process.env.NODE_ENV !== 'production';
  const diasLimite = ehDev ? (5 * 365) : 90;
  const limiteDataMs = Date.now() - (diasLimite * 24 * 60 * 60 * 1000);

  const edicoesFiltradas = edicoes
    .filter(edicao => {
      if (!edicao.data) return false;
      const dataEdicaoMs = new Date(`${edicao.data}T00:00:00`).getTime();
      return dataEdicaoMs >= limiteDataMs;
    })
    .sort((a, b) => b.data.localeCompare(a.data));

  console.log(`[Jales Diário] [${ehDev ? 'MODO DEV (5 anos)' : 'PRODUÇÃO (3 meses)'}] Edições para raspagem: ${edicoesFiltradas.length} de ${edicoes.length}`);

  const resultados: Edital[] = [];
  const errosEdicoes: string[] = [];

  // 2. Processa cada edição em lotes de 5 para otimização de velocidade
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

        // 1. Identifica dinamicamente qual página contém o Sumário buscando pela palavra "SUMÁRIO" (Página 1 ou 2)
        let paginaSumario = 1;
        let textoPaginaSumario = await extrairTextoDePdf(buffer, { fPagina: 1, lPagina: 1, layout: false });

        if (!/sumário|sumario/i.test(textoPaginaSumario) && totalPaginas > 1) {
          const textoPag2 = await extrairTextoDePdf(buffer, { fPagina: 2, lPagina: 2, layout: false });
          if (/sumário|sumario/i.test(textoPag2)) {
            paginaSumario = 2;
            textoPaginaSumario = textoPag2;
          }
        }

        // Remove linhas de rodapé/cabeçalho de página, linhas de pontos e cabeçalhos de edições
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
          if (l === 'SUMÁRIO' || l.startsWith('SUMÁRIO')) {
            inSumario = true;
            continue;
          }

          if (inSumario && (l.includes('ACERVO') || l.includes('ENTIDADES') || l.includes('EXPEDIENTE') || l.startsWith('O Diário Oficial'))) {
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

          // Formato em linha única (ex: "Edital - Classificação .......... 7" ou "Decretos 2")
          const matchLinhaUnica = linha.match(/^(.+?)[\s\.\…\_\-]{2,}(\d+)$/) || linha.match(/^([a-zà-ú\s\/\-\,\(\)]+?)\s+(\d+)$/i);
          if (matchLinhaUnica && !/^\d+$/.test(matchLinhaUnica[1].trim())) {
            const tit = matchLinhaUnica[1].trim();
            const pag = parseInt(matchLinhaUnica[2], 10);
            if (tit && !isNaN(pag)) {
              itensSumario.push({ titulo: tit, pagina: pag });
              continue;
            }
          }

          // Formato em linhas separadas (ex: linha 1 = Título, linha 2 = Número de página)
          if (/^\d+$/.test(linha)) {
            paginasBuffer.push(parseInt(linha, 10));
          } else {
            titulosBuffer.push(linha);
          }

          if (titulosBuffer.length > 0 && titulosBuffer.length === paginasBuffer.length) {
            for (let k = 0; k < titulosBuffer.length; k++) {
              itensSumario.push({ titulo: titulosBuffer[k], pagina: paginasBuffer[k] });
            }
            titulosBuffer.length = 0;
            paginasBuffer.length = 0;
          }
        }

        if (titulosBuffer.length > 0 && titulosBuffer.length === paginasBuffer.length) {
          for (let k = 0; k < titulosBuffer.length; k++) {
            itensSumario.push({ titulo: titulosBuffer[k], pagina: paginasBuffer[k] });
          }
        }

        // Localiza o bloco de Concursos no sumário
        const idxConcursos = itensSumario.findIndex(item => /concurso|seletivo/i.test(item.titulo));

        const subsecoesAto: { titulo: string; pagInicio: number; pagFim: number }[] = [];

        if (idxConcursos !== -1) {
          const itemHead = itensSumario[idxConcursos];
          const pagInicioHead = itemHead.pagina;

          const subsecoesEncontradas: { titulo: string; pagina: number }[] = [];
          let pagProximaSecaoGeral = totalPaginas + 1;

          for (let j = idxConcursos + 1; j < itensSumario.length; j++) {
            const item = itensSumario[j];
            if (item.pagina < pagInicioHead) continue;

            // Identifica se a linha é o cabeçalho de uma nova Seção Principal do Diário ou o fim do bloco do sumário
            const ehOutraSecaoPrincipal = /^(poder\s+|licitaç|contrato|compra|terceiro\s+setor|conselho|instituto|acervo|entidade|expediente|página\s+\d+|contas\s+públicas|atos?\s+oficia|atos?\s+administra|atos?\s+legis)/i.test(item.titulo) && !/concurso|seletivo/i.test(item.titulo);

            if (ehOutraSecaoPrincipal) {
              pagProximaSecaoGeral = item.pagina;
              break;
            } else {
              subsecoesEncontradas.push(item);
            }
          }

          if (subsecoesEncontradas.length === 0) {
            subsecoesEncontradas.push(itemHead);
          }

          for (let k = 0; k < subsecoesEncontradas.length; k++) {
            const sub = subsecoesEncontradas[k];
            let pagFim = totalPaginas;

            if (k + 1 < subsecoesEncontradas.length) {
              pagFim = Math.max(sub.pagina, subsecoesEncontradas[k + 1].pagina - 1);
            } else if (pagProximaSecaoGeral <= totalPaginas) {
              pagFim = Math.max(sub.pagina, pagProximaSecaoGeral - 1);
            }

            subsecoesAto.push({
              titulo: sub.titulo,
              pagInicio: sub.pagina,
              pagFim
            });
          }
        } else {
          // Se o sumário não tiver a palavra concurso explicitada (fallback seguro)
          subsecoesAto.push({
            titulo: 'Concursos Públicos/Processos Seletivos',
            pagInicio: 1,
            pagFim: totalPaginas
          });
        }

        let atoIndex = 0;
        for (const atoSub of subsecoesAto) {
          atoIndex++;
          const pagInicio = atoSub.pagInicio;
          const pagFim = atoSub.pagFim;

          // Lê até 2 páginas a partir de pagInicio para extração do cabeçalho, concurso e amostra da descrição
          const pagLimite = Math.min(pagInicio + 1, pagFim);
          const textoPaginasRaw = await extrairTextoDePdf(buffer, { fPagina: pagInicio, lPagina: pagLimite, layout: true });
          const ato = limparCabecalhoRodape(textoPaginasRaw, pagInicio, totalPaginas);

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

            const ehLegislativo = /c[aâ]mara|legislativo/i.test(ato);
            const orgao = ehLegislativo ? 'Câmara Municipal' : 'Prefeitura';

            const partesData = edicao.data.split('-');
            const anoPublicacao = partesData[0];
            const dataPublicacao = `${partesData[2]}/${partesData[1]}/${partesData[0]}`;
            const dataTimestamp = new Date(`${edicao.data}T00:00:00`).getTime();

            // Garantia estrita: se a chave concurso não for identificada, aplica o fallback "Outros"
            let concursoFinal = concurso;
            if (!concursoFinal || concursoFinal === 'Não identificado' || concursoFinal.trim() === '') {
              concursoFinal = 'Outros';
            }

            const anoFinal = ano || parseInt(anoPublicacao, 10);

            // Inclui o índice do ato se houver mais de um ato na edição para garantir unicidade absoluta da chave link no MongoDB
            const sufixoAto = subsecoesAto.length > 1 ? `&ato=${atoIndex}` : '';
            const linkFinal = `${urlPdf}#page=${pagInicio}${sufixoAto}`;

            resultados.push({
              cidade: 'Jales',
              orgao,
              titulo: tituloFinal,
              link: linkFinal,
              descricao: ato,
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
        console.error(`[Jales Diário] Erro ao ler a edição ${edicao.edicao_do}:`, e.message || e);
        errosEdicoes.push(`Edição ${edicao.edicao_do} (${e.message || 'Erro'})`);
      }
    }));
  }

  console.log(`[Jales Diário] Concluído! Atos oficiais extraídos: ${resultados.length}`);
  if (errosEdicoes.length > 0) {
    console.warn(`[Jales Diário] Avisos: Falha ao ler ${errosEdicoes.length} edições (${errosEdicoes.join(', ')})`);
  }

  // Ordena os resultados: mais recentes primeiro
  resultados.sort((a, b) => b.dataTimestamp - a.dataTimestamp);

  // Atribui ordemOriginal cronológica
  resultados.forEach((res, index) => {
    res.ordemOriginal = index + 1;
  });

  return resultados;
}
