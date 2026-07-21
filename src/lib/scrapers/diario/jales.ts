import { Edital, ScraperOptions } from '../../../types';
import { buscarDospBase } from './dospEngine';

/**
 * Scraper do Diário Oficial de Jales (DOSP - Código 4932)
 */
export async function buscarJalesDiario(opcoes?: ScraperOptions): Promise<Edital[]> {
  return buscarDospBase(
    {
      cidade: 'Jales',
      codigoDosp: 4932,
      urlDisponibilidade: 'https://www.imprensaoficialmunicipal.com.br/jales',
      dominiosOuTermos: ['jales.sp.gov.br', 'imprensaoficialmunicipal.com.br/jales', 'município de jales']
    },
    opcoes
  );
}
