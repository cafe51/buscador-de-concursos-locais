import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import ServidorIBGE from '@/models/ServidorIBGE';

export async function GET() {
  try {
    await connectToDatabase();

    const agenciasExercicio = await ServidorIBGE.aggregate([
      { $match: { uorgExercicio: { $regex: /^AGENCIA DO IBGE EM/i } } },
      { $group: { _id: { uorg: '$uorgExercicio', uf: '$ufExercicio' } } }
    ]);
    
    const agenciasLotacao = await ServidorIBGE.aggregate([
      { $match: { uorgLotacao: { $regex: /^AGENCIA DO IBGE EM/i } } },
      { $group: { _id: { uorg: '$uorgLotacao', uf: '$ufExercicio' } } }
    ]);

    const allAgencias = [...agenciasExercicio, ...agenciasLotacao];
    const map = new Map<string, { nome: string, query: string, uf: string }>();

    for (const item of allAgencias) {
      if (!item._id.uorg) continue;
      
      const uorg = item._id.uorg;
      let uf = item._id.uf;
      let nomeCidade = uorg.replace(/^AGENCIA DO IBGE EM /i, '').trim();

      const parts = nomeCidade.split('/');
      if (parts.length > 1) {
        uf = parts[parts.length - 1]; // Extrai UF da string (ex: /SP)
        nomeCidade = parts.slice(0, -1).join('/'); // Pega só o nome
      }

      if (uf === '-1' || !uf || uf === 'Sem informação') {
        uf = 'OUTROS';
      }

      if (!map.has(uorg)) {
        map.set(uorg, {
          nome: nomeCidade,
          query: uorg, // O query exacto para bater no endpoint de busca
          uf: uf.toUpperCase()
        });
      } else if (uf !== 'OUTROS' && map.get(uorg)!.uf === 'OUTROS') {
        // Se já existe mas era OUTROS e agora temos uma UF válida, atualizamos
        map.get(uorg)!.uf = uf.toUpperCase();
      }
    }

    const cidadesPorEstado: Record<string, { nome: string, query: string }[]> = {};
    const agenciasAgrupadas = Array.from(map.values());

    for (const a of agenciasAgrupadas) {
      if (!cidadesPorEstado[a.uf]) {
        cidadesPorEstado[a.uf] = [];
      }
      cidadesPorEstado[a.uf].push({ nome: a.nome, query: a.query });
    }

    const estados = Object.keys(cidadesPorEstado).sort();
    
    // Ordenar cidades em cada estado
    for (const uf of estados) {
      cidadesPorEstado[uf].sort((a, b) => a.nome.localeCompare(b.nome));
    }
    
    // Buscar a data de atualização mais recente
    const lastUpdateDoc = await ServidorIBGE.findOne().sort({ ultimaAtualizacao: -1 }).select('ultimaAtualizacao').lean();
    const ultimaAtualizacao = lastUpdateDoc ? lastUpdateDoc.ultimaAtualizacao : null;

    return NextResponse.json({
      estados,
      cidadesPorEstado,
      ultimaAtualizacao
    });
  } catch (error) {
    console.error('Erro na rota de agências IBGE:', error);
    return NextResponse.json({ error: 'Erro interno ao buscar agências' }, { status: 500 });
  }
}
