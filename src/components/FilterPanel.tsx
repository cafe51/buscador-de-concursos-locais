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
    <section className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 mb-8 grid grid-cols-1 md:grid-cols-2 gap-6">

      {/* PAINEL DE DESEJADAS */}
      <div>
        <h3 className="font-semibold text-green-700 mb-2">✅ Palavras Desejadas</h3>
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={inputDesejada}
            onChange={(e) => setInputDesejada(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && adicionarDesejada()}
            placeholder="Ex: processo seletivo, edital, concurso"
            className="border p-2 rounded flex-1 text-sm outline-none focus:border-green-500"
          />
          <button onClick={adicionarDesejada} className="bg-green-600 text-white px-4 rounded hover:bg-green-700 transition-colors">Add</button>
        </div>

        <div className="flex flex-wrap gap-2">
          {palavrasDesejadas.map((p) => (
            <button
              key={p}
              onClick={() => setPalavrasDesejadas(palavrasDesejadas.filter(item => item !== p))}
              title="Clique para remover"
              className="bg-green-100 text-green-800 text-xs px-3 py-1.5 rounded flex items-center gap-2 hover:bg-red-100 hover:text-red-800 hover:line-through transition-colors cursor-pointer group"
            >
              {p} <span className="font-bold text-green-600 group-hover:text-red-600">x</span>
            </button>
          ))}
        </div>
      </div>

      {/* PAINEL DE IGNORADAS */}
      <div>
        <h3 className="font-semibold text-red-700 mb-2">❌ Palavras Ignoradas</h3>
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={inputIgnorada}
            onChange={(e) => setInputIgnorada(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && adicionarIgnorada()}
            placeholder="Ex: convocacao, homologacao, gabarito"
            className="border p-2 rounded flex-1 text-sm outline-none focus:border-red-500"
          />
          <button onClick={adicionarIgnorada} className="bg-red-600 text-white px-4 rounded hover:bg-red-700 transition-colors">Add</button>
        </div>

        <div className="flex flex-wrap gap-2">
          {palavrasIgnoradas.map((p) => (
            <button
              key={p}
              onClick={() => setPalavrasIgnoradas(palavrasIgnoradas.filter(item => item !== p))}
              title="Clique para remover"
              className="bg-red-100 text-red-800 text-xs px-3 py-1.5 rounded flex items-center gap-2 hover:bg-red-200 hover:text-red-900 hover:line-through transition-colors cursor-pointer group"
            >
              {p} <span className="font-bold text-red-600 group-hover:text-red-900">x</span>
            </button>
          ))}
        </div>
      </div>

    </section>
  );
}