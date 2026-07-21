import { Edital, ScraperOptions } from '../../../types';
import { buscarDospBase } from './dospEngine';

/**
 * Scraper do Diário Oficial de Dolcinópolis (DOSP - Código 4807)
 * Em modo DEV pesquisa o último 1 ano (anosDev: 1).
 */
export async function buscarDolcinopolisDiario(opcoes?: ScraperOptions): Promise<Edital[]> {
  return buscarDospBase(
    {
      cidade: 'Dolcinópolis',
      codigoDosp: 4807,
      urlDisponibilidade: 'https://www.imprensaoficialmunicipal.com.br/dolcinopolis',
      dominiosOuTermos: ['dolcinopolis.sp.gov.br', 'imprensaoficialmunicipal.com.br/dolcinopolis', 'município de dolcinopolis', 'município de dolcinópolis'],
      anosDev: 1
    },
    opcoes
  );
}
