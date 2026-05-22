// src/components/Header.tsx
type HeaderProps = {
  loading: boolean;
  hasData: boolean;
  onExport: () => void;
  onUpdate: () => void;
};

export default function Header({ loading, hasData, onExport, onUpdate }: HeaderProps) {
  return (
    <header className="mb-6 flex flex-col md:flex-row md:justify-between md:items-center bg-white p-6 rounded-lg shadow-sm border border-gray-100 gap-4">
      <div>
        <h1 className="text-3xl font-bold text-blue-900">Radar de Concursos 🎯</h1>
        <p className="text-gray-500 mt-1">Monitorando Órgãos Locais e Região</p>
      </div>
      <div className="flex gap-4">
        <button
          onClick={onExport}
          disabled={loading || !hasData}
          className={`px-4 py-3 rounded font-bold transition-colors border ${loading || !hasData ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' : 'bg-white text-blue-600 border-blue-200 hover:bg-blue-50'}`}
          title="Baixar a lista de TODOS os editais filtrados"
        >
          📥 Exportar Tudo
        </button>
        <button
          onClick={onUpdate}
          disabled={loading}
          className={`px-6 py-3 rounded font-bold text-white transition-colors ${loading ? 'bg-blue-300 cursor-wait' : 'bg-blue-600 hover:bg-blue-700'}`}
        >
          {loading ? 'Extraindo dados...' : '🔄 Atualizar Todos'}
        </button>
      </div>
    </header>
  );
}