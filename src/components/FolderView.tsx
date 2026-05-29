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
        <p className="text-sm text-neutral-400">{concursosAgrupados.length} pastas encontradas</p>
        <div className="bg-neutral-800 border border-neutral-700 p-1 rounded-xl inline-flex w-full sm:w-auto overflow-x-auto">
          <button onClick={() => setFiltroTipoGrupo('todos')} className={`flex-1 sm:flex-none px-3 py-1 text-xs font-semibold rounded-lg whitespace-nowrap ${filtroTipoGrupo === 'todos' ? 'bg-indigo-500/20 text-indigo-400' : 'text-neutral-400 hover:text-neutral-200'}`}>Todos</button>
          <button onClick={() => setFiltroTipoGrupo('concurso')} className={`flex-1 sm:flex-none px-3 py-1 text-xs font-semibold rounded-lg whitespace-nowrap ${filtroTipoGrupo === 'concurso' ? 'bg-indigo-500/20 text-indigo-400' : 'text-neutral-400 hover:text-neutral-200'}`}>Concursos</button>
          <button onClick={() => setFiltroTipoGrupo('seletivo')} className={`flex-1 sm:flex-none px-3 py-1 text-xs font-semibold rounded-lg whitespace-nowrap ${filtroTipoGrupo === 'seletivo' ? 'bg-indigo-500/20 text-indigo-400' : 'text-neutral-400 hover:text-neutral-200'}`}>Procs. Seletivos</button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {concursosAgrupados.length === 0 ? (
          <div className="col-span-full bg-neutral-900/50 backdrop-blur-xl border border-neutral-800 p-6 rounded-xl text-center text-neutral-400">Nenhum concurso atende ao filtro atual.</div>
        ) : (
          concursosAgrupados.map((grupo, idx) => (
            <div key={idx} onClick={() => onSelectFolder(grupo.chaveUnica)} className="bg-neutral-900/50 backdrop-blur-xl p-6 rounded-xl border border-neutral-800 hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-500/5 transition-all duration-200 cursor-pointer group flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-4">
                  <span className="bg-purple-500/10 text-purple-400 text-xs font-bold px-3 py-1 rounded-full border border-purple-500/30">🗂️ {grupo.nome}</span>
                  <span className="bg-neutral-800 text-neutral-400 text-xs font-semibold px-3 py-1 rounded-full border border-neutral-700 whitespace-nowrap">{grupo.totalItens} {grupo.totalItens === 1 ? 'item' : 'itens'}</span>
                </div>
                <h3 className="text-lg font-bold text-neutral-100 group-hover:text-purple-400 transition-colors">{grupo.nome}</h3>
              </div>
              <div className="mt-6 flex flex-col gap-2 text-sm text-neutral-500 border-t border-neutral-800 pt-4">
                <div className="flex items-center gap-2 text-indigo-400 font-medium"><span>🏛️</span> {grupo.orgao}</div>
                <div className="flex items-center gap-2"><span>📍</span> {grupo.cidade}</div>
                <div className="flex items-center gap-2"><span>🕒</span> <span className="font-semibold text-neutral-300">Atualizado em: {grupo.ultimaAtualizacao}</span></div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}