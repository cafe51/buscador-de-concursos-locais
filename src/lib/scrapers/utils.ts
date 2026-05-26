// src/lib/scrapers/utils.ts

/**
 * Faz uma requisição HTTP com os headers padrão para simular um navegador real,
 * retornando o HTML da página ou vazio em caso de erro.
 */
export async function fetchHtml(url: string, forceCache: boolean = false): Promise<{ ok: boolean, html: string, status: number }> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
      },
      cache: forceCache ? 'force-cache' : 'no-store'
    });

    if (!res.ok) {
      return { ok: false, html: '', status: res.status };
    }

    const html = await res.text();
    return { ok: true, html, status: res.status };
  } catch (err: any) {
    return { ok: false, html: '', status: 0 };
  }
}

/**
 * Extrai a data no formato DD/MM/YYYY, DD.MM.YYYY ou DD-MM-YYYY de um texto.
 * Retorna a data formatada (DD/MM/YYYY) e o timestamp em milissegundos.
 */
export function extrairData(texto: string): { dataFormatada: string, dataTimestamp: number } | null {
  if (!texto) return null;
  
  // Corrige "1º" para "01" antes de tentar encontrar a data
  const textoCorrigido = texto.replace(/1[º°o]\s*[\/\.\-]/gi, '01/');
  
  const matchData = textoCorrigido.match(/\b(\d{1,2})[\/\.\-](\d{2})[\/\.\-](\d{4})\b/);
  
  if (matchData) {
    const dia = matchData[1].padStart(2, '0');
    const mes = matchData[2];
    const ano = matchData[3];
    return {
      dataFormatada: `${dia}/${mes}/${ano}`,
      dataTimestamp: new Date(`${ano}-${mes}-${dia}T00:00:00`).getTime()
    };
  }
  
  return null;
}

/**
 * Limpa títulos de documentos removendo palavras genéricas (download, anexo, etc)
 * e limpando pontuações/números inúteis no começo da string.
 */
export function limparTituloDoc(tituloOriginal: string, textoFallback: string = ''): string {
  let titulo = tituloOriginal.replace(/\s+/g, ' ').trim();
  
  // Substitui 1º, 1° ou 1o por 01 (comum em prefeituras)
  titulo = titulo.replace(/1[º°o]\s*[\/\.]/gi, '01/');

  const palavrasGenericas = ['download', 'ver', 'anexo', 'clique aqui', 'acessar', 'arquivo'];
  
  if (!titulo || palavrasGenericas.includes(titulo.toLowerCase())) {
    titulo = textoFallback;
  } else if (titulo.toLowerCase() === 'edital') {
    if (textoFallback.toLowerCase().includes('abertura')) {
      titulo = textoFallback;
    } else {
      titulo = 'Edital de Abertura';
    }
  }
  
  if (/^[\d\/\.\-\s]+$/.test(titulo)) {
    titulo = textoFallback;
  }

  // Remove lixos numéricos ou barras no início
  titulo = titulo.replace(/^[\d\/\.\-\s\|]+/, '').trim();
  if (titulo.startsWith('-') || titulo.startsWith('|')) {
    titulo = titulo.substring(1).trim();
  }

  // Remove termos desnecessários que o limpador do filtro geral não pega
  titulo = titulo.replace(/(Concurso P[úu]blico|Processo Seletivo).*?[\-\|]/i, '').trim();
  titulo = titulo.replace(/\b\d{1,2}[\/\.\-]\d{2}[\/\.\-]\d{4}\b/g, '').trim(); // Limpa datas do meio do nome

  return titulo.trim();
}
