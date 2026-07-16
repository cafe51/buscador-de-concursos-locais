'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { UserCircle } from 'lucide-react'
import { getSessionUser } from '@/app/auth/actions'

interface LocalUser {
  id: string;
  email: string;
  user_metadata?: {
    username?: string;
  };
}

export default function ProfileButton() {
  const [user, setUser] = useState<LocalUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getSessionUser().then((sessionUser) => {
      setUser(sessionUser)
      setLoading(false)
    })
  }, [])

  if (loading) return <div className="w-24 h-10 bg-slate-100 animate-pulse rounded-xl border border-slate-200"></div>

  if (user) {
    const displayName = user.user_metadata?.username || 'Meu Perfil'
    return (
      <Link href="/profile" className="flex items-center gap-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-4 py-2 rounded-xl font-semibold transition-all duration-200 border border-indigo-200 shadow-sm">
        <UserCircle size={20} />
        {displayName}
      </Link>
    )
  }

  return (
    <Link href="/login" className="flex items-center gap-2 bg-white text-slate-700 hover:bg-slate-50 hover:text-indigo-600 px-4 py-2 rounded-xl font-semibold transition-all duration-200 border border-slate-200 shadow-sm">
      <UserCircle size={20} />
      Entrar
    </Link>
  )
}
