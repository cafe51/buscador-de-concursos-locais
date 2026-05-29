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

  if (loading) return <div className="w-24 h-10 bg-neutral-800 animate-pulse rounded-xl"></div>

  if (user) {
    const displayName = user.user_metadata?.username || 'Meu Perfil'
    return (
      <Link href="/profile" className="flex items-center gap-2 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 px-4 py-2 rounded-xl font-medium transition-all duration-200 border border-indigo-500/30">
        <UserCircle size={20} />
        {displayName}
      </Link>
    )
  }

  return (
    <Link href="/login" className="flex items-center gap-2 bg-neutral-800 text-neutral-300 hover:bg-neutral-700 hover:text-white px-4 py-2 rounded-xl font-medium transition-all duration-200 border border-neutral-700">
      <UserCircle size={20} />
      Entrar
    </Link>
  )
}
