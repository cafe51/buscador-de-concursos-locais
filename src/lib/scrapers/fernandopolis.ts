import * as cheerio from 'cheerio';
import { Edital } from '../../types';
import { ehSujeira, ehRelevante } from '../filtrosGlobais';

const TERMOS_OBRIGATORIOS_FERNANDOPOLIS = [
  'concurso', 'processo seletivo', 'processo de selecao', 'selecao de', 'estagiario', 'estagio',
  'atribuicao', 'contratacao', 'chamada publica', 'admissao', 'posse',
  'convocacao', 'convoca ', 'gabarito', 'resultado', 'classificacao', 'homologacao',
  'retificacao', 'rerratificacao', 'prorrogacao', 'recurso', 'respostas', 'comunicado',
  'provas', 'entrevista', 'inscricao', 'inscricoes', 'aviso', 'extrato'
];

const SIGLAS_SECRETARIAS: Record<string, string> = {
  'SME': 'Educação',
  'SMRH': 'Recursos Humanos',
  'SMEL': 'Esportes e Lazer',
  'SMCT': 'Cultura e Turismo',
  'SMS': 'Saúde',
  'SMAS': 'Assistência Social',
  'SMO': 'Obras'
};

// --- FUNÇÃO ATUALIZADA: Agora retorna a DATA e os TEXTOS DOS LINKS INTERNOS ---
async function buscarDetalhesFernandopolis(url: string): Promise<{ dataCorreta: string | null, descricaoExtra: string }> {
  try {
    const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'force-cache' });
    if (!response.ok) return { dataCorreta: null, descricaoExtra: '' };

    const html = await response.text();
    const $ = cheerio.load(html);

    let dataCorreta: string | null = null;
    $('time').each((_, elemento) => {
      const match = $(elemento).text().trim().match(/\b(\d{2}\/\d{2}\/\d{4})\b/);
      if (match && !dataCorreta) dataCorreta = match[1];
    });

    // ISOLANDO O CONTEÚDO PRINCIPAL (Ignoramos o <aside> de "Conteúdos relacionados" e menus)
    const $main = $('main').clone();
    $main.find('aside, header, nav, script, .share__container, .horizontal--laptop').remove();

    const nomesDosLinks: string[] = [];

    $main.find('a').each((_, el) => {
      let textoLink = $(el).text().replace(/\s+/g, ' ').trim();

      // Se o link for só a palavra "Download" ou estiver vazio, tenta pegar o atributo 'title'
      if (!textoLink || textoLink.toLowerCase() === 'download' || textoLink.toLowerCase() === 'ver') {
        textoLink = $(el).attr('title') || '';
      }

      // Faz uma limpeza pra tirar datas soltas e hífens do começo do texto do link (igual em Jales)
      textoLink = textoLink.replace(/^[\d\/\.\-\s]+/, '').trim();
      if (textoLink.startsWith('-')) textoLink = textoLink.substring(1).trim();

      // Se sobrou um texto válido e ele ainda não está na nossa lista, nós guardamos
      if (textoLink.length > 3 && !nomesDosLinks.includes(textoLink)) {
        nomesDosLinks.push(textoLink);
      }
    });

    return {
      dataCorreta,
      descricaoExtra: nomesDosLinks.join(' | ') // Junta os nomes com um separador visual
    };

  } catch {
    return { dataCorreta: null, descricaoExtra: '' };
  }
}

export async function buscarFernandopolis(): Promise<Edital[]> {
  const resultados: Edital[] = [];
  let ordemGlobal = 0;

  for (let pagina = 1; pagina <= 15; pagina++) {
    try {
      const response = await fetch(`https://fernandopolis.sp.gov.br/publicacoes/?categoria=concurso&pagina=${pagina}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store'
      });

      if (!response.ok) continue;

      const html = await response.text();
      const $ = cheerio.load(html);
      const itensDestaPagina: { titulo: string, href: string, textoAoRedor: string, ordem: number }[] = [];

      $('h3 a').each((_, elemento) => {
        const titulo = $(elemento).text().trim();
        const href = $(elemento).attr('href') || '';
        const textoAoRedor = $(elemento).parent().parent().text().replace(titulo, '').replace(/\s+/g, ' ').trim();

        const textoParaAnalise = `${titulo} ${textoAoRedor}`;

        if (ehSujeira(textoParaAnalise)) return;
        if (!ehRelevante(textoParaAnalise, TERMOS_OBRIGATORIOS_FERNANDOPOLIS)) return;

        ordemGlobal++;
        itensDestaPagina.push({ titulo, href, textoAoRedor, ordem: ordemGlobal });
      });

      await Promise.all(itensDestaPagina.map(async (item) => {
        const linkCompleto = item.href.startsWith('http') ? item.href : `https://fernandopolis.sp.gov.br${item.href}`;

        // Chamando a nossa função turbinada
        const detalhes = await buscarDetalhesFernandopolis(linkCompleto);

        let timestamp = 0;
        if (detalhes.dataCorreta) {
          const partes = detalhes.dataCorreta.split('/');
          timestamp = new Date(`${partes[2]}-${partes[1]}-${partes[0]}T00:00:00`).getTime();
        }

        // Junta a descrição da lista principal com a dos links internos
        const descricaoFinal = [item.textoAoRedor, detalhes.descricaoExtra].filter(Boolean).join(' - ');

        const tagsMetadados: string[] = [];
        const textoCompletoPesquisa = `${item.titulo} ${descricaoFinal}`.toUpperCase();

        if (textoCompletoPesquisa.includes('SME') || textoCompletoPesquisa.includes('SECRETARIA MUNICIPAL DA EDUCAÇÃO') || textoCompletoPesquisa.includes('SECRETARIA MUNICIPAL DE EDUCACAO')) {
          tagsMetadados.push('Educação');
        }
        if (textoCompletoPesquisa.includes('SMRH') || textoCompletoPesquisa.includes('RECURSOS HUMANOS')) {
          tagsMetadados.push('Recursos Humanos');
        }
        if (textoCompletoPesquisa.includes('SMEL') || textoCompletoPesquisa.includes('ESPORTES E LAZER')) {
          tagsMetadados.push('Esportes e Lazer');
        }
        if (textoCompletoPesquisa.includes('SMCT') || textoCompletoPesquisa.includes('CULTURA E TURISMO')) {
          tagsMetadados.push('Cultura e Turismo');
        }
        if (textoCompletoPesquisa.includes('SMS ') || textoCompletoPesquisa.includes('SECRETARIA MUNICIPAL DE SAUDE') || textoCompletoPesquisa.includes('SECRETARIA MUNICIPAL DE SAÚDE')) {
          tagsMetadados.push('Saúde');
        }
        if (textoCompletoPesquisa.includes('SMAS') || textoCompletoPesquisa.includes('ASSISTENCIA SOCIAL') || textoCompletoPesquisa.includes('ASSISTÊNCIA SOCIAL')) {
          tagsMetadados.push('Assistência Social');
        }

        if (textoCompletoPesquisa.includes('SMAS') || textoCompletoPesquisa.includes('ASSISTENCIA SOCIAL')) {
          tagsMetadados.push('Assistência Social');
        }

        // NOVA REGRA: Pescando o Consórcio de Saúde
        if (textoCompletoPesquisa.includes('CISARF')) {
          tagsMetadados.push('Consórcio CISARF');
        }


        resultados.push({
          cidade: 'Fernandópolis',
          orgao: 'Prefeitura',
          titulo: item.titulo,
          link: linkCompleto,
          descricao: descricaoFinal || undefined, // A DESCRIÇÃO RICA ENTRA AQUI!
          metadados: tagsMetadados.length > 0 ? tagsMetadados : undefined,
          dataPublicacao: detalhes.dataCorreta || 'sem data',
          dataTimestamp: timestamp,
          ordemOriginal: item.ordem
        });
      }));

    } catch (e) {
      console.error(`Erro ao buscar Fernandópolis na página ${pagina}`, e);
    }
  }
  return resultados;
}