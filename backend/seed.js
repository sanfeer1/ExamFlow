const { pool, initDB } = require('./db');

async function runSeed() {
    console.log('Running database initialization and demo data seeding...');
    await initDB();
    console.log('Seeding completed successfully!');
    await pool.end();
    process.exit(0);
}

runSeed().catch(err => {
    console.error('Seeding failed:', err);
    process.exit(1);
});
