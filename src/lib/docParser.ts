// @ts-ignore
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import * as mammoth from 'mammoth';
import { PDFs_IGNORADOS } from './blacklist'; // <--- IMPORTAÇÃO DA NOSSA LISTA LIMPA

const consoleWarnOriginal = console.warn;
console.warn = function (...args) {
  if (typeof args[0] === 'string' && args[0].includes('Warning: TT: undefined function')) {
    return;
  }
  consoleWarnOriginal.apply(console, args);
};

export const urlsParaBlacklist = new Set<string>();

const MESES: Record<string, string> = {
  janeiro: '01', fevereiro: '02', março: '03', marco: '03',
  abril: '04', maio: '05', junho: '06', julho: '07',
  agosto: '08', setembro: '09', outubro: '10', novembro: '11', dezembro: '12'
};

export async function extrairDataDoArquivo(url: string): Promise<{ formatada: string, timestamp: number } | null> {
  // 1. REGRA DA LISTA NEGRA: Puxada do nosso arquivo isolado
  if (PDFs_IGNORADOS.includes(url)) {
    return null;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    // Se o site recusou conexão/timeout, não bota na blacklist, tenta de novo amanhã.
    if (!res.ok) {
      return null;
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = res.headers.get('content-type') || '';
    const isPDF = contentType.includes('pdf') || buffer.toString('hex', 0, 4) === '25504446';
    const isDOCX = contentType.includes('wordprocessingml') || buffer.toString('hex', 0, 4) === '504b0304';

    let textoExtraido = '';

    if (isPDF) {
      const logOriginal = console.log;
      const warnOriginal = console.warn;
      const errorOriginal = console.error;
      console.log = () => { };
      console.warn = () => { };
      console.error = () => { };

      try {
        // @ts-ignore
        const dadosPdf = await pdfParse(buffer, { max: 1 });
        textoExtraido = dadosPdf.text;
      } finally {
        console.log = logOriginal;
        console.warn = warnOriginal;
        console.error = errorOriginal;
      }
    }
    else if (isDOCX) {
      const result = await mammoth.extractRawText({ buffer });
      textoExtraido = result.value;
    } else {
      // É uma imagem solta, joga pra blacklist gerada no final da execução
      urlsParaBlacklist.add(url);
      return null;
    }

    const regex = /\b(\d{1,2})\s+de\s+([a-zA-ZçÇ]+)\s+de\s+(\d{4})\b/gi;
    let match;
    let maiorTimestamp = 0;
    let dataMaisRecente = '';

    while ((match = regex.exec(textoExtraido)) !== null) {
      const dia = match[1].padStart(2, '0');
      const mesTexto = match[2].toLowerCase();
      const ano = match[3];

      const mesNumero = MESES[mesTexto];
      if (mesNumero) {
        const timestampAtual = new Date(`${ano}-${mesNumero}-${dia}T00:00:00`).getTime();
        if (timestampAtual > maiorTimestamp) {
          maiorTimestamp = timestampAtual;
          dataMaisRecente = `${dia}/${mesNumero}/${ano}`;
        }
      }
    }

    if (maiorTimestamp > 0) {
      return { formatada: dataMaisRecente, timestamp: maiorTimestamp };
    }

    // Não tinha NENHUMA data escrita no documento
    urlsParaBlacklist.add(url);
    return null;

  } catch (error) {
    // Falha de rede genérica, ignora.
    return null;
  }
}