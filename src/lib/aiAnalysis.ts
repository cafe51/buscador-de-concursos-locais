import { GoogleGenerativeAI, Part } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import { Edital } from '../types';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { obterBufferDoDocumento } from './docParser';
import { PDFDocument } from 'pdf-lib';
import * as crypto from 'crypto';

export const MODEL_NAME = 'gemini-3.1-flash-lite';

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

function calcularCusto(modelo: string, promptTokens: number, outputTokens: number): number {
  let custoInput = 0;
  let custoOutput = 0;

  const inM = promptTokens / 1_000_000;
  const outM = outputTokens / 1_000_000;

  switch (modelo) {
    case 'gemini-3.5-flash':
      custoInput = inM * 1.50;
      custoOutput = outM * 9.00;
      break;
    case 'gemini-3.1-pro-preview':
      if (promptTokens <= 200_000) {
        custoInput = inM * 2.00;
        custoOutput = outM * 12.00;
      } else {
        custoInput = inM * 4.00;
        custoOutput = outM * 18.00;
      }
      break;
    case 'gemini-3.1-flash-lite':
      custoInput = inM * 0.25;
      custoOutput = outM * 1.50;
      break;
    case 'gemini-2.5-pro':
      if (promptTokens <= 200_000) {
        custoInput = inM * 1.25;
        custoOutput = outM * 10.00;
      } else {
        custoInput = inM * 2.50;
        custoOutput = outM * 15.00;
      }
      break;
    case 'gemini-2.5-flash':
      custoInput = inM * 0.30;
      custoOutput = outM * 2.50;
      break;
    case 'gemini-2.5-flash-lite':
      custoInput = inM * 0.10;
      custoOutput = outM * 0.40;
      break;
    default:
      // Fallback
      custoInput = inM * 0.00;
      custoOutput = outM * 0.00;
      break;
  }
  return custoInput + custoOutput;
}

async function obterCotacaoDolar(): Promise<number> {
  try {
    const res = await fetch('https://economia.awesomeapi.com.br/last/USD-BRL');
    if (!res.ok) return 5.50; // Fallback caso falhe
    const data = await res.json();
    return parseFloat(data.USDBRL.bid);
  } catch (e) {
    return 5.50; // Fallback caso ocorra erro de rede
  }
}

function extrairJSONSeguro(texto: string): any {
  try {
    let limpo = texto.replace(/```json/g, '').replace(/```/g, '').trim();
    const inicio = limpo.indexOf('{');
    const fim = limpo.lastIndexOf('}');
    if (inicio !== -1 && fim !== -1) {
      limpo = limpo.substring(inicio, fim + 1);
    }
    return JSON.parse(limpo);
  } catch (e) {
    throw new Error("Falha ao processar o JSON gerado pela IA.");
  }
}

async function baixarDocumentoBruto(url: string): Promise<{ bytes: string; mimeType: string } | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    const contentType = (res.headers.get('content-type') || '').toLowerCase();

    // Convert arrayBuffer to base64 for Gemini API
    const base64Data = Buffer.from(arrayBuffer).toString("base64");

    let mimeType = 'application/pdf'; // Default fallback
    if (contentType.includes('pdf')) mimeType = 'application/pdf';
    else if (contentType.includes('wordprocessingml')) mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    return { bytes: base64Data, mimeType };
  } catch (e) {
    return null;
  }
}

async function analisarEditalComIA(edital: Edital): Promise<{ titulo: string; descricao: string; concurso?: string; dataPublicacao?: string; custoReq?: number } | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genAI = new GoogleGenerativeAI(apiKey);
  const fileManager = new GoogleAIFileManager(apiKey);

  const systemInstruction = `Você é um especialista em concursos públicos e processos seletivos no Brasil.
INSTRUÇÕES RÍGIDAS DE FORMATAÇÃO:
1. TÍTULO: Gere um título conciso (máximo 10 palavras) focado APENAS na ação principal e referência do documento. 
   REGRA CRÍTICA: NUNCA repita o nome da cidade ou o órgão.
   Exemplos bons: "Abertura de Processo Seletivo 01/2026", "Convocação para Provas Práticas".
   
2. DESCRIÇÃO: 2 a 3 frases curtas informativas para o candidato:
   - Motivo central (ex: vagas temporárias, homologação, convocações)
   - Escolaridade e cargos principais (se aplicável)
   - Datas principais (se aplicável)
   
3. CONCURSO (Chave de Agrupamento): Extraia a referência do concurso e PADRONIZE RIGOROSAMENTE para o formato:
   - PARTE 1: EXATAMENTE "Processo Seletivo" ou "Concurso Público".
   - PARTE 2: Número no formato nn/aaaa. CONVERTA QUALQUER NÚMERO PARA EXATAMENTE 2 DÍGITOS ANTES DA BARRA (Ex: 001/2020 deve virar 01/2020. 1/2020 deve virar 01/2020). O ano deve ter 4 dígitos.
   - PARTE 3 (Opcional): Se for para estagiários, adicione "(Estagiários)" no final.
   Exemplo Perfeito: "Processo Seletivo 01/2026" ou "Processo Seletivo 01/2026 (Estagiários)".
   Se não conseguir identificar a que concurso o edital pertence, deixe como string vazia "".

4. DATA: Extraia a data exata de publicação oficial ou assinatura do edital (se houver) no formato DD/MM/AAAA.
   ATENÇÃO: Em caso de conflito entre múltiplas datas encontradas, analise com cuidado para descobrir qual data se refere à publicação do documento, dê preferência para datas associadas à assinatura que costuma vir em uma sequencia que segue o formato [nome da cidade] ao lado de [data de publicação do documento] e embaixo [nome da pessoa e/ou instituição/cargo].

Responda EXCLUSIVAMENTE em JSON válido, sem markdown:
{
  "titulo": "...",
  "descricao": "...",
  "concurso": "...",
  "dataPublicacao": "..."
}`;

  const model = genAI.getGenerativeModel({
    model: MODEL_NAME,
    systemInstruction
  });

  let partesReq: any[] = [{ text: "Extraia os dados deste documento seguindo rigorosamente as instruções do sistema." }];
  let arquivoTemporarioPath: string | null = null;
  let geminiFileName: string | null = null;

  try {
    const docRaw = await obterBufferDoDocumento(edital.link);

    if (!docRaw) {
      throw new Error("Não foi possível acessar o documento no link fornecido.");
    }

    if (docRaw.isPDF && docRaw.buffer) {
      const pdfDoc = await PDFDocument.load(docRaw.buffer, { ignoreEncryption: true });
      const pageCount = pdfDoc.getPageCount();
      let bufferParaUpload: Uint8Array = docRaw.buffer;

      if (pageCount > 10) {
        const novoPdf = await PDFDocument.create();
        const indicesToCopy = [0, 1, 2, 3, 4, pageCount - 5, pageCount - 4, pageCount - 3, pageCount - 2, pageCount - 1];
        const paginasExtraidas = await novoPdf.copyPages(pdfDoc, indicesToCopy);
        paginasExtraidas.forEach(page => novoPdf.addPage(page));
        bufferParaUpload = await novoPdf.save();
      }

      const tempFilename = crypto.randomUUID() + '.pdf';
      arquivoTemporarioPath = path.join(os.tmpdir(), tempFilename);
      fs.writeFileSync(arquivoTemporarioPath, bufferParaUpload);

      const uploadResult = await fileManager.uploadFile(arquivoTemporarioPath, {
        mimeType: "application/pdf",
        displayName: `Edital-${edital.cidade}`
      });

      geminiFileName = uploadResult.file.name;

      partesReq.push({
        fileData: {
          mimeType: "application/pdf",
          fileUri: uploadResult.file.uri
        }
      });

    } else if (docRaw.textoLimpo) {
      partesReq.push({ text: `\nTEXTO DO HTML:\n${docRaw.textoLimpo.substring(0, 200000)}` });
    } else if (docRaw.isDOCX && docRaw.buffer) {
      partesReq.push({
        inlineData: {
          data: docRaw.buffer.toString('base64'),
          mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        }
      });
    } else {
      throw new Error("Formato não suportado ou documento vazio.");
    }

    const contentsPayload = [
      {
        role: "user",
        parts: [{ text: "Extraia os dados deste documento seguindo rigorosamente as instruções do sistema.\n\n[O documento de exemplo foi omitido aqui para focar no formato de saída]" }]
      },
      {
        role: "model",
        parts: [{ text: `{\n  "titulo": "Abertura de Concurso Público 01/2024",\n  "descricao": "Abertura de concurso para contratação de Professores na rede municipal.",\n  "concurso": "Concurso Público 01/2024",\n  "dataPublicacao": ""\n}` }]
      },
      {
        role: "user",
        parts: partesReq
      }
    ];

    const result = await model.generateContent({ contents: contentsPayload });

    let custoReq = 0;
    if (result.response.usageMetadata) {
      const promptTokens = result.response.usageMetadata.promptTokenCount || 0;
      const outputTokens = result.response.usageMetadata.candidatesTokenCount || 0;
      custoReq = calcularCusto(MODEL_NAME, promptTokens, outputTokens);
    }

    const responseText = result.response.text();
    const dados = extrairJSONSeguro(responseText);

    if (dados.titulo && dados.descricao) {
      return {
        titulo: dados.titulo,
        descricao: dados.descricao,
        concurso: dados.concurso,
        dataPublicacao: dados.dataPublicacao,
        custoReq
      };
    }
    return null;
  } catch (error) {
    throw error;
  } finally {
    if (arquivoTemporarioPath && fs.existsSync(arquivoTemporarioPath)) {
      try {
        fs.unlinkSync(arquivoTemporarioPath);
      } catch (e) {
        console.error("Falha ao deletar arquivo local temporário", e);
      }
    }
    if (geminiFileName) {
      try {
        await fileManager.deleteFile(geminiFileName);
      } catch (e) {
        console.error("Falha ao deletar arquivo do Gemini API", e);
      }
    }
  }
}

export async function processarComIA(editaisNovos: Edital[]): Promise<void> {
  if (!process.env.GEMINI_API_KEY) {
    console.log("🧠 [IA] GEMINI_API_KEY não configurada. Passo 0 ignorado.");
    return;
  }

  console.log("🧠 ══════════════════════════════════════════════════════");
  console.log("🧠  PASSO 0: ANÁLISE POR INTELIGÊNCIA ARTIFICIAL (GEMINI)");
  console.log("🧠 ══════════════════════════════════════════════════════");
  console.log(`🧠 [IA] ${editaisNovos.length} novos editais identificados para análise.`);

  let cotacaoDolar = 5.50;
  try {
    cotacaoDolar = await obterCotacaoDolar();
    console.log(`🧠 [IA] 💵 Cotação do Dólar hoje: R$ ${cotacaoDolar.toFixed(2)}`);
  } catch (e) { }

  let sucessos = 0;
  let falhas = 0;
  let custoGeralUSD = 0;

  try {
    for (let i = 0; i < editaisNovos.length; i++) {
      const edital = editaisNovos[i];
      console.log(`🧠 [IA] [${i + 1}/${editaisNovos.length}] Analisando: "${edital.titulo}" (${edital.cidade} - ${edital.orgao})...`);

      try {
        const resultado = await analisarEditalComIA(edital);
        if (resultado) {
          if (resultado.custoReq) custoGeralUSD += resultado.custoReq;
          edital.dadosEnriquecidos = {
            titulo: resultado.titulo,
            descricao: resultado.descricao,
            concurso: resultado.concurso,
            dataPublicacao: resultado.dataPublicacao
          };
          const custoBRL = (resultado.custoReq || 0) * cotacaoDolar;
          console.log(`🧠 [IA] [${i + 1}/${editaisNovos.length}] ✅ [💰 R$ ${custoBRL.toFixed(4)}] Título: "${resultado.titulo}"\n   ↳ Descrição: "${resultado.descricao}"`);
          sucessos++;
        } else {
          console.log(`🧠 [IA] [${i + 1}/${editaisNovos.length}] ❌ Falha ao extrair dados. O resultado estava vazio.`);
          falhas++;
        }
      } catch (err: any) {
        if (err.message && err.message.includes('429')) {
          console.log(`🧠 [IA] [${i + 1}/${editaisNovos.length}] ⏳ Rate limit atingido. Aguardando 60s...`);
          await delay(60000);
          // Retry
          try {
            const resultado = await analisarEditalComIA(edital);
            if (resultado) {
              if (resultado.custoReq) custoGeralUSD += resultado.custoReq;
              edital.dadosEnriquecidos = {
                titulo: resultado.titulo,
                descricao: resultado.descricao,
                concurso: resultado.concurso,
                dataPublicacao: resultado.dataPublicacao
              };
              const custoBRL = (resultado.custoReq || 0) * cotacaoDolar;
              console.log(`🧠 [IA] [${i + 1}/${editaisNovos.length}] ✅ [💰 R$ ${custoBRL.toFixed(4)}] Título: "${resultado.titulo}" (Após retry)\n   ↳ Descrição: "${resultado.descricao}"`);
              sucessos++;
            }
          } catch (e) {
            console.log(`🧠 [IA] [${i + 1}/${editaisNovos.length}] ❌ Falha no retry: ${e}. Continuando sem IA para este edital.`);
            falhas++;
          }
        } else {
          console.log(`🧠 [IA] [${i + 1}/${editaisNovos.length}] ❌ Falha: ${err.message || err}. Continuando sem IA para este edital.`);
          falhas++;
        }
      }

      // Rate limit base (espera 4 segundos para evitar limite de ~15 RPM)
      if (i < editaisNovos.length - 1) {
        await delay(4000);
      }
    }
  } catch (fatalError) {
    console.log(`🚨 [IA] Erro fatal no Passo 0: ${fatalError}. Passo ignorado silenciosamente.`);
  }

  const custoTotalBRL = custoGeralUSD * cotacaoDolar;
  console.log("🧠 ──────────────────────────────────────────────────────");
  console.log(`🧠 [IA] RESUMO: ✅ ${sucessos}/${editaisNovos.length} enriquecidos | ❌ ${falhas} falhas | 💰 Custo Total Estimado: R$ ${custoTotalBRL.toFixed(4)}`);
  console.log("🧠 ══════════════════════════════════════════════════════");
}
