import { openCliDb, cliDbPath } from './_db';
import { runMigrations } from '../db/migrator';

const db = openCliDb();
console.log(`[migrate] db: ${cliDbPath()}`);
runMigrations(db);
db.close();
console.log('[migrate] done');
