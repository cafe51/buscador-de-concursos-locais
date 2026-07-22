import connectToDatabase from '../src/lib/mongodb';
import { ScraperConfigModel } from '../src/models/ScraperConfig';
import { CIDADES_ATIVAS } from '../src/lib/scrapers/registry';

async function run() {
  await connectToDatabase();
  console.log('Conectado. Inicializando configurações...');

  // Remove registros obsoletos de Câmaras/Cidades inativas do banco
  const deleteRes = await ScraperConfigModel.deleteMany({ nome: { $nin: CIDADES_ATIVAS } });
  if (deleteRes.deletedCount > 0) {
    console.log(`- Limpos: ${deleteRes.deletedCount} registros obsoletos desativados.`);
  }

  let count = 0;
  for (const cidade of CIDADES_ATIVAS) {
    const existe = await ScraperConfigModel.findOne({ nome: cidade });
    if (!existe) {
      await ScraperConfigModel.create({ nome: cidade, verificarDisponibilidade: false });
      console.log(`+ Criado: ${cidade}`);
      count++;
    }
  }

  console.log(`Inicialização concluída! ${count} novos registros inseridos.`);
  process.exit(0);
}

run().catch(console.error);
