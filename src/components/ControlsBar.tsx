// src/components/ControlsBar.tsx
type ControlsBarProps = {
  modoVisualizacao: 'lista' | 'agrupado';
  setModoVisualizacao: (modo: 'lista' | 'agrupado') => void;
  onClearSelection: () => void;

  filtroCidade: string;
  setFiltroCidade: (cidade: string) => void;
  cidadesDisponiveis: string[];

  filtroOrgao: string;
  setFiltroOrgao: (orgao: string) => void;
  orgaosDisponiveis: string[];

  filtroAno: number | 'todos';
  setFiltroAno: (ano: number | 'todos') => void;
  anosDisponiveis: number[];
};

export default function ControlsBar({
  modoVisualizacao, setModoVisualizacao, onClearSelection,
  filtroCidade, setFiltroCidade, cidadesDisponiveis,
  filtroOrgao, setFiltroOrgao, orgaosDisponiveis,
  filtroAno, setFiltroAno, anosDisponiveis
}: ControlsBarProps) {
  return (
    <div className="flex flex-col lg:flex-row justify-between items-center mb-8 gap-4">
      <div className="bg-neutral-800 p-1 rounded-xl inline-flex w-full lg:w-auto overflow-hidden shrink-0">
        <button
          onClick={() => { setModoVisualizacao('lista'); onClearSelection(); }}
          className={`flex-1 lg:flex-none px-4 py-2 rounded-lg font-semibold text-sm transition-all ${modoVisualizacao === 'lista' ? 'bg-indigo-500/20 text-indigo-400 shadow-sm' : 'text-neutral-400 hover:text-neutral-200'}`}
        >
          📋 Feed
        </button>
        <button
          onClick={() => setModoVisualizacao('agrupado')}
          className={`flex-1 lg:flex-none px-4 py-2 rounded-lg font-semibold text-sm transition-all ${modoVisualizacao === 'agrupado' ? 'bg-indigo-500/20 text-indigo-400 shadow-sm' : 'text-neutral-400 hover:text-neutral-200'}`}
        >
          🗂️ Agrupados
        </button>
      </div>

      <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-center gap-3 w-full lg:w-auto sm:justify-end">
        {/* FILTRO DE CIDADE */}
        <div className="flex items-center gap-2 bg-neutral-900/50 backdrop-blur-xl px-3 py-2 rounded-xl border border-neutral-800 w-full sm:w-auto">
          <label htmlFor="cidadeFiltro" className="text-sm font-bold text-neutral-400 hidden sm:block">Cidade:</label>
          <span className="sm:hidden text-sm font-bold text-neutral-400">📍</span>
          <select
            id="cidadeFiltro"
            value={filtroCidade}
            onChange={(e) => setFiltroCidade(e.target.value)}
            className="bg-transparent text-sm font-semibold text-indigo-400 outline-none cursor-pointer flex-1 w-full max-w-full sm:max-w-[150px] truncate"
          >
            <option value="todas">Todas as Cidades</option>
            {cidadesDisponiveis.map(cidade => <option key={cidade} value={cidade}>{cidade}</option>)}
          </select>
        </div>

        {/* FILTRO DE ÓRGÃO */}
        <div className="flex items-center gap-2 bg-neutral-900/50 backdrop-blur-xl px-3 py-2 rounded-xl border border-neutral-800 w-full sm:w-auto">
          <label htmlFor="orgaoFiltro" className="text-sm font-bold text-neutral-400 hidden sm:block">Órgão:</label>
          <span className="sm:hidden text-sm font-bold text-neutral-400">🏛️</span>
          <select
            id="orgaoFiltro"
            value={filtroOrgao}
            onChange={(e) => setFiltroOrgao(e.target.value)}
            className="bg-transparent text-sm font-semibold text-indigo-400 outline-none cursor-pointer flex-1 w-full max-w-full sm:max-w-[150px] truncate"
          >
            <option value="todos">Todos os Órgãos</option>
            {orgaosDisponiveis.map(orgao => <option key={orgao} value={orgao}>{orgao}</option>)}
          </select>
        </div>

        {/* FILTRO DE ANO */}
        <div className="flex items-center gap-2 bg-neutral-900/50 backdrop-blur-xl px-3 py-2 rounded-xl border border-neutral-800 w-full sm:w-auto">
          <label htmlFor="anoFiltro" className="text-sm font-bold text-neutral-400 hidden sm:block">Ano:</label>
          <span className="sm:hidden text-sm font-bold text-neutral-400">📅</span>
          <select
            id="anoFiltro"
            value={filtroAno}
            onChange={(e) => setFiltroAno(e.target.value === 'todos' ? 'todos' : parseInt(e.target.value, 10))}
            className="bg-transparent text-sm font-semibold text-indigo-400 outline-none cursor-pointer flex-1 w-full max-w-full sm:max-w-[100px]"
          >
            <option value="todos">Todos</option>
            {anosDisponiveis.map(ano => <option key={ano} value={ano}>{ano}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}