// src/lib/scrapers/camaras/parisi.ts
import * as cheerio from 'cheerio';
import { Edital } from '../../../types';
import { ehSujeira, extrairIdConcurso, corrigirErrosDigitacao } from '../../filtrosGlobais';

export async function buscarCamaraParisi(): Promise<Edital[]> {
  const resultados: Edital[] = [];
  let ordemGlobal = 0;

  const mainRssUrl = 'https://www.parisi.sp.leg.br/transparencia/concurso-publico/RSS';
  const palavrasLocais = ['sentenca', 'tcesp'];

  try {
    const res = await fetch(mainRssUrl, { headers: { 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
        }, cache: 'no-store' });
    if (!res.ok) return [];

    const xml = await res.text();
    const $ = cheerio.load(xml, { xmlMode: true });

    const linksDasPastas: string[] = [];

    // Lê a primeira camada do RSS (As pastas de Anos, ex: 2019)
    $('item').each((_, el) => {
      const linkPasta = $(el).find('link').text().trim();
      if (linkPasta) {
        linksDasPastas.push(`${linkPasta}/RSS`);
      }
    });

    await Promise.all(linksDasPastas.map(async (feedUrl) => {
      try {
        const resInner = await fetch(feedUrl, { headers: { 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
        }, cache: 'no-store' });
        if (!resInner.ok) return;

        const xmlInner = await resInner.text();
        const $inner = cheerio.load(xmlInner, { xmlMode: true });

        const linkOrigemPasta = feedUrl.replace(/\/RSS$/i, '');

        const items = $inner('item').toArray();

        items.forEach((el, index) => {
          const tituloRaw = $inner(el).find('title').text().trim();
          const linkItem = $inner(el).find('link').text().trim();
          const descricaoItem = $inner(el).find('description').text().replace(/\s+/g, ' ').trim();

          const dateISO = $inner(el).find('dc\\:date').text().trim();

          let tituloLimpo = tituloRaw.replace(/^\d+\.\s*/, '').trim();

          const textoParaAvaliar = `${tituloLimpo} ${descricaoItem}`;
          if (ehSujeira(textoParaAvaliar, palavrasLocais)) return;

          let dataFormatada = 'sem data';
          let dataTimestamp = 0;

          if (dateISO) {
            const dateObj = new Date(dateISO);
            dataFormatada = `${String(dateObj.getDate()).padStart(2, '0')}/${String(dateObj.getMonth() + 1).padStart(2, '0')}/${dateObj.getFullYear()}`;
            dataTimestamp = dateObj.getTime();
          }

          dataTimestamp -= (index * 60000);

          // ====================================================================
          // 🚀 BLINDAGEM CONTRA CPF/RG: Remove números que enganam a Regex Global
          // ====================================================================
          const descricaoSegura = descricaoItem
            .replace(/\d{3}\.\d{3}\.\d{3}-\d{2}/g, '') // Remove CPF formatado
            .replace(/(CPF|RG|Lei|Artigo|Art\.)[\s\S]*?\d+/gi, ''); // Remove rótulos

          let idConcurso = '';

          // 1. Tenta achar o padrão exato de Parisi ("Concurso 01_2019")
          const matchLocal = tituloLimpo.match(/Concurso\s+(\d{1,2})_(\d{4})/i) || descricaoItem.match(/Concurso\s+(\d{1,2})_(\d{4})/i);

          if (matchLocal) {
            idConcurso = `Concurso Público ${matchLocal[1].padStart(2, '0')}/${matchLocal[2]}`;
          } else {
            // 2. Se não achar, usa o extrator global na descrição limpa
            idConcurso = extrairIdConcurso(tituloLimpo, descricaoSegura, true, false) || '';
          }

          // 3. Fallback Supremo: Pega o ano que está na URL da pasta (Ex: .../2019/RSS)
          if (!idConcurso) {
            const matchAnoPasta = feedUrl.match(/\/(\d{4})\/RSS/i);
            if (matchAnoPasta) {
              idConcurso = `Concurso Público 01/${matchAnoPasta[1]}`;
            } else {
              idConcurso = 'Concurso Público (Não Identificado)';
            }
          }

          // 🟢 CORREÇÃO: Adicionada a trava !idConcurso.includes('Público')
          if (idConcurso && idConcurso.startsWith('Concurso ') && !idConcurso.includes('Público')) {
            idConcurso = idConcurso.replace('Concurso ', 'Concurso Público ');
          }

          let anoConcurso: number | undefined = undefined;
          if (idConcurso) {
            const matchAno = idConcurso.match(/\/(\d{4})\b/);
            if (matchAno) anoConcurso = parseInt(matchAno[1], 10);
          }

          tituloLimpo = tituloLimpo.replace(/-\s*Concurso\s*\d{1,2}_\d{4}\.?$/i, '').trim();

          ordemGlobal++;

          resultados.push({
            cidade: 'Parisi',
            orgao: 'Câmara Municipal',
            titulo: tituloLimpo,
            descricao: descricaoItem ? descricaoItem.substring(0, 150) + '...' : undefined,
            concurso: idConcurso,
            ano: anoConcurso,
            link: linkItem,
            dataPublicacao: dataFormatada,
            dataTimestamp: dataTimestamp,
            ordemOriginal: ordemGlobal,
            linkOrigem: linkOrigemPasta
          });
        });

      } catch (error: any) {
    const cause = (error as any).cause;
    const causeMsg = cause ? " - Detalhes: " + (cause.message || cause.code || JSON.stringify(cause)) : "";
    throw new Error(`Erro ao ler o feed interno da Câmara Parisi: ${feedUrl}` + ": " + (error as Error).message + causeMsg);
  }
    }));

  } catch (error: any) {
    const cause = (error as any).cause;
    const causeMsg = cause ? " - Detalhes: " + (cause.message || cause.code || JSON.stringify(cause)) : "";
    throw new Error('Erro geral ao buscar Câmara Parisi' + ": " + (error as Error).message + causeMsg);
  }

  return resultados;
}