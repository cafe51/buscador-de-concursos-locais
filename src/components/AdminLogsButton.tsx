'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import Link from 'next/link'
import { User } from '@supabase/supabase-js'

export default function AdminLogsButton() {
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    const supabase = createClient()
    
    // Get initial session
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Verifica se o usuário possui a role de admin no seu metadata
  if (!user || user.user_metadata?.role !== 'admin') {
    return null;
  }

  return (
    <Link 
      href="/developer/logs" 
      className="flex items-center gap-2 bg-slate-800 text-white hover:bg-slate-700 px-4 py-2 rounded-xl font-semibold transition-all duration-200 border border-slate-700 shadow-sm"
      title="Acessar Logs do Sistema"
    >
      <span>⚙️</span> Logs (Admin)
    </Link>
  )
}
