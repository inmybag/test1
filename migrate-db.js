const { initDb } = require('./src/lib/db');
require('dotenv').config({ path: '.env.local' });

async function migrate() {
    console.log('Running migration...');
    await initDb();
    console.log('Migration finished.');
    process.exit(0);
}

migrate();
