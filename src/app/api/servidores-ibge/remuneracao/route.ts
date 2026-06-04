import { NextResponse } from 'next/server';

const API_KEY = process.env.PORTAL_TRANSPARENCIA_API_KEY;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Parâmetro id é obrigatório' }, { status: 400 });
  }

  if (!API_KEY) {
    return NextResponse.json({ error: 'Chave de API não configurada no servidor' }, { status: 500 });
  }

  try {
    const today = new Date();
    let year = today.getFullYear();
    let month = today.getMonth() + 1; // 1 to 12

    // Tentamos os últimos 4 meses, pois a folha tem atraso de 1 a 3 meses geralmente
    for (let i = 0; i < 4; i++) {
      let m = month - i;
      let y = year;
      if (m <= 0) {
        m += 12;
        y -= 1;
      }
      const mesAno = `${y}${m.toString().padStart(2, '0')}`;
      const url = `https://api.portaldatransparencia.gov.br/api-de-dados/servidores/remuneracao?id=${id}&mesAno=${mesAno}&pagina=1`;
      
      const res = await fetch(url, { 
        headers: { 'chave-api-dados': API_KEY },
        next: { revalidate: 86400 } // cache de 1 dia para não estourar limite da API
      });
      
      if (!res.ok) continue;

      const data = await res.json();
      if (data && data.length > 0 && data[0].remuneracoesDTO && data[0].remuneracoesDTO.length > 0) {
        const rem = data[0].remuneracoesDTO[0];
        return NextResponse.json({
          mesReferencia: rem.mesAnoPorExtenso,
          bruta: rem.remuneracaoBasicaBruta,
          liquida: rem.valorTotalRemuneracaoAposDeducoes,
          verbasIndenizatorias: rem.verbasIndenizatorias,
          impostoRetido: rem.impostoRetidoNaFonte,
          previdencia: rem.previdenciaOficial,
          outrasDeducoes: rem.outrasDeducoesObrigatorias,
          gratificacaoNatalina: rem.gratificacaoNatalina,
          ferias: rem.ferias,
          outrasRemuneracoes: rem.outrasRemuneracoesEventuais
        });
      }
    }

    return NextResponse.json({ error: 'Nenhuma remuneração encontrada nos últimos 4 meses.' }, { status: 404 });
  } catch (error) {
    console.error('Erro na rota de remuneração:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
