// src/components/Footer.tsx
export default function Footer() {
  return (
    <footer className="mt-auto py-8 text-center border-t border-neutral-800 bg-neutral-950 text-neutral-500">
      <div className="container mx-auto px-4">
        <p className="text-sm font-medium">
          © {new Date().getFullYear()} Radar de Concursos. Todos os direitos reservados.
        </p>
        <p className="text-xs mt-2 text-neutral-600">
          Monitorando oportunidades em órgãos locais para você.
        </p>
      </div>
    </footer>
  );
}
