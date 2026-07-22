import { Edital, ScraperOptions } from '../../../types';
import { buscarDospBase } from './dospEngine';

/**
 * Scraper do Diário Oficial de Ouroeste (DOSP - Código 5043)
 * Em modo DEV pesquisa os últimos 5 anos (anosDev: 5).
 */
export async function buscarOuroesteDiario(opcoes?: ScraperOptions): Promise<Edital[]> {
  return buscarDospBase(
    {
      cidade: 'Ouroeste',
      codigoDosp: 5043,
      urlDisponibilidade: 'https://www.imprensaoficialmunicipal.com.br/ouroeste',
      dominiosOuTermos: [
        'ouroeste.sp.gov.br',
        'imprensaoficialmunicipal.com.br/ouroeste',
        'município de ouroeste'
      ],
      anosDev: 5
    },
    opcoes
  );
}
