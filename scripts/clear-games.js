/**
 * ChessBase Clear Games Script
 * DBMS Level 3 Experiential Learning
 * 
 * Safely purges all game records, moves, game_motifs, game_embeddings, and import jobs
 * while preserving users, players, openings metadata, master tactical motifs, and schema.
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Load .env
try {
  const envPath = path.resolve(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split(/\r?\n/)) {
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
  // Ignore
}

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:six7@localhost:5432/chessbase';

async function clearGames() {
  const pool = new Pool({ connectionString });
  console.log('Connecting to ChessBase database to purge hardcoded/stored games...');

  try {
    const client = await pool.connect();

    await client.query('BEGIN');

    // 1. Delete dependent tables
    console.log('Purging game_motifs...');
    await client.query('DELETE FROM game_motifs;');

    console.log('Purging game_embeddings...');
    await client.query('DELETE FROM game_embeddings;');

    console.log('Purging user_favourites...');
    await client.query('DELETE FROM user_favourites;');

    console.log('Purging moves...');
    await client.query('DELETE FROM moves;');

    console.log('Purging games...');
    await client.query('DELETE FROM games;');

    console.log('Purging pgn_import_jobs...');
    await client.query('DELETE FROM pgn_import_jobs;');

    // Reset sequences
    console.log('Resetting game and move ID sequences...');
    await client.query('ALTER SEQUENCE games_game_id_seq RESTART WITH 1;');
    await client.query('ALTER SEQUENCE moves_move_id_seq RESTART WITH 1;');
    await client.query('ALTER SEQUENCE game_motifs_id_seq RESTART WITH 1;');
    await client.query('ALTER SEQUENCE pgn_import_jobs_job_id_seq RESTART WITH 1;');

    await client.query('COMMIT');
    client.release();

    console.log('\n=============================================================');
    console.log(' ✓ All hardcoded games and game records successfully purged!');
    console.log(' ✓ Database is ready in clean state for user games.');
    console.log('=============================================================\n');
  } catch (err) {
    console.error('Failed to clear games:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

clearGames();
