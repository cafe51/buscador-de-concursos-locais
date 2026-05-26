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
        <button onClick={onBack} className="flex items-center gap-2 text-blue-600 hover:text-blue-800 font-semibold transition-colors">
          <span>←</span> Voltar para as Pastas
        </button>
        {process.env.NODE_ENV === 'development' && (
          <button
            onClick={() => exportarParaJSON(grupo.itens, formatarNomeArquivo(`${grupo.cidade}-${grupo.nome}`))}
            className="w-full sm:w-auto bg-white text-purple-700 border border-purple-300 hover:bg-purple-50 px-4 py-2 rounded text-sm font-bold shadow-sm transition-colors"
          >
            📥 Baixar Arquivos Deste Concurso
          </button>
        )}
      </div>

      <div className="bg-purple-50 border-l-4 border-purple-600 p-6 rounded-lg mb-6 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <span className="bg-indigo-100 text-indigo-800 text-xs font-bold px-2 py-1 rounded">🏛️ {grupo.orgao}</span>
        </div>
        <h2 className="text-2xl font-bold text-purple-900">{grupo.nome}</h2>
        <p className="text-purple-700 mt-1">Todos os {grupo.totalItens} andamentos encontrados para {grupo.cidade}.</p>
      </div>

      <div className="space-y-4">
        {grupo.itens.map((edital: any, index: number) => (
          <EditalCard key={index} edital={edital} />
        ))}
      </div>
    </div>
  );
}