import { loadEnvConfig } from '@next/env';
// Carrega as variáveis de ambiente do .env e .env.local antes de qualquer coisa
loadEnvConfig(process.cwd());

import { runFullScraperWorkflow } from '../src/lib/orchestrator';

async function main() {
  try {
    await runFullScraperWorkflow({ isLocalUI: false });
  } catch (e) {
    console.error("❌ Falha fatal no github actions:", e);
    process.exit(1);
  } finally {
    // Força o encerramento do processo Node.js com sucesso.
    // Isso evita que a Action do GitHub fique travada "In progress" devido a conexões pendentes.
    process.exit(0);
  }
}

main();
