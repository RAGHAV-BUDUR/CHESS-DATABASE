/**
 * ChessBase Database Initialization Script
 * Runs DDL scripts: schema, functions, triggers, views, indexes
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/chessbase';

async function initDatabase() {
  console.log('Connecting to PostgreSQL at:', connectionString);
  const pool = new Pool({ connectionString });

  try {
    const client = await pool.connect();
    console.log('Connected successfully!');

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
    console.log('\nAll ChessBase database tables, functions, triggers, views, and indexes successfully initialized!');
  } catch (err) {
    console.error('Database Initialization Failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

initDatabase();

