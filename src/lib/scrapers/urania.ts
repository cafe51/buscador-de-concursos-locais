// src/lib/scrapers/urania.ts
import * as cheerio from 'cheerio';
import { Edital } from '../../types';
import { ehSujeira, extrairIdConcurso } from '../filtrosGlobais';
import { extrairDataDoArquivo } from '../docParser';
import { fetchHtml, extrairData } from './utils';

export async function buscarUrania(): Promise<Edital[]> {
  const resultados: Edital[] = [];
  const linkPagina = 'https://www.urania.sp.gov.br/transparencia/concursos-e-editais/concursos-publicos-editais-processo-seletivo';

  try {
    const res = await fetchHtml(linkPagina);
    if (!res.ok) return [];

    const $ = cheerio.load(res.html);

    // 🚀 FOCO CIRÚRGICO: Apenas os links dentro da div de conteúdo
    const elementosTagA = $('div[data-id="19ba033"] a').toArray();
    let ordemGlobal = 0;

    const linksParaProcessar = elementosTagA.map(el => {
      const href = $(el).attr('href') || '';
      const textoOriginal = $(el).text() || $(el).attr('title') || '';
      return { href, textoOriginal };
    }).filter(item => item.href && item.textoOriginal);

    // Processa os links em paralelo para extrair datas dos PDFs quando necessário
    await Promise.all(linksParaProcessar.map(async (item) => {
      // 1. Limpa o formato feio de Urânia (Ex: "Urânia-PS-002.2018" -> "Urânia PS 002 2018")
      let tituloLimpo = item.textoOriginal.replace(/-/g, ' ').replace(/\s+/g, ' ').trim();

      if (ehSujeira(tituloLimpo, [], item.href)) return;

      let dataFormatada = 'sem data';
      let dataTimestamp = 0;

      // 2. Tenta extrair a data diretamente do título
      const dataExtraida = extrairData(tituloLimpo);
      if (dataExtraida) {
        dataFormatada = dataExtraida.dataFormatada;
        dataTimestamp = dataExtraida.dataTimestamp;

        const matchDataTitulo = tituloLimpo.match(/\b\d{2}[\.\/\-]\d{2}[\.\/\-]\d{4}\b/);
        if (matchDataTitulo) {
          tituloLimpo = tituloLimpo.replace(matchDataTitulo[0], '').trim();
        }
      } else {
        // Se não tem data no título, o DocParser lê o arquivo!
        const dataDoc = await extrairDataDoArquivo(item.href);
        if (dataDoc) {
          dataFormatada = dataDoc.formatada;
          dataTimestamp = dataDoc.timestamp;
        }
      }

      // 3. Extrai a Chave de Agrupamento
      let idConcurso = extrairIdConcurso(tituloLimpo, '');

      // 🚀 TRADUTOR DE SIGLAS DE URÂNIA (Corrigido o zero à esquerda)
      if (!idConcurso) {
        const matchCP = tituloLimpo.match(/\bcp\s*(\d{1,3})[_\.\/](\d{4})\b/i);
        if (matchCP) {
          const num = parseInt(matchCP[1], 10).toString().padStart(2, '0');
          idConcurso = `Concurso Público ${num}/${matchCP[2]}`;
        }

        const matchPS = tituloLimpo.match(/\bps\s*(\d{1,3})[_\.\/](\d{4})\b/i);
        if (matchPS) {
          const num = parseInt(matchPS[1], 10).toString().padStart(2, '0');
          idConcurso = `Processo Seletivo ${num}/${matchPS[2]}`;
        }
      }

      // 🟢 PADRONIZAÇÃO EXIGIDA
      if (idConcurso && idConcurso.startsWith('Concurso ') && !idConcurso.includes('Público')) {
        idConcurso = idConcurso.replace('Concurso ', 'Concurso Público ');
      }

      // Se for estagiário, marca para não misturar
      if (idConcurso && tituloLimpo.toUpperCase().includes('ESTAGI')) {
        idConcurso += ' (Estagiários)';
      }

      let anoConcurso: number | undefined = undefined;
      if (idConcurso) {
        const matchAno = idConcurso.match(/\/(\d{4})\b/);
        if (matchAno) anoConcurso = parseInt(matchAno[1], 10);
      }

      const tituloFinal = tituloLimpo.replace(/\b(?:cp|ps)\s*\d{1,3}[_\.\/]\d{4}\b.*$/i, '').trim();

      ordemGlobal++;

      resultados.push({
        cidade: 'Urânia',
        orgao: 'Prefeitura',
        titulo: tituloFinal || 'Documento',
        concurso: idConcurso,
        ano: anoConcurso,
        link: item.href.startsWith('http') ? item.href : `https://ecrie.com.br${item.href}`,
        dataPublicacao: dataFormatada,
        dataTimestamp: dataTimestamp,
        ordemOriginal: ordemGlobal,
        linkOrigem: linkPagina
      });
    }));

  } catch (e: any) {
    const cause = (e as any).cause;
    const causeMsg = cause ? " - Detalhes: " + (cause.message || cause.code || JSON.stringify(cause)) : "";
    throw new Error(`Erro geral ao buscar Urânia` + ": " + (e as Error).message + causeMsg);
  }

  return resultados;
}