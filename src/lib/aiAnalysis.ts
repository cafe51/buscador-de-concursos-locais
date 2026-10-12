import { GoogleGenAI } from '@google/genai';
import { Edital } from '../types';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { obterBufferDoDocumento } from './docParser';
import { converterWordParaPdf } from './wordToPdf';
import { PDFDocument } from 'pdf-lib';
import * as crypto from 'crypto';

export const MODEL_NAME = 'gemini-flash-lite-latest';
export const TAXA_IMPOSTO = 0.14; // 14% de imposto (pode ser modificado)

export const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export function calcularCusto(modelo: string, promptTokens: number, outputTokens: number): number {
  let custoInput = 0;
  let custoOutput = 0;

  const inM = promptTokens / 1_000_000;
  const outM = outputTokens / 1_000_000;

  switch (modelo) {
    case 'gemini-flash-latest':
    case 'gemini-3.8-flash':
      custoInput = inM * 0.75;
      custoOutput = outM * 3.75;
      break;
    case 'gemini-flash-lite-latest':
    case 'gemini-3.5-flash-lite':
      custoInput = inM * 0.30;
      custoOutput = outM * 2.50;
      break;
    case 'gemini-3.6-flash':
      custoInput = inM * 1.50;
      custoOutput = outM * 7.50;
      break;
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
      custoInput = inM * 0.50;
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
      // Fallback para gemini-flash-latest
      custoInput = inM * 0.75;
      custoOutput = outM * 3.75;
      break;
  }
  const custoBase = custoInput + custoOutput;
  return custoBase * (1 + TAXA_IMPOSTO);
}

export async function obterCotacaoDolar(): Promise<number> {
  try {
    const res = await fetch('https://economia.awesomeapi.com.br/last/USD-BRL');
    if (!res.ok) return 5.50; // Fallback caso falhe
    const data = await res.json();
    return parseFloat(data.USDBRL.bid);
  } catch (e) {
    return 5.50; // Fallback caso ocorra erro de rede
  }
}

export function extrairJSONSeguro(texto: string): any {
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

export function extrairPaginaDoLink(link: string): number | null {
  const match = link.match(/#page=(\d+)/i);
  if (match) {
    const pag = parseInt(match[1], 10);
    return isNaN(pag) || pag < 1 ? null : pag;
  }
  return null;
}

const SYSTEM_INSTRUCTION_PORTAL = `Você é um especialista em concursos públicos e processos seletivos no Brasil.
INSTRUÇÕES RÍGIDAS DE FORMATAÇÃO:
1. TÍTULO: Gere um título conciso (máximo 10 palavras) focado APENAS na ação principal e referência do documento. 
   REGRA CRÍTICA: NUNCA repita o nome da cidade ou o órgão.
   Exemplos bons: "Abertura de Processo Seletivo 01/2026", "Convocação para Provas Práticas".
   
2. DESCRIÇÃO: 2 a 3 frases curtas informativas para o candidato:
   - Motivo central (ex: vagas temporárias, homologação, convocações)
   - Escolaridade e cargos principais (se aplicável)
   - Datas principais (se aplicável)
   
3. CONCURSO (Chave de Agrupamento): Extraia a referência do concurso e PADRONIZE RIGOROSAMENTE para o formato:
   - PARTE 1: EXATAMENTE "Processo Seletivo" ou EXATAMENTE "Concurso Público".
   - PARTE 2: Número no formato nn/aaaa. CONVERTA QUALQUER NÚMERO PARA EXATAMENTE 2 DÍGITOS ANTES DA BARRA (Ex: 001/2020 deve virar 01/2020. 1/2020 deve virar 01/2020). O ano deve ter 4 dígitos.
   - PARTE 3 (Opcional): Se for para estagiários, adicione "(Estagiários)" no final.
   Exemplo Perfeito: "Processo Seletivo 01/2026" ou "Processo Seletivo 01/2026 (Estagiários)".
   Se conseguir identificar o certame a que o edital pertence, gere a chave "concurso" usando obrigatoriamente as duas partes (PARTE 1 + PARTE 2) e opcionalmente a parte 3.
   Se não conseguir identificar a que concurso o edital pertence, gere a chave "concurso" como string vazia "".
   
   REGRA CRÍTICA PARA MÚLTIPLOS CERTAMES NO MESMO DOCUMENTO:
   Se o documento abordar convocações/atos de MAIS DE UM certame (ex: Concurso Público 01/2020 e Processo Seletivo 02/2022 no mesmo PDF):
   - Na chave "concurso": Escolha EXCLUSIVAMENTE o PRIMEIRO certame mencionado na ação principal do documento.
   - Na chave "descricao": Obrigatoriamente inclua a citação ao(s) outro(s) certame(s) abrangidos pelo documento.

4. DATA: Extraia a data exata de publicação oficial ou assinatura do edital (se houver) no formato DD/MM/AAAA.
   ATENÇÃO: Em caso de conflito entre múltiplas datas encontradas, analise com cuidado para descobrir qual data se refere à publicação do documento.

Responda EXCLUSIVAMENTE em JSON válido, sem markdown:
{
  "titulo": "...",
  "descricao": "...",
  "concurso": "...",
  "dataPublicacao": "..."
}`;

const SYSTEM_INSTRUCTION_DIARIO = `Você é um especialista em concursos públicos e processos seletivos no Brasil analisando um ato do Diário Oficial.
INSTRUÇÕES RÍGIDAS DE FORMATAÇÃO:
1. TÍTULO: Gere um título conciso (máximo 10 palavras) focado APENAS na ação principal e referência do documento. 
   REGRA CRÍTICA: NUNCA repita o nome da cidade ou o órgão.
   Exemplos bons: "Abertura de Processo Seletivo 01/2026", "Convocação para Provas Práticas".
   
2. DESCRIÇÃO: 2 a 3 frases curtas informativas para o candidato:
   - Motivo central (ex: vagas temporárias, homologação, convocações)
   - Escolaridade e cargos principais (se aplicável)
   - Datas principais (se aplicável)
   
3. CONCURSO (Chave de Agrupamento): Extraia a referência do concurso e PADRONIZE RIGOROSAMENTE para o formato:
   - PARTE 1: EXATAMENTE "Processo Seletivo" ou EXATAMENTE "Concurso Público".
   - PARTE 2: Número no formato nn/aaaa. CONVERTA QUALQUER NÚMERO PARA EXATAMENTE 2 DÍGITOS ANTES DA BARRA (Ex: 001/2020 deve virar 01/2020. 1/2020 deve virar 01/2020). O ano deve ter 4 dígitos.
   - PARTE 3 (Opcional): Se for para estagiários, adicione "(Estagiários)" no final.
   Exemplo Perfeito: "Processo Seletivo 01/2026" ou "Processo Seletivo 01/2026 (Estagiários)".
   Se conseguir identificar o certame a que o edital pertence, gere a chave "concurso" usando obrigatoriamente as duas partes (PARTE 1 + PARTE 2) e opcionalmente a parte 3.
   Se não conseguir identificar a que concurso o edital pertence, gere a chave "concurso" como string vazia "".
   
   REGRA CRÍTICA PARA MÚLTIPLOS CERTAMES NO MESMO DOCUMENTO:
   Se o documento abordar convocações/atos de MAIS DE UM certame (ex: Concurso Público 01/2020 e Processo Seletivo 02/2022 no mesmo PDF):
   - Na chave "concurso": Escolha EXCLUSIVAMENTE o PRIMEIRO certame mencionado na ação principal do documento.
   - Na chave "descricao": Obrigatoriamente inclua a citação ao(s) outro(s) certame(s) abrangidos pelo documento.

4. ÓRGÃO (DETERMINÍSTICO E EXCLUSIVO):
   REGRA ABSOLUTA: O valor da chave "orgao" DEVE SER EXATAMENTE "Prefeitura" OU EXATAMENTE "Câmara Municipal".
   É PROIBIDO RETORNAR QUALQUER OUTRO VALOR (NÃO use "Instituto", "Autarquia", "Secretaria", "Conselho", etc.).
   - Se o ato for emitido pelo Poder Legislativo / Câmara de Vereadores / Mesa Diretora da Câmara, retorne "Câmara Municipal".
   - Para todos os demais atos do município, retorne "Prefeitura".

Responda EXCLUSIVAMENTE em JSON válido, sem markdown:
{
  "titulo": "...",
  "descricao": "...",
  "concurso": "...",
  "orgao": "..."
}`;

async function analisarEditalComIA(edital: Edital, modelOverride?: string): Promise<{ titulo: string; descricao: string; concurso?: string; dataPublicacao?: string; orgao?: string; custoReq?: number } | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const client = new GoogleGenAI({ apiKey });

  const ehDiario = edital.fonte === 'diario';
  const systemInstruction = ehDiario ? SYSTEM_INSTRUCTION_DIARIO : SYSTEM_INSTRUCTION_PORTAL;
  const modeloUsado = modelOverride || MODEL_NAME;

  const inputItems: any[] = [];
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

      const ehDiario = edital.fonte === 'diario';
      const paginaAlvo = ehDiario ? extrairPaginaDoLink(edital.link) : null;

      if (ehDiario && paginaAlvo && paginaAlvo <= pageCount) {
        console.log(`[IA] [Diário Oficial] Extraindo exclusivamente a página ${paginaAlvo} do PDF (total: ${pageCount} págs)...`);
        const novoPdf = await PDFDocument.create();
        const paginasExtraidas = await novoPdf.copyPages(pdfDoc, [paginaAlvo - 1]);
        novoPdf.addPage(paginasExtraidas[0]);
        bufferParaUpload = await novoPdf.save();
      } else if (pageCount > 10) {
        const novoPdf = await PDFDocument.create();
        const indicesToCopy = [0, 1, 2, 3, 4, pageCount - 5, pageCount - 4, pageCount - 3, pageCount - 2, pageCount - 1];
        const paginasExtraidas = await novoPdf.copyPages(pdfDoc, indicesToCopy);
        paginasExtraidas.forEach(page => novoPdf.addPage(page));
        bufferParaUpload = await novoPdf.save();
      }

      const tempFilename = crypto.randomUUID() + '.pdf';
      arquivoTemporarioPath = path.join(os.tmpdir(), tempFilename);
      fs.writeFileSync(arquivoTemporarioPath, bufferParaUpload);

      const uploadResult = await client.files.upload({
        file: arquivoTemporarioPath,
        config: {
          mimeType: "application/pdf",
          displayName: `Edital-${edital.cidade}`
        }
      });

      geminiFileName = uploadResult.name || null;

      inputItems.push({
        type: "document",
        uri: uploadResult.uri,
        mime_type: "application/pdf"
      });

    } else if (docRaw.textoLimpo) {
      inputItems.push({
        type: "text",
        text: `\nTEXTO DO HTML:\n${docRaw.textoLimpo.substring(0, 200000)}`
      });
    } else if ((docRaw.isDOCX || docRaw.isDOC) && docRaw.buffer) {
      console.log(`[IA] Convertendo Word para PDF usando LibreOffice...`);
      const pdfBufferConvertido = await converterWordParaPdf(docRaw.buffer, !!docRaw.isDOCX);

      const tempFilename = crypto.randomUUID() + '-convertido.pdf';
      arquivoTemporarioPath = path.join(os.tmpdir(), tempFilename);
      fs.writeFileSync(arquivoTemporarioPath, pdfBufferConvertido);

      const uploadResult = await client.files.upload({
        file: arquivoTemporarioPath,
        config: {
          mimeType: "application/pdf",
          displayName: `Edital-${edital.cidade}`
        }
      });

      geminiFileName = uploadResult.name || null;

      inputItems.push({
        type: "document",
        uri: uploadResult.uri,
        mime_type: "application/pdf"
      });
    } else {
      throw new Error("Formato não suportado ou documento vazio.");
    }

    inputItems.push({
      type: "text",
      text: "Extraia os dados deste documento seguindo rigorosamente as instruções do sistema."
    });

    const interaction = await client.interactions.create({
      model: modeloUsado,
      system_instruction: systemInstruction,
      input: inputItems
    });

    let custoReq = 0;
    if (interaction.usage) {
      const promptTokens = interaction.usage.total_input_tokens || 0;
      const outputTokens = (interaction.usage.total_output_tokens || 0) + (interaction.usage.total_thought_tokens || 0);
      custoReq = calcularCusto(modeloUsado, promptTokens, outputTokens);
    }

    const responseText = interaction.output_text || "";
    const dados = extrairJSONSeguro(responseText);

    if (dados.titulo && dados.descricao) {
      return {
        titulo: dados.titulo,
        descricao: dados.descricao,
        concurso: dados.concurso,
        dataPublicacao: dados.dataPublicacao,
        orgao: dados.orgao,
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
        await client.files.delete({ name: geminiFileName });
      } catch (e) {
        console.error("Falha ao deletar arquivo do Gemini API", e);
      }
    }
  }
}

export async function processarComIA(editaisNovos: Edital[], modelOverride?: string): Promise<void> {
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
        const resultado = await analisarEditalComIA(edital, modelOverride);
        if (resultado) {
          if (resultado.custoReq) custoGeralUSD += resultado.custoReq;

          const ehDiario = edital.fonte === 'diario';
          const orgaoLimpo = (resultado.orgao || '').toLowerCase().includes('câmara') ? 'Câmara Municipal' : 'Prefeitura';

          edital.dadosEnriquecidos = {
            titulo: resultado.titulo,
            descricao: resultado.descricao,
            concurso: resultado.concurso,
            // 1. Data de Publicação: EXCLUSIVAMENTE para Diário Oficial, a dataPublicacao do scraper é tomada como VERDADE ABSOLUTA
            dataPublicacao: ehDiario ? edital.dataPublicacao : (resultado.dataPublicacao || edital.dataPublicacao),
            // 2. Órgão: EXCLUSIVAMENTE para Diário Oficial, a IA revisa o órgão. Para portais, preserva o órgão original do scraper.
            orgao: ehDiario ? orgaoLimpo : edital.orgao
          };

          // Para Diário Oficial, a IA atualiza edital.orgao estritamente para Prefeitura ou Câmara Municipal
          if (ehDiario) {
            edital.orgao = orgaoLimpo;
          }

          const custoBRL = (resultado.custoReq || 0) * cotacaoDolar;
          console.log(`🧠 [IA] [${i + 1}/${editaisNovos.length}] ✅ [💰 R$ ${custoBRL.toFixed(4)}] Título: "${resultado.titulo}"\n   ↳ Órgão: "${edital.orgao}" | Descrição: "${resultado.descricao}"`);
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
              const ehDiario = edital.fonte === 'diario';
              const orgaoLimpo = (resultado.orgao || '').toLowerCase().includes('câmara') ? 'Câmara Municipal' : 'Prefeitura';

              edital.dadosEnriquecidos = {
                titulo: resultado.titulo,
                descricao: resultado.descricao,
                concurso: resultado.concurso,
                dataPublicacao: ehDiario ? edital.dataPublicacao : (resultado.dataPublicacao || edital.dataPublicacao),
                orgao: ehDiario ? orgaoLimpo : edital.orgao
              };

              if (ehDiario) {
                edital.orgao = orgaoLimpo;
              }

              const custoBRL = (resultado.custoReq || 0) * cotacaoDolar;
              console.log(`🧠 [IA] [${i + 1}/${editaisNovos.length}] ✅ [💰 R$ ${custoBRL.toFixed(4)}] Título: "${resultado.titulo}" (Após retry)\n   ↳ Órgão: "${edital.orgao}" | Descrição: "${resultado.descricao}"`);
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
