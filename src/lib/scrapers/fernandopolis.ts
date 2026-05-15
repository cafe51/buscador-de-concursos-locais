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

async function buscarDataFernandopolis(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'force-cache' });
    if (!response.ok) return null;
    const html = await response.text();
    const $ = cheerio.load(html);
    let dataCorreta: string | null = null;
    $('time').each((_, elemento) => {
      const match = $(elemento).text().trim().match(/\b(\d{2}\/\d{2}\/\d{4})\b/);
      if (match && !dataCorreta) dataCorreta = match[1];
    });
    return dataCorreta;
  } catch {
    return null;
  }
}

async function buscarDetalhesFernandopolis(url: string): Promise<{ dataCorreta: string | null, descricaoExtra: string, urlPrimeiroPdf: string | null }> {
  try {
    const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'force-cache' });
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

  // Flag global para avisar o loop quando parar
  let encontrouAlvoDeParada = false;

  // Aumentamos o limite para 50 para garantir folga no futuro, mas o código vai parar sozinho bem antes.
  for (let pagina = 1; pagina <= 50; pagina++) {
    try {
      const response = await fetch(`https://fernandopolis.sp.gov.br/publicacoes/?categoria=concurso&pagina=${pagina}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store'
      });

      if (!response.ok) continue;

      const html = await response.text();
      const $ = cheerio.load(html);
      const itensDestaPagina: { titulo: string, linkCompleto: string, textoAoRedor: string, ordem: number }[] = [];

      $('h3 a').each((_, elemento) => {
        const titulo = $(elemento).text().trim();
        const href = $(elemento).attr('href') || '';
        const linkCompleto = href.startsWith('http') ? href : `https://fernandopolis.sp.gov.br${href}`;
        const textoAoRedor = $(elemento).parent().parent().text().replace(titulo, '').replace(/\s+/g, ' ').trim();
        const textoParaAnalise = `${titulo} ${textoAoRedor}`;

        // ==============================================================
        // 🛑 A CONDIÇÃO DE PARADA (Verifica se é o Edital 01/2023)
        // ==============================================================
        const ehOLinkAlvo = linkCompleto.includes('/concurso/edital-normativo-do-concurso-publico-no-012018-7933');

        if (ehSujeira(textoParaAnalise, [], linkCompleto)) {
          if (ehOLinkAlvo) { encontrouAlvoDeParada = true; return false; } // Para o .each() do cheerio
          return true; // Funciona como 'continue', pula para o próximo
        }

        if (!ehRelevante(textoParaAnalise, TERMOS_OBRIGATORIOS_FERNANDOPOLIS)) {
          if (ehOLinkAlvo) { encontrouAlvoDeParada = true; return false; }
          return true;
        }

        ordemGlobal++;
        itensDestaPagina.push({ titulo, linkCompleto, textoAoRedor, ordem: ordemGlobal });

        // Se este item aprovado nos filtros era o nosso alvo, a gente aciona o freio
        // e o 'return false' garante que os cards que estão ABAIXO dele não sejam lidos.
        if (ehOLinkAlvo) {
          encontrouAlvoDeParada = true;
          return false;
        }
        // ==============================================================
      });

      // Baixa apenas os itens coletados até a batida do freio
      await Promise.all(itensDestaPagina.map(async (item) => {
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
          metadados: tagsMetadados.length > 0 ? tagsMetadados : undefined,
          dataPublicacao: detalhes.dataCorreta || 'sem data',
          dataTimestamp: timestamp,
          ordemOriginal: item.ordem
        });
      }));

      // Se a bandeira de parada foi levantada, nós damos o BREAK no loop principal de páginas
      if (encontrouAlvoDeParada) {
        break;
      }

    } catch (e) {
      console.error(`Erro ao buscar Fernandópolis na página ${pagina}`, e);
    }
  }
  return resultados;
}