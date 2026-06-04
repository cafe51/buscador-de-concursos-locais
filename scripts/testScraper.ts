import { buscarTodosEditais } from '../src/app/actions';

async function run() {
  const result = await buscarTodosEditais(['Fernandópolis']);
  console.log('Editais:', result.editais.length);
  console.log('Falhas:', result.falhas);
  console.log('Detalhes:', result.resultadosDetalhes.map(r => ({ cidade: r.cidade, ignorado: r.ignorado, sucesso: r.sucesso, qtd: r.dados?.length })));
  process.exit(0);
}
run().catch(console.error);
