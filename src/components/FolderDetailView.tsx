// src/components/FolderDetailView.tsx
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import EditalCard from './EditalCard';
import { exportarParaJSON } from '../utils/exportJson';
import { enriquecerArquivosAction, reverterEnriquecimentoAction } from '../app/actions';

type FolderDetailViewProps = {
  grupo: any;
  onBack: () => void;
  onUpdateGlobal?: (link: string, novosDados: any | null) => void;
};

function formatarNomeArquivo(nome: string) {
  return nome.replace(/[\/\s]/g, '-').toLowerCase();
}

export default function FolderDetailView({ grupo, onBack, onUpdateGlobal }: FolderDetailViewProps) {
  const [isEnriching, setIsEnriching] = useState(false);
  const [isEnrichMode, setIsEnrichMode] = useState(false);
  const [selectedLinks, setSelectedLinks] = useState<string[]>([]);
  const [localItens, setLocalItens] = useState<any[]>([]);
  const [revertingLink, setRevertingLink] = useState<string | null>(null);
  const [confirmRevertLink, setConfirmRevertLink] = useState<string | null>(null);

  useEffect(() => {
    // Inicializar selecionados apenas os NÃO enriquecidos
    if (grupo && grupo.itens) {
      setLocalItens(grupo.itens);
      const naoEnriquecidos = grupo.itens
        .filter((item: any) => !(item.dadosEnriquecidos && Object.keys(item.dadosEnriquecidos).length > 0))
        .map((item: any) => item.link);
      setSelectedLinks(naoEnriquecidos);
    }
  }, [grupo]);

  const toggleLink = (link: string) => {
    if (selectedLinks.includes(link)) {
      setSelectedLinks(selectedLinks.filter(l => l !== link));
    } else {
      setSelectedLinks([...selectedLinks, link]);
    }
  };

  const selectAll = () => {
    const naoEnriquecidos = localItens
      .filter((item: any) => !(item.dadosEnriquecidos && Object.keys(item.dadosEnriquecidos).length > 0))
      .map((item: any) => item.link);
    setSelectedLinks(naoEnriquecidos);
  };
  const deselectAll = () => setSelectedLinks([]);

  function handleReverterEnriquecimento(link: string) {
    setConfirmRevertLink(link);
  }

  async function executeRevert(link: string) {
    setConfirmRevertLink(null);
    setRevertingLink(link);
    try {
      const res = await reverterEnriquecimentoAction(link);
      if (res.sucesso) {
        if (onUpdateGlobal) onUpdateGlobal(link, null);

        setLocalItens(prev => prev.map(item => {
          if (item.link === link) {
            const newItem = { ...item };
            delete newItem.dadosEnriquecidos;
            return newItem;
          }
          return item;
        }));
      } else {
        alert("Falha ao reverter enriquecimento no banco de dados.");
      }
    } catch (e) {
      console.error(e);
      alert("Erro ao comunicar com o servidor.");
    } finally {
      setRevertingLink(null);
    }
  }

  async function handleEnriquecer() {
    const itemsParaEnriquecer = localItens.filter((item: any) => selectedLinks.includes(item.link));
    if (itemsParaEnriquecer.length === 0) {
      alert("Selecione pelo menos um documento para enriquecer.");
      return;
    }

    setIsEnriching(true);
    try {
      const result = await enriquecerArquivosAction(itemsParaEnriquecer);
      if (result.sucesso) {
        if (result.count > 0 && result.atualizados) {
          if (onUpdateGlobal) {
            result.atualizados.forEach((a: any) => {
              onUpdateGlobal(a.link, a.dadosEnriquecidos);
            });
          }

          setLocalItens(prev => prev.map(item => {
            const atualizado = result.atualizados.find((a: any) => a.link === item.link);
            if (atualizado) {
              return { ...item, dadosEnriquecidos: atualizado.dadosEnriquecidos };
            }
            return item;
          }));

          const atualizadosMap = new Map();
          result.atualizados.forEach((e: any) => atualizadosMap.set(e.link, e));
          setSelectedLinks((prev) => prev.filter(link => !atualizadosMap.has(link)));

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
              onClick={() => exportarParaJSON(localItens, formatarNomeArquivo(`${grupo.cidade}-${grupo.nome}`))}
              className="w-full sm:w-auto bg-white text-purple-700 border border-purple-200 hover:bg-purple-50 px-4 py-2 rounded-xl text-sm font-bold transition-colors shadow-sm"
            >
              📥 Baixar Arquivos Deste Concurso
            </button>
            <button
              onClick={() => setIsEnrichMode(!isEnrichMode)}
              className={`w-full sm:w-auto text-white border px-4 py-2 rounded-xl text-sm font-bold transition-colors shadow-sm flex items-center justify-center gap-2 ${isEnrichMode
                  ? 'bg-slate-500 border-slate-600 hover:bg-slate-600'
                  : 'bg-emerald-600 border-emerald-700 hover:bg-emerald-700'
                }`}
            >
              <span>🧠</span>
              {isEnrichMode ? 'Fechar Painel de IA' : 'Enriquecer Arquivos Deste Concurso'}
            </button>
          </div>
        )}
      </div>

      {process.env.NODE_ENV === 'development' && isEnrichMode && (
        <div className="bg-white/90 backdrop-blur-xl border border-slate-200 p-4 rounded-2xl shadow-xl w-full mt-2 mb-6 animate-fade-in flex flex-col gap-3">
          <h3 className="font-bold text-indigo-700 mb-1 flex items-center gap-2">⚙️ Seleção de Arquivos para IA</h3>
          <p className="text-xs text-slate-500">
            Selecione quais documentos deste concurso você deseja enviar para o Gemini.
            Arquivos que já foram enriquecidos serão ignorados automaticamente no servidor.
          </p>
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-col gap-2">
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm font-bold text-slate-700">Documentos ({selectedLinks.length}/{localItens.length})</span>
              <div className="flex gap-2">
                <button onClick={selectAll} className="text-xs text-indigo-600 hover:underline">Todos</button>
                <button onClick={deselectAll} className="text-xs text-indigo-600 hover:underline">Nenhum</button>
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1 pr-2">
              {localItens.map((edital: any) => {
                const isEnriquecido = edital.dadosEnriquecidos && Object.keys(edital.dadosEnriquecidos).length > 0;
                return (
                  <div key={edital.link} className={`flex items-start gap-2 text-xs p-2 rounded border transition-colors group ${
                    isEnriquecido 
                      ? 'bg-emerald-50 border-emerald-200' 
                      : 'bg-transparent border-transparent hover:bg-slate-100'
                  }`}>
                    <label className={`flex items-start gap-2 flex-1 ${isEnriquecido ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                      <input 
                        type="checkbox" 
                        checked={selectedLinks.includes(edital.link)} 
                        disabled={isEnriquecido}
                        onChange={() => !isEnriquecido && toggleLink(edital.link)} 
                        className="rounded text-indigo-600 focus:ring-indigo-500 mt-0.5 disabled:opacity-40 shrink-0" 
                      />
                      <div className="flex flex-col">
                        <span className={`font-medium ${isEnriquecido ? 'text-emerald-900' : 'text-slate-800'}`}>
                          {edital.titulo}
                        </span>
                        {isEnriquecido && edital.dadosEnriquecidos?.titulo && (
                          <span className="font-bold text-emerald-600 mt-0.5">
                            Novo: {edital.dadosEnriquecidos.titulo}
                          </span>
                        )}
                      </div>
                    </label>
                    {isEnriquecido && (
                      <button
                        onClick={() => handleReverterEnriquecimento(edital.link)}
                        disabled={revertingLink === edital.link}
                        title="Desfazer IA"
                        className="text-rose-500 hover:text-rose-700 bg-rose-100 hover:bg-rose-200 px-2 py-1.5 rounded transition-colors disabled:opacity-50 shrink-0 font-bold"
                      >
                        {revertingLink === edital.link ? '⏳' : '↩️'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <button
            onClick={handleEnriquecer}
            disabled={isEnriching || selectedLinks.length === 0}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-700 px-4 py-3 rounded-xl text-sm font-bold transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
          >
            {isEnriching ? (
              <>
                <span className="animate-spin inline-block">⏳</span>
                Processando no Servidor...
              </>
            ) : (
              <>
                <span>🚀</span>
                Rodar Enriquecimento na Seleção
              </>
            )}
          </button>
        </div>
      )}

      <div className="bg-purple-50 border border-purple-200 p-6 rounded-xl mb-6 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <span className="bg-indigo-100 text-indigo-800 text-xs font-bold px-2 py-1 rounded-lg border border-indigo-200">🏛️ {grupo.orgao}</span>
        </div>
        <h2 className="text-2xl font-bold text-purple-900">{grupo.nome}</h2>
        <p className="text-purple-700 mt-1">Todos os {grupo.totalItens} andamentos encontrados para {grupo.cidade}.</p>
      </div>

      <div className="space-y-4">
        {localItens.map((edital: any, index: number) => (
          <EditalCard key={index} edital={edital} />
        ))}
      </div>

      {confirmRevertLink && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 relative">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-500 flex items-center justify-center text-2xl mb-4 shrink-0">
              ⚠️
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">Desfazer Enriquecimento?</h3>
            <p className="text-sm text-slate-600 mb-6">
              Tem certeza que deseja remover os dados gerados pela IA deste documento? Ele voltará ao estado original.
            </p>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 mt-auto">
              <button
                onClick={() => setConfirmRevertLink(null)}
                className="w-full sm:w-auto px-4 py-3 sm:py-2 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => executeRevert(confirmRevertLink)}
                className="w-full sm:w-auto px-4 py-3 sm:py-2 rounded-xl text-sm font-bold text-white bg-rose-500 hover:bg-rose-600 transition-colors"
              >
                Sim, desfazer
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}