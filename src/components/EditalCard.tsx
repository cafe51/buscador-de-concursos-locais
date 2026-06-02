// src/components/EditalCard.tsx
import { Edital } from '../types';

export default function EditalCard({ edital }: { edital: Edital }) {
  return (
    <a
      href={edital.link}
      target="_blank"
      rel="noopener noreferrer"
      className="block bg-white/80 backdrop-blur-xl p-6 rounded-xl border border-slate-200 hover:border-indigo-300 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 relative overflow-hidden group"
    >
      <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-3 mb-3">
        <div className="flex flex-wrap gap-2">

          <span className="bg-indigo-50 text-indigo-700 border border-indigo-100 text-xs font-bold px-2 py-1 rounded-lg">
            📍 {edital.cidade}
          </span>

          <span className="bg-purple-50 text-purple-700 border border-purple-100 text-xs font-bold px-2 py-1 rounded-lg">
            🏛️ {edital.orgao}
          </span>

          {edital.statusGeral && (
            <span className={`text-xs font-bold px-2 py-1 rounded-lg border ${edital.statusGeral === 'Aberto' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
              edital.statusGeral === 'Em Andamento' ? 'bg-sky-50 text-sky-700 border-sky-200' :
                edital.statusGeral === 'Em Julgamento' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                  'bg-violet-50 text-violet-700 border-violet-200'
              }`}>
              📌 {edital.statusGeral}
            </span>
          )}

          {edital.metadados && edital.metadados.length > 0 && (
            edital.metadados.map((meta, idx) => (
              <span key={idx} className="bg-slate-100 text-slate-600 text-xs font-semibold px-2 py-1 rounded-lg border border-slate-200">
                📄 {meta}
              </span>
            ))
          )}

          {edital.dadosEnriquecidos?.concurso || edital.concurso ? (
            <span className="bg-violet-50 text-violet-700 border border-violet-200 text-xs font-bold px-2 py-1 rounded-lg">
              🗂️ {edital.dadosEnriquecidos?.concurso ? '✨ ' : ''}{edital.dadosEnriquecidos?.concurso || edital.concurso}
            </span>
          ) : null}
        </div>

        {edital.dadosEnriquecidos?.dataPublicacao || edital.dataPublicacao ? (
          <span className="text-xs font-medium text-slate-500 bg-slate-50 px-2 py-1 rounded-lg shrink-0 w-fit border border-slate-200">
            📅 {edital.dadosEnriquecidos?.dataPublicacao ? '✨ ' : ''}{edital.dadosEnriquecidos?.dataPublicacao || edital.dataPublicacao}
          </span>
        ) : null}
      </div>

      <h2 className="text-lg font-semibold text-slate-800 pr-4 group-hover:text-indigo-700 transition-colors">
        {edital.dadosEnriquecidos?.titulo || edital.titulo}
      </h2>

      {(edital.dadosEnriquecidos?.descricao || edital.descricao) && (
        <p className="mt-2 text-sm text-slate-500 line-clamp-2 leading-relaxed">
          {edital.dadosEnriquecidos?.descricao || edital.descricao}
        </p>
      )}

      <div className="mt-3 flex justify-end">
        <span className="text-sm text-indigo-600 font-medium group-hover:text-indigo-800 transition-colors">
          Ver documento original →
        </span>
      </div>
    </a>
  );
}