import Link from 'next/link'
import ServidoresIBGE from './ServidoresIBGE'
import { ArrowLeft } from 'lucide-react'

import { Suspense } from 'react'

export const metadata = {
  title: 'Servidores IBGE - Achador de Editais',
  description: 'Pesquisa em tempo real de servidores do IBGE por agência e estado.',
}

export default function ServidoresIBGEPage() {
  return (
    <main className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8 animate-fade-in">
      <div className="max-w-6xl mx-auto space-y-6">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-800 font-medium transition-colors">
          <ArrowLeft size={16} /> Voltar para a Página Inicial
        </Link>
        
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Portal da Transparência: IBGE</h1>
          <p className="text-slate-600 max-w-2xl">
            Acompanhe o quadro de funcionários ativos e inativos nas agências do Instituto Brasileiro de Geografia e Estatística em todo o Brasil. Os dados são sincronizados do Portal da Transparência do Governo Federal.
          </p>
        </div>

        <div className="mt-8">
          <Suspense fallback={<div className="p-8 text-center text-slate-500">Carregando painel do IBGE...</div>}>
            <ServidoresIBGE />
          </Suspense>
        </div>
      </div>
    </main>
  )
}
