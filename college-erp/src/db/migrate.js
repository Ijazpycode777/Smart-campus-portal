// Run database migrations (create tables if they do not exist).
const { migrate } = require('./schema');
const { closeDb } = require('./connection');

migrate();
closeDb();
process.exit(0);
