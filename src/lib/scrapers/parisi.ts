// src/lib/scrapers/parisi.ts
import { Edital } from '../../types';
import { buscarInstarBase } from './instar';

export async function buscarParisi(): Promise<Edital[]> {
  return buscarInstarBase({
    cidade: 'Parisi',
    baseUrl: 'https://www.parisi.sp.gov.br',
    // 🚀 PERDÃO CONCEDIDO: O funcionário de Parisi escreveu "Processo Simplificado" 
    // na descrição de um Concurso Público Estatutário (Erro de digitação da prefeitura).
    excecoesPalavrasGlobais: ['simplificado']
  });
}