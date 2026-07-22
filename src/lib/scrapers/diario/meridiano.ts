import { Edital, ScraperOptions } from '../../../types';
import { buscarDospBase } from './dospEngine';

/**
 * Scraper do Diário Oficial de Meridiano (DOSP - Código 4983)
 * Em modo DEV pesquisa o último 1 ano (anosDev: 1).
 */
export async function buscarMeridianoDiario(opcoes?: ScraperOptions): Promise<Edital[]> {
  return buscarDospBase(
    {
      cidade: 'Meridiano',
      codigoDosp: 4983,
      urlDisponibilidade: 'https://www.imprensaoficialmunicipal.com.br/meridiano',
      dominiosOuTermos: [
        'meridiano.sp.gov.br',
        'imprensaoficialmunicipal.com.br/meridiano',
        'município de meridiano'
      ],
      anosDev: 1
    },
    opcoes
  );
}
