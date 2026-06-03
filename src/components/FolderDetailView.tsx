// src/components/FolderDetailView.tsx
import { useState } from 'react';
import EditalCard from './EditalCard';
import { exportarParaJSON } from '../utils/exportJson';
import { enriquecerArquivosAction } from '../app/actions';

type FolderDetailViewProps = {
  grupo: any;
  onBack: () => void;
};

function formatarNomeArquivo(nome: string) {
  return nome.replace(/[\/\s]/g, '-').toLowerCase();
}

export default function FolderDetailView({ grupo, onBack }: FolderDetailViewProps) {
  const [isEnriching, setIsEnriching] = useState(false);

  async function handleEnriquecer() {
    setIsEnriching(true);
    try {
      const result = await enriquecerArquivosAction(grupo.itens);
      if (result.sucesso) {
        if (result.count > 0) {
          alert(`${result.count} arquivo(s) enriquecido(s) com sucesso!\n\nVerifique o console do terminal e do navegador para ver os links afetados.`);
          console.log("Editais enriquecidos:", result.links);
        } else {
          alert("Todos os editais deste concurso já estão enriquecidos, ou a IA falhou. Verifique os logs do servidor.");
        }
      } else {
        alert("Falha ao enriquecer arquivos.");
      }
    } catch (e) {
      console.error(e);
      alert("Erro ao comunicar com o servidor.");
    } finally {
      setIsEnriching(false);
    }
  }

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <button onClick={onBack} className="flex items-center gap-2 text-indigo-600 hover:text-indigo-800 font-semibold transition-colors">
          <span>←</span> Voltar para as Pastas
        </button>
        {process.env.NODE_ENV === 'development' && (
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <button
              onClick={() => exportarParaJSON(grupo.itens, formatarNomeArquivo(`${grupo.cidade}-${grupo.nome}`))}
              className="w-full sm:w-auto bg-white text-purple-700 border border-purple-200 hover:bg-purple-50 px-4 py-2 rounded-xl text-sm font-bold transition-colors shadow-sm"
            >
              📥 Baixar Arquivos Deste Concurso
            </button>
            <button
              onClick={handleEnriquecer}
              disabled={isEnriching}
              className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-700 px-4 py-2 rounded-xl text-sm font-bold transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isEnriching ? (
                <>
                  <span className="animate-spin inline-block">⏳</span>
                  Enriquecendo...
                </>
              ) : (
                <>
                  <span>🧠</span>
                  Enriquecer Arquivos Deste Concurso
                </>
              )}
            </button>
          </div>
        )}
      </div>

      <div className="bg-purple-50 border border-purple-200 p-6 rounded-xl mb-6 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <span className="bg-indigo-100 text-indigo-800 text-xs font-bold px-2 py-1 rounded-lg border border-indigo-200">🏛️ {grupo.orgao}</span>
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