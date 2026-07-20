import { execFileSync } from 'child_process';

// 🛡️ Polyfills globais para pdfjs-dist em ambientes Serverless Node.js (Vercel)
if (typeof globalThis !== 'undefined') {
  if (typeof (globalThis as any).DOMMatrix === 'undefined') {
    (globalThis as any).DOMMatrix = class DOMMatrix {
      a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
      constructor(init?: any) {
        if (Array.isArray(init) && init.length >= 6) {
          this.a = init[0]; this.b = init[1]; this.c = init[2];
          this.d = init[3]; this.e = init[4]; this.f = init[5];
        }
      }
      multiply() { return this; }
      translate() { return this; }
      scale() { return this; }
      rotate() { return this; }
      inverse() { return this; }
      transformPoint(p: any) { return p; }
    };
  }

  if (typeof (globalThis as any).Path2D === 'undefined') {
    (globalThis as any).Path2D = class Path2D {
      addPath() {}
      closePath() {}
      moveTo() {}
      lineTo() {}
      arc() {}
      rect() {}
    };
  }
}

export interface PdfExtractOptions {
  fPagina?: number; // Primeira página (1-indexed)
  lPagina?: number; // Última página (1-indexed)
  layout?: boolean; // Se true, tenta preservar o layout organizando itens por posição (Y, X)
}

interface TextItemWithPos {
  str: string;
  x: number;
  y: number;
  height: number;
  width: number;
  hasEOL?: boolean;
}

let pdfjsLibModule: any = null;

async function obterPdfJsLib() {
  if (!pdfjsLibModule) {
    pdfjsLibModule = await import('pdfjs-dist/legacy/build/pdf.mjs');
    // @ts-ignore
    await import('pdfjs-dist/legacy/build/pdf.worker.mjs');
  }
  return pdfjsLibModule;
}

/**
 * Tenta extrair texto do PDF via utilitário de sistema `pdftotext` (Poppler engine).
 * Excelente para reconstrução instantânea de mapas de caracteres CMap/CID corrompidos.
 */
function extrairTextoViaPdftotext(buffer: Buffer, options: PdfExtractOptions = {}): string | null {
  try {
    const args: string[] = [];
    if (options.fPagina) args.push('-f', options.fPagina.toString());
    if (options.lPagina) args.push('-l', options.lPagina.toString());
    if (options.layout !== false) args.push('-layout');
    args.push('-', '-');

    const stdout = execFileSync('pdftotext', args, {
      input: buffer,
      maxBuffer: 10 * 1024 * 1024,
      timeout: 15000,
      stdio: ['pipe', 'pipe', 'ignore']
    });

    const texto = stdout.toString('utf-8');
    if (texto && texto.trim().length > 0) {
      return texto;
    }
  } catch (err) {
    // pdftotext não instalado ou falhou - fallback para pdfjs-dist
  }
  return null;
}

/**
 * Extrai texto de um PDF usando pdftotext (Poppler) com fallback para Mozilla pdfjs-dist.
 */
export async function extrairTextoDePdf(
  buffer: Buffer,
  options: PdfExtractOptions = {}
): Promise<string> {
  const textoPdftotext = extrairTextoViaPdftotext(buffer, options);
  if (textoPdftotext !== null) {
    return textoPdftotext;
  }

  const pdfjsLib = await obterPdfJsLib();
  const data = new Uint8Array(buffer);
  const loadingTask = pdfjsLib.getDocument({
    data,
    useSystemFonts: true,
    disableFontFace: true,
  } as any);

  const pdfDoc = await loadingTask.promise;
  const numPages = pdfDoc.numPages;

  const startPage = Math.max(1, options.fPagina || 1);
  const endPage = Math.min(numPages, options.lPagina || numPages);

  const pageTexts: string[] = [];

  for (let pageNum = startPage; pageNum <= endPage; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const textContent = await page.getTextContent();

    if (!options.layout) {
      // Extração simples sem ordenação espacial
      let pageStr = '';
      for (const item of textContent.items) {
        if ('str' in item) {
          pageStr += item.str + (item.hasEOL ? '\n' : ' ');
        }
      }
      pageTexts.push(pageStr);
      continue;
    }

    // Extração respeitando layout espacial (Y descendente, X ascendente)
    const items: TextItemWithPos[] = [];
    for (const item of textContent.items) {
      if ('str' in item && item.str.trim().length > 0) {
        const transform = item.transform; // [scaleX, skewY, skewX, scaleY, x, y]
        items.push({
          str: item.str,
          x: transform[4],
          y: transform[5],
          height: item.height || Math.abs(transform[3]) || 10,
          width: item.width || Math.abs(transform[0]) || 10,
          hasEOL: item.hasEOL
        });
      }
    }

    if (items.length === 0) {
      pageTexts.push('');
      continue;
    }

    // Agrupa itens em linhas por coordenada Y próxima (tolerância de ~4pt)
    const lines: TextItemWithPos[][] = [];
    const sortedItems = [...items].sort((a, b) => b.y - a.y || a.x - b.x);

    for (const item of sortedItems) {
      let inserted = false;
      for (const line of lines) {
        // Se a diferença vertical entre o item e a linha for menor que 4pt, pertence à mesma linha
        if (Math.abs(line[0].y - item.y) <= 4) {
          line.push(item);
          inserted = true;
          break;
        }
      }
      if (!inserted) {
        lines.push([item]);
      }
    }

    // Ordena cada linha da esquerda para a direita (X crescente) e monta o texto
    const pageLines: string[] = [];
    for (const line of lines) {
      line.sort((a, b) => a.x - b.x);
      let lineText = '';
      let prevXRight = 0;

      for (let i = 0; i < line.length; i++) {
        const item = line[i];
        if (i > 0 && item.x - prevXRight > 4) {
          lineText += ' ';
        }
        lineText += item.str;
        prevXRight = item.x + item.width;
      }

      pageLines.push(lineText);
    }

    pageTexts.push(pageLines.join('\n'));
  }

  return pageTexts.join('\n\n');
}
