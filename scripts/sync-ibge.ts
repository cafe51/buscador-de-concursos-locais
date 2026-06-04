import connectToDatabase from '../src/lib/mongodb';
import ServidorIBGE from '../src/models/ServidorIBGE';

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

    let totalSaved = 0;
    let page = 1;

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

        await ServidorIBGE.findOneAndUpdate(
          { idServidor: servidor.id },
          {
            idServidor: servidor.id,
            nome: servidor.pessoa?.nome || 'Desconhecido',
            cpfFormatado: servidor.pessoa?.cpfFormatado,
            situacao: servidor.situacao,
            uorgExercicio: uorgExercicio,
            uorgLotacao: uorgLotacao,
            ufExercicio: servidor.estadoExercicio?.sigla || '',
            rawData: item,
            ultimaAtualizacao: new Date()
          },
          { upsert: true, returnDocument: 'after' }
        );
      }

      totalSaved += data.length;
      page++;

      // Delay de 200ms para respeitar limite de ~400 requisições por minuto da API
      await delay(200);
    }

    console.log(`✅ Sincronização Completa finalizada! Total processado: ${totalSaved}`);
    process.exit(0);

  } catch (error) {
    console.error('❌ Erro durante a sincronização:', error);
    process.exit(1);
  }
}

syncIBGE();
