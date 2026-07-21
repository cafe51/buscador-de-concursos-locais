import { Edital, ScraperOptions } from '../../../types';
import { buscarDospBase } from './dospEngine';

/**
 * Scraper do Diário Oficial de Estrela d'Oeste (DOSP - Código 4824)
 * Em modo DEV pesquisa o último 1 ano (anosDev: 1).
 */
export async function buscarEstrelaDOesteDiario(opcoes?: ScraperOptions): Promise<Edital[]> {
  return buscarDospBase(
    {
      cidade: "Estrela d'Oeste",
      codigoDosp: 4824,
      urlDisponibilidade: 'https://www.imprensaoficialmunicipal.com.br/estreladoeste',
      dominiosOuTermos: [
        'estreladoeste.sp.gov.br',
        'pmestrela.sp.gov.br',
        'imprensaoficialmunicipal.com.br/estreladoeste',
        "município de estrela d'oeste",
        'município de estrela doeste'
      ],
      anosDev: 1
    },
    opcoes
  );
}
