import { Edital } from '../../types';
import { buscarInstarBase } from './instar';

export async function buscarVotuporanga(): Promise<Edital[]> {
  return buscarInstarBase({
    cidade: 'Votuporanga',
    baseUrl: 'https://www.votuporanga.sp.gov.br'
    // Não precisa passar 'basePath' nem 'orgao' porque os valores padrões do motor já servem!
  });
}