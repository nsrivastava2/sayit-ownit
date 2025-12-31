/**
 * Backfill stock_id for existing recommendations
 *
 * This script attempts to match existing recommendations to the stocks table
 * using nse_symbol and share_name fields.
 *
 * Usage: node scripts/backfill-stock-ids.js
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'sayitownit',
  user: process.env.DB_USER || 'sayitownit',
  password: process.env.DB_PASSWORD || 'sayitownit123',
});

async function resolveStock(nseSymbol, shareName) {
  // Try exact symbol match first
  if (nseSymbol) {
    const result = await pool.query(`
      SELECT id, symbol FROM stocks
      WHERE UPPER(symbol) = UPPER($1) AND is_active = true
      LIMIT 1
    `, [nseSymbol]);

    if (result.rows[0]) {
      return result.rows[0];
    }
  }

  // Try fuzzy match on company name or symbol
  if (shareName) {
    const result = await pool.query(`
      SELECT id, symbol FROM stocks
      WHERE is_active = true
        AND (
          company_name ILIKE $1
          OR UPPER(symbol) = UPPER($2)
        )
      ORDER BY
        CASE WHEN UPPER(symbol) = UPPER($2) THEN 0 ELSE 1 END
      LIMIT 1
    `, [`%${shareName}%`, shareName]);

    if (result.rows[0]) {
      return result.rows[0];
    }
  }

  return null;
}

async function backfillStockIds() {
  console.log('Starting stock_id backfill...');

  // Get recommendations without stock_id
  const result = await pool.query(`
    SELECT id, nse_symbol, share_name
    FROM recommendations
    WHERE stock_id IS NULL
  `);

  console.log(`Found ${result.rows.length} recommendations to backfill`);

  if (result.rows.length === 0) {
    console.log('No recommendations need backfilling.');
    await pool.end();
    return;
  }

  let updated = 0;
  let notFound = 0;
  const unresolved = [];

  for (const rec of result.rows) {
    const stock = await resolveStock(rec.nse_symbol, rec.share_name);

    if (stock) {
      await pool.query(
        'UPDATE recommendations SET stock_id = $1 WHERE id = $2',
        [stock.id, rec.id]
      );
      updated++;
      console.log(`  ✓ Matched: ${rec.nse_symbol || rec.share_name} → ${stock.symbol}`);
    } else {
      notFound++;
      const name = rec.nse_symbol || rec.share_name || 'Unknown';
      if (!unresolved.includes(name)) {
        unresolved.push(name);
      }
      console.log(`  ✗ Could not resolve: ${name}`);
    }
  }

  console.log('\n=== Backfill Summary ===');
  console.log(`Updated: ${updated}`);
  console.log(`Not found: ${notFound}`);

  if (unresolved.length > 0) {
    console.log('\nUnresolved stock names (may need to add to stocks table):');
    unresolved.forEach(name => console.log(`  - ${name}`));
  }

  await pool.end();
}

backfillStockIds().catch(err => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
