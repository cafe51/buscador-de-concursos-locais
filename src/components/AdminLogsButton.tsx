'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getSessionUser } from '@/app/auth/actions'

interface LocalUser {
  id: string;
  email: string;
  user_metadata?: {
    username?: string;
    role?: string;
  };
}

export default function AdminLogsButton() {
  const [user, setUser] = useState<LocalUser | null>(null)

  useEffect(() => {
    getSessionUser().then((sessionUser) => {
      setUser(sessionUser)
    })
  }, [])

  // Verifica se o usuário possui a role de admin no seu metadata
  if (!user || user.user_metadata?.role !== 'admin') {
    return null;
  }

  return (
    <Link 
      href="/developer/logs" 
      className="flex items-center justify-center gap-2 bg-slate-800 text-white hover:bg-slate-700 px-3 sm:px-4 py-2 rounded-xl font-semibold transition-all duration-200 border border-slate-700 shadow-sm text-sm sm:text-base"
      title="Acessar Logs do Sistema"
    >
      <span className="text-lg leading-none">⚙️</span>
      <span className="hidden sm:inline">Logs (Admin)</span>
      <span className="sm:hidden">Logs</span>
    </Link>
  )
}
