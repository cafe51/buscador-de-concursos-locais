// src/lib/docParser.ts
// @ts-ignore
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import * as mammoth from 'mammoth';
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
export async function extrairTextoBruto(url: string, depth = 0): Promise<string | null> {
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

    if (!res.ok) return null;

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

      const jsRedirect = htmlText.match(/window\.location(?:\.href)?\s*=\s*['"]([^'"]+)['"]/i);
      const metaRedirect = htmlText.match(/url=['"]?([^'">]+)['"]?/i);

      let novaUrl = '';
      if (jsRedirect && jsRedirect[1]) novaUrl = jsRedirect[1];
      else if (metaRedirect && metaRedirect[1]) novaUrl = metaRedirect[1];

      if (novaUrl) {
        const urlAbsoluta = novaUrl.startsWith('http') ? novaUrl : new URL(novaUrl, url).href;
        return extrairTextoBruto(urlAbsoluta, depth + 1);
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
        // @ts-ignore
        const dadosPdf = await pdfParse(buffer, { max: 3 }); // Lê até 3 páginas para garantir
        return dadosPdf.text;
      } catch (err: any) {
        urlsParaBlacklist.add(url);
        return null;
      } finally {
        console.log = logOriginal; console.warn = warnOriginal; console.error = errorOriginal;
      }
    } else if (isDOCX) {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    }

    urlsParaBlacklist.add(url);
    return null;

  } catch (error: any) {
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

  let match;
  let maiorTimestamp = 0;
  let dataMaisRecente = '';

  const dataLimite = new Date().getTime() + 86400000; // Hoje + 1 dia de margem de segurança

  while ((match = regexExtenso.exec(textoExtraido)) !== null) {
    const dia = match[1].padStart(2, '0');
    const mesTexto = match[2].toLowerCase();
    const ano = match[3];

    const mesNumero = MESES[mesTexto];
    if (mesNumero) {
      const timestampAtual = new Date(`${ano}-${mesNumero}-${dia}T00:00:00`).getTime();
      if (timestampAtual > maiorTimestamp && timestampAtual <= dataLimite) {
        maiorTimestamp = timestampAtual;
        dataMaisRecente = `${dia}/${mesNumero}/${ano}`;
      }
    }
  }

  while ((match = regexNumerica.exec(textoExtraido)) !== null) {
    const dia = match[1].padStart(2, '0');
    const mesNumero = match[2].padStart(2, '0');
    const ano = match[3];

    const timestampAtual = new Date(`${ano}-${mesNumero}-${dia}T00:00:00`).getTime();
    if (timestampAtual > maiorTimestamp && timestampAtual <= dataLimite) {
      maiorTimestamp = timestampAtual;
      dataMaisRecente = `${dia}/${mesNumero}/${ano}`;
    }
  }

  if (maiorTimestamp > 0) {
    return { formatada: dataMaisRecente, timestamp: maiorTimestamp };
  }

  urlsParaBlacklist.add(url);
  return null;
}