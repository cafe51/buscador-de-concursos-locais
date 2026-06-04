import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import { Edital } from '../types';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { obterBufferDoDocumento } from './docParser';
import { PDFDocument } from 'pdf-lib';
import * as crypto from 'crypto';
import { delay, calcularCusto, extrairJSONSeguro, obterCotacaoDolar } from './aiAnalysis';

export const AUDITOR_MODEL_NAME = 'gemini-3.5-flash';

type AuditoriaResultado = {
  veredicto: "CORRETO" | "INCORRETO";
  tipoVazio?: "JUSTIFICADO" | "INJUSTIFICADO" | "NAO_SE_APLICA";
  justificativa: string;
  dadosCorrigidos?: { concurso?: string; dataPublicacao?: string };
  custoReq?: number;
};

export type EditalAuditavel = {
  edital: Edital;
  mudancasTexto: string;
};

async function auditarEditalComIA(item: EditalAuditavel): Promise<AuditoriaResultado | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genAI = new GoogleGenerativeAI(apiKey);
  const fileManager = new GoogleAIFileManager(apiKey);

  const systemInstruction = `Você é um Auditor IA Especialista.
Seu papel é verificar o trabalho de uma IA júnior que extraiu dados de um documento de concurso público.

Você receberá o documento PDF (ou texto) original, e um log com as alterações que a IA júnior fez.
Sua tarefa é analisar SE a decisão da IA júnior foi CORRETA ou INCORRETA baseando-se EXCLUSIVAMENTE nas informações do documento original.

REGRAS RÍGIDAS DE AUDITORIA:
1. Se a IA júnior extraiu um dado ("concurso" ou "dataPublicacao") corretamente, o veredicto é "CORRETO".
2. Se a IA júnior preencheu com string vazia ("") E a informação realmente não existe no documento, o veredicto é "CORRETO", e tipoVazio é "JUSTIFICADO".
3. Se a IA júnior cometeu um erro (extraiu errado ou deixou vazio quando a informação existia), o veredicto é "INCORRETO". Você deve fornecer a correção exata no campo "dadosCorrigidos".
4. "justificativa" deve ser direta ao ponto e ter NO MÁXIMO 300 caracteres.

Lembrete de padronização da IA júnior para concursos:
- PARTE 1: EXATAMENTE "Processo Seletivo" ou "Concurso Público".
- PARTE 2: nn/aaaa (sempre com 2 dígitos antes da barra e 4 depois). Ex: 01/2026.
- A data de publicação deve ser no formato DD/MM/AAAA.

Responda EXCLUSIVAMENTE em JSON válido, sem markdown:
{
  "veredicto": "CORRETO" ou "INCORRETO",
  "tipoVazio": "JUSTIFICADO" ou "INJUSTIFICADO" ou "NAO_SE_APLICA",
  "justificativa": "Sua justificativa (máx 300 caracteres)",
  "dadosCorrigidos": {
    "concurso": "nova string (ou vazia)",
    "dataPublicacao": "nova string (ou vazia)"
  } // Preencher apenas se INCORRETO. Se correto, pode omitir ou enviar null.
}`;

  const model = genAI.getGenerativeModel({
    model: AUDITOR_MODEL_NAME,
    systemInstruction
  });

  let partesReq: any[] = [{ text: `A IA júnior fez as seguintes alterações no documento:\n${item.mudancasTexto}\n\nAvalie se ela acertou ou errou, e corrija se necessário.` }];
  let arquivoTemporarioPath: string | null = null;
  let geminiFileName: string | null = null;

  try {
    const docRaw = await obterBufferDoDocumento(item.edital.link);

    if (!docRaw) {
      throw new Error("Não foi possível acessar o documento original.");
    }

    if (docRaw.isPDF && docRaw.buffer) {
      const pdfDoc = await PDFDocument.load(docRaw.buffer, { ignoreEncryption: true });
      const pageCount = pdfDoc.getPageCount();
      let bufferParaUpload: Uint8Array = docRaw.buffer;

      // Simplificação do PDF para poupar tokens do auditor também
      if (pageCount > 10) {
        const novoPdf = await PDFDocument.create();
        const indicesToCopy = [0, 1, 2, 3, 4, pageCount - 5, pageCount - 4, pageCount - 3, pageCount - 2, pageCount - 1];
        const paginasExtraidas = await novoPdf.copyPages(pdfDoc, indicesToCopy);
        paginasExtraidas.forEach(page => novoPdf.addPage(page));
        bufferParaUpload = await novoPdf.save();
      }

      const tempFilename = crypto.randomUUID() + '-auditoria.pdf';
      arquivoTemporarioPath = path.join(os.tmpdir(), tempFilename);
      fs.writeFileSync(arquivoTemporarioPath, bufferParaUpload);

      const uploadResult = await fileManager.uploadFile(arquivoTemporarioPath, {
        mimeType: "application/pdf",
        displayName: `Auditoria-${item.edital.cidade}`
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
      throw new Error("Formato não suportado para auditoria.");
    }

    const contentsPayload = [
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
      custoReq = calcularCusto(AUDITOR_MODEL_NAME, promptTokens, outputTokens);
    }

    const responseText = result.response.text();
    const dados = extrairJSONSeguro(responseText);

    if (dados.veredicto) {
      // Forçar limite de 300 chars na justificativa caso a IA ultrapasse
      if (dados.justificativa && dados.justificativa.length > 300) {
        dados.justificativa = dados.justificativa.substring(0, 297) + '...';
      }
      return {
        veredicto: dados.veredicto,
        tipoVazio: dados.tipoVazio,
        justificativa: dados.justificativa,
        dadosCorrigidos: dados.dadosCorrigidos,
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
      } catch (e) { }
    }
    if (geminiFileName) {
      try {
        await fileManager.deleteFile(geminiFileName);
      } catch (e) { }
    }
  }
}

export async function processarAuditoria(itensParaAuditar: EditalAuditavel[]): Promise<void> {
  if (itensParaAuditar.length === 0) {
    console.log("🕵️ [AUDITOR] Nenhum edital com mudanças relevantes para auditar.");
    return;
  }

  console.log("\n🕵️ ══════════════════════════════════════════════════════");
  console.log("🕵️  PASSO 0.5: AUDITORIA COM IA SUPERIOR (GEMINI 3.5 FLASH)");
  console.log("🕵️ ══════════════════════════════════════════════════════");
  console.log(`🕵️ [AUDITOR] Iniciando auditoria de ${itensParaAuditar.length} editais com alterações relevantes.`);

  let cotacaoDolar = 5.50;
  try { cotacaoDolar = await obterCotacaoDolar(); } catch (e) { }

  let sucesso = 0;
  let incorretosCorrigidos = 0;
  let falhaTecnica = 0;
  let custoGeralUSD = 0;

  for (let i = 0; i < itensParaAuditar.length; i++) {
    const { edital, mudancasTexto } = itensParaAuditar[i];
    try {
      const resultado = await auditarEditalComIA(itensParaAuditar[i]);

      if (resultado) {
        if (resultado.custoReq) custoGeralUSD += resultado.custoReq;
        const custoBRL = (resultado.custoReq || 0) * cotacaoDolar;

        const icone = resultado.veredicto === 'CORRETO' ? '✅' : '❌';
        const mudancasCurtas = mudancasTexto.replace(/concurso: |dataPublicacao: /g, '');

        console.log("──────────────────────────────────────────────────────");
        console.log(`🕵️ [AUDITOR] [${i + 1}/${itensParaAuditar.length}] ${mudancasCurtas} ${resultado.veredicto}  ${icone}`);
        console.log(`   ↳ Justificativa: "${resultado.justificativa}"  [💰 R$ ${custoBRL.toFixed(4)}]`);


        if (resultado.veredicto === 'CORRETO') {
          sucesso++;
        } else if (resultado.veredicto === 'INCORRETO' && resultado.dadosCorrigidos) {
          // Aplica a correção diretamente na referência do edital
          if (edital.dadosEnriquecidos) {
            if (resultado.dadosCorrigidos.concurso !== undefined) {
              edital.dadosEnriquecidos.concurso = resultado.dadosCorrigidos.concurso;
            }
            if (resultado.dadosCorrigidos.dataPublicacao !== undefined) {
              edital.dadosEnriquecidos.dataPublicacao = resultado.dadosCorrigidos.dataPublicacao;
            }
          }
          console.log(`   ↳ 🛠️ DADOS CORRIGIDOS PELA AUDITORIA: concurso: "${resultado.dadosCorrigidos.concurso || ''}" | dataPublicacao: "${resultado.dadosCorrigidos.dataPublicacao || ''}"`);
          incorretosCorrigidos++;
        }
      } else {
        console.log(`🕵️ [AUDITOR] [${i + 1}/${itensParaAuditar.length}] ❌ Falha técnica ao extrair auditoria.`);
        falhaTecnica++;
      }
    } catch (err: any) {
      if (err.message && err.message.includes('429')) {
        console.log(`🕵️ [AUDITOR] [${i + 1}/${itensParaAuditar.length}] ⏳ Rate limit. Esperando 60s...`);
        await delay(60000);
        // Não haverá retry secundário para poupar código, se falhar pula.
        falhaTecnica++;
      } else {
        console.log(`🕵️ [AUDITOR] [${i + 1}/${itensParaAuditar.length}] ❌ Erro: ${err.message || err}`);
        falhaTecnica++;
      }
    }

    if (i < itensParaAuditar.length - 1) {
      await delay(4000);
    }
  }

  const custoTotalBRL = custoGeralUSD * cotacaoDolar;
  console.log("🕵️ ══════════════════════════════════════════════════════");
  console.log(`🕵️ [AUDITOR] RESUMO DA AUDITORIA:`);
  console.log(`🕵️ ✅ Aprovados: ${sucesso}`);
  console.log(`🕵️ 🛠️ Correções: ${incorretosCorrigidos}`);
  console.log(`🕵️ ❌ Falhas técnicas: ${falhaTecnica}`);
  console.log(`🕵️ 💰 Custo Total Estimado da Auditoria: R$ ${custoTotalBRL.toFixed(4)}`);
  console.log("🕵️ ══════════════════════════════════════════════════════\n");
}
