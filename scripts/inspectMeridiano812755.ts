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
import { extrairIdConcurso, corrigirErrosDigitacao } from '../src/lib/filtrosGlobais';

async function main() {
  const base64Id = 'ODEyNzU1'; // Meridiano 812755
  const urlPdf = `https://dosp.com.br/exibe_do.php?i=${base64Id}`;

  console.log(`📌 Inspecionando PDF de Meridiano ${base64Id} (Página 7)...`);
  const res = await fetch(urlPdf);
  const buffer = Buffer.from(await res.arrayBuffer());

  const textoPag7 = await extrairTextoDePdf(buffer, { fPagina: 7, lPagina: 7, layout: true });
  console.log('--- PÁGINA 7 (Texto Bruto) ---');
  console.log(textoPag7);

  const textoCorrigido = corrigirErrosDigitacao(textoPag7);
  console.log('\n--- Texto Corrigido ---');
  console.log(textoCorrigido);

  const idConcurso = extrairIdConcurso(textoCorrigido, '', true, false);
  console.log('\n--- ID Concurso Extraído via extrairIdConcurso ---');
  console.log('idConcurso:', idConcurso);

  process.exit(0);
}

main().catch(console.error);
