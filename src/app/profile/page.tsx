import { getSessionUser } from '@/lib/auth'
import connectToDatabase from '@/lib/mongodb'
import { UserModel } from '@/models/User'
import { redirect } from 'next/navigation'
import ProfileClient from './ProfileClient'
import { getScraperConfigsAction } from '@/app/admin/actions'

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>
}) {
  const sessionUser = await getSessionUser()

  if (!sessionUser) {
    return redirect('/login')
  }

  await connectToDatabase()
  const dbUser = await UserModel.findById(sessionUser.id).lean()
  if (!dbUser) {
    return redirect('/login')
  }

  const user = {
    id: dbUser._id.toString(),
    email: dbUser.email,
    user_metadata: {
      username: dbUser.username,
      role: dbUser.role,
      notifications: dbUser.notifications ? {
        enabled: dbUser.notifications.enabled,
        organs: dbUser.notifications.organs,
        cities: dbUser.notifications.cities,
      } : undefined
    }
  }

  // Await the searchParams to safely access them in Next.js 15+
  const params = await searchParams
  const error = params?.error
  const message = params?.message

  const isAdmin = user.user_metadata?.role === 'admin'
  let adminConfigs = undefined
  if (isAdmin) {
    const res = await getScraperConfigsAction()
    if (!res.error) {
      adminConfigs = res.configs
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-8 relative overflow-hidden flex flex-col items-center">
      {/* Background gradients */}
      <div className="absolute top-0 right-[20%] w-96 h-96 bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none" />
      
      <div className="w-full max-w-4xl z-10 mt-10">
        <div className="flex justify-between items-center mb-10">
          <h1 className="text-3xl font-bold text-indigo-900 tracking-tight">Meu Perfil</h1>
          <form action="/auth/actions" method="post">
            {/* We will use a dedicated Client component for forms, but logout can be a simple button */}
          </form>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-xl text-red-500 text-sm text-center">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/50 rounded-xl text-emerald-400 text-sm text-center font-medium">
            {message}
          </div>
        )}

        <ProfileClient user={user} isAdmin={isAdmin} adminConfigs={adminConfigs} />
      </div>
    </div>
  )
}
