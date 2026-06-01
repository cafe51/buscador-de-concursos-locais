import { list } from '@vercel/blob';
import connectToDatabase from '../src/lib/mongodb';
import { EditalModel } from '../src/models/Edital';
import { ScrapingLogModel } from '../src/models/ScrapingLog';
import { MetadataModel } from '../src/models/Metadata';

async function migrate() {
  console.log("🚀 Iniciando migração do Vercel Blob para MongoDB...");
  
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error("ERRO: BLOB_READ_WRITE_TOKEN não encontrado nas variáveis de ambiente.");
    process.exit(1);
  }
  
  if (!process.env.MONGODB_URI) {
    console.error("ERRO: MONGODB_URI não encontrado nas variáveis de ambiente.");
    process.exit(1);
  }

  try {
    await connectToDatabase();
    console.log("✅ Conectado ao MongoDB!");

    console.log("Listando arquivos do Vercel Blob...");
    const { blobs } = await list();
    
    // Migrar Editais
    const fileEditais = blobs.find(b => b.pathname === 'editais.json');
    if (fileEditais) {
      console.log(`Baixando ${fileEditais.pathname}...`);
      const res = await fetch(fileEditais.downloadUrl, { headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` } });
      const editais = await res.json();
      console.log(`Inserindo ${editais.length} editais no MongoDB...`);
      await EditalModel.deleteMany({});
      await EditalModel.insertMany(editais);
      console.log("✅ Editais migrados com sucesso!");
    } else {
      console.log("⚠️ Arquivo editais.json não encontrado no Blob.");
    }
    
    // Migrar Logs
    const fileLogs = blobs.find(b => b.pathname === 'scraping-logs.json');
    if (fileLogs) {
      console.log(`Baixando ${fileLogs.pathname}...`);
      const res = await fetch(fileLogs.downloadUrl, { headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` } });
      const logs = await res.json();
      console.log(`Inserindo ${logs.length} logs no MongoDB...`);
      await ScrapingLogModel.deleteMany({});
      await ScrapingLogModel.insertMany(logs);
      console.log("✅ Logs migrados com sucesso!");
    } else {
      console.log("⚠️ Arquivo scraping-logs.json não encontrado no Blob.");
    }
    
    // Migrar Metadata
    const fileMeta = blobs.find(b => b.pathname === 'metadata.json');
    if (fileMeta) {
      console.log(`Baixando ${fileMeta.pathname}...`);
      const res = await fetch(fileMeta.downloadUrl, { headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` } });
      const meta = await res.json();
      if (meta && meta.ultimaAtualizacao) {
        console.log(`Inserindo Metadata no MongoDB...`);
        await MetadataModel.updateOne({ key: 'global' }, { $set: { ultimaAtualizacao: meta.ultimaAtualizacao } }, { upsert: true });
        console.log("✅ Metadata migrado com sucesso!");
      }
    } else {
      console.log("⚠️ Arquivo metadata.json não encontrado no Blob.");
    }
    
    console.log("🎉 MIGRAÇÃO CONCLUÍDA COM SUCESSO!");
    process.exit(0);
  } catch (e) {
    console.error("❌ Erro na migração:", e);
    process.exit(1);
  }
}

migrate();
