import { Edital, ScraperOptions } from '../../../types';
import { buscarDospBase } from './dospEngine';

/**
 * Scraper do Diário Oficial de Santa Salete (DOSP - Código 5181)
 * Em modo DEV pesquisa os últimos 5 anos (anosDev: 5).
 */
export async function buscarSantaSaleteDiario(opcoes?: ScraperOptions): Promise<Edital[]> {
  return buscarDospBase(
    {
      cidade: 'Santa Salete',
      codigoDosp: 5181,
      urlDisponibilidade: 'https://www.imprensaoficialmunicipal.com.br/santasalete',
      dominiosOuTermos: [
        'santasalete.sp.gov.br',
        'imprensaoficialmunicipal.com.br/santasalete',
        'município de santa salete'
      ],
      anosDev: 5,
      anosProd: 2
    },
    opcoes
  );
}
