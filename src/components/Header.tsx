// src/components/Header.tsx
type HeaderProps = {
  loading: boolean;
  hasData: boolean;
  onExport: () => void;
  onUpdate: () => void;
  ultimaAtualizacao?: string;
};

import ProfileButton from './ProfileButton';
import Link from 'next/link';

export default function Header({ loading, hasData, onExport, onUpdate, ultimaAtualizacao }: HeaderProps) {
  const showDevTools = process.env.NODE_ENV === 'development';

  return (
    <header className="mb-6 flex flex-col md:flex-row md:justify-between md:items-center bg-neutral-900/50 backdrop-blur-xl border border-neutral-800 p-4 sm:p-6 rounded-2xl shadow-xl gap-4">
      <div className="flex justify-between items-start w-full">
        <div>
          <Link href="/" className="inline-block hover:opacity-80 transition-opacity">
            <h1 className="text-2xl md:text-3xl font-bold text-white">Radar de Concursos 🎯</h1>
          </Link>
          <p className="text-sm md:text-base text-neutral-400 mt-1">Monitorando Órgãos Locais e Região</p>
          {ultimaAtualizacao && (
            <p className="text-xs text-emerald-400 mt-1.5 font-medium flex items-center gap-1.5">
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
            className={`w-full sm:w-auto px-4 py-3 rounded-xl font-bold transition-colors border ${loading || !hasData ? 'bg-neutral-800/50 text-neutral-600 border-neutral-700 cursor-not-allowed' : 'bg-neutral-800 text-indigo-400 border-neutral-700 hover:bg-neutral-700 hover:text-indigo-300'}`}
            title="Baixar a lista de TODOS os editais filtrados"
          >
            📥 Exportar Tudo
          </button>
          <button
            onClick={onUpdate}
            disabled={loading}
            className={`w-full sm:w-auto px-6 py-3 rounded-xl font-bold text-white transition-colors shadow-sm ${loading ? 'bg-indigo-800/50 cursor-wait' : 'bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500'}`}
          >
            {loading ? 'Extraindo...' : '🔄 Atualizar Todos'}
          </button>
        </div>
      )}
    </header>
  );
}