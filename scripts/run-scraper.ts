import { buscarTodosEditais } from '../src/app/actions';
import { sincronizarBanco } from '../src/lib/storage';

async function main() {
  console.log("===================================================");
  console.log("🚀 INICIANDO RASPAGEM AUTOMATIZADA (GITHUB ACTIONS)");
  console.log("===================================================");
  
  const inicio = performance.now();
  
  try {
    // 1. Roda a raspagem completa de todas as cidades
    const { editais, falhas } = await buscarTodosEditais();
    
    console.log(`\n✅ Raspagem finalizada. Total de editais extraídos: ${editais.length}`);
    if (falhas.length > 0) {
      console.log(`⚠️ Falhas detectadas em: ${falhas.join(', ')}`);
    }

    // 2. Sincroniza com o Vercel Blob apenas se encontrou editais
    if (editais.length > 0) {
      console.log("\nIniciando sincronização com o banco de dados...");
      const resultado = await sincronizarBanco(editais, false);
      
      if (resultado.sucesso) {
        console.log("✅ Sincronização concluída com sucesso!");
      } else {
        console.error("❌ Falha na sincronização com o banco de dados.");
        process.exit(1);
      }
    } else {
      console.log("⚠️ Nenhum edital encontrado. O banco de dados não foi atualizado.");
    }
  } catch (error) {
    console.error("❌ Erro fatal no script de raspagem:", error);
    process.exit(1);
  } finally {
    const fim = performance.now();
    console.log("\n===================================================");
    console.log(`⏱️ Tempo total de execução do script: ${((fim - inicio) / 1000).toFixed(2)}s`);
    console.log("===================================================");
  }
}

main();
