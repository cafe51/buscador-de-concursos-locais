'use client'
import { useState, useEffect, useRef } from 'react';
import { LogMessage } from '@/lib/devLogger';

const renderTextWithLinks = (text: string) => {
  // Ignora colchetes e parênteses de fechamento que possam estar "colados" no final da URL
  const urlRegex = /(https?:\/\/[^\s\])"]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) => {
    if (part.match(urlRegex)) {
      return (
        <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
          {part}
        </a>
      );
    }
    return part;
  });
};

export default function TerminalPanel() {
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [isMinimized, setIsMinimized] = useState(true);
  const endOfLogsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;

    const eventSource = new EventSource('/api/dev/logs');

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'history') {
        setLogs(data.logs);
      } else if (data.type === 'log') {
        setLogs((prev) => {
          const newLogs = [...prev, data.log];
          if (newLogs.length > 200) newLogs.shift();
          return newLogs;
        });
      }
    };

    return () => {
      eventSource.close();
    };
  }, []);

  useEffect(() => {
    if (!isMinimized) {
      endOfLogsRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isMinimized]);

  if (process.env.NODE_ENV !== 'development') return null;

  if (isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        className="fixed bottom-24 right-6 z-50 bg-slate-900/90 backdrop-blur-md text-emerald-400 p-4 rounded-full shadow-2xl hover:bg-slate-800 transition-all hover:scale-110 flex items-center justify-center border border-slate-700 group"
        title="Abrir Logs do Terminal"
      >
        <span className="text-2xl leading-none transition-transform duration-300">💻</span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col w-[90vw] md:w-[600px] h-[60vh] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden font-mono text-[10px] sm:text-xs leading-tight animate-fade-in">
      <div className="bg-slate-800 px-4 py-2 flex justify-between items-center border-b border-slate-700">
        <div className="flex items-center gap-2">
          <span className="text-emerald-400">💻</span>
          <span className="text-slate-300 font-bold">Terminal Backend</span>
        </div>
        <div className="flex gap-4 items-center">
          <span className="text-slate-500 text-xs px-2 py-0.5 bg-slate-950 rounded-full border border-slate-700 select-none">
            {logs.length} logs
          </span>
          <button onClick={() => setLogs([])} className="text-slate-400 hover:text-white transition-colors" title="Limpar logs visíveis">
            Limpar
          </button>
          <button onClick={() => setIsMinimized(true)} className="text-slate-400 hover:text-white transition-colors" title="Minimizar painel">
            ✖
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-2 text-slate-300">
        {logs.length === 0 ? (
          <div className="text-slate-500 italic text-center mt-10">Aguardando logs...</div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="flex gap-3 border-b border-slate-800/50 pb-1">
              <span className="text-slate-500 shrink-0 select-none opacity-50">
                {new Date(log.timestamp).toLocaleTimeString('pt-BR')}
              </span>
              <span className={`break-all sm:break-words whitespace-pre-wrap ${
                log.type === 'error' ? 'text-rose-400 font-bold' :
                log.type === 'warn' ? 'text-amber-400' :
                log.type === 'info' ? 'text-sky-400' :
                'text-slate-300'
              }`}>
                {renderTextWithLinks(log.args.join(' '))}
              </span>
            </div>
          ))
        )}
        <div ref={endOfLogsRef} />
      </div>
    </div>
  );
}
