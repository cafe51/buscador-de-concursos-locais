import { Edital, ScraperOptions } from '../../../types';
import { buscarDospBase } from './dospEngine';

/**
 * Scraper do Diário Oficial de Votuporanga (DOSP - Código 5292)
 * Em modo DEV pesquisa o último 1 ano (configurado via anosDev: 1).
 */
export async function buscarVotuporangaDiario(opcoes?: ScraperOptions): Promise<Edital[]> {
  return buscarDospBase(
    {
      cidade: 'Votuporanga',
      codigoDosp: 5292,
      urlDisponibilidade: 'https://www.imprensaoficialmunicipal.com.br/votuporanga',
      dominiosOuTermos: ['votuporanga.sp.gov.br', 'imprensaoficialmunicipal.com.br/votuporanga', 'município de votuporanga'],
      anosDev: 1
    },
    opcoes
  );
}
