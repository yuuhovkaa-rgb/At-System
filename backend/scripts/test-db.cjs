// Creates/resets the schema of the TEST database (never touches DATABASE_URL).
require('dotenv').config();
const { spawnSync } = require('child_process');
const url = process.env.TEST_DATABASE_URL;
if (!url || !/test/i.test(new URL(url).pathname)) {
  console.error('Set TEST_DATABASE_URL in backend/.env to a database whose name contains "test".');
  process.exit(1);
}
const r = spawnSync('npx', ['prisma', 'db', 'push', '--skip-generate', '--force-reset', '--accept-data-loss'], { stdio: 'inherit', shell: true, env: { ...process.env, DATABASE_URL: url } });
process.exit(r.status ?? 1);
