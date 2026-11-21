// Reset the database: drop all data files and re-create schema + seed.
const fs = require('fs');
const path = require('path');
const { closeDb } = require('./connection');
const { migrate } = require('./schema');
const { seed } = require('./seed');

const dbPath = process.env.DATABASE_PATH || './data/college_erp.sqlite';
const absPath = path.resolve(dbPath);

['', '-wal', '-shm', '-journal'].forEach(ext => {
  const p = absPath + ext;
  if (fs.existsSync(p)) {
    fs.unlinkSync(p);
    console.log(`✓ removed ${path.basename(p)}`);
  }
});

closeDb();
migrate();
seed();
closeDb();
console.log('✓ Database reset complete.');
process.exit(0);
