// src/lib/notifications.ts
import { SyncLogAddition } from './storage';
import { enviarEmail } from './email';

// Lista de palavras ignoradas padrão (postagens burocráticas / intermediárias)
const PALAVRAS_IGNORADAS_PADRAO = [
  'classificacao', 'convocacao', 'chamamento', 'homologacao', 'estagiario',
  'gabarito', 'resultado', 'cancelamento', 'homologadas', 'inventario',
  'contrarrazoes', 'recurso', 'respostas', 'provas', 'inscricoes',
  'nomeacao', 'nomeacoes', 'convocacoes', 'impugnacao', 'impugnacoes',
  'atividades', 'atividade', 'atribuicoes', 'atribuicao', 'exoneracao',
  'exoneracoes', 'filhos da terra', 'isencao', 'isencoes', 'simplificado',
  'estagio', 'estagiario', 'homologacoes', 'class', 'pontuacao',
  'inscritos', 'alocacao', 'salas', 'notas', 'sorteio', 'desempate'
];

function removerAcentos(texto: string): string {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export async function processarNotificacoes(novasAdicoes: SyncLogAddition[]) {
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
    const descricaoNormalizada = edital.dadosEnriquecidos?.descricao ? removerAcentos(edital.dadosEnriquecidos.descricao) : '';
    const concursoNorm = (edital.dadosEnriquecidos?.concurso || edital.concurso) ? removerAcentos(edital.dadosEnriquecidos?.concurso || edital.concurso || '') : '';
    const textoCompleto = `${tituloNormalizado} ${descricaoNormalizada} ${concursoNorm}`;

    const contemBurocracia = PALAVRAS_IGNORADAS_PADRAO.some(palavra => {
      const palavraNorm = removerAcentos(palavra);
      const bateu = textoCompleto.includes(palavraNorm);
      if (bateu) {
        console.log(`  ❌ Excluído por palavra burocrática: [${edital.cidade}] [${edital.orgao || 'Geral'}] "${edital.titulo}" (Motivo: termo '${palavra}')`);
      }
      return bateu;
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

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://buscador-de-concursos-locais.vercel.app';
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("❌ [NOTIFICAÇÕES] [ERRO CRÍTICO] Variáveis do Supabase Admin não configuradas no servidor.");
    console.error("  Verifique as chaves NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente.");
    console.log("=====================================================================\n");
    return;
  }

  console.log(`🔔 [NOTIFICAÇÕES] Iniciando varredura para ${adicoesFiltradas.length} postagens sobreviventes...`);

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    console.log("\n👤 [NOTIFICAÇÕES] [PASSO 2/4] Buscando usuários ativos na base do Supabase...");

    // 2. Identifica quais usuários do banco de dados ativaram as notificações (Passo 2)
    let page = 1;
    const todosUsuarios: any[] = [];

    while (true) {
      console.log(`  🔍 Consultando API do Supabase (Página ${page})...`);
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage: 100
      });

      if (error) {
        console.error(`  ❌ [NOTIFICAÇÕES] Erro na API do Supabase ao listar usuários na página ${page}:`, error.message);
        break;
      }

      if (!data?.users || data.users.length === 0) {
        break;
      }

      todosUsuarios.push(...data.users);

      if (data.users.length < 100) {
        break;
      }
      page++;
    }

    console.log(`  👥 Total de usuários carregados da base: ${todosUsuarios.length}`);

    const usuariosNotificaveis = todosUsuarios.filter(user => {
      const enabled = user.user_metadata?.notifications?.enabled === true;
      if (enabled) {
        console.log(`    ✉️ Canal ativo encontrado: ${user.email}`);
      }
      return enabled;
    });

    console.log(`  📊 [PASSO 2 CONCLUÍDO] Total de canais de notificação ativos: ${usuariosNotificaveis.length}`);

    if (usuariosNotificaveis.length === 0) {
      console.log("🔔 [NOTIFICAÇÕES] Nenhum usuário ativou o sistema de notificações por e-mail até o momento.");
      console.log("=====================================================================\n");
      return;
    }

    console.log("\n⚙️ [NOTIFICAÇÕES] [PASSO 3/4] Avaliando filtros individuais dos usuários...");

    // Processar notificações para cada usuário
    for (const usuario of usuariosNotificaveis) {
      const prefs = usuario.user_metadata.notifications;
      const userCities = prefs.cities || ['todas'];
      const userOrgans = prefs.organs || 'todos';
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

      // 4. Desenha o email e envia para cada usuário de acordo com o resultado das filtragens (Passo 4)
      console.log(`  🚀 [PASSO 4/4] Desenhando e despachando e-mail para ${userEmail} contendo ${matchesUsuario.length} correspondências...`);

      // 4. Formatar o e-mail em HTML Premium
      console.log(`  🔍 [DEBUG-EMAIL] Dados a serem desenhados no email:`, JSON.stringify(matchesUsuario, null, 2));

      const itemsHtml = matchesUsuario.map(item => {
        const isCamara = item.orgao ? removerAcentos(item.orgao).includes('camara') : false;
        const badgeColor = isCamara ? '#7c3aed' : '#2563eb'; // Roxo para Câmara, Azul para Prefeitura
        const labelOrgao = item.orgao ? (isCamara ? 'Câmara' : 'Prefeitura') : 'Geral';

        const tituloFinal = item.dadosEnriquecidos?.titulo || item.titulo;
        const badgeIA = item.dadosEnriquecidos ? `<span style="display: inline-block; padding: 4px 10px; background-color: #f59e0b; color: #ffffff; font-size: 11px; font-weight: bold; border-radius: 9999px; text-transform: uppercase; margin-right: 6px;">✨ Enriquecido por IA</span>` : '';
        const descricaoHtml = item.dadosEnriquecidos?.descricao ? `<p style="margin: 0 0 12px 0; color: #475569; font-size: 14px; line-height: 1.5;">${item.dadosEnriquecidos.descricao}</p>` : '';
        const concursoFinal = item.dadosEnriquecidos?.concurso || item.concurso;
        const concursoBadgeIA = item.dadosEnriquecidos?.concurso ? '✨ ' : '';
        const dataPublicacaoFinal = item.dadosEnriquecidos?.dataPublicacao || item.dataPublicacao;
        const dataPublicacaoBadgeIA = item.dadosEnriquecidos?.dataPublicacao ? '✨ ' : '';
        
        console.log(`  🔍 [DEBUG-EMAIL] Item mapeado -> tituloFinal: "${tituloFinal}"`);

        return `
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
      }).join('');

      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Novos Editais Encontrados</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
          <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
            <!-- Header -->
            <tr>
              <td style="padding: 40px 30px; background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); text-align: center; color: #ffffff;">
                <h2 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">Buscador de Concursos</h2>
                <p style="margin: 0; font-size: 14px; color: #e0e7ff; font-weight: 500;">Novas oportunidades encontradas na sua região</p>
              </td>
            </tr>
            
            <!-- Conteúdo -->
            <tr>
              <td style="padding: 30px 24px; background-color: #f8fafc;">
                <p style="margin: 0 0 20px 0; font-size: 15px; color: #334155; line-height: 1.6;">
                  Olá! Identificamos novas publicações de editais que correspondem às suas preferências de monitoramento cadastradas:
                </p>
                
                <!-- Lista de Itens -->
                ${itemsHtml}
                
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

      // Enviar e-mail de fato
      const assunto = matchesUsuario.length === 1 
        ? `[Novo Edital] Oportunidade em ${matchesUsuario[0].cidade}!`
        : `[Alerta] ${matchesUsuario.length} Novos Editais Publicados na Região!`;

      const resultEmail = await enviarEmail(userEmail, assunto, emailHtml);
      if (resultEmail.error) {
        console.error(`    ❌ Falha ao enviar e-mail para ${userEmail}:`, resultEmail.error);
      } else {
        console.log(`    ✅ Alerta de e-mail entregue com sucesso para: ${userEmail}`);
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
