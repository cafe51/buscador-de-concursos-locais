import { buscarTodosEditais, buscarEditaisPorCidade } from '../src/app/actions';
import { sincronizarBanco } from '../src/lib/storage';

// ==============================================================
// ⏱️ CONFIGURAÇÕES DE RETENTATIVA
// ==============================================================
const RETRY_DELAY_MINUTES = 1;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = RETRY_DELAY_MINUTES * 60 * 1000;

async function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log("===================================================");
  console.log("🚀 INICIANDO BLOCO DE RASPAGEM AUTOMATIZADA (GITHUB ACTIONS)");
  console.log("===================================================");
  
  const inicio = performance.now();
  
  try {
    // 1. Roda a raspagem completa de todas as cidades (Primeira etapa do bloco)
    let { editais, falhas } = await buscarTodosEditais();
    const todosEditais = [...editais];
    let cidadesComFalha = [...falhas];
    
    console.log(`\n✅ Raspagem inicial finalizada. Itens extraídos: ${editais.length}`);
    
    // 2. Lógica de Retentativas
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      if (cidadesComFalha.length === 0) break; // Sucesso total!

      console.log(`\n⚠️ Falhas detectadas em: ${cidadesComFalha.join(', ')}`);
      console.log(`⏳ Aguardando ${RETRY_DELAY_MINUTES} minuto(s) para a Tentativa ${attempt} de ${MAX_RETRIES}...`);
      
      await wait(RETRY_DELAY_MS);
      
      // Extrai apenas os nomes puros das cidades (remove o motivo do erro entre parênteses)
      const nomesCidades = cidadesComFalha.map(falha => {
        const match = falha.match(/(.+)\s+\([^)]+\)$/);
        return match ? match[1].trim() : falha.trim();
      });

      cidadesComFalha = []; // Zera para a nova rodada
      
      for (const cidade of nomesCidades) {
        console.log(`\n♻️ Reprocessando cidade com falha: ${cidade}`);
        try {
          const resultado = await buscarEditaisPorCidade(cidade);
          if (resultado.falhas.length > 0) {
            cidadesComFalha.push(resultado.falhas[0]);
          } else {
            // Sucesso na retentativa! Adiciona ao bolo total
            todosEditais.push(...resultado.editais);
          }
        } catch (e: any) {
          cidadesComFalha.push(`${cidade} (${e.message || 'Erro no reprocessamento'})`);
        }
      }
    }

    if (cidadesComFalha.length > 0) {
      console.log(`\n🚨 O Bloco de raspagem terminou, mas ainda restaram falhas: ${cidadesComFalha.join(', ')}`);
    } else {
      console.log(`\n✅ Bloco de raspagem finalizado com SUCESSO TOTAL para todas as cidades!`);
    }

    console.log(`📊 Total consolidado de editais extraídos no bloco: ${todosEditais.length}`);

    // 3. Sincroniza com o Vercel Blob apenas se encontrou editais e salva Metadados no final
    if (todosEditais.length > 0) {
      console.log("\nIniciando sincronização com o banco de dados...");
      // sincronizarBanco já salva a metadata automaticamente ao terminar
      const resultado = await sincronizarBanco(todosEditais, false);
      
      if (resultado.sucesso) {
        console.log("✅ Sincronização concluída com sucesso! (A data de atualização também foi registrada na Nuvem)");
      } else {
        console.error("❌ Falha na sincronização com o banco de dados.");
        process.exit(1);
      }
    } else {
      console.log("⚠️ Nenhum edital encontrado no bloco. O banco de dados não foi atualizado.");
    }
  } catch (error) {
    console.error("❌ Erro fatal no script de raspagem:", error);
    process.exit(1);
  } finally {
    const fim = performance.now();
    console.log("\n===================================================");
    console.log(`⏱️ Tempo total do bloco de execução: ${((fim - inicio) / 1000).toFixed(2)}s`);
    console.log("===================================================");
  }
}

main();
