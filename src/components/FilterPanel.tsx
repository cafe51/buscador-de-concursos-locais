// src/components/FilterPanel.tsx
'use client'
import { useState } from 'react';

type Props = {
  palavrasDesejadas: string[];
  setPalavrasDesejadas: (val: string[]) => void;
  palavrasIgnoradas: string[];
  setPalavrasIgnoradas: (val: string[]) => void;
};

function removerAcentos(texto: string) {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export default function FilterPanel({ palavrasDesejadas, setPalavrasDesejadas, palavrasIgnoradas, setPalavrasIgnoradas }: Props) {
  const [inputDesejada, setInputDesejada] = useState('');
  const [inputIgnorada, setInputIgnorada] = useState('');

  // Lógica aprimorada para aceitar múltiplas palavras separadas por vírgula
  function adicionarDesejada() {
    if (!inputDesejada.trim()) return;

    // Quebra a string nas vírgulas, limpa os espaços e tira os acentos de cada pedaço
    const novasPalavras = inputDesejada
      .split(',')
      .map(p => removerAcentos(p.trim()))
      .filter(p => p !== ''); // Tira vazios caso a pessoa digite "teste,,"

    // O 'Set' junta as listas e apaga automaticamente qualquer palavra repetida!
    const combinadas = Array.from(new Set([...palavrasDesejadas, ...novasPalavras]));

    setPalavrasDesejadas(combinadas);
    setInputDesejada('');
  }

  function adicionarIgnorada() {
    if (!inputIgnorada.trim()) return;

    const novasPalavras = inputIgnorada
      .split(',')
      .map(p => removerAcentos(p.trim()))
      .filter(p => p !== '');

    const combinadas = Array.from(new Set([...palavrasIgnoradas, ...novasPalavras]));

    setPalavrasIgnoradas(combinadas);
    setInputIgnorada('');
  }

  return (
    <section className="bg-white/80 backdrop-blur-xl border border-slate-200 p-6 rounded-2xl shadow-sm mb-8 grid grid-cols-1 md:grid-cols-2 gap-6">

      {/* PAINEL DE DESEJADAS */}
      <div>
        <h3 className="font-semibold text-emerald-600 mb-2">✅ Palavras Desejadas</h3>
        <div className="flex flex-col sm:flex-row gap-2 mb-3">
          <input
            type="text"
            value={inputDesejada}
            onChange={(e) => setInputDesejada(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && adicionarDesejada()}
            placeholder="Ex: processo seletivo, edital, concurso"
            className="bg-white border border-slate-300 p-2 rounded-xl flex-1 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 text-slate-800 placeholder-slate-400 transition-all shadow-sm"
          />
          <button onClick={adicionarDesejada} className="bg-emerald-600 text-white px-6 py-2 sm:py-0 rounded-xl hover:bg-emerald-700 transition-colors font-semibold shadow-sm">Add</button>
        </div>

        <div className="flex flex-wrap gap-2">
          {palavrasDesejadas.map((p) => (
            <button
              key={p}
              onClick={() => setPalavrasDesejadas(palavrasDesejadas.filter(item => item !== p))}
              title="Clique para remover"
              className="bg-emerald-50 text-emerald-700 text-xs px-3 py-1.5 rounded-full flex items-center gap-2 hover:bg-red-50 hover:text-red-700 hover:line-through transition-colors cursor-pointer group border border-emerald-200 hover:border-red-300"
            >
              {p} <span className="font-bold text-emerald-600 group-hover:text-red-600">x</span>
            </button>
          ))}
        </div>
      </div>

      {/* PAINEL DE IGNORADAS */}
      <div>
        <h3 className="font-semibold text-red-600 mb-2">❌ Palavras Ignoradas</h3>
        <div className="flex flex-col sm:flex-row gap-2 mb-3">
          <input
            type="text"
            value={inputIgnorada}
            onChange={(e) => setInputIgnorada(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && adicionarIgnorada()}
            placeholder="Ex: convocacao, homologacao, gabarito"
            className="bg-white border border-slate-300 p-2 rounded-xl flex-1 text-sm outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/20 text-slate-800 placeholder-slate-400 transition-all shadow-sm"
          />
          <button onClick={adicionarIgnorada} className="bg-red-600 text-white px-6 py-2 sm:py-0 rounded-xl hover:bg-red-700 transition-colors font-semibold shadow-sm">Add</button>
        </div>

        <div className="flex flex-wrap gap-2">
          {palavrasIgnoradas.map((p) => (
            <button
              key={p}
              onClick={() => setPalavrasIgnoradas(palavrasIgnoradas.filter(item => item !== p))}
              title="Clique para remover"
              className="bg-red-50 text-red-700 text-xs px-3 py-1.5 rounded-full flex items-center gap-2 hover:bg-red-100 hover:text-red-800 hover:line-through transition-colors cursor-pointer group border border-red-200 hover:border-red-300"
            >
              {p} <span className="font-bold text-red-600 group-hover:text-red-800">x</span>
            </button>
          ))}
        </div>
      </div>

    </section>
  );
}