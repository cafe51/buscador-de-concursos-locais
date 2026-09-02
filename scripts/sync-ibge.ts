import connectToDatabase from '../src/lib/mongodb';
import ServidorIBGE from '../src/models/ServidorIBGE';
import { enviarEmail } from '../src/lib/email';

const API_KEY = process.env.PORTAL_TRANSPARENCIA_API_KEY;
const IBGE_SIAPE = '45205';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchPage(page: number) {
  const url = `https://api.portaldatransparencia.gov.br/api-de-dados/servidores?orgaoServidorExercicio=${IBGE_SIAPE}&pagina=${page}`;

  if (!API_KEY) {
    throw new Error('Chave de API não encontrada.');
  }

  const response = await fetch(url, {
    headers: {
      'chave-api-dados': API_KEY,
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Erro na API (Página ${page}): ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

function extractUorg(fichaData: any): string {
  if (!fichaData || fichaData.length === 0) return '';
  return fichaData[0].uorgExercicio || fichaData[0].uorgLotacao || '';
}

async function syncIBGE() {
  try {
    await connectToDatabase();
    console.log('Iniciando sincronização COMPLETA dos servidores do IBGE...');

    let totalProcessados = 0;
    let docsAdded = 0;
    let docsUpdated = 0;
    let page = 1;
    
    // Array para guardar alterações em Fernandópolis
    const atualizacoesFernandopolis: string[] = [];

    while (true) {
      if (page % 100 === 1) {
        console.log(`[Páginas ${page} - ${page + 99}] Buscando e salvando dados da API...`);
      }

      const data = await fetchPage(page);

      if (!data || data.length === 0) {
        console.log(`Nenhum dado retornado na página ${page}. Sincronização concluída.`);
        break;
      }

      for (const item of data) {
        const servidor = item.servidor;
        if (!servidor || !servidor.id) continue;

        let uorgExercicio = extractUorg(item.fichasCargoEfetivo)
          || extractUorg(item.fichasDemaisSituacoes)
          || extractUorg(item.fichasMilitar);

        let uorgLotacao = '';
        if (item.fichasCargoEfetivo && item.fichasCargoEfetivo.length > 0) {
          uorgLotacao = item.fichasCargoEfetivo[0].uorgLotacao || '';
        }

        const isFernandopolis = uorgExercicio.toLowerCase().includes('fernandopolis') || uorgExercicio.toLowerCase().includes('fernandópolis');

        if (isFernandopolis) {
          const existing = await ServidorIBGE.findOne({ idServidor: servidor.id }).lean();
          
          if (!existing) {
             atualizacoesFernandopolis.push(`<li><b>NOVO SERVIDOR:</b> ${servidor.pessoa?.nome} - Situação: ${servidor.situacao}</li>`);
          } else {
             const oldFicha = existing.rawData?.fichasCargoEfetivo?.[0] || existing.rawData?.fichasDemaisSituacoes?.[0] || {};
             const newFicha = item.fichasCargoEfetivo?.[0] || item.fichasDemaisSituacoes?.[0] || {};
             
             const oldCargo = oldFicha.cargo || 'N/A';
             const newCargo = newFicha.cargo || 'N/A';
             
             const oldCpf = existing.cpfFormatado || 'N/A';
             const newCpf = servidor.pessoa?.cpfFormatado || 'N/A';

             const oldNome = existing.nome || 'N/A';
             const newNome = servidor.pessoa?.nome || 'N/A';

             const oldRegime = oldFicha.regimeJuridico || 'N/A';
             const newRegime = newFicha.regimeJuridico || 'N/A';

             const oldJornada = oldFicha.jornadaTrabalho || 'N/A';
             const newJornada = newFicha.jornadaTrabalho || 'N/A';

             const oldIngresso = oldFicha.dataIngressoOrgao || 'N/A';
             const newIngresso = newFicha.dataIngressoOrgao || 'N/A';
             
             let changedDetails = [];
             
             if (existing.situacao !== servidor.situacao) changedDetails.push(`Situação: ${existing.situacao} ➔ ${servidor.situacao}`);
             if (oldCargo !== newCargo) changedDetails.push(`Cargo: ${oldCargo} ➔ ${newCargo}`);
             if (oldCpf !== newCpf) changedDetails.push(`CPF: ${oldCpf} ➔ ${newCpf}`);
             if (oldNome !== newNome) changedDetails.push(`Nome: ${oldNome} ➔ ${newNome}`);
             if (oldRegime !== newRegime) changedDetails.push(`Regime Jurídico: ${oldRegime} ➔ ${newRegime}`);
             if (oldJornada !== newJornada) changedDetails.push(`Jornada: ${oldJornada} ➔ ${newJornada}`);
             if (oldIngresso !== newIngresso) changedDetails.push(`Ingresso: ${oldIngresso} ➔ ${newIngresso}`);
             
             if (changedDetails.length > 0) {
               atualizacoesFernandopolis.push(
                 `<li><b>ATUALIZAÇÃO em ${newNome}:</b><br>
                 ${changedDetails.join('<br>')}</li>`
               );
             }
          }
        }

        const result = await ServidorIBGE.updateOne(
          { idServidor: servidor.id },
          {
            $set: {
              idServidor: servidor.id,
              nome: servidor.pessoa?.nome || 'Desconhecido',
              cpfFormatado: servidor.pessoa?.cpfFormatado,
              situacao: servidor.situacao,
              uorgExercicio: uorgExercicio,
              uorgLotacao: uorgLotacao,
              ufExercicio: servidor.estadoExercicio?.sigla || '',
              rawData: item,
              ultimaAtualizacao: new Date()
            }
          },
          { upsert: true }
        );

        if (result.upsertedCount > 0) {
          docsAdded++;
        } else {
          docsUpdated++;
        }
      }

      totalProcessados += data.length;
      page++;

      // Delay de 200ms para respeitar limite de ~400 requisições por minuto da API
      await delay(200);
    }

    console.log(`\n✅ Sincronização Completa finalizada!`);
    console.log(`📊 Total processado: ${totalProcessados}`);
    console.log(`🆕 Novos registros adicionados: ${docsAdded}`);
    console.log(`🔄 Registros atualizados: ${docsUpdated}\n`);

    if (atualizacoesFernandopolis.length > 0) {
      console.log(`Enviando e-mail de notificação para Fernandópolis (${atualizacoesFernandopolis.length} alterações encontradas)...`);
      const htmlContent = `
        <h2>Atualizações - IBGE Fernandópolis</h2>
        <p>A sincronização diária encontrou as seguintes alterações nos servidores de Fernandópolis:</p>
        <ul>
          ${atualizacoesFernandopolis.join('<br>')}
        </ul>
        <p><a href="https://achadordeeditais.vercel.app/servidoresIBGE?uf=SP&cidade=AGENCIA+DO+IBGE+EM+FERNANDOPOLIS%2FSP">Acessar o Painel</a></p>
      `;
      
      const destinatario = process.env.ADMIN_NOTIFICATION_EMAIL || 'admin@example.com';
      const resEmail = await enviarEmail(destinatario, '🚨 Atualização de Servidor - IBGE Fernandópolis', htmlContent);
      
      if (resEmail.error) {
        console.error('❌ Falha ao enviar e-mail de notificação:', resEmail.error);
      } else {
        console.log(`✅ E-mail de notificação enviado com sucesso para ${destinatario}!`);
      }
    } else {
      console.log('Nenhuma alteração nos servidores de Fernandópolis hoje.');
    }

    process.exit(0);

  } catch (error) {
    console.error('❌ Erro durante a sincronização:', error);
    process.exit(1);
  }
}

syncIBGE();
