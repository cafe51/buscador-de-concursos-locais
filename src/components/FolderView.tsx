// src/components/FolderView.tsx
type FolderViewProps = {
  concursosAgrupados: any[];
  filtroTipoGrupo: 'todos' | 'concurso' | 'seletivo';
  setFiltroTipoGrupo: (tipo: 'todos' | 'concurso' | 'seletivo') => void;
  onSelectFolder: (chave: string) => void;
};

export default function FolderView({ concursosAgrupados, filtroTipoGrupo, setFiltroTipoGrupo, onSelectFolder }: FolderViewProps) {
  return (
    <div className="animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between sm:items-end mb-4 gap-4">
        <p className="text-sm text-slate-500">{concursosAgrupados.length} pastas encontradas</p>
        <div className="bg-white border border-slate-200 p-1 rounded-xl inline-flex w-full sm:w-auto overflow-x-auto shadow-sm">
          <button onClick={() => setFiltroTipoGrupo('todos')} className={`flex-1 sm:flex-none px-3 py-1 text-xs font-semibold rounded-lg whitespace-nowrap ${filtroTipoGrupo === 'todos' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}>Todos</button>
          <button onClick={() => setFiltroTipoGrupo('concurso')} className={`flex-1 sm:flex-none px-3 py-1 text-xs font-semibold rounded-lg whitespace-nowrap ${filtroTipoGrupo === 'concurso' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}>Concursos</button>
          <button onClick={() => setFiltroTipoGrupo('seletivo')} className={`flex-1 sm:flex-none px-3 py-1 text-xs font-semibold rounded-lg whitespace-nowrap ${filtroTipoGrupo === 'seletivo' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}>Procs. Seletivos</button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {concursosAgrupados.length === 0 ? (
          <div className="col-span-full bg-white/80 backdrop-blur-xl border border-slate-200 p-6 rounded-xl text-center text-slate-500 shadow-sm">Nenhum concurso atende ao filtro atual.</div>
        ) : (
          concursosAgrupados.map((grupo, idx) => {
            const todosEnriquecidos = grupo.itens && grupo.itens.length > 0 && grupo.itens.every((item: any) => item.dadosEnriquecidos && Object.keys(item.dadosEnriquecidos).length > 0);
            
            return (
            <div key={idx} onClick={() => onSelectFolder(grupo.chaveUnica)} className="bg-white/80 backdrop-blur-xl p-6 rounded-xl border border-slate-200 hover:border-purple-300 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-4">
                  <span className="bg-purple-50 text-purple-700 text-xs font-bold px-3 py-1 rounded-full border border-purple-100">🗂️ {todosEnriquecidos ? '✨ ' : ''}{grupo.nome}</span>
                  <span className="bg-slate-100 text-slate-600 text-xs font-semibold px-3 py-1 rounded-full border border-slate-200 whitespace-nowrap">{grupo.totalItens} {grupo.totalItens === 1 ? 'item' : 'itens'}</span>
                </div>
                <h3 className="text-lg font-bold text-slate-800 group-hover:text-purple-700 transition-colors">{grupo.nome}</h3>
              </div>
              <div className="mt-6 flex flex-col gap-2 text-sm text-slate-500 border-t border-slate-100 pt-4">
                <div className="flex items-center gap-2 text-indigo-600 font-medium"><span>🏛️</span> {grupo.orgao}</div>
                <div className="flex items-center gap-2"><span>📍</span> {grupo.cidade}</div>
                <div className="flex items-center gap-2"><span>🕒</span> <span className="font-semibold text-slate-700">Atualizado em: {grupo.ultimaAtualizacao}</span></div>
              </div>
            </div>
            );
          })
        )}
      </div>
    </div>
  );
}