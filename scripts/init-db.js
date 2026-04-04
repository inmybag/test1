const { initDb } = require('./src/lib/db');
require('dotenv').config({ path: '.env.local' });

async function run() {
  console.log('Initializing database...');
  await initDb();
  console.log('Done.');
  process.exit(0);
}

run();
