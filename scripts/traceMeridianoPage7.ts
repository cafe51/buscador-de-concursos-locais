import fs from 'fs';
import path from 'path';

const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*["']?(.*?)["']?\s*$/);
    if (match) {
      process.env[match[1]] = match[2];
    }
  });
}

import { extrairTextoDePdf } from '../src/lib/pdfParserModern';

async function main() {
  const base64Id = 'ODEyNzU1'; // Meridiano 812755
  const urlPdf = `https://dosp.com.br/exibe_do.php?i=${base64Id}`;

  const res = await fetch(urlPdf);
  const buffer = Buffer.from(await res.arrayBuffer());

  const textoPag7 = await extrairTextoDePdf(buffer, { fPagina: 7, lPagina: 7, layout: true });

  let texto = textoPag7.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();

  const regexSujeiraNumerica = /(CONVOCACAO|RETIFICACAO|HOMOLOGACAO|ATRIBUI[CQ]AO|CLASSIFICACAO|RESULTADO|PORTARIA|DECRETO|ERRATA|GABARITO|CHAMADA|RECOMENDACAO ADMINISTRATIVA)(?:(?!CONCUR|SELETIV|\bPS\b)[^\d]){0,25}?\d{1,3}[\s\/\-_\.]+\d{2,4}/g;
  texto = texto.replace(regexSujeiraNumerica, '');

  console.log('📌 Texto limpo em extrairIdConcurso:');
  console.log(texto);

  const regexConcurso = /\b(CONCUR[A-Z]*|SELETIVO|SELECAO|\bPS\b)[^\d]{0,40}?(\d{1,3})[\s\/\-_\.]+(\d{2}|\d{4})\b(?!\s*[\/\-_\.]\s*\d{2,4})/;
  const match = texto.match(regexConcurso);

  console.log('\n📌 Match de regexConcurso:');
  console.log(match);

  process.exit(0);
}

main().catch(console.error);
