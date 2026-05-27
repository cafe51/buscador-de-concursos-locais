import { Edital } from '../types';

export type ResultadoRunner = {
  sucesso: boolean;
  cidade: string;
  dados: Edital[];
  tempoGasto: number;
  motivo?: string;
  aviso?: boolean;
};

// ==============================================================
// ⏱️ LIMITE MÁXIMO DE TEMPO POR CIDADE (300 Segundos)
// ==============================================================
const TIMEOUT_POR_CIDADE_MS = 290000;

export async function rodarComProtecao(nomeCidade: string, funcaoScraper: () => Promise<Edital[]>): Promise<ResultadoRunner> {
  const tempoInicio = performance.now();

  try {
    const cronometro = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('TIMEOUT')), TIMEOUT_POR_CIDADE_MS);
    });

    const dados = await Promise.race([
      funcaoScraper(),
      cronometro
    ]);

    if (dados.length === 0) {
      throw new Error('0 itens extraídos (possível bloqueio de IP ou falha de layout da página)');
    }

    const tempoFim = performance.now();
    const tempoGasto = ((tempoFim - tempoInicio) / 1000).toFixed(2);

    // Formatação cuidadosa dos Logs
    const tamanhoFixoNome = 30;
    const tamanhoFixoTempo = 5;

    const nomeFormatado = `[${nomeCidade}]`.padEnd(tamanhoFixoNome, ' ');
    const tempoFormatado = tempoGasto.padEnd(tamanhoFixoTempo, ' ');
    const statusFormatado = 'OK'.padEnd(6, ' ');

    console.log(`🟢 ${nomeFormatado} ${statusFormatado} \t| Tempo: ${tempoFormatado}s \t| Itens extraídos: ${dados.length}`);

    return { sucesso: true, cidade: nomeCidade, dados, tempoGasto: Number(tempoGasto) };
  } catch (e: any) {
    const tempoFim = performance.now();
    const tempoGasto = ((tempoFim - tempoInicio) / 1000).toFixed(2);

    let motivo = e.message;
    if (motivo === 'TIMEOUT') {
      motivo = `Tempo limite de ${TIMEOUT_POR_CIDADE_MS / 1000}s excedido`;
    }

    // Formatação do Log de Falha
    const tamanhoFixoTempo = 5;
    const tamanhoFixoNome = 30;
    const nomeFormatado = `[${nomeCidade}]`.padEnd(tamanhoFixoNome, ' ');
    const tempoFormatado = tempoGasto.padEnd(tamanhoFixoTempo, ' ');

    if (e.dadosParciais) {
      const statusFormatado = 'AVISO'.padEnd(6, ' ');
      console.log(`🟡 ${nomeFormatado} ${statusFormatado} \t| Tempo: ${tempoFormatado}s \t| Itens extraídos: ${e.dadosParciais.length} \t| Motivo: ${motivo}`);
      return { sucesso: false, cidade: nomeCidade, dados: e.dadosParciais, motivo, tempoGasto: Number(tempoGasto), aviso: true };
    }

    const statusFormatadoFalha = 'FALHOU'.padEnd(6, ' ');
    console.error(`🔴 ${nomeFormatado} ${statusFormatadoFalha} \t| Tempo: ${tempoFormatado}s \t| Motivo: ${motivo}`);

    return { sucesso: false, cidade: nomeCidade, dados: [], motivo, tempoGasto: Number(tempoGasto) };
  }
}
