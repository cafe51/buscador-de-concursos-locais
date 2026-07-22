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
import { extrairIdConcurso } from '../src/lib/filtrosGlobais';

async function main() {
  const base64Id = 'ODEyNzU1'; // Meridiano 812755
  const urlPdf = `https://dosp.com.br/exibe_do.php?i=${base64Id}`;

  const res = await fetch(urlPdf);
  const buffer = Buffer.from(await res.arrayBuffer());

  for (let p = 7; p <= 11; p++) {
    const txt = await extrairTextoDePdf(buffer, { fPagina: p, lPagina: p, layout: true });
    console.log(`\n=================== PÁGINA ${p} ===================`);
    console.log(txt);
    console.log(`extrairIdConcurso na página ${p}:`, extrairIdConcurso(txt, '', true, false));
  }

  process.exit(0);
}

main().catch(console.error);
