// @ts-ignore
import pdfParse from 'pdf-parse/lib/pdf-parse.js'; // O segredo está em importar direto o arquivo .js limpo!
import * as mammoth from 'mammoth';

// Dicionário para converter o mês em texto para número (com e sem acento/cedilha)
const MESES: Record<string, string> = {
  janeiro: '01', fevereiro: '02', março: '03', marco: '03',
  abril: '04', maio: '05', junho: '06', julho: '07',
  agosto: '08', setembro: '09', outubro: '10', novembro: '11', dezembro: '12'
};

export async function extrairDataDoArquivo(url: string): Promise<{ formatada: string, timestamp: number } | null> {
  try {
    // Busca o arquivo (com timeout de 10s para evitar travar o programa se o arquivo for enorme)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) return null;

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // As URLs de Pedranópolis (DownloadServlet) às vezes não terminam em .pdf, 
    // então é mais seguro olhar os primeiros bytes do arquivo ou o cabeçalho.
    const contentType = res.headers.get('content-type') || '';
    const isPDF = contentType.includes('pdf') || buffer.toString('hex', 0, 4) === '25504446'; // 25504446 é a assinatura hexadecimal de um PDF
    const isDOCX = contentType.includes('wordprocessingml') || buffer.toString('hex', 0, 4) === '504b0304'; // PK.. (Zip/Docx)

    let textoExtraido = '';

    // 1. SE FOR PDF
    if (isPDF) {
      // @ts-ignore
      const dadosPdf = await pdfParse(buffer, { max: 1 }); // max: 1 lê apenas a primeira página!
      textoExtraido = dadosPdf.text;
    }
    // 2. SE FOR DOCX
    else if (isDOCX) {
      const result = await mammoth.extractRawText({ buffer });
      textoExtraido = result.value;
    } else {
      // É uma imagem solta, ZIP ou outro formato não legível
      return null;
    }

    // 3. REGEX: Procura o padrão "8 de novembro de 2021" ou "08 de Novembro de 2021"
    const regex = /\b(\d{1,2})\s+de\s+([a-zA-ZçÇ]+)\s+de\s+(\d{4})\b/gi;
    let match;
    let maiorTimestamp = 0;
    let dataMaisRecente = '';

    // Roda o regex em todo o texto para encontrar todas as datas da primeira página
    while ((match = regex.exec(textoExtraido)) !== null) {
      const dia = match[1].padStart(2, '0');
      const mesTexto = match[2].toLowerCase();
      const ano = match[3];

      const mesNumero = MESES[mesTexto];
      if (mesNumero) {
        // Meia noite, como você solicitou
        const timestampAtual = new Date(`${ano}-${mesNumero}-${dia}T00:00:00`).getTime();

        // Se achar mais de uma data na página, fica com a mais nova
        if (timestampAtual > maiorTimestamp) {
          maiorTimestamp = timestampAtual;
          dataMaisRecente = `${dia}/${mesNumero}/${ano}`;
        }
      }
    }

    if (maiorTimestamp > 0) {
      return { formatada: dataMaisRecente, timestamp: maiorTimestamp };
    }

    return null; // Leu a página mas não achou o padrão de data
  } catch (error) {
    // console.error(`Erro ao ler arquivo: ${url}`, error);
    return null;
  }
}