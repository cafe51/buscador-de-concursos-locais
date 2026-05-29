import { Resend } from 'resend';

// Verifica se a chave existe antes de instanciar
const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

/**
 * Envia um e-mail genérico (Será usado na Fase 2 para notificações)
 */
export async function enviarEmail(para: string, assunto: string, conteudoHTML: string) {
  if (!resend) {
    console.error('RESEND_API_KEY não está configurada no .env.local');
    return { error: 'Serviço de e-mail não configurado.' };
  }

  try {
    const { data, error } = await resend.emails.send({
      // Lembre-se: O e-mail de remetente (from) precisa ter o domínio verificado no Resend
      from: 'Avisos de Concursos <onboarding@resend.dev>', // ⚠️ Altere para o seu domínio depois! (ex: avisos@seusite.com)
      to: para,
      subject: assunto,
      html: conteudoHTML,
    });

    if (error) {
      console.error('Erro ao enviar e-mail pelo Resend:', error);
      return { error };
    }

    return { data };
  } catch (err) {
    console.error('Falha inesperada no envio de e-mail:', err);
    return { error: err };
  }
}
