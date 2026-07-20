import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { EJSON } from 'bson';

const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    if (line.startsWith('MONGODB_URI=')) {
      process.env.MONGODB_URI = line.replace('MONGODB_URI=', '').replace(/"/g, '').trim();
    }
  }
}

async function backup() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌ MONGODB_URI não foi encontrada no arquivo .env.local');
    process.exit(1);
  }

  const dateStr = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
  const backupDir = path.resolve(process.cwd(), 'backups', `backup-${dateStr}`);

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  console.log(`🚀 Iniciando backup do banco de dados MongoDB...`);
  console.log(`📁 Diretório de destino: ${backupDir}\n`);

  try {
    await mongoose.connect(uri);
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Não foi possível obter a instância do banco de dados.');
    }

    const collections = await db.listCollections().toArray();
    console.log(`📦 Encontradas ${collections.length} coleções para exportação.\n`);

    const summary: Record<string, number> = {};

    for (const colInfo of collections) {
      const collectionName = colInfo.name;
      console.log(`⏳ Exportando coleção: ${collectionName}...`);

      const docs = await db.collection(collectionName).find({}).toArray();
      const filePath = path.join(backupDir, `${collectionName}.json`);

      // Usa EJSON para preservar tipos nativos do MongoDB (ObjectId, Date, etc.)
      const ejsonData = EJSON.stringify(docs, undefined, 2);
      fs.writeFileSync(filePath, ejsonData, 'utf-8');

      const fileSize = (fs.statSync(filePath).size / (1024 * 1024)).toFixed(2);
      console.log(`   ✅ ${docs.length} documentos salvos em ${collectionName}.json (${fileSize} MB)`);
      summary[collectionName] = docs.length;
    }

    // Salva um arquivo de resumo com informações da execução
    const infoPath = path.join(backupDir, 'backup-info.json');
    fs.writeFileSync(
      infoPath,
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          databaseName: db.databaseName,
          totalCollections: collections.length,
          collections: summary,
        },
        null,
        2
      )
    );

    console.log(`\n🎉 Backup concluído com sucesso em: ${backupDir}`);
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Erro durante o backup:', err);
    process.exit(1);
  }
}

backup();
