/**
 * ChessBase Database Initialization Script
 * Runs DDL scripts: schema, functions, triggers, views, indexes
 * Auto-creates the 'chessbase' database if it doesn't exist yet.
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// 1. Manually load .env file
function loadEnv() {
  try {
    const envPath = path.resolve(__dirname, '../.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      for (const line of content.split(/\r?\n/)) {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match && !process.env[match[1]]) {
          let val = match[2] || '';
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          process.env[match[1]] = val;
        }
      }
    }
  } catch (e) {
    // ignore
  }
}

loadEnv();

const targetConnectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/chessbase';

async function ensureDatabaseExists() {
  try {
    // Parse target DB name
    const url = new URL(targetConnectionString);
    const targetDbName = url.pathname.replace(/^\//, '');

    if (targetDbName && targetDbName !== 'postgres') {
      // Connect to default 'postgres' database to check/create target DB
      const maintenanceUrl = new URL(targetConnectionString);
      maintenanceUrl.pathname = '/postgres';

      const maintenancePool = new Pool({ connectionString: maintenanceUrl.toString() });
      try {
        const client = await maintenancePool.connect();
        const checkRes = await client.query('SELECT 1 FROM pg_database WHERE datname = $1;', [targetDbName]);
        if (checkRes.rows.length === 0) {
          console.log(`Database "${targetDbName}" not found. Creating database "${targetDbName}"...`);
          await client.query(`CREATE DATABASE "${targetDbName}";`);
          console.log(`✓ Database "${targetDbName}" created successfully!`);
        } else {
          console.log(`✓ Database "${targetDbName}" already exists.`);
        }
        client.release();
      } catch (checkErr) {
        // If maintenance DB connection failed, continue to attempt target connection directly
      } finally {
        await maintenancePool.end().catch(() => {});
      }
    }
  } catch (err) {
    // Ignore URL parse errors
  }
}

async function initDatabase() {
  const maskedUrl = targetConnectionString.replace(/:([^:@]+)@/, ':****@');
  console.log('Connecting to PostgreSQL at:', maskedUrl);

  // Ensure DB exists before running scripts
  await ensureDatabaseExists();

  const pool = new Pool({ connectionString: targetConnectionString });

  try {
    const client = await pool.connect();
    console.log('Connected to ChessBase database successfully!');

    const files = [
      'sql/schema.sql',
      'sql/functions.sql',
      'sql/triggers.sql',
      'sql/views.sql',
      'sql/indexes.sql',
    ];

    for (const relPath of files) {
      const fullPath = path.join(__dirname, '..', relPath);
      console.log(`Executing ${relPath}...`);
      const sql = fs.readFileSync(fullPath, 'utf8');
      await client.query(sql);
      console.log(`✓ ${relPath} executed successfully.`);
    }

    client.release();
    console.log('\n=============================================================');
    console.log(' All ChessBase database tables, functions, triggers, views,');
    console.log(' and indexes have been successfully initialized!');
    console.log('=============================================================\n');
  } catch (err) {
    console.error('\nDatabase Initialization Failed:', err.message);

    if (err.message.includes('password authentication failed')) {
      console.error('\n-------------------------------------------------------------');
      console.error(' HOW TO FIX PASSWORD AUTHENTICATION ERROR:');
      console.error(' 1. Open the file ".env" in this project folder.');
      console.error(' 2. Look at the line:');
      console.error('    DATABASE_URL="postgresql://postgres:postgres@localhost:5432/chessbase"');
      console.error(' 3. Replace the second "postgres" with your actual PostgreSQL password');
      console.error('    that you set when installing PostgreSQL / pgAdmin on Windows:');
      console.error('    DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/chessbase"');
      console.error(' 4. Save .env and run "npm run db:init" again.');
      console.error('-------------------------------------------------------------\n');
    }

    process.exit(1);
  } finally {
    await pool.end().catch(() => {});
  }
}

initDatabase();
