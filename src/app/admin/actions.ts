'use server'

import { createClient } from '@/utils/supabase/server'
import connectToDatabase from '@/lib/mongodb'
import { ScraperConfigModel } from '@/models/ScraperConfig'

export type ScraperConfigDTO = {
  nome: string;
  verificarDisponibilidade: boolean;
}

/**
 * Helper to check if the user is an admin.
 */
async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.user_metadata?.role !== 'admin') {
    throw new Error('Acesso negado: Requer privilégios de administrador.')
  }
  return user
}

/**
 * Fetch all scraper configs from MongoDB. Only accessible to admins.
 */
export async function getScraperConfigsAction(): Promise<{ configs: ScraperConfigDTO[], error?: string }> {
  try {
    await requireAdmin()
    await connectToDatabase()

    const configs = await ScraperConfigModel.find().sort({ nome: 1 }).lean()
    
    // Convert to simple objects since they will cross the Server/Client boundary
    const serializedConfigs: ScraperConfigDTO[] = configs.map((c: any) => ({
      nome: c.nome,
      verificarDisponibilidade: c.verificarDisponibilidade
    }))

    return { configs: serializedConfigs }
  } catch (err: any) {
    console.error("Erro ao buscar configurações de scrapers:", err)
    return { configs: [], error: err.message || 'Erro interno' }
  }
}

/**
 * Update the verificarDisponibilidade flag for a specific scraper.
 */
export async function toggleScraperConfigAction(nome: string, newValue: boolean): Promise<{ success: boolean, error?: string }> {
  try {
    await requireAdmin()
    await connectToDatabase()

    const result = await ScraperConfigModel.updateOne(
      { nome },
      { $set: { verificarDisponibilidade: newValue } }
    )

    if (result.matchedCount === 0) {
      return { success: false, error: 'Cidade não encontrada no banco.' }
    }

    return { success: true }
  } catch (err: any) {
    console.error(`Erro ao atualizar scraper ${nome}:`, err)
    return { success: false, error: err.message || 'Erro interno' }
  }
}
