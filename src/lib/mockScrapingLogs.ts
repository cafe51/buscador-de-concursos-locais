import { ScrapingLog } from './storage';

export function obterMockLogs(): ScrapingLog[] {
  const agora = Date.now();
  
  return [
    {
      id: "mock-1-realistico",
      inicio: new Date(agora - 1000 * 60 * 5).toISOString(), // 5 mins ago
      fim: new Date(agora - 1000 * 60 * 5 + 273381).toISOString(), // duration 273.38s
      duracaoSegundos: 273.38,
      tentativas: 4,
      status: "falha_parcial",
      totalEditais: 3219,
      detalhesCidades: [
        { cidade: "Jales (Câmara)", sucesso: true, itens: 39, tentativaSucesso: 1, tempoGastoSegundos: 0.86 },
        { cidade: "Jales", sucesso: true, itens: 174, tentativaSucesso: 1, tempoGastoSegundos: 1.60 },
        { cidade: "Fernandópolis (Câmara)", sucesso: true, itens: 41, tentativaSucesso: 1, tempoGastoSegundos: 2.00 },
        { cidade: "Fernandópolis", sucesso: true, itens: 336, tentativaSucesso: 1, tempoGastoSegundos: 56.01 },
        { cidade: "Macedônia", sucesso: true, itens: 24, tentativaSucesso: 1, tempoGastoSegundos: 0.54 },
        { cidade: "Guarani d'Oeste", sucesso: true, itens: 7, tentativaSucesso: 1, tempoGastoSegundos: 4.99 },
        { cidade: "Estrela d'Oeste", sucesso: true, itens: 307, tentativaSucesso: 1, tempoGastoSegundos: 6.00 },
        { cidade: "Meridiano", sucesso: false, itens: 0, tentativaSucesso: 0, tempoGastoSegundos: 85.00, erro: "Tempo limite de 85s excedido" },
        { cidade: "Pedranópolis", sucesso: true, itens: 23, tentativaSucesso: 1, tempoGastoSegundos: 9.49 },
        { cidade: "São João das Duas Pontes", sucesso: true, itens: 100, tentativaSucesso: 1, tempoGastoSegundos: 10.31 },
        { cidade: "Meridiano (Câmara)", sucesso: true, itens: 7, tentativaSucesso: 1, tempoGastoSegundos: 14.23 },
        { cidade: "Votuporanga", sucesso: true, itens: 913, tentativaSucesso: 1, tempoGastoSegundos: 50.35 },
        { cidade: "Votuporanga (Câmara)", sucesso: true, itens: 14, tentativaSucesso: 1, tempoGastoSegundos: 2.09 },
        { cidade: "Mira Estrela", sucesso: true, itens: 1, tentativaSucesso: 1, tempoGastoSegundos: 5.75 },
        { cidade: "Ouroeste", sucesso: true, itens: 93, tentativaSucesso: 1, tempoGastoSegundos: 7.80 },
        { cidade: "Mira Estrela (Câmara)", sucesso: true, itens: 16, tentativaSucesso: 1, tempoGastoSegundos: 8.88 },
        { cidade: "Indiaporã (Câmara)", sucesso: true, itens: 9, tentativaSucesso: 1, tempoGastoSegundos: 3.12 },
        { cidade: "Indiaporã", sucesso: true, itens: 21, tentativaSucesso: 1, tempoGastoSegundos: 6.48 },
        { cidade: "Álvares Florence", sucesso: true, itens: 158, tentativaSucesso: 1, tempoGastoSegundos: 10.21 },
        { cidade: "Parisi", sucesso: true, itens: 57, tentativaSucesso: 1, tempoGastoSegundos: 10.51 },
        { cidade: "Parisi (Câmara)", sucesso: true, itens: 16, tentativaSucesso: 1, tempoGastoSegundos: 0.42 },
        { cidade: "Urânia", sucesso: true, itens: 59, tentativaSucesso: 1, tempoGastoSegundos: 3.97 },
        { cidade: "Vitória Brasil", sucesso: true, itens: 58, tentativaSucesso: 1, tempoGastoSegundos: 8.54 },
        { cidade: "Valentim Gentil", sucesso: true, itens: 605, tentativaSucesso: 1, tempoGastoSegundos: 61.78 },
        { cidade: "Pontalinda", sucesso: true, itens: 22, tentativaSucesso: 1, tempoGastoSegundos: 0.70 },
        { cidade: "Dolcinópolis", sucesso: true, itens: 23, tentativaSucesso: 1, tempoGastoSegundos: 0.72 },
        { cidade: "Santa Salete", sucesso: true, itens: 97, tentativaSucesso: 1, tempoGastoSegundos: 0.82 }
      ],
      syncInfo: {
        adicionados: 1,
        atualizados: 4,
        relatorioAdicoes: [
          { cidade: "Valentim Gentil", titulo: "EDITAL", link: "https://www.valentimgentil.sp.gov.br/editais/edital_de_abertura_concurso_pUblico_n_01-2026_26083546.pdf" }
        ],
        relatorioAtualizacoes: [
          { cidade: "Jales", titulo: "Edital de Abertura nº01-2024", link: "https://ecrie.com.br/sistema/conteudos/arquivo/a_149_0_1_18062024140329.pdf", mudancas: ["titulo: 'Edital' ➔ 'Edital de Abertura nº01-2024'"] },
          { cidade: "Jales", titulo: "Edital de Abertura", link: "https://ecrie.com.br/sistema/conteudos/arquivo/a_149_0_1_28122023103343.pdf", mudancas: ["titulo: 'Edital' ➔ 'Edital de Abertura'"] },
          { cidade: "Jales", titulo: "Edital de Abertura", link: "https://ecrie.com.br/sistema/conteudos/arquivo/a_149_0_1_29112023162852.pdf", mudancas: ["titulo: 'Edital' ➔ 'Edital de Abertura'"] },
          { cidade: "Jales", titulo: "Edital de Abertura", link: "https://ecrie.com.br/sistema/conteudos/arquivo/a_149_0_1_29112023162226.pdf", mudancas: ["titulo: 'Edital' ➔ 'Edital de Abertura'"] }
        ]
      }
    },
    {
      id: "mock-2-realistico",
      inicio: new Date(agora - 1000 * 60 * 60 * 12).toISOString(), // 12 hours ago
      fim: new Date(agora - 1000 * 60 * 60 * 12 + 150000).toISOString(),
      duracaoSegundos: 150.00,
      tentativas: 4,
      status: "falha_parcial",
      totalEditais: 3200,
      detalhesCidades: [
        { cidade: "Jales", sucesso: true, itens: 170, tentativaSucesso: 1, tempoGastoSegundos: 1.50 },
        { cidade: "Fernandópolis", sucesso: true, itens: 330, tentativaSucesso: 1, tempoGastoSegundos: 50.00 },
        { cidade: "Meridiano", sucesso: true, itens: 10, tentativaSucesso: 2, tempoGastoSegundos: 12.00 },
        { cidade: "Urânia", sucesso: false, itens: 50, tentativaSucesso: 0, tempoGastoSegundos: 16.00, aviso: true, erro: "Aviso: site com lentidão temporária, dados parciais extraídos." },
        { cidade: "Vitória Brasil", sucesso: false, itens: 0, tentativaSucesso: 0, tempoGastoSegundos: 10.00, erro: "FetchError: ENOTFOUND vitoriabrasil.sp.gov.br" }
      ],
      syncInfo: {
        adicionados: 0,
        atualizados: 0,
        relatorioAdicoes: [],
        relatorioAtualizacoes: []
      }
    },
    {
      id: "mock-3-realistico",
      inicio: new Date(agora - 1000 * 60 * 60 * 24).toISOString(), // 24 hours ago
      fim: new Date(agora - 1000 * 60 * 60 * 24 + 120000).toISOString(),
      duracaoSegundos: 120.00,
      tentativas: 1,
      status: "sucesso",
      totalEditais: 3100,
      detalhesCidades: [
        { cidade: "Jales", sucesso: true, itens: 160, tentativaSucesso: 1, tempoGastoSegundos: 1.40 },
        { cidade: "Fernandópolis", sucesso: true, itens: 320, tentativaSucesso: 1, tempoGastoSegundos: 45.00 },
        { cidade: "Votuporanga", sucesso: true, itens: 900, tentativaSucesso: 1, tempoGastoSegundos: 48.00 }
      ],
      syncInfo: {
        adicionados: 5,
        atualizados: 2,
        relatorioAdicoes: [
          { cidade: "Jales", titulo: "Concurso Público 01/2026", link: "https://exemplo.com/1" },
          { cidade: "Fernandópolis", titulo: "Processo Seletivo Educação", link: "https://exemplo.com/2" },
          { cidade: "Fernandópolis", titulo: "Gabarito Preliminar", link: "https://exemplo.com/3" },
          { cidade: "Votuporanga", titulo: "Convocação para Provas", link: "https://exemplo.com/4" },
          { cidade: "Votuporanga", titulo: "Resultado Final", link: "https://exemplo.com/5" }
        ],
        relatorioAtualizacoes: [
          { cidade: "Jales", titulo: "Edital de Abertura", link: "https://exemplo.com/old1", mudancas: ["statusGeral: 'aberto' ➔ 'encerrado'"] },
          { cidade: "Fernandópolis", titulo: "Processo Seletivo", link: "https://exemplo.com/old2", mudancas: ["titulo: 'Edital' ➔ 'Processo Seletivo'"] }
        ]
      }
    },
    {
      id: "mock-4-realistico",
      inicio: new Date(agora - 1000 * 60 * 60 * 48).toISOString(), // 48 hours ago
      fim: new Date(agora - 1000 * 60 * 60 * 48 + 5000).toISOString(),
      duracaoSegundos: 5.00,
      tentativas: 4,
      status: "falha",
      totalEditais: 0,
      detalhesCidades: [
        { cidade: "Jales", sucesso: false, itens: 0, tentativaSucesso: 0, tempoGastoSegundos: 5.00, erro: "Conexão rejeitada pelo servidor remoto (ECONNREFUSED)" },
        { cidade: "Fernandópolis", sucesso: false, itens: 0, tentativaSucesso: 0, tempoGastoSegundos: 5.00, erro: "Conexão rejeitada pelo servidor remoto (ECONNREFUSED)" }
      ]
    }
  ];
}
