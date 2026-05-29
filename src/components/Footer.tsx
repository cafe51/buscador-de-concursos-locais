// src/components/Footer.tsx
export default function Footer() {
  return (
    <footer className="mt-auto py-8 text-center border-t border-slate-200 bg-white text-slate-500">
      <div className="container mx-auto px-4">
        <p className="text-sm font-medium text-slate-700">
          © {new Date().getFullYear()} Radar de Concursos. Todos os direitos reservados.
        </p>
        <p className="text-xs mt-2 text-slate-500">
          Monitorando oportunidades em órgãos locais para você.
        </p>
      </div>
    </footer>
  );
}
