import { ScraperOptions, Edital } from '../../../types';
import {
  DiarioTransparenteConfig,
  executarScraperDiarioTransparente,
  parseSumarioDiarioTransparente,
  isolarTextoSumario,
  buscarEdicoesDiarioTransparente,
  EdicaoDiarioTransparente
} from './diarioTransparenteEngine';

const CONFIG_FERNANDOPOLIS: DiarioTransparenteConfig = {
  cidade: 'Fernandópolis',
  slugEntidade: 'spfernandopolispm',
  orgaoDefault: 'Prefeitura',
  excecoesSujeira: ['simplificado']
};

/**
 * Busca edições do Diário Oficial de Fernandópolis.
 */
export async function buscarEdicoesDiarioFernandopolis(
  opcoes?: ScraperOptions & { keyword?: string; anosDev?: number; anosProd?: number }
): Promise<EdicaoDiarioTransparente[]> {
  return buscarEdicoesDiarioTransparente(CONFIG_FERNANDOPOLIS, opcoes);
}

/**
 * Parse do sumário de Fernandópolis.
 */
export function parseSumarioFernandopolis(
  textoSumarioBruto: string,
  urlPdf: string = ''
): { titulo: string; concurso: string; pagina: number }[] {
  return parseSumarioDiarioTransparente(textoSumarioBruto, urlPdf, CONFIG_FERNANDOPOLIS);
}

/**
 * Scraper Principal do Diário Oficial de Fernandópolis utilizando o motor comum do Diário Transparente.
 */
export async function buscarFernandopolisDiario(opcoes?: ScraperOptions): Promise<Edital[]> {
  return executarScraperDiarioTransparente(CONFIG_FERNANDOPOLIS, opcoes);
}

export { isolarTextoSumario };
