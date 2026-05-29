// src/components/EditalCard.tsx
import { Edital } from '../types';

export default function EditalCard({ edital }: { edital: Edital }) {
  return (
    <a
      href={edital.link}
      target="_blank"
      rel="noopener noreferrer"
      className="block bg-neutral-900/50 backdrop-blur-xl p-6 rounded-xl border border-neutral-800 hover:border-indigo-500/50 hover:shadow-lg hover:shadow-indigo-500/5 transition-all duration-200 relative overflow-hidden group"
    >
      <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-3 mb-3">
        <div className="flex flex-wrap gap-2">

          <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 text-xs font-bold px-2 py-1 rounded-lg">
            📍 {edital.cidade}
          </span>

          {/* NOVA ETIQUETA PARA O ÓRGÃO */}
          <span className="bg-purple-500/10 text-purple-400 border border-purple-500/30 text-xs font-bold px-2 py-1 rounded-lg">
            🏛️ {edital.orgao}
          </span>

          {edital.statusGeral && (
            <span className={`text-xs font-bold px-2 py-1 rounded-lg border ${edital.statusGeral === 'Aberto' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
              edital.statusGeral === 'Em Andamento' ? 'bg-sky-500/10 text-sky-400 border-sky-500/30' :
                edital.statusGeral === 'Em Julgamento' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
                  'bg-violet-500/10 text-violet-400 border-violet-500/30'
              }`}>
              📌 {edital.statusGeral}
            </span>
          )}

          {edital.metadados && edital.metadados.length > 0 && (
            edital.metadados.map((meta, idx) => (
              <span key={idx} className="bg-neutral-800 text-neutral-400 text-xs font-semibold px-2 py-1 rounded-lg border border-neutral-700">
                📄 {meta}
              </span>
            ))
          )}

          {edital.concurso && (
            <span className="bg-violet-500/10 text-violet-400 border border-violet-500/30 text-xs font-bold px-2 py-1 rounded-lg">
              🗂️ {edital.concurso}
            </span>
          )}
        </div>

        {edital.dataPublicacao && (
          <span className="text-xs font-medium text-neutral-500 bg-neutral-800 px-2 py-1 rounded-lg shrink-0 w-fit border border-neutral-700">
            📅 {edital.dataPublicacao}
          </span>
        )}
      </div>

      <h2 className="text-lg font-semibold text-neutral-100 pr-4">
        {edital.titulo}
      </h2>

      {edital.descricao && (
        <p className="mt-2 text-sm text-neutral-400 line-clamp-2 leading-relaxed">
          {edital.descricao}
        </p>
      )}

      <div className="mt-3 flex justify-end">
        <span className="text-sm text-indigo-400 font-medium group-hover:text-indigo-300 transition-colors">
          Ver documento original →
        </span>
      </div>
    </a>
  );
}