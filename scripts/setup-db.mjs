import fs from 'node:fs';
import pg from 'pg';
import bcrypt from 'bcryptjs';

const url = process.argv.includes('--test')
  ? process.env.TEST_DATABASE_URL
  : process.env.DATABASE_URL;
if (!url) throw new Error('Database URL is not set');
const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
const client = new pg.Client({
  connectionString: url,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});
await client.connect();
await client.query(fs.readFileSync('db/schema.sql', 'utf8'));

const hash = await bcrypt.hash('Demo@1234', 10);
const users = [
  ['supervisor@apparelflow.demo', 'cutting_supervisor', 'Cutting Supervisor'],
  ['verifier@apparelflow.demo', 'cutting_verifier', 'Cutting Verifier'],
  ['sewing@apparelflow.demo', 'sewing_supervisor', 'Sewing Supervisor'],
];
for (const [email, role, name] of users) {
  await client.query(
    `INSERT INTO users (email, password_hash, role, full_name)
     VALUES ($1,$2,$3,$4) ON CONFLICT (email) DO NOTHING`,
    [email, hash, role, name]
  );
}

const recipes = [
  ['REC-BL01', 'Casual Blouse', 'Blouse', 1.8, 5.0, [
    ['Front Body Panel', 1], ['Back Body Panel', 1], ['Sleeves (Left & Right)', 2],
    ['Collar & Stand', 1], ['Sleeve Cuffs', 2]]],
  ['REC-CT02', 'Crop Top', 'Crop Top', 1.1, 8.0, [
    ['Front Chest Panel', 1], ['Back Support Panel', 1], ['Neck Binding Strip', 1],
    ['Hem Elastic Casing', 1], ['Side Strap Accents', 2]]],
];
for (const [code, name, cat, yds, cap, comps] of recipes) {
  await client.query(
    `INSERT INTO recipes (recipe_code, name, category, std_fabric_yards, wastage_cap)
     VALUES ($1,$2,$3,$4,$5) ON CONFLICT (recipe_code) DO NOTHING`,
    [code, name, cat, yds, cap]
  );
  for (const [cname, pcs] of comps) {
    await client.query(
      `INSERT INTO recipe_components (recipe_id, component_name, pieces_per_garment)
       SELECT id, $2, $3 FROM recipes WHERE recipe_code = $1
       ON CONFLICT (recipe_id, component_name) DO NOTHING`,
      [code, cname, pcs]
    );
  }
}
await client.end();
console.log('DB ready');