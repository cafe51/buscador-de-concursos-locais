import { obterBufferDoDocumento } from './src/lib/docParser';
async function main() {
  const result = await obterBufferDoDocumento("https://www.parisi.sp.leg.br/transparencia/concurso-publico/2019/4-julgamento-dos-recursos-gabarito-concurso-01_2019");
  console.log("Result type:", result ? Object.keys(result) : "null");
  if (result && result.isPDF) {
    console.log("It's a PDF!");
    console.log("Buffer size:", result.buffer.length);
  }
}
main().catch(console.error);
