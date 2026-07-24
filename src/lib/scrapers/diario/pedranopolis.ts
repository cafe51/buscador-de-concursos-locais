import { ScraperOptions, Edital } from '../../../types';
import {
  DiarioTransparenteConfig,
  executarScraperDiarioTransparente,
  parseSumarioDiarioTransparente,
  isolarTextoSumario,
  buscarEdicoesDiarioTransparente,
  EdicaoDiarioTransparente
} from './diarioTransparenteEngine';

const CONFIG_PEDRANOPOLIS: DiarioTransparenteConfig = {
  cidade: 'Pedranópolis',
  slugEntidade: 'sppedranopolispm',
  orgaoDefault: 'Prefeitura',
  urlsPesquisa: [
    "https://diariotransparente.com.br/publicacoes/frame/sppedranopolispm?entityId=&keyword=concurso+p%C3%BAblico&publishDateIni=&publishDateEnd=",
    "https://diariotransparente.com.br/publicacoes/frame/sppedranopolispm?entityId=&keyword=processo+seletivo&publishDateIni=&publishDateEnd="
  ],
  excecoesSujeira: ['simplificado'],
  anosDev: 4, // 4 anos em modo de desenvolvimento
  anosProd: 0.5 // 6 meses (0.5 anos) em modo de produção
};

/**
 * Busca a lista de edições do Diário Oficial de Pedranópolis.
 */
export async function buscarEdicoesDiarioPedranopolis(
  opcoes?: ScraperOptions & { anosDev?: number; anosProd?: number }
): Promise<EdicaoDiarioTransparente[]> {
  return buscarEdicoesDiarioTransparente(CONFIG_PEDRANOPOLIS, opcoes);
}

/**
 * Parse do sumário de Pedranópolis.
 */
export function parseSumarioPedranopolis(
  textoSumarioBruto: string,
  urlPdf: string = ''
): { titulo: string; concurso: string; pagina: number }[] {
  return parseSumarioDiarioTransparente(textoSumarioBruto, urlPdf, CONFIG_PEDRANOPOLIS);
}

/**
 * Scraper Principal do Diário Oficial de Pedranópolis utilizando o motor comum do Diário Transparente.
 */
export async function buscarPedranopolisDiario(opcoes?: ScraperOptions): Promise<Edital[]> {
  return executarScraperDiarioTransparente(CONFIG_PEDRANOPOLIS, opcoes);
}

export { isolarTextoSumario };
