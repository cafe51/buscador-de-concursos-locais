async function main() {
  const res = await fetch("https://www.parisi.sp.leg.br/transparencia/concurso-publico/2019/4-julgamento-dos-recursos-gabarito-concurso-01_2019");
  console.log("Final URL:", res.url);
  
  if (res.url.includes('drive.google.com/file/d/')) {
    const match = res.url.match(/file\/d\/([a-zA-Z0-9_-]+)/);
    if (match) {
      console.log("ID:", match[1]);
      const direct = `https://drive.google.com/uc?export=download&id=${match[1]}`;
      console.log("Direct:", direct);
      
      const res2 = await fetch(direct);
      console.log("Direct final URL:", res2.url);
      console.log("Direct content type:", res2.headers.get('content-type'));
      const buffer = await res2.arrayBuffer();
      console.log("Is PDF?", Buffer.from(buffer).toString('hex', 0, 4) === '25504446');
    }
  }
}
main().catch(console.error);
