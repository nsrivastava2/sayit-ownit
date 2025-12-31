/**
 * Import Official NSE and BSE Stock Data
 *
 * This script imports stock data from official NSE and BSE CSV files:
 * - NSE_EQUITY_L.csv (NSE equity list)
 * - BSE_Equity.csv (BSE equity list)
 *
 * Usage: node scripts/import-official-stocks.js
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'sayitownit',
  user: process.env.DB_USER || 'sayitownit',
  password: process.env.DB_PASSWORD || 'sayitownit123',
});

// Sector classification mapping based on common Indian stock sectors
const SECTOR_KEYWORDS = {
  'Information Technology': ['software', 'tech', 'computer', 'it ', 'digital', 'infotech', 'systems', 'consultancy'],
  'Financial Services': ['bank', 'finance', 'capital', 'insurance', 'credit', 'invest', 'fund', 'exchange', 'broker', 'nbfc', 'fintech'],
  'Healthcare': ['pharma', 'health', 'hospital', 'medical', 'drug', 'life sciences', 'biotech', 'diagnostic'],
  'Automobile': ['auto', 'motor', 'vehicle', 'tyre', 'tractor', 'scooter', 'two wheeler', 'car '],
  'FMCG': ['consumer', 'food', 'beverage', 'dairy', 'personal care', 'tobacco', 'fmcg'],
  'Oil & Gas': ['oil', 'gas', 'petroleum', 'refinery', 'lng', 'energy'],
  'Metals & Mining': ['steel', 'iron', 'metal', 'aluminium', 'copper', 'zinc', 'mining', 'mineral'],
  'Power': ['power', 'electric', 'energy', 'solar', 'wind', 'renewable', 'generation'],
  'Construction Materials': ['cement', 'concrete', 'building material'],
  'Real Estate': ['realty', 'real estate', 'property', 'housing', 'developers'],
  'Chemicals': ['chemical', 'fertilizer', 'agrochemical', 'pesticide', 'specialty chem'],
  'Telecommunication': ['telecom', 'communication', 'tower', 'mobile', 'cellular'],
  'Capital Goods': ['engineering', 'machinery', 'equipment', 'industrial', 'electrical equip'],
  'Consumer Durables': ['appliance', 'electronics', 'jewellery', 'paint', 'furniture'],
  'Textiles': ['textile', 'garment', 'apparel', 'fabric', 'yarn', 'cotton'],
  'Media': ['media', 'entertainment', 'broadcast', 'film', 'tv ', 'printing'],
  'Services': ['service', 'logistics', 'port', 'airport', 'hotel', 'travel', 'shipping'],
};

function inferSector(companyName) {
  const lowerName = companyName.toLowerCase();

  for (const [sector, keywords] of Object.entries(SECTOR_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerName.includes(keyword)) {
        return sector;
      }
    }
  }

  return null; // Unknown sector
}

function parseCSV(content, delimiter = ',') {
  const lines = content.split('\n');
  const headers = lines[0].split(delimiter).map(h => h.trim().replace(/"/g, ''));

  const data = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Handle quoted fields with commas inside
    const values = [];
    let current = '';
    let inQuotes = false;

    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    if (values.length >= headers.length - 2) { // Allow some flexibility
      const row = {};
      headers.forEach((header, idx) => {
        row[header] = values[idx] || '';
      });
      data.push(row);
    }
  }

  return data;
}

async function importNSEStocks() {
  console.log('\n=== Importing NSE Stocks ===');

  const nseFile = path.join(__dirname, '../../documentation/NSE_EQUITY_L.csv');

  if (!fs.existsSync(nseFile)) {
    console.error('NSE file not found:', nseFile);
    return { imported: 0, updated: 0, errors: 0 };
  }

  const content = fs.readFileSync(nseFile, 'utf-8');
  const stocks = parseCSV(content);

  console.log(`Found ${stocks.length} NSE stocks to process`);

  let imported = 0;
  let updated = 0;
  let errors = 0;

  for (const stock of stocks) {
    try {
      // NSE CSV columns: SYMBOL, NAME OF COMPANY, SERIES, DATE OF LISTING, PAID UP VALUE, MARKET LOT, ISIN NUMBER, FACE VALUE
      const symbol = stock['SYMBOL']?.trim();
      const companyName = stock['NAME OF COMPANY']?.trim();
      const isin = stock['ISIN NUMBER']?.trim();
      const series = stock[' SERIES']?.trim() || stock['SERIES']?.trim();

      // Skip non-equity series (like BE, BL, etc.) - we want EQ series
      if (series && series !== 'EQ') {
        continue;
      }

      if (!symbol || !companyName) {
        continue;
      }

      const sector = inferSector(companyName);

      const result = await pool.query(`
        INSERT INTO stocks (symbol, exchange, company_name, isin, sector, industry, market_cap_category, is_active)
        VALUES ($1, $2, $3, $4, $5, NULL, NULL, true)
        ON CONFLICT (symbol, exchange) DO UPDATE SET
          company_name = EXCLUDED.company_name,
          isin = COALESCE(EXCLUDED.isin, stocks.isin),
          sector = COALESCE(EXCLUDED.sector, stocks.sector),
          updated_at = NOW()
        RETURNING (xmax = 0) AS inserted
      `, [symbol, 'NSE', companyName, isin, sector]);

      if (result.rows[0]?.inserted) {
        imported++;
      } else {
        updated++;
      }
    } catch (error) {
      console.error(`Error importing NSE stock ${stock['SYMBOL']}:`, error.message);
      errors++;
    }
  }

  console.log(`NSE Import - New: ${imported}, Updated: ${updated}, Errors: ${errors}`);
  return { imported, updated, errors };
}

async function importBSEStocks() {
  console.log('\n=== Importing BSE Stocks ===');

  const bseFile = path.join(__dirname, '../../documentation/BSE_Equity.csv');

  if (!fs.existsSync(bseFile)) {
    console.error('BSE file not found:', bseFile);
    return { imported: 0, updated: 0, errors: 0, skipped: 0 };
  }

  const content = fs.readFileSync(bseFile, 'utf-8');
  const stocks = parseCSV(content);

  console.log(`Found ${stocks.length} BSE stocks to process`);

  let imported = 0;
  let updated = 0;
  let errors = 0;
  let skipped = 0;

  // First, get all existing NSE stocks by ISIN for cross-referencing
  const existingNSE = await pool.query(`
    SELECT symbol, isin FROM stocks WHERE exchange = 'NSE' AND isin IS NOT NULL
  `);
  const nseIsinMap = new Map(existingNSE.rows.map(r => [r.isin, r.symbol]));

  for (const stock of stocks) {
    try {
      // BSE CSV columns: Security Code, Issuer Name, Security Id, Security Name, Status, Group, Face Value, ISIN No, Instrument
      const securityId = stock['Security Id']?.trim();
      const issuerName = stock['Issuer Name']?.trim();
      const securityName = stock['Security Name']?.trim();
      const isin = stock['ISIN No']?.trim();
      const status = stock['Status']?.trim();
      const group = stock['Group']?.trim();

      // Skip inactive stocks
      if (status && status !== 'Active') {
        skipped++;
        continue;
      }

      // Skip if no symbol
      if (!securityId) {
        skipped++;
        continue;
      }

      // Clean up symbol (remove # suffix used in T0 securities)
      const symbol = securityId.replace(/#$/, '');

      // Use issuer name (full company name) or security name
      const companyName = issuerName || securityName || symbol;

      if (!companyName) {
        skipped++;
        continue;
      }

      // Check if this stock already exists in NSE (by ISIN)
      // If it does, we'll add it as BSE entry but with same classification
      const nseSymbol = nseIsinMap.get(isin);
      let sector = inferSector(companyName);

      // If exists in NSE, try to get its sector
      if (nseSymbol && !sector) {
        const nseStock = await pool.query(
          'SELECT sector FROM stocks WHERE symbol = $1 AND exchange = $2',
          [nseSymbol, 'NSE']
        );
        if (nseStock.rows[0]?.sector) {
          sector = nseStock.rows[0].sector;
        }
      }

      const result = await pool.query(`
        INSERT INTO stocks (symbol, exchange, company_name, isin, sector, industry, market_cap_category, is_active)
        VALUES ($1, $2, $3, $4, $5, NULL, NULL, true)
        ON CONFLICT (symbol, exchange) DO UPDATE SET
          company_name = EXCLUDED.company_name,
          isin = COALESCE(EXCLUDED.isin, stocks.isin),
          sector = COALESCE(EXCLUDED.sector, stocks.sector),
          updated_at = NOW()
        RETURNING (xmax = 0) AS inserted
      `, [symbol, 'BSE', companyName, isin, sector]);

      if (result.rows[0]?.inserted) {
        imported++;
      } else {
        updated++;
      }
    } catch (error) {
      console.error(`Error importing BSE stock ${stock['Security Id']}:`, error.message);
      errors++;
    }
  }

  console.log(`BSE Import - New: ${imported}, Updated: ${updated}, Skipped: ${skipped}, Errors: ${errors}`);
  return { imported, updated, errors, skipped };
}

async function updateNSEWithBSECrossRef() {
  console.log('\n=== Cross-referencing NSE stocks with BSE data ===');

  // Update NSE stocks with sector info from BSE if missing
  const result = await pool.query(`
    UPDATE stocks nse
    SET sector = bse.sector
    FROM stocks bse
    WHERE nse.exchange = 'NSE'
      AND bse.exchange = 'BSE'
      AND nse.isin = bse.isin
      AND nse.sector IS NULL
      AND bse.sector IS NOT NULL
  `);

  console.log(`Updated ${result.rowCount} NSE stocks with sector from BSE cross-reference`);
}

async function printSummary() {
  console.log('\n=== Database Summary ===');

  const nseCount = await pool.query(`SELECT COUNT(*) FROM stocks WHERE exchange = 'NSE'`);
  const bseCount = await pool.query(`SELECT COUNT(*) FROM stocks WHERE exchange = 'BSE'`);
  const withSector = await pool.query(`SELECT COUNT(*) FROM stocks WHERE sector IS NOT NULL`);
  const withIsin = await pool.query(`SELECT COUNT(*) FROM stocks WHERE isin IS NOT NULL`);

  console.log(`Total NSE stocks: ${nseCount.rows[0].count}`);
  console.log(`Total BSE stocks: ${bseCount.rows[0].count}`);
  console.log(`Stocks with sector classification: ${withSector.rows[0].count}`);
  console.log(`Stocks with ISIN: ${withIsin.rows[0].count}`);

  // Show sector distribution
  const sectorDist = await pool.query(`
    SELECT sector, COUNT(*) as count
    FROM stocks
    WHERE sector IS NOT NULL
    GROUP BY sector
    ORDER BY count DESC
    LIMIT 15
  `);

  console.log('\nTop sectors by stock count:');
  for (const row of sectorDist.rows) {
    console.log(`  ${row.sector}: ${row.count}`);
  }
}

async function main() {
  console.log('Starting Official NSE/BSE Stock Import');
  console.log('=====================================');

  try {
    // Import NSE stocks first (higher quality data)
    const nseResults = await importNSEStocks();

    // Import BSE stocks
    const bseResults = await importBSEStocks();

    // Cross-reference to fill in missing data
    await updateNSEWithBSECrossRef();

    // Print summary
    await printSummary();

    console.log('\n=== Final Summary ===');
    console.log(`NSE: ${nseResults.imported} new, ${nseResults.updated} updated`);
    console.log(`BSE: ${bseResults.imported} new, ${bseResults.updated} updated, ${bseResults.skipped || 0} skipped`);
    console.log('Import completed successfully!');

  } catch (error) {
    console.error('Import failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
