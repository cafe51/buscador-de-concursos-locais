// src/lib/docParser.ts
// @ts-ignore
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import * as mammoth from 'mammoth';
import * as cheerio from 'cheerio';
import { PDFs_IGNORADOS } from './blacklist';

process.noDeprecation = true;

const consoleWarnOriginal = console.warn;
console.warn = function (...args) {
  if (typeof args[0] === 'string' && args[0].includes('Warning: TT: undefined function')) return;
  consoleWarnOriginal.apply(console, args);
};

export const urlsParaBlacklist = new Set<string>();

const MESES: Record<string, string> = {
  janeiro: '01', fevereiro: '02', março: '03', marco: '03',
  abril: '04', maio: '05', junho: '06', julho: '07',
  agosto: '08', setembro: '09', outubro: '10', novembro: '11', dezembro: '12'
};

// ==============================================================
// 📄 EXTRATOR DE TEXTO BRUTO (Módulo Genérico)
// ==============================================================
export async function extrairTextoBruto(url: string, depth = 0, tentativas = 2): Promise<string | null> {
  if (depth > 2) return null; // Limite de 2 saltos de redirecionamento
  if (PDFs_IGNORADOS.includes(url)) return null;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/pdf, application/octet-stream, text/html, */*'
      }
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      if (tentativas > 0) {
        await new Promise(r => setTimeout(r, 3000));
        return extrairTextoBruto(url, depth, tentativas - 1);
      }
      return null;
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = (res.headers.get('content-type') || '').toLowerCase();

    const isPDF = contentType.includes('pdf') || contentType.includes('octet-stream') || buffer.toString('hex', 0, 4) === '25504446';
    const isDOCX = contentType.includes('wordprocessingml') || buffer.toString('hex', 0, 4) === '504b0304';

    // =========================================================================
    // 🔀 LIDANDO COM REDIRECIONAMENTOS JAVASCRIPT / META HTML (SILENCIOSO)
    // =========================================================================
    if (contentType.includes('text/html') && !isPDF && !isDOCX) {
      const htmlText = buffer.toString('utf-8');
      const $ = cheerio.load(htmlText);

      let novaUrl = '';
      
      // Checa Meta Refresh (redirecionamento HTML)
      const refreshMeta = $('meta[http-equiv="refresh" i]').attr('content');
      if (refreshMeta) {
        const match = refreshMeta.match(/url=['"]?([^'"]+)['"]?/i);
        if (match) novaUrl = match[1];
      }

      // Checa JS Redirect
      if (!novaUrl) {
        const jsRedirect = htmlText.match(/window\.location(?:\.href)?\s*=\s*['"]([^'"]+)['"]/i);
        if (jsRedirect && jsRedirect[1]) novaUrl = jsRedirect[1];
      }

      if (novaUrl) {
        const urlAbsoluta = novaUrl.startsWith('http') ? novaUrl : new URL(novaUrl, url).href;
        return extrairTextoBruto(urlAbsoluta, depth + 1, tentativas);
      }

      $('script, style, nav, header, footer, aside').remove();
      const textoLimpo = $('body').text().replace(/\s+/g, ' ').trim();
      console.log(`[DEBUG docParser] htmlText.length = ${htmlText.length}`);
      console.log(`[DEBUG docParser] textoLimpo.length = ${textoLimpo.length}`);
      if (textoLimpo.length > 50) {
        return textoLimpo;
      }

      urlsParaBlacklist.add(url);
      return null;
    }

    if (isPDF) {
      const logOriginal = console.log;
      const warnOriginal = console.warn;
      const errorOriginal = console.error;
      console.log = () => { }; console.warn = () => { }; console.error = () => { };

      try {
        const render_page = function(pageData: any) {
          const render_options = {
              normalizeWhitespace: false,
              disableCombineTextItems: false
          };
          return pageData.getTextContent(render_options).then(function(textContent: any) {
              let text = '';
              for (let item of textContent.items) {
                  text += item.str + ' ';
              }
              return `\n[---PAGINA_${pageData.pageIndex}---]\n` + text;
          });
        };

        // @ts-ignore
        const dadosPdf = await pdfParse(buffer, { pagerender: render_page }); 
        
        const paginas = dadosPdf.text.split(/\[---PAGINA_\d+---\]/).filter((p: string) => p.trim().length > 0);
        
        if (paginas.length <= 5) {
          return paginas.join('\n');
        } else {
          const inicio = paginas.slice(0, 3).join('\n');
          const fim = paginas.slice(-2).join('\n');
          return inicio + '\n\n...[PÁGINAS INTERMEDIÁRIAS OMITIDAS]...\n\n' + fim;
        }
      } catch (err: any) {
        urlsParaBlacklist.add(url);
        return null;
      } finally {
        console.log = logOriginal; console.warn = warnOriginal; console.error = errorOriginal;
      }
    } else if (isDOCX) {
      const result = await mammoth.extractRawText({ buffer });
      const textoStr = result.value;
      if (textoStr.length > 15000) {
        return textoStr.substring(0, 8000) + '\n\n...[TEXTO INTERMEDIÁRIO OMITIDO]...\n\n' + textoStr.substring(textoStr.length - 5000);
      }
      return textoStr;
    }

    urlsParaBlacklist.add(url);
    return null;

  } catch (err) {
    if (tentativas > 0) {
      await new Promise(r => setTimeout(r, 3000));
      return extrairTextoBruto(url, depth, tentativas - 1);
    }
    return null;
  }
}

// ==============================================================
// 📅 EXTRATOR DE DATA (Usa a função acima)
// ==============================================================
export async function extrairDataDoArquivo(url: string): Promise<{ formatada: string, timestamp: number } | null> {
  const textoExtraido = await extrairTextoBruto(url);

  if (!textoExtraido) return null;

  const regexExtenso = /\b(\d{1,2})\s+de\s+([a-zA-ZçÇ]+)\s+de\s+(\d{4})\b/gi;
  const regexNumerica = /\b(\d{2})[\/\.](\d{2})[\/\.](\d{4})\b/gi;

  let melhorData = '';
  let maiorScore = -Infinity;
  let menorIndex = Infinity;
  let timestampEscolhido = 0;

  const dataLimite = new Date().getTime() + 86400000; // Hoje + 1 dia de margem de segurança

  const processarData = (match: RegExpExecArray, dia: string, mesNumero: string, ano: string) => {
    const timestampAtual = new Date(`${ano}-${mesNumero}-${dia}T00:00:00`).getTime();
    if (timestampAtual <= dataLimite) {
      const startIndex = Math.max(0, match.index - 40);
      const contextoAntes = textoExtraido.substring(startIndex, match.index);
      const contextoDepois = textoExtraido.substring(match.index + match[0].length, match.index + match[0].length + 40);
      
      let score = 0;
      
      // 1. Penalidade forte para prazos e cronogramas (contexto anterior)
      if (/(?:dia|até|para|a partir de|período|prazo|entre|realizad[oa]s?\s+em|aplicad[oa]s?\s+em|designad[oa]s?\s+para)\s*$/i.test(contextoAntes)) {
        score -= 50;
      }
      
      // 1.2 Penalidade forte para citações de documentos passados (ex: "conforme Edital de 06 de junho")
      if (/(?:conforme|termos|referente|datado|lei|decreto|edital|processo|documento|portaria|resolução).*(?:de|em)\s*$/i.test(contextoAntes)) {
        score -= 50;
      }

      // 1.3 Penalidade forte para cronogramas (contexto posterior indicando horas, ex: "às 14:00" ou "14:00 horas")
      if (/^\s*(?:às|as|à|a|-)?\s*\d{1,2}[:h]/i.test(contextoDepois) || /^\s*(?:às|as|à|a)\s+/i.test(contextoDepois)) {
        score -= 50;
      }
      
      // 2. Bônus para assinaturas e locais
      if (/(?:Aos|Gabinete|Dado(?: e passado)?|Paço Municipal)[,\.\s]*$/i.test(contextoAntes) ||
          /(?:-|\/)\s*[A-Z]{2}[,\.\s]*$/.test(contextoAntes)) {
        score += 50;
      }
      
      // 3. Bônus para cabeçalhos ou assinatura "Em" (no início da linha)
      const linhaInicio = textoExtraido.lastIndexOf('\n', match.index);
      const textoNaLinhaAntes = textoExtraido.substring(linhaInicio === -1 ? 0 : linhaInicio + 1, match.index);
      if (/^\s*Em\s*$/i.test(textoNaLinhaAntes)) {
        score += 50;
      } else if (/^\s*$/.test(textoNaLinhaAntes)) {
        score += 40;
      }
      
      if (score > maiorScore || (score === maiorScore && match.index < menorIndex)) {
        maiorScore = score;
        menorIndex = match.index;
        melhorData = `${dia.padStart(2, '0')}/${mesNumero.padStart(2, '0')}/${ano}`;
        timestampEscolhido = timestampAtual;
      }
    }
  };

  let match;
  while ((match = regexExtenso.exec(textoExtraido)) !== null) {
    const mesNumero = MESES[match[2].toLowerCase()];
    if (mesNumero) processarData(match, match[1], mesNumero, match[3]);
  }

  while ((match = regexNumerica.exec(textoExtraido)) !== null) {
    processarData(match, match[1], match[2], match[3]);
  }

  if (maiorScore !== -Infinity) {
    return { formatada: melhorData, timestamp: timestampEscolhido };
  }

  urlsParaBlacklist.add(url);
  return null;
}