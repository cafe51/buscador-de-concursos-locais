import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import ServidorIBGE from '@/models/ServidorIBGE';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const cidade = searchParams.get('cidade');

  if (!cidade) {
    return NextResponse.json({ error: 'Parâmetro cidade é obrigatório' }, { status: 400 });
  }

  try {
    await connectToDatabase();

    // Filtra servidores onde uorgExercicio ou uorgLotacao contém o nome da cidade.
    // Usamos $regex com option 'i' (case insensitive).
    const regex = new RegExp(cidade, 'i');
    
    const servidores = await ServidorIBGE.find({
      $or: [
        { uorgExercicio: { $regex: regex } },
        { uorgLotacao: { $regex: regex } }
      ]
    })
    .sort({ nome: 1 })
    .select('idServidor nome situacao uorgExercicio uorgLotacao ufExercicio cpfFormatado rawData')
    .lean();

    // Deduplicação pelo CPF ou Nome (pois o Portal da Transparência cria um ID diferente para cargo e função)
    const map = new Map();
    for (const srv of servidores) {
      const key = srv.cpfFormatado || srv.nome;
      if (!map.has(key)) {
        map.set(key, srv);
      } else {
        const existing = map.get(key);
        const existingFuncao = existing.rawData?.servidor?.funcao?.codigoFuncaoCargo;
        const currentFuncao = srv.rawData?.servidor?.funcao?.codigoFuncaoCargo;
        
        // Se o documento atual tiver uma função válida (diferente de -1) e o existente não, atualizamos
        if (existingFuncao === '-1' && currentFuncao && currentFuncao !== '-1') {
          map.set(key, srv);
        }
      }
    }

    const servidoresUnicos = Array.from(map.values());

    return NextResponse.json({
      cidade,
      total: servidoresUnicos.length,
      servidores: servidoresUnicos
    });
  } catch (error) {
    console.error('Erro na rota de servidores IBGE:', error);
    return NextResponse.json({ error: 'Erro interno ao buscar servidores' }, { status: 500 });
  }
}
