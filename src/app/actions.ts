'use server'

import { Edital } from '../types';
import { buscarFernandopolis } from '../lib/scrapers/fernandopolis';
import { buscarVotuporanga } from '../lib/scrapers/votuporanga';
import { buscarMacedonia } from '../lib/scrapers/macedonia';
import { buscarPedranopolis } from '../lib/scrapers/pedranopolis';
import { buscarEstrela } from '../lib/scrapers/estrela';
import { buscarMeridiano } from '../lib/scrapers/meridiano';
import { buscarSaoJoao } from '../lib/scrapers/saojoao';
import { urlsParaBlacklist } from '../lib/docParser'; // <-- IMPORTAÇÃO DA LISTA NEGRA

export type ResultadoBusca = {
  editais: Edital[];
  falhas: string[];
};

async function rodarComProtecao(nomeCidade: string, funcaoScraper: () => Promise<Edital[]>) {
  try {
    const dados = await funcaoScraper();
    return { sucesso: true, cidade: nomeCidade, dados };
  } catch (e: any) {
    console.error(`Falha isolada em ${nomeCidade}:`, e.message);
    return { sucesso: false, cidade: nomeCidade, dados: [] };
  }
}

export async function buscarTodosEditais(): Promise<ResultadoBusca> {
  let todosOsEditais: Edital[] = [];
  const cidadesComFalha: string[] = [];

  // Limpa a lista negra em tempo de execução antes de começar a rodada
  urlsParaBlacklist.clear();

  console.log("⏳ Iniciando raspagem de dados...");
  const tempoInicioTotal = performance.now();

  try {
    const promessas = await Promise.all([
      rodarComProtecao('Fernandópolis', buscarFernandopolis),
      rodarComProtecao('Votuporanga', buscarVotuporanga),
      rodarComProtecao('Macedônia', buscarMacedonia),
      rodarComProtecao('Pedranópolis', buscarPedranopolis),
      rodarComProtecao("Estrela d'Oeste", buscarEstrela),
      rodarComProtecao('Meridiano', buscarMeridiano),
      rodarComProtecao('São João das Duas Pontes', buscarSaoJoao)
    ]);

    promessas.forEach((resultado) => {
      if (resultado.sucesso) {
        todosOsEditais = [...todosOsEditais, ...resultado.dados];
      } else {
        cidadesComFalha.push(resultado.cidade);
      }
    });

    todosOsEditais.sort((a, b) => {
      if (b.dataTimestamp !== a.dataTimestamp) {
        return b.dataTimestamp - a.dataTimestamp;
      }
      return (a.ordemOriginal || 0) - (b.ordemOriginal || 0);
    });

    const tempoFimTotal = performance.now();
    const tempoGasto = ((tempoFimTotal - tempoInicioTotal) / 1000).toFixed(2);

    console.log(`\n✅ RASPAGEM CONCLUÍDA EM ${tempoGasto} SEGUNDOS!`);
    console.log(`📊 Total de editais extraídos: ${todosOsEditais.length}`);
    if (cidadesComFalha.length > 0) {
      console.log(`⚠️ Falhas detectadas em: ${cidadesComFalha.join(', ')}`);
    }

    // A MÁGICA ACONTECE AQUI! IMPRIME O ARRAY DA LISTA NEGRA
    if (urlsParaBlacklist.size > 0) {
      console.log(`\n🛑 ENCONTRAMOS ${urlsParaBlacklist.size} ARQUIVOS SEM DATA (IMAGENS/QUEBRADOS).`);
      console.log(`Copie o bloco abaixo e cole no array PDFs_IGNORADOS em docParser.ts:\n`);
      console.log(JSON.stringify(Array.from(urlsParaBlacklist), null, 2));
    }

    console.log("\n---------------------------------------------------\n");

    return {
      editais: todosOsEditais,
      falhas: cidadesComFalha
    };

  } catch (e: any) {
    throw new Error('Erro grave ao processar as buscas.');
  }
}