import { Edital } from '../types';

export default function EditalCard({ edital }: { edital: Edital }) {
  return (
    <a
      href={edital.link}
      target="_blank"
      rel="noopener noreferrer"
      className="block bg-white p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow border-l-4 border-blue-600 relative overflow-hidden group"
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex flex-wrap gap-2">

          <span className="bg-blue-100 text-blue-800 border border-blue-200 text-xs font-bold px-2 py-1 rounded">
            📍 {edital.cidade}
          </span>

          {/* NOVA ETIQUETA PARA O ÓRGÃO */}
          <span className="bg-indigo-100 text-indigo-800 border border-indigo-200 text-xs font-bold px-2 py-1 rounded">
            🏛️ {edital.orgao}
          </span>

          {edital.statusGeral && (
            <span className={`text-xs font-bold px-2 py-1 rounded border ${edital.statusGeral === 'Aberto' ? 'bg-green-100 text-green-800 border-green-200' :
                edital.statusGeral === 'Em Andamento' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                  edital.statusGeral === 'Em Julgamento' ? 'bg-orange-100 text-orange-800 border-orange-200' :
                    'bg-purple-100 text-purple-800 border-purple-200'
              }`}>
              📌 {edital.statusGeral}
            </span>
          )}

          {edital.metadados && (
            <span className="bg-gray-100 text-gray-600 text-xs font-semibold px-2 py-1 rounded border border-gray-200">
              📄 {edital.metadados}
            </span>
          )}
        </div>

        {edital.dataPublicacao && (
          <span className="text-xs font-medium text-gray-400 bg-gray-50 px-2 py-1 rounded">
            🗓️ {edital.dataPublicacao}
          </span>
        )}
      </div>

      <h2 className="text-lg font-semibold text-gray-800 pr-4">
        {edital.titulo}
      </h2>

      {edital.descricao && (
        <p className="mt-2 text-sm text-gray-600 line-clamp-2 leading-relaxed">
          {edital.descricao}
        </p>
      )}

      <div className="mt-3 flex justify-end">
        <span className="text-sm text-blue-600 font-medium group-hover:underline">
          Ver documento original →
        </span>
      </div>
    </a>
  );
}