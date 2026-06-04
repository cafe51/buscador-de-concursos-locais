import connectToDatabase from '../src/lib/mongodb';
import { ScraperConfigModel } from '../src/models/ScraperConfig';

async function run() {
  await connectToDatabase();
  const configs = await ScraperConfigModel.find();
  console.log("Configs no banco:");
  configs.forEach(c => {
    if (c.nome === 'Fernandópolis') {
      console.log(c.nome, "=>", c.verificarDisponibilidade, typeof c.verificarDisponibilidade);
    }
  });

  // Atualiza via mongoose para garantir boolean
  await ScraperConfigModel.updateOne({ nome: 'Fernandópolis' }, { verificarDisponibilidade: true });
  console.log("Forçado para true via mongoose.");
  process.exit(0);
}
run().catch(console.error);
