import { GoogleGenerativeAI } from '@google/generative-ai';
import { Edital } from '../types';
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
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `Você é um especialista em concursos públicos e processos seletivos no Brasil.

Analise o documento abaixo, que foi coletado de um Diário Oficial municipal.

DADOS DA POSTAGEM:
- Cidade: ${edital.cidade}
- Órgão: ${edital.orgao}
- Título original: ${edital.titulo}
- Descrição original: ${edital.descricao || 'Não fornecida'}

INSTRUÇÕES:
1. Gere um TÍTULO conciso (máximo 10 palavras) focado APENAS na ação principal e referência do documento. 
   REGRA CRÍTICA 1: NÃO repita o nome da cidade ou o órgão, nós já temos essa informação.
   Exemplos bons: "Abertura de Processo Seletivo 01/2026", "Convocação para Provas Práticas", "Resultado Preliminar de Cargos Administrativos".
   Exemplos ruins (não faça assim): "Edital de Abertura Processo Seletivo Simplificado 001/2026, Prefeitura de Parisi/SP, Nível Médio." (muito longo e repete a cidade).
   
2. Gere uma DESCRIÇÃO informativa (2 a 3 frases curtas) focada no conteúdo útil para o candidato:
   - Motivo central (ex: vagas temporárias, contratação de professores, etc)
   - Nível de escolaridade e alguns cargos principais (se aplicável)
   - Datas principais (período de inscrição, data da prova)
   
3. Extraia a referência do concurso ou processo seletivo e PADRONIZE RIGOROSAMENTE para o seguinte formato exato:
   - PARTE 1: Deve ser EXATAMENTE "Processo Seletivo" ou "Concurso Público" (e nada mais).
   - PARTE 2: Deve ser o número no formato nn/aaaa (exatamente 2 dígitos, barra, 4 dígitos. Ex: 01/2026).
   - PARTE 3 (opcional, adicione no fim se aplicável): Deve ser EXATAMENTE "(Estagiários)" ou "(Simplificado)".
   Exemplo Perfeito: "Processo Seletivo 01/2026 (Simplificado)".
   Se não conseguir identificar, deixe como string vazia "".

4. Extraia a data exata de publicação oficial do edital (se houver). Formato DD/MM/AAAA.

Responda EXCLUSIVAMENTE em JSON válido, sem markdown:
{
  "titulo": "...",
  "descricao": "...",
  "concurso": "...",
  "dataPublicacao": "..."
}
`;

  try {
    let textoDocumento = await extrairTextoBruto(edital.link);
    let partesReq: any[] = [prompt];
    
    if (textoDocumento && textoDocumento.length > 100) {
      // Usar texto
      partesReq.push(`\nTEXTO DO DOCUMENTO:\n${textoDocumento.substring(0, 30000)}`);
    } else {
      console.log(`🧠 [IA] ⚠️ Texto insuficiente para "${edital.titulo}". Enviando PDF/Arquivo como imagem ao Gemini...`);
      const docRaw = await baixarDocumentoBruto(edital.link);
      if (docRaw) {
        partesReq.push({
          inlineData: {
            data: docRaw.bytes,
            mimeType: docRaw.mimeType
          }
        });
      } else {
        throw new Error("Não foi possível extrair texto nem baixar o arquivo bruto.");
      }
    }

    const result = await model.generateContent(partesReq);
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
