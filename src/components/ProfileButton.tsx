'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import Link from 'next/link'
import { User } from '@supabase/supabase-js'
import { UserCircle } from 'lucide-react'

export default function ProfileButton() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    
    // Get initial session
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
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
