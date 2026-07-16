// src/lib/notifications.ts
import { SyncLogAddition } from './storage';
import { enviarEmail } from './email';
import connectToDatabase from './mongodb';
import { UserModel } from '../models/User';

// Lista de palavras ignoradas padrão (postagens burocráticas / intermediárias)
const PALAVRAS_IGNORADAS_PADRAO = [
  'classificacao', 'convocacao', 'chamamento', 'homologacao', 'estagiario',
  'gabarito', 'resultado', 'cancelamento', 'homologadas', 'inventario',
  'contrarrazoes', 'recurso', 'respostas', 'provas', 'indeferimento', 'deferimento',
  'nomeacao', 'nomeacoes', 'convocacoes', 'impugnacao', 'impugnacoes',
  'atividades', 'atividade', 'atribuicoes', 'atribuicao', 'exoneracao',
  'exoneracoes', 'filhos da terra', 'isencao', 'isencoes', 'locais',
  'estagio', 'estagiario', 'homologacoes', 'class', 'pontuacao',
  'inscritos', 'alocacao', 'salas', 'notas', 'sorteio', 'desempate', 'retificacao', 'errata',
  // Frases compostas específicas de etapas pós-abertura
  'prorrogacao de inscricoes', 'lista de inscricoes', 'lista provisoria de inscricoes',
  'inscricoes deferidas', 'inscricoes indeferidas', 'homologacao das inscricoes',
  'homologacao de inscricoes', 'acesso das inscricoes', 'inscricoes homologadas',
  'lista de inscritos'
];

function removerAcentos(texto: string): string {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export async function processarNotificacoes(novasAdicoes: SyncLogAddition[], enviarEmails: boolean = true) {
  console.log("\n=====================================================================");
  console.log("📢 [NOTIFICAÇÕES] INICIANDO FLUXO DE PROCESSAMENTO DE ALERTAS");
  console.log("=====================================================================");

  if (!novasAdicoes || novasAdicoes.length === 0) {
    console.log("🔔 [NOTIFICAÇÕES] Nenhuma nova adição recebida para notificar.");
    console.log("=====================================================================\n");
    return;
  }

  console.log(`📦 [NOTIFICAÇÕES] [PASSO 1/4] Filtrando ${novasAdicoes.length} novas postagens contra o filtro burocrático...`);

  // 1. Passa a adição de documentos pelo filtro das 41 palavras primeiro (Passo mais leve e rápido)
  const adicoesFiltradas = novasAdicoes.filter(edital => {
    const tituloNormalizado = edital.dadosEnriquecidos?.titulo ? removerAcentos(edital.dadosEnriquecidos.titulo) : removerAcentos(edital.titulo);

    const contemBurocracia = PALAVRAS_IGNORADAS_PADRAO.some(palavra => {
      const palavraNorm = removerAcentos(palavra);
      if (tituloNormalizado.includes(palavraNorm)) {
        console.log(`  ❌ Excluído por palavra burocrática: [${edital.cidade}] [${edital.orgao}] "${edital.dadosEnriquecidos?.titulo || edital.titulo}" (Motivo: termo '${palavra}')`);
        return true;
      }
      return false;
    });

    if (!contemBurocracia) {
      console.log(`  ✅ Aprovado para alertas: [${edital.cidade}] [${edital.orgao || 'Geral'}] "${edital.titulo}"`);
    }

    return !contemBurocracia;
  });

  console.log(`\n  📊 [PASSO 1 CONCLUÍDO] Postagens sobreviventes: ${adicoesFiltradas.length} de ${novasAdicoes.length}`);

  if (adicoesFiltradas.length === 0) {
    console.log("🔔 [NOTIFICAÇÕES] Nenhuma postagem de edital sobreviveu ao filtro burocrático global de 41 palavras.");
    console.log("💡 Otimização: processo encerrado precocemente sem consultar base de dados.");
    console.log("=====================================================================\n");
    return;
  }

  if (!enviarEmails) {
    console.log("⚠️ [NOTIFICAÇÕES] Disparo de e-mails desativado nas opções locais.");
    console.log("💡 Processo de notificações interrompido. O filtro burocrático acima rodou apenas para fins de Log e Teste.");
    console.log("=====================================================================\n");
    return;
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://buscador-de-concursos-locais.vercel.app';

  console.log(`🔔 [NOTIFICAÇÕES] Iniciando varredura para ${adicoesFiltradas.length} postagens sobreviventes...`);

  try {
    await connectToDatabase();

    console.log("\n👤 [NOTIFICAÇÕES] [PASSO 2/4] Buscando usuários ativos na base do MongoDB...");

    // 2. Identifica quais usuários do banco de dados ativaram as notificações (Passo 2)
    const usuariosNotificaveis = await UserModel.find({ "notifications.enabled": true }).lean();

    console.log(`  👥 Total de canais de notificação ativos: ${usuariosNotificaveis.length}`);

    if (usuariosNotificaveis.length === 0) {
      console.log("🔔 [NOTIFICAÇÕES] Nenhum usuário ativou o sistema de notificações por e-mail até o momento.");
      console.log("=====================================================================\n");
      return;
    }

    console.log("\n⚙️ [NOTIFICAÇÕES] [PASSO 3/4] Avaliando filtros individuais dos usuários...");

    // Processar notificações para cada usuário
    for (const usuario of usuariosNotificaveis) {
      const prefs = usuario.notifications;
      const userCities = prefs?.cities || ['todas'];
      const userOrgans = prefs?.organs || 'todos';
      const userEmail = usuario.email;

      if (!userEmail) {
        console.log("  ⚠️ Usuário sem endereço de e-mail cadastrado. Pulado.");
        continue;
      }

      console.log(`\n  👥 Processando preferências de: ${userEmail}`);
      console.log(`    Preferências: Órgãos='${userOrgans}' | Cidades=[${userCities.join(', ')}]`);

      // 3. Passa a postagem sobrevivente pelos filtros de cada um desses usuários (cidade e órgão) (Passo 3)
      const matchesUsuario = adicoesFiltradas.filter(edital => {
        // A. Filtro de Cidades
        const cidadeMatch = userCities.includes('todas') || userCities.includes(edital.cidade);
        if (!cidadeMatch) {
          console.log(`    x [DESCARTADO POR CIDADE] [${edital.cidade}] não listada nas preferências`);
          return false;
        }

        // B. Filtro de Órgão
        if (userOrgans === 'todos') {
          console.log(`    ✓ [MATCH] [${edital.cidade}] [${edital.orgao || 'Geral'}] "${edital.titulo}"`);
          return true;
        }
        
        if (!edital.orgao) {
          console.log(`    x [DESCARTADO POR ÓRGÃO] Edital sem órgão definido`);
          return false;
        }
        
        const orgaoNorm = removerAcentos(edital.orgao);
        if (userOrgans === 'prefeitura') {
          const matched = orgaoNorm.includes('prefeitura');
          if (matched) console.log(`    ✓ [MATCH] [${edital.cidade}] [${edital.orgao}] "${edital.titulo}"`);
          else console.log(`    x [DESCARTADO POR ÓRGÃO] Pretendido: 'Prefeitura', Encontrado: '${edital.orgao}'`);
          return matched;
        }
        if (userOrgans === 'camara') {
          const matched = orgaoNorm.includes('camara') || orgaoNorm.includes('legislativo');
          if (matched) console.log(`    ✓ [MATCH] [${edital.cidade}] [${edital.orgao}] "${edital.titulo}"`);
          else console.log(`    x [DESCARTADO POR ÓRGÃO] Pretendido: 'Câmara', Encontrado: '${edital.orgao}'`);
          return matched;
        }

        return true;
      });

      if (matchesUsuario.length === 0) {
        console.log(`    🤫 Nenhuma correspondência de interesse para ${userEmail}`);
        continue;
      }

      // 4. Desenha e envia UM EMAIL POR EDITAL para o usuário (Passo 4)
      console.log(`  🚀 [PASSO 4/4] Enviando ${matchesUsuario.length} e-mail(s) individuais para ${userEmail}...`);

      for (const item of matchesUsuario) {
        const isCamara = item.orgao ? removerAcentos(item.orgao).includes('camara') : false;
        const badgeColor = isCamara ? '#7c3aed' : '#2563eb';
        const labelOrgao = item.orgao ? (isCamara ? 'Câmara' : 'Prefeitura') : 'Geral';

        const tituloFinal = item.dadosEnriquecidos?.titulo || item.titulo;
        const badgeIA = item.dadosEnriquecidos ? `<span style="display: inline-block; padding: 4px 10px; background-color: #f59e0b; color: #ffffff; font-size: 11px; font-weight: bold; border-radius: 9999px; text-transform: uppercase; margin-right: 6px;">✨ Enriquecido por IA</span>` : '';
        const descricaoHtml = item.dadosEnriquecidos?.descricao ? `<p style="margin: 0 0 12px 0; color: #475569; font-size: 14px; line-height: 1.5;">${item.dadosEnriquecidos.descricao}</p>` : '';
        const concursoFinal = item.dadosEnriquecidos?.concurso || item.concurso;
        const concursoBadgeIA = item.dadosEnriquecidos?.concurso ? '✨ ' : '';
        const dataPublicacaoFinal = item.dadosEnriquecidos?.dataPublicacao || item.dataPublicacao;
        const dataPublicacaoBadgeIA = item.dadosEnriquecidos?.dataPublicacao ? '✨ ' : '';
        
        console.log(`  🔍 [DEBUG-EMAIL] Desenhando e-mail individual para -> tituloFinal: "${tituloFinal}"`);

        const itemHtml = `
          <div style="margin-bottom: 24px; padding: 20px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; font-family: sans-serif;">
            <div style="margin-bottom: 8px;">
              ${badgeIA}
              <span style="display: inline-block; padding: 4px 10px; background-color: #f1f5f9; color: #334155; font-size: 11px; font-weight: bold; border-radius: 9999px; text-transform: uppercase; margin-right: 6px;">
                📍 ${item.cidade}
              </span>
              <span style="display: inline-block; padding: 4px 10px; background-color: ${badgeColor}; color: #ffffff; font-size: 11px; font-weight: bold; border-radius: 9999px; text-transform: uppercase;">
                🏛️ ${labelOrgao}
              </span>
            </div>
            
            <h4 style="margin: 0 0 10px 0; color: #1e1b4b; font-size: 16px; font-weight: 600; line-height: 1.4;">
              ${tituloFinal}
            </h4>
            
            ${descricaoHtml}
            
            ${concursoFinal ? `<p style="margin: 0 0 4px 0; color: #64748b; font-size: 13px;"><strong>Referência:</strong> ${concursoBadgeIA}${concursoFinal}</p>` : ''}
            ${dataPublicacaoFinal ? `<p style="margin: 0 0 12px 0; color: #64748b; font-size: 13px;"><strong>Publicação:</strong> ${dataPublicacaoBadgeIA}${dataPublicacaoFinal}</p>` : ''}
            
            <div style="margin-top: 14px;">
              <a href="${item.link}" target="_blank" style="display: inline-block; padding: 8px 16px; background-color: #4f46e5; color: #ffffff; font-size: 13px; font-weight: 600; text-decoration: none; border-radius: 8px; transition: background-color 0.2s;">
                Acessar Documento ↗
              </a>
            </div>
          </div>
        `;

        const emailHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Novo Edital Encontrado</title>
          </head>
          <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
            <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
              <!-- Header -->
              <tr>
                <td style="padding: 40px 30px; background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); text-align: center; color: #ffffff;">
                  <h2 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">Buscador de Concursos</h2>
                  <p style="margin: 0; font-size: 14px; color: #e0e7ff; font-weight: 500;">Nova oportunidade em ${item.cidade}</p>
                </td>
              </tr>
              
              <!-- Conteúdo -->
              <tr>
                <td style="padding: 30px 24px; background-color: #f8fafc;">
                  <p style="margin: 0 0 20px 0; font-size: 15px; color: #334155; line-height: 1.6;">
                    Olá! Identificamos a publicação de um novo edital que corresponde às suas preferências de monitoramento:
                  </p>
                  
                  <!-- Item -->
                  ${itemHtml}
                  
                  <!-- Call to Action Principal -->
                  <div style="text-align: center; margin-top: 30px; margin-bottom: 10px;">
                    <a href="${siteUrl}" target="_blank" style="display: inline-block; padding: 12px 28px; background-color: #1e1b4b; color: #ffffff; font-size: 14px; font-weight: bold; text-decoration: none; border-radius: 10px;">
                      Acessar Painel Completo
                    </a>
                  </div>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="padding: 24px 30px; background-color: #ffffff; border-top: 1px solid #f1f5f9; text-align: center; font-size: 12px; color: #94a3b8; line-height: 1.5;">
                  <p style="margin: 0 0 8px 0;">
                    Este e-mail foi enviado automaticamente de acordo com as preferências da sua conta.
                  </p>
                  <p style="margin: 0;">
                    Para alterar suas preferências de cidades ou cancelar o recebimento, acesse a página 
                    <a href="${siteUrl}/profile" target="_blank" style="color: #4f46e5; text-decoration: underline; font-weight: 500;">Meu Perfil</a>.
                  </p>
                </td>
              </tr>
            </table>
          </body>
          </html>
        `;

        // O Assunto agora será focado neste edital específico
        const labelAssuntoOrgao = item.orgao || 'Prefeitura/Câmara';
        const assunto = `[Novo Edital] ${item.cidade} - ${labelAssuntoOrgao}: ${tituloFinal}`;

        const resultEmail = await enviarEmail(userEmail, assunto, emailHtml);
        if (resultEmail.error) {
          console.error(`    ❌ Falha ao enviar e-mail de ${tituloFinal} para ${userEmail}:`, resultEmail.error);
        } else {
          console.log(`    ✅ Alerta de e-mail entregue com sucesso para: ${userEmail} -> ${tituloFinal}`);
        }
      }
    }

    console.log("\n=====================================================================");
    console.log("✅ [NOTIFICAÇÕES] TODOS OS DISPAROS DE ALERTA FORAM PROCESSADOS");
    console.log("=====================================================================\n");

  } catch (error: any) {
    console.error("\n=====================================================================");
    console.error("❌ [NOTIFICAÇÕES] [ERRO FATAL EM EXECUÇÃO]:", error.message || error);
    console.error("=====================================================================\n");
  }
}

export async function enviarAlertaDisponibilidadeAdmin(cidadesDisponiveis: string[]) {
  if (!cidadesDisponiveis || cidadesDisponiveis.length === 0) return;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://buscador-de-concursos-locais.vercel.app';

  try {
    await connectToDatabase();
    
    // Busca administradores
    const admins = await UserModel.find({ role: 'admin' }).lean();
    if (admins.length === 0) return;

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="margin: 0; padding: 20px; font-family: sans-serif; background-color: #f8fafc;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 30px; border-radius: 12px; border: 1px solid #e2e8f0;">
          <h2 style="color: #10b981; margin-top: 0;">🌐 Alerta do Modo Disponibilidade</h2>
          <p style="color: #334155; font-size: 15px;">Os seguintes scrapers configurados no <strong>Modo Verificação de Disponibilidade</strong> reportaram status ONLINE (sucesso) na última rotina de raspagem global:</p>
          
          <ul style="color: #475569; font-size: 15px; margin-bottom: 24px;">
            ${cidadesDisponiveis.map(c => `<li><strong>${c}</strong></li>`).join('')}
          </ul>
          
          <p style="color: #334155; font-size: 15px;">
            Você pode desligar este modo para que eles voltem a raspar editais normalmente acessando o seu <a href="${siteUrl}/profile" style="color: #4f46e5;">Painel de Administração</a>.
          </p>
        </div>
      </body>
      </html>
    `;

    const assunto = `[Sistema] Scrapers Online detectados no Modo Disponibilidade`;

    for (const admin of admins) {
      if (!admin.email) continue;
      const resultEmail = await enviarEmail(admin.email, assunto, emailHtml);
      if (resultEmail.error) {
        console.error(`    ❌ Falha ao enviar alerta admin para ${admin.email}:`, resultEmail.error);
      } else {
        console.log(`    ✅ Alerta admin de disponibilidade enviado para: ${admin.email}`);
      }
    }
  } catch (e) {
    console.error("❌ Erro ao enviar email de disponibilidade para admins:", e);
  }
}
