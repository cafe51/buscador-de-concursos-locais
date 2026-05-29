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

  if (loading) return <div className="w-24 h-10 bg-gray-100 animate-pulse rounded-lg"></div>

  if (user) {
    const displayName = user.user_metadata?.username || 'Meu Perfil'
    return (
      <Link href="/profile" className="flex items-center gap-2 bg-blue-50 text-blue-700 hover:bg-blue-100 px-4 py-2 rounded-lg font-medium transition-colors border border-blue-200">
        <UserCircle size={20} />
        {displayName}
      </Link>
    )
  }

  return (
    <Link href="/login" className="flex items-center gap-2 bg-white text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-lg font-medium transition-colors border border-gray-200 shadow-sm">
      <UserCircle size={20} />
      Entrar
    </Link>
  )
}
