// src/components/ListView.tsx
import { Edital } from '../types';
import EditalCard from './EditalCard';

type ListViewProps = {
  editais: Edital[];
  totalFiltrados: number;
  paginaAtual: number;
  setPaginaAtual: (p: number | ((prev: number) => number)) => void;
  totalPaginas: number;
};

export default function ListView({ editais, totalFiltrados, paginaAtual, setPaginaAtual, totalPaginas }: ListViewProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500 text-right">Mostrando {totalFiltrados} resultados</p>
      {editais.map((edital, index) => <EditalCard key={index} edital={edital} />)}

      <div className="mt-8 flex justify-center items-center gap-4">
        <button
          onClick={() => setPaginaAtual(p => Math.max(1, p - 1))}
          disabled={paginaAtual === 1}
          className="px-4 py-2 rounded bg-gray-800 text-white disabled:bg-gray-200 disabled:text-gray-400"
        >← Anterior</button>
        <span className="text-gray-600 font-medium">Página {paginaAtual} de {totalPaginas}</span>
        <button
          onClick={() => setPaginaAtual(p => Math.min(totalPaginas, p + 1))}
          disabled={paginaAtual === totalPaginas}
          className="px-4 py-2 rounded bg-gray-800 text-white disabled:bg-gray-200 disabled:text-gray-400"
        >Próxima →</button>
      </div>
    </div>
  );
}