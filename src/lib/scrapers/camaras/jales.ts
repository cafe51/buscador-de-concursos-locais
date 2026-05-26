// src/lib/scrapers/camaras/jales.ts
import * as cheerio from 'cheerio';
import { Edital } from '../../../types';
import { ehSujeira, extrairIdConcurso, corrigirErrosDigitacao } from '../../filtrosGlobais';
import { extrairTextoBruto } from '../../docParser';

export async function buscarCamaraJales(): Promise<Edital[]> {
  const resultados: Edital[] = [];
  let ordemGlobal = 0;
  const baseUrl = 'https://www.jales.sp.leg.br';
  const urlPagina = `${baseUrl}/concurso-publico`;

  try {
    const res = await fetch(urlPagina, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
      }, cache: 'no-store'
    });
    if (!res.ok) return [];

    const html = await res.text();
    const $ = cheerio.load(html);

    // 🚀 FOCO CIRÚRGICO: Navega exatamente na hierarquia solicitada
    const $tabelasConcursos = $('body#zoomcontent .content .container-fluid .row .col-lg-9 .content > table');

    if ($tabelasConcursos.length === 0) {
      console.log('🛑 [Câmara Jales] Nenhuma tabela de concurso encontrada na hierarquia especificada.');
      return [];
    }

    const pastasParaProcessar: any[] = [];

    $tabelasConcursos.each((_, tabela) => {
      const $linhas = $(tabela).find('tr');
      if ($linhas.length < 2) return;

      // Linha 1: Extrai o Ano (Ex: "Ano de 2024")
      const textoAno = $linhas.eq(0).text().trim();
      let anoConcurso: number | undefined;
      const matchAno = textoAno.match(/\b(\d{4})\b/);
      if (matchAno) anoConcurso = parseInt(matchAno[1], 10);

      // 🛑 REGRA ESTRITA: Ignora concursos anteriores a 2018
      if (anoConcurso && anoConcurso < 2018) return;

      // Linha 2: Extrai a Descrição e os Links
      const $tdConteudo = $linhas.eq(1).find('td');
      const descricao = $tdConteudo.find('p').text().replace(/\s+/g, ' ').trim();

      const documentosDestaPasta: any[] = [];

      $tdConteudo.find('a').each((indexDoc, aEl) => {
        const href = $(aEl).attr('href') || '';
        if (!href) return;

        const linkDoc = href.startsWith('http') ? href : `${baseUrl}${href}`;
        let textoA = $(aEl).text().replace(/\s+/g, ' ').trim();

        let dataFormatada = 'sem data';
        let dataTimestamp = 0;

        // O texto costuma ser "18/04/2024 - Edital Resumido"
        const matchData = textoA.match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/);
        if (matchData) {
          dataFormatada = matchData[0];
          dataTimestamp = new Date(`${matchData[3]}-${matchData[2]}-${matchData[1]}T00:00:00`).getTime();
          // Remove a data do título
          textoA = textoA.replace(matchData[0], '').trim();
        }

        // ==============================================================
        // 🚀 O NORMALIZADOR ABSOLUTO DE TÍTULOS
        // Arranca tudo no início do texto que NÃO seja letra (A-Z, acentos) ou número (0-9).
        // Isso vaporiza na hora pontos, traços, pipes, espaços vazios ou símbolos estranhos.
        // ==============================================================
        let tituloDoc = textoA.replace(/^[^a-zA-Z0-9À-ÿ]+/, '').trim();

        if (!tituloDoc) tituloDoc = 'Documento Anexo';

        if (ehSujeira(tituloDoc, [], linkDoc)) return;

        // 🚀 ORDENAÇÃO: Como os editais em Jales são listados do mais velho pro mais novo (top to bottom),
        // adicionamos minutos extras baseados no index para que os últimos subam para o topo do nosso App!
        dataTimestamp += (indexDoc * 60000);

        documentosDestaPasta.push({
          titulo: tituloDoc,
          link: linkDoc,
          dataFormatada,
          dataTimestamp
        });
      });

      if (documentosDestaPasta.length > 0) {
        pastasParaProcessar.push({
          anoConcurso,
          descricao,
          documentos: documentosDestaPasta
        });
      }
    });

    // ========================================================================
    // 🧠 LEITOR DE PDFS (Fila de Prioridade para achar o nome do Concurso)
    // ========================================================================
    function obterPrioridade(titulo: string): number {
      const t = titulo.toLowerCase();
      if (t.includes('resumido')) return 1;
      if (t.includes('extrato')) return 2;
      if (t.includes('completo')) return 3;
      if (t.includes('abertura')) return 4;
      if (t.includes('edital')) return 5;
      return 99; // Fundo da fila
    }

    await Promise.all(pastasParaProcessar.map(async (pasta) => {
      let idConcursoDefinitivo = '';

      // Ordena uma cópia dos documentos baseada na nossa Fila de Prioridade
      const documentosPriorizados = [...pasta.documentos].sort((a, b) => {
        return obterPrioridade(a.titulo) - obterPrioridade(b.titulo);
      });

      // Tenta ler os PDFs na ordem de prioridade
      for (const doc of documentosPriorizados) {
        if (doc.link.toLowerCase().endsWith('.pdf')) {
          try {
            const textoPdf = await extrairTextoBruto(doc.link);
            if (textoPdf) {
              const cleanTexto = textoPdf.replace(/\s+/g, ' ');
              const idExtraido = extrairIdConcurso(corrigirErrosDigitacao(cleanTexto), '');

              if (idExtraido) {
                idConcursoDefinitivo = idExtraido;
                break; // Achou o ID! Interrompe o loop de downloads.
              }
            }
          } catch (e) { }
        }
      }

      // Se nenhum PDF salvou o dia, aplica o Fallback Rústico
      if (!idConcursoDefinitivo) {
        const descUpper = pasta.descricao.toUpperCase();
        const modalidade = descUpper.includes('PROCESSO SELETIVO') ? 'Processo Seletivo' : 'Concurso Público';
        idConcursoDefinitivo = `${modalidade} ${pasta.anoConcurso || 'Não Identificado'}`;
      }

      if (idConcursoDefinitivo.startsWith('Concurso ')) {
        idConcursoDefinitivo = idConcursoDefinitivo.replace('Concurso ', 'Concurso Público ');
      }

      // Monta os cards finais
      pasta.documentos.forEach((doc: any) => {
        ordemGlobal++;
        resultados.push({
          cidade: 'Jales',
          orgao: 'Câmara Municipal',
          titulo: doc.titulo,
          descricao: pasta.descricao ? pasta.descricao.substring(0, 100) + '...' : undefined,
          concurso: idConcursoDefinitivo,
          ano: pasta.anoConcurso,
          link: doc.link,
          dataPublicacao: doc.dataFormatada,
          dataTimestamp: doc.dataTimestamp,
          ordemOriginal: ordemGlobal,
          linkOrigem: urlPagina
        });
      });
    }));

  } catch (error: any) {
    const cause = (error as any).cause;
    const causeMsg = cause ? " - Detalhes: " + (cause.message || cause.code || JSON.stringify(cause)) : "";
    throw new Error('Erro geral ao buscar Câmara Jales' + ": " + (error as Error).message + causeMsg);
  }

  return resultados;
}