import { exec } from 'child_process';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import * as util from 'util';

const execAsync = util.promisify(exec);

export async function converterWordParaPdf(buffer: Buffer, isDocx: boolean): Promise<Buffer> {
  const ext = isDocx ? '.docx' : '.doc';
  const id = crypto.randomUUID();
  const tempWordPath = path.join(os.tmpdir(), `${id}${ext}`);
  const outDir = os.tmpdir();
  const tempPdfPath = path.join(outDir, `${id}.pdf`);

  try {
    fs.writeFileSync(tempWordPath, buffer);
    
    // O comando 'soffice' invoca o LibreOffice
    const command = `soffice --headless --convert-to pdf "${tempWordPath}" --outdir "${outDir}"`;
    await execAsync(command);

    if (!fs.existsSync(tempPdfPath)) {
      throw new Error('Falha na conversão para PDF: LibreOffice não gerou o arquivo de saída.');
    }

    const pdfBuffer = fs.readFileSync(tempPdfPath);
    return pdfBuffer;
  } finally {
    // Limpeza de rastro no SO
    if (fs.existsSync(tempWordPath)) fs.unlinkSync(tempWordPath);
    if (fs.existsSync(tempPdfPath)) fs.unlinkSync(tempPdfPath);
  }
}
