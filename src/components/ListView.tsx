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
      <p className="text-sm text-neutral-400 text-right">Mostrando {totalFiltrados} resultados</p>
      {editais.map((edital, index) => <EditalCard key={index} edital={edital} />)}

      <div className="mt-8 flex justify-center items-center gap-4">
        <button
          onClick={() => setPaginaAtual(p => Math.max(1, p - 1))}
          disabled={paginaAtual === 1}
          className="px-4 py-2 rounded-xl bg-neutral-800 text-neutral-200 border border-neutral-700 hover:bg-neutral-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >← Anterior</button>
        <span className="text-neutral-400 font-medium">Página {paginaAtual} de {totalPaginas}</span>
        <button
          onClick={() => setPaginaAtual(p => Math.min(totalPaginas, p + 1))}
          disabled={paginaAtual === totalPaginas}
          className="px-4 py-2 rounded-xl bg-neutral-800 text-neutral-200 border border-neutral-700 hover:bg-neutral-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >Próxima →</button>
      </div>
    </div>
  );
}