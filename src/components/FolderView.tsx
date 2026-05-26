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
        <p className="text-sm text-gray-500">{concursosAgrupados.length} pastas encontradas</p>
        <div className="bg-white border border-gray-200 p-1 rounded inline-flex shadow-sm w-full sm:w-auto overflow-x-auto">
          <button onClick={() => setFiltroTipoGrupo('todos')} className={`flex-1 sm:flex-none px-3 py-1 text-xs font-semibold rounded whitespace-nowrap ${filtroTipoGrupo === 'todos' ? 'bg-gray-100 text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}>Todos</button>
          <button onClick={() => setFiltroTipoGrupo('concurso')} className={`flex-1 sm:flex-none px-3 py-1 text-xs font-semibold rounded whitespace-nowrap ${filtroTipoGrupo === 'concurso' ? 'bg-gray-100 text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}>Concursos</button>
          <button onClick={() => setFiltroTipoGrupo('seletivo')} className={`flex-1 sm:flex-none px-3 py-1 text-xs font-semibold rounded whitespace-nowrap ${filtroTipoGrupo === 'seletivo' ? 'bg-gray-100 text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}>Procs. Seletivos</button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {concursosAgrupados.length === 0 ? (
          <div className="col-span-full bg-white p-6 rounded-lg shadow text-center text-gray-500 border border-gray-100">Nenhum concurso atende ao filtro atual.</div>
        ) : (
          concursosAgrupados.map((grupo, idx) => (
            <div key={idx} onClick={() => onSelectFolder(grupo.chaveUnica)} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:border-purple-400 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-4">
                  <span className="bg-purple-100 text-purple-800 text-xs font-bold px-3 py-1 rounded-full">🗂️ {grupo.nome}</span>
                  <span className="bg-gray-100 text-gray-600 text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap">{grupo.totalItens} {grupo.totalItens === 1 ? 'item' : 'itens'}</span>
                </div>
                <h3 className="text-lg font-bold text-gray-800 group-hover:text-purple-700 transition-colors">{grupo.nome}</h3>
              </div>
              <div className="mt-6 flex flex-col gap-2 text-sm text-gray-500 border-t border-gray-100 pt-4">
                <div className="flex items-center gap-2 text-indigo-700 font-medium"><span>🏛️</span> {grupo.orgao}</div>
                <div className="flex items-center gap-2"><span>📍</span> {grupo.cidade}</div>
                <div className="flex items-center gap-2"><span>🕒</span> <span className="font-semibold text-gray-700">Atualizado em: {grupo.ultimaAtualizacao}</span></div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}