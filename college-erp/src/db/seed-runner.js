// Convenience runner for npm run db:seed
require('dotenv').config();
const { seed } = require('./seed');
const { closeDb } = require('./connection');

seed();
closeDb();
process.exit(0);
