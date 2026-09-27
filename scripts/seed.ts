import { openCliDb, cliDbPath } from './_db';
import { runMigrations, seedIfEmpty } from '../db/migrator';

const db = openCliDb();
console.log(`[seed] db: ${cliDbPath()}`);
runMigrations(db);
seedIfEmpty(db);
db.close();
console.log('[seed] done');
