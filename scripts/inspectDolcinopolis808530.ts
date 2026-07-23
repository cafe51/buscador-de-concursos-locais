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
  const base64Id = 'ODA4NTMw'; // Dolcinopolis 808530
  const urlPdf = `https://dosp.com.br/exibe_do.php?i=${base64Id}`;

  const res = await fetch(urlPdf);
  const buffer = Buffer.from(await res.arrayBuffer());

  const textoPag1 = await extrairTextoDePdf(buffer, { fPagina: 1, lPagina: 1, layout: false });
  console.log('📌 Sumário (Página 1) de Dolcinópolis 808530:');
  console.log(textoPag1);

  process.exit(0);
}

main().catch(console.error);
