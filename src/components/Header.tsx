// src/components/Header.tsx
type HeaderProps = {
  loading: boolean;
  hasData: boolean;
  onExport: () => void;
  onUpdate: () => void;
  ultimaAtualizacao?: string;
};

import ProfileButton from './ProfileButton';

export default function Header({ loading, hasData, onExport, onUpdate, ultimaAtualizacao }: HeaderProps) {
  const showDevTools = process.env.NODE_ENV === 'development';

  return (
    <header className="mb-6 flex flex-col md:flex-row md:justify-between md:items-center bg-white p-4 sm:p-6 rounded-lg shadow-sm border border-gray-100 gap-4">
      <div className="flex justify-between items-start w-full">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-blue-900">Radar de Concursos 🎯</h1>
          <p className="text-sm md:text-base text-gray-500 mt-1">Monitorando Órgãos Locais e Região</p>
          {ultimaAtualizacao && (
            <p className="text-xs text-emerald-600 mt-1.5 font-medium flex items-center gap-1.5">
              <span>⏰</span> Última atualização automática: {ultimaAtualizacao}
            </p>
          )}
        </div>
        <ProfileButton />
      </div>
      {showDevTools && (
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <button
            onClick={onExport}
            disabled={loading || !hasData}
            className={`w-full sm:w-auto px-4 py-3 rounded font-bold transition-colors border ${loading || !hasData ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' : 'bg-white text-blue-600 border-blue-200 hover:bg-blue-50'}`}
            title="Baixar a lista de TODOS os editais filtrados"
          >
            📥 Exportar Tudo
          </button>
          <button
            onClick={onUpdate}
            disabled={loading}
            className={`w-full sm:w-auto px-6 py-3 rounded font-bold text-white transition-colors shadow-sm ${loading ? 'bg-blue-300 cursor-wait' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            {loading ? 'Extraindo...' : '🔄 Atualizar Todos'}
          </button>
        </div>
      )}
    </header>
  );
}