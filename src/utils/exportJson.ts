import { Edital } from '../types';

export function exportarParaJSON(dados: Edital[], prefixoNome: string = 'editais-filtrados') {
  if (!dados || dados.length === 0) {
    alert("Não há dados para exportar com os filtros atuais.");
    return;
  }

  // 1. Transforma o array em string JSON
  const jsonString = JSON.stringify(dados, null, 2);

  // 2. Cria o arquivo em memória
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  // 3. Monta o link para forçar o download
  const link = document.createElement('a');
  link.href = url;

  const dataHoje = new Date().toISOString().split('T')[0];
  link.download = `${prefixoNome}-${dataHoje}.json`;

  // 4. Executa o clique e limpa a memória
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}