import { GoogleGenerativeAI, Part } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import { Edital } from '../types';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { extrairTextoBruto } from './docParser';

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

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

async function analisarEditalComIA(edital: Edital): Promise<{ titulo: string; descricao: string; concurso?: string; dataPublicacao?: string } | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  
  const genAI = new GoogleGenerativeAI(apiKey);
  
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

4. DATA: Extraia a data exata de publicação oficial do edital (se houver) no formato DD/MM/AAAA.

Responda EXCLUSIVAMENTE em JSON válido, sem markdown:
{
  "titulo": "...",
  "descricao": "...",
  "concurso": "...",
  "dataPublicacao": "..."
}`;

  const model = genAI.getGenerativeModel({ 
    model: "gemini-2.5-flash",
    systemInstruction
  });

  try {
    let textoDocumento = await extrairTextoBruto(edital.link);
    let partesReq: any[] = [{ text: "Extraia os dados deste documento seguindo rigorosamente as instruções do sistema." }];
    
    if (textoDocumento && textoDocumento.length > 100) {
      partesReq.push({ text: `\nTEXTO DO DOCUMENTO:\n${textoDocumento.substring(0, 30000)}` });
    } else {
      console.log(`🧠 [IA] ⚠️ Texto insuficiente para "${edital.titulo}". Enviando PDF/Arquivo como imagem ao Gemini...`);
      const docRaw = await baixarDocumentoBruto(edital.link);
      
      if (docRaw) {
        let mimeTypeUpload = docRaw.mimeType || "application/pdf";
        const buffer = Buffer.from(docRaw.bytes, 'base64');
        const magicBytes = buffer.toString('hex', 0, 4);
        
        if (magicBytes === '25504446') {
          mimeTypeUpload = "application/pdf";
        } else if (magicBytes === '504b0304') {
          mimeTypeUpload = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        } else {
          const inicio = buffer.toString('utf8', 0, 200).toLowerCase();
          if (inicio.includes('<!doctype html') || inicio.includes('<html')) {
            mimeTypeUpload = "text/html";
          }
        }

        partesReq.push({
          inlineData: {
            data: docRaw.bytes,
            mimeType: mimeTypeUpload
          }
        });
      } else {
        throw new Error("Não foi possível extrair texto nem baixar o arquivo bruto.");
      }
    }

    const contentsPayload = [
      {
        role: "user",
        parts: [{ text: "Extraia os dados deste documento seguindo rigorosamente as instruções do sistema.\n\nTEXTO DO DOCUMENTO:\n...[TEXTO OMITIDO]... O Prefeito Municipal de Exemplo/SP torna público a abertura do Concurso Público nº 001/2024 para provimento de cargos de Professor..." }]
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
    const responseText = result.response.text();
    const dados = extrairJSONSeguro(responseText);
    
    if (dados.titulo && dados.descricao) {
      return { 
        titulo: dados.titulo, 
        descricao: dados.descricao,
        concurso: dados.concurso,
        dataPublicacao: dados.dataPublicacao
      };
    }
    return null;
  } catch (error) {
    throw error;
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

  let sucessos = 0;
  let falhas = 0;

  try {
    for (let i = 0; i < editaisNovos.length; i++) {
      const edital = editaisNovos[i];
      console.log(`🧠 [IA] [${i+1}/${editaisNovos.length}] Analisando: "${edital.titulo}" (${edital.cidade} - ${edital.orgao})...`);
      
      try {
        const resultado = await analisarEditalComIA(edital);
        if (resultado) {
          edital.dadosEnriquecidos = {
            titulo: resultado.titulo,
            descricao: resultado.descricao,
            concurso: resultado.concurso,
            dataPublicacao: resultado.dataPublicacao
          };
          console.log(`🧠 [IA] [${i+1}/${editaisNovos.length}] ✅ Título: "${resultado.titulo}"\n   ↳ Descrição: "${resultado.descricao}"`);
          sucessos++;
        } else {
          console.log(`🧠 [IA] [${i+1}/${editaisNovos.length}] ❌ Falha ao extrair dados. O resultado estava vazio.`);
          falhas++;
        }
      } catch (err: any) {
        if (err.message && err.message.includes('429')) {
          console.log(`🧠 [IA] [${i+1}/${editaisNovos.length}] ⏳ Rate limit atingido. Aguardando 60s...`);
          await delay(60000);
          // Retry
          try {
            const resultado = await analisarEditalComIA(edital);
            if (resultado) {
              edital.dadosEnriquecidos = {
                titulo: resultado.titulo,
                descricao: resultado.descricao,
                concurso: resultado.concurso,
                dataPublicacao: resultado.dataPublicacao
              };
              console.log(`🧠 [IA] [${i+1}/${editaisNovos.length}] ✅ Título: "${resultado.titulo}" (Após retry)\n   ↳ Descrição: "${resultado.descricao}"`);
              sucessos++;
            }
          } catch(e) {
            console.log(`🧠 [IA] [${i+1}/${editaisNovos.length}] ❌ Falha no retry: ${e}. Continuando sem IA para este edital.`);
            falhas++;
          }
        } else {
          console.log(`🧠 [IA] [${i+1}/${editaisNovos.length}] ❌ Falha: ${err.message || err}. Continuando sem IA para este edital.`);
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

  console.log("🧠 ──────────────────────────────────────────────────────");
  console.log(`🧠 [IA] RESUMO: ✅ ${sucessos}/${editaisNovos.length} enriquecidos | ❌ ${falhas} falhas`);
  console.log("🧠 ══════════════════════════════════════════════════════");
}
