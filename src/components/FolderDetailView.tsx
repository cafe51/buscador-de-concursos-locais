// src/components/FolderDetailView.tsx
import EditalCard from './EditalCard';
import { exportarParaJSON } from '../utils/exportJson';

type FolderDetailViewProps = {
  grupo: any;
  onBack: () => void;
};

function formatarNomeArquivo(nome: string) {
  return nome.replace(/[\/\s]/g, '-').toLowerCase();
}

export default function FolderDetailView({ grupo, onBack }: FolderDetailViewProps) {
  return (
    <div className="animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <button onClick={onBack} className="flex items-center gap-2 text-indigo-400 hover:text-indigo-300 font-semibold transition-colors">
          <span>←</span> Voltar para as Pastas
        </button>
        {process.env.NODE_ENV === 'development' && (
          <button
            onClick={() => exportarParaJSON(grupo.itens, formatarNomeArquivo(`${grupo.cidade}-${grupo.nome}`))}
            className="w-full sm:w-auto bg-neutral-800 text-purple-400 border border-purple-500/30 hover:bg-purple-500/10 px-4 py-2 rounded-xl text-sm font-bold transition-colors"
          >
            📥 Baixar Arquivos Deste Concurso
          </button>
        )}
      </div>

      <div className="bg-purple-500/10 border border-purple-500/30 p-6 rounded-xl mb-6">
        <div className="flex items-center gap-2 mb-2">
          <span className="bg-indigo-500/10 text-indigo-400 text-xs font-bold px-2 py-1 rounded-lg border border-indigo-500/30">🏛️ {grupo.orgao}</span>
        </div>
        <h2 className="text-2xl font-bold text-purple-300">{grupo.nome}</h2>
        <p className="text-purple-400/70 mt-1">Todos os {grupo.totalItens} andamentos encontrados para {grupo.cidade}.</p>
      </div>

      <div className="space-y-4">
        {grupo.itens.map((edital: any, index: number) => (
          <EditalCard key={index} edital={edital} />
        ))}
      </div>
    </div>
  );
}