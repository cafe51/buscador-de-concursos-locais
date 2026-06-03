// src/components/Header.tsx
type HeaderProps = {
  loading: boolean;
  hasData: boolean;
  onExport: () => void;
  onUpdate: () => void;
  ultimaAtualizacao?: string;
};

import ProfileButton from './ProfileButton';
import AdminLogsButton from './AdminLogsButton';
import Link from 'next/link';

export default function Header({ loading, hasData, onExport, onUpdate, ultimaAtualizacao }: HeaderProps) {
  const showDevTools = process.env.NODE_ENV === 'development';

  return (
    <header className="mb-6 flex flex-col md:flex-row md:justify-between md:items-center bg-white/80 backdrop-blur-xl border border-slate-200 p-4 sm:p-6 rounded-2xl shadow-sm gap-4">
      <div className="flex flex-wrap justify-between items-start sm:items-center w-full md:w-auto md:flex-1 gap-4">
        <div>
          <Link href="/" className="inline-block hover:opacity-80 transition-opacity">
            <h1 className="text-2xl md:text-3xl font-bold text-indigo-900">Radar de Concursos 🎯</h1>
          </Link>
          <p className="text-sm md:text-base text-slate-500 mt-1">Monitorando Órgãos Locais e Região</p>
          {ultimaAtualizacao && (
            <p className="text-xs text-emerald-600 mt-1.5 font-medium flex items-center gap-1.5">
              <span>⏰</span> Última atualização automática: {ultimaAtualizacao}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-end">
          <AdminLogsButton />
          <ProfileButton />
        </div>
      </div>
      {showDevTools && (
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <button
            onClick={onExport}
            disabled={loading || !hasData}
            className={`w-full sm:w-auto px-4 py-3 rounded-xl font-bold transition-colors border ${loading || !hasData ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed' : 'bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50 shadow-sm'}`}
            title="Baixar a lista de TODOS os editais filtrados"
          >
            📥 Exportar Tudo
          </button>
          <button
            onClick={onUpdate}
            disabled={loading}
            className={`w-full sm:w-auto px-6 py-3 rounded-xl font-bold text-white transition-all shadow-md ${loading ? 'bg-indigo-400 cursor-wait' : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 hover:shadow-lg'}`}
          >
            {loading ? 'Extraindo...' : '🔄 Atualizar Todos'}
          </button>
        </div>
      )}
    </header>
  );
}