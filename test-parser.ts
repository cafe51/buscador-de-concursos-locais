import { obterBufferDoDocumento } from './src/lib/docParser';
import * as cheerio from 'cheerio';

async function main() {
  const url = "https://www.parisi.sp.leg.br/transparencia/concurso-publico/2019/4-julgamento-dos-recursos-gabarito-concurso-01_2019";
  const res = await fetch(url);
  const html = await res.text();
  console.log("Original HTML size:", html.length);
  const $ = cheerio.load(html);
  
  // Find iframe or script
  const iframe = $('iframe').attr('src');
  console.log("iframe src:", iframe);
  
  const jsRedirect = html.match(/window\.location(?:\.href)?\s*=\s*['"]([^'"]+)['"]/i);
  console.log("jsRedirect:", jsRedirect ? jsRedirect[1] : null);

  // Check hrefs that look like drive
  const aTags = $('a').map((i, el) => $(el).attr('href')).get();
  const driveLink = aTags.find(h => h && h.includes('drive.google.com/file/d/'));
  console.log("driveLink:", driveLink);
}
main().catch(console.error);
