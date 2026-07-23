import { Edital, ScraperOptions } from '../../../types';
import { buscarDospBase } from './dospEngine';

/**
 * Scraper do Diário Oficial de Urânia (DOSP - Código 5276)
 * Configurado com 5 anos para DEV e 2 anos para PRODUÇÃO (anosDev: 5, anosProd: 2).
 */
export async function buscarUraniaDiario(opcoes?: ScraperOptions): Promise<Edital[]> {
  return buscarDospBase(
    {
      cidade: 'Urânia',
      codigoDosp: 5276,
      urlDisponibilidade: 'https://www.imprensaoficialmunicipal.com.br/urania',
      dominiosOuTermos: [
        'urania.sp.gov.br',
        'imprensaoficialmunicipal.com.br/urania',
        'município de urânia',
        'urânia'
      ],
      anosDev: 5,
      anosProd: 2
    },
    opcoes
  );
}
