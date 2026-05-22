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
      <div className="bg-gray-200 p-1 rounded-lg inline-flex w-full lg:w-auto overflow-hidden shrink-0">
        <button
          onClick={() => { setModoVisualizacao('lista'); onClearSelection(); }}
          className={`flex-1 lg:flex-none px-4 py-2 rounded-md font-semibold text-sm transition-all ${modoVisualizacao === 'lista' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          📋 Ver Tudo
        </button>
        <button
          onClick={() => setModoVisualizacao('agrupado')}
          className={`flex-1 lg:flex-none px-4 py-2 rounded-md font-semibold text-sm transition-all ${modoVisualizacao === 'agrupado' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          🗂️ Agrupados
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto justify-end">
        {/* FILTRO DE CIDADE */}
        <div className="flex flex-1 sm:flex-none items-center gap-2 bg-white px-3 py-2 rounded-lg border border-gray-200 shadow-sm">
          <label htmlFor="cidadeFiltro" className="text-sm font-bold text-gray-700 hidden sm:block">Cidade:</label>
          <span className="sm:hidden text-sm font-bold text-gray-700">📍</span>
          <select
            id="cidadeFiltro"
            value={filtroCidade}
            onChange={(e) => setFiltroCidade(e.target.value)}
            className="bg-transparent text-sm font-semibold text-blue-700 outline-none cursor-pointer flex-1 w-full max-w-[150px] truncate"
          >
            <option value="todas">Todas as Cidades</option>
            {cidadesDisponiveis.map(cidade => <option key={cidade} value={cidade}>{cidade}</option>)}
          </select>
        </div>

        {/* 🚀 NOVO: FILTRO DE ÓRGÃO */}
        <div className="flex flex-1 sm:flex-none items-center gap-2 bg-white px-3 py-2 rounded-lg border border-gray-200 shadow-sm">
          <label htmlFor="orgaoFiltro" className="text-sm font-bold text-gray-700 hidden sm:block">Órgão:</label>
          <span className="sm:hidden text-sm font-bold text-gray-700">🏛️</span>
          <select
            id="orgaoFiltro"
            value={filtroOrgao}
            onChange={(e) => setFiltroOrgao(e.target.value)}
            className="bg-transparent text-sm font-semibold text-blue-700 outline-none cursor-pointer flex-1 w-full max-w-[150px] truncate"
          >
            <option value="todos">Todos os Órgãos</option>
            {orgaosDisponiveis.map(orgao => <option key={orgao} value={orgao}>{orgao}</option>)}
          </select>
        </div>

        {/* FILTRO DE ANO */}
        <div className="flex flex-1 sm:flex-none items-center gap-2 bg-white px-3 py-2 rounded-lg border border-gray-200 shadow-sm">
          <label htmlFor="anoFiltro" className="text-sm font-bold text-gray-700 hidden sm:block">Ano:</label>
          <span className="sm:hidden text-sm font-bold text-gray-700">📅</span>
          <select
            id="anoFiltro"
            value={filtroAno}
            onChange={(e) => setFiltroAno(e.target.value === 'todos' ? 'todos' : parseInt(e.target.value, 10))}
            className="bg-transparent text-sm font-semibold text-blue-700 outline-none cursor-pointer flex-1 w-full"
          >
            <option value="todos">Todos</option>
            {anosDisponiveis.map(ano => <option key={ano} value={ano}>{ano}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}