/**
 * ChessBase - High Performance PGN Batch Importer CLI
 * Ingests external PGN collections (e.g. CaissaBase, Lichess exports, personal PGNs)
 * 
 * Usage:
 *   node scripts/import-pgn.js <path_to_pgn_file> [--limit 500] [--batch 50]
 */

const fs = require('fs');
const readline = require('readline');
const path = require('path');
const { Pool } = require('pg');
const { Chess } = require('chess.js');
const { classify } = require('./eco-classifier');

// Load .env if present
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

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/chessbase';

// 384-dim vector embedding generator
function generateEmbedding(text) {
  const DIMENSIONS = 384;
  const vector = new Array(DIMENSIONS).fill(0);
  if (!text) return vector;

  const cleaned = text.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ');
  const tokens = cleaned.split(/\s+/).filter(t => t.length > 0);

  const domainWeights = {
    queen: 2.5, sacrifice: 3.0, mate: 3.5, checkmate: 4.0, attack: 2.0,
    kingside: 2.2, queenside: 2.2, storm: 2.8, pawn: 1.5, fork: 3.0,
    knight: 2.0, pin: 2.8, skewer: 2.8, castling: 1.8, sicilian: 2.0,
    defense: 1.5, gambit: 2.5, endgame: 2.0, brilliancy: 3.0
  };

  for (const token of tokens) {
    const weight = domainWeights[token] || 1.0;
    let h1 = 0x811c9dc5 ^ 1337;
    let h2 = 0x811c9dc5 ^ 7331;
    for (let i = 0; i < token.length; i++) {
      const code = token.charCodeAt(i);
      h1 ^= code;
      h1 = Math.imul(h1, 0x01000193);
      h2 ^= code;
      h2 = Math.imul(h2, 0x01000193);
    }
    const idx1 = Math.abs(h1) % DIMENSIONS;
    const idx2 = Math.abs(h2) % DIMENSIONS;
    vector[idx1] += weight * 0.7;
    vector[idx2] += weight * 0.3;
  }

  let norm = 0;
  for (let i = 0; i < DIMENSIONS; i++) norm += vector[i] * vector[i];
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < DIMENSIONS; i++) vector[i] = Number((vector[i] / norm).toFixed(6));
  }
  return vector;
}

function parsePgnGame(rawPgn) {
  try {
    const chess = new Chess();
    let loaded = false;

    // 1. Direct load
    try {
      chess.loadPgn(rawPgn);
      loaded = chess.history().length > 0;
    } catch {
      loaded = false;
    }

    // 2. Sanitized fallback for Chessis comments, variations, and NAGs
    if (!loaded) {
      try {
        const cleanPgn = rawPgn
          .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '')
          .replace(/\{[^}]*\}/g, ' ')
          .replace(/\([^)]*\)/g, ' ')
          .replace(/\$\d+/g, ' ')
          .trim();
        chess.loadPgn(cleanPgn);
        loaded = chess.history().length > 0;
      } catch {
        return null;
      }
    }

    if (!loaded) return null;

    const headers = chess.header();
    const history = chess.history({ verbose: true });
    if (history.length === 0) return null;

    let white = (headers['White'] || 'Unknown White').trim().slice(0, 100);
    let black = (headers['Black'] || 'Unknown Black').trim().slice(0, 100);
    if (white.toLowerCase() === black.toLowerCase()) {
      black = `${black} (Black)`.slice(0, 100);
    }
    let event = (headers['Event'] || 'PGN Import Event').trim().slice(0, 150);
    let date = headers['Date'] || headers['UTCDate'] || '2024-01-01';
    date = date.replace(/\?/g, '01').replace(/\./g, '-');
    const dparts = date.split('-');
    let y = (dparts[0] || '2024').replace(/\D/g, '').slice(0, 4) || '2024';
    let m = (dparts[1] || '01').replace(/\D/g, '').slice(0, 2).padStart(2, '0');
    let d = (dparts[2] || '01').replace(/\D/g, '').slice(0, 2).padStart(2, '0');
    if (parseInt(m, 10) > 12) m = '12';
    if (parseInt(d, 10) > 28) d = '28';
    date = `${y}-${m}-${d}`;

    const ecoMatch = classify(rawPgn, history.map(m => m.san));
    let eco = ecoMatch.ecoCode;
    let opening = ecoMatch.openingName;
    let result = (headers['Result'] || '*').trim();
    if (!['1-0', '0-1', '1/2-1/2'].includes(result)) result = '*';

    const whiteRating = parseInt(headers['WhiteElo'], 10) || null;
    const blackRating = parseInt(headers['BlackElo'], 10) || null;

    return {
      white,
      black,
      event,
      date,
      eco,
      opening,
      result,
      whiteRating,
      blackRating,
      moves: history,
      pgn: rawPgn,
      moveCount: history.length,
    };
  } catch {
    return null;
  }
}

async function run() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
=============================================================
 ChessBase PGN Batch Importer CLI (CaissaBase & Custom PGN)
=============================================================
Usage:
  node scripts/import-pgn.js <file.pgn> [options]

Options:
  --limit <number>   Maximum number of games to import (default: 500)
  --skip <number>    Number of games to skip from beginning (default: 0)

Examples:
  node scripts/import-pgn.js caissabase_sample.pgn --limit 1000
  node scripts/import-pgn.js my_games.pgn
=============================================================
`);
    process.exit(0);
  }

  const pgnFile = args[0];
  if (!fs.existsSync(pgnFile)) {
    console.error(`Error: File not found at ${pgnFile}`);
    process.exit(1);
  }

  let limit = 500;
  let skip = 0;
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) limit = parseInt(args[i + 1], 10);
    if (args[i] === '--skip' && args[i + 1]) skip = parseInt(args[i + 1], 10);
  }

  console.log(`Connecting to database at ${connectionString.replace(/:([^:@]+)@/, ':****@')}...`);
  const pool = new Pool({ connectionString });

  try {
    const test = await pool.query('SELECT current_database(), version();');
    console.log(` Connected to PostgreSQL: ${test.rows[0].current_database}`);
  } catch (err) {
    console.error(` Database connection failed: ${err.message}`);
    console.error(`Please check your .env DATABASE_URL setting.`);
    process.exit(1);
  }

  // Check pgvector
  let hasPgVector = false;
  try {
    const ext = await pool.query("SELECT extname FROM pg_extension WHERE extname = 'vector'");
    hasPgVector = ext.rows.length > 0;
  } catch {
    hasPgVector = false;
  }
  console.log(`pgvector extension status: ${hasPgVector ? 'ACTIVE (Vector embeddings enabled)' : 'NOT INSTALLED (Text only)'}`);

  console.log(`\nReading and splitting PGN file: ${path.basename(pgnFile)}...`);
  const fileStream = fs.createReadStream(pgnFile, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let currentGameLines = [];
  let gamesFound = 0;
  let gamesImported = 0;
  let gamesSkipped = 0;
  let gamesFailed = 0;
  const startTime = Date.now();

  let hasMoves = false;

  const processGame = async (gameLines) => {
    gamesFound++;
    if (gamesFound <= skip) return;
    if (gamesImported >= limit) return;

    const gamePgn = gameLines.join('\n');
    const parsed = parsePgnGame(gamePgn);

    if (parsed) {
      try {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');

          // Players
          const wRes = await client.query(`
            INSERT INTO players (name, fide_rating, country)
            VALUES ($1, $2, 'FIDE')
            ON CONFLICT (name) DO UPDATE SET fide_rating = COALESCE(EXCLUDED.fide_rating, players.fide_rating)
            RETURNING player_id;
          `, [parsed.white, parsed.whiteRating]);
          const whiteId = wRes.rows[0].player_id;

          const bRes = await client.query(`
            INSERT INTO players (name, fide_rating, country)
            VALUES ($1, $2, 'FIDE')
            ON CONFLICT (name) DO UPDATE SET fide_rating = COALESCE(EXCLUDED.fide_rating, players.fide_rating)
            RETURNING player_id;
          `, [parsed.black, parsed.blackRating]);
          const blackId = bRes.rows[0].player_id;

          // Tournament
          let tournamentId = null;
          if (parsed.event && parsed.event.trim().length > 0) {
            const tExisting = await client.query(`SELECT tournament_id FROM tournaments WHERE name = $1 LIMIT 1;`, [parsed.event]);
            if (tExisting.rows.length > 0) {
              tournamentId = tExisting.rows[0].tournament_id;
            } else {
              const tRes = await client.query(`
                INSERT INTO tournaments (name, location, start_date)
                VALUES ($1, 'CaissaBase', $2)
                RETURNING tournament_id;
              `, [parsed.event, parsed.date]);
              tournamentId = tRes.rows[0].tournament_id;
            }
          }

          // Opening
          const oRes = await client.query(`
            INSERT INTO openings (eco_code, opening_name, description)
            VALUES ($1, $2, $3)
            ON CONFLICT (eco_code, opening_name) DO UPDATE SET description = EXCLUDED.description
            RETURNING opening_id;
          `, [parsed.eco, parsed.opening, parsed.opening]);
          const openingId = oRes.rows[0].opening_id;

          // Game
          const gRes = await client.query(`
            INSERT INTO games (
              white_player_id, black_player_id, tournament_id, opening_id,
              result, game_date, round, pgn, move_count, white_rating, black_rating
            )
            VALUES ($1, $2, $3, $4, $5, $6, '1', $7, $8, $9, $10)
            RETURNING game_id;
          `, [
            whiteId, blackId, tournamentId, openingId,
            parsed.result, parsed.date, parsed.pgn,
            Math.ceil(parsed.moveCount / 2), parsed.whiteRating, parsed.blackRating
          ]);
          const gameId = gRes.rows[0].game_id;

          // Moves
          for (let mIdx = 0; mIdx < parsed.moves.length; mIdx++) {
            const m = parsed.moves[mIdx];
            const moveNumber = Math.floor(mIdx / 2) + 1;
            const color = m.color === 'w' ? 'white' : 'black';
            const uci = `${m.from}${m.to}${m.promotion || ''}`;
            const isCheck = m.san.includes('+') || m.san.includes('#');
            const isCapture = m.san.includes('x');

            await client.query(`
              INSERT INTO moves (game_id, move_number, color, san, uci, fen_after, is_check, is_capture)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8);
            `, [gameId, moveNumber, color, m.san.slice(0, 20), uci.slice(0, 10), m.after || '', isCheck, isCapture]);
          }

          // Vectors
          const summary = `${parsed.white} vs ${parsed.black}, ${parsed.opening} (${parsed.eco}). Result ${parsed.result}. Moves: ${parsed.moves.slice(0, 15).map(m => m.san).join(' ')}`;
          const vec = generateEmbedding(summary);
          const vecStr = `[${vec.join(',')}]`;
          if (hasPgVector) {
            await client.query(`
              INSERT INTO game_embeddings (game_id, model_name, dimensions, source_text, embedding)
              VALUES ($1, 'deterministic-chess-384', 384, $2, $3::vector)
              ON CONFLICT (game_id) DO UPDATE SET embedding = EXCLUDED.embedding;
            `, [gameId, summary, vecStr]);
          } else {
            await client.query(`
              INSERT INTO game_embeddings (game_id, model_name, dimensions, source_text, embedding)
              VALUES ($1, 'deterministic-chess-384', 384, $2, $3)
              ON CONFLICT (game_id) DO UPDATE SET embedding = EXCLUDED.embedding;
            `, [gameId, summary, vecStr]);
          }

          await client.query('COMMIT');
          gamesImported++;
          if (gamesImported % 25 === 0 || gamesImported === 1) {
            process.stdout.write(`\r[${gamesImported}/${limit}] Ingested: ${parsed.white} vs ${parsed.black} (${parsed.moveCount} moves)`);
          }
        } catch (txErr) {
          await client.query('ROLLBACK');
          gamesFailed++;
        } finally {
          client.release();
        }
      } catch (connErr) {
        gamesFailed++;
      }
    } else {
      gamesSkipped++;
    }
  };

  for await (const line of rl) {
    const trimmed = line.trim();
    const isHeader = trimmed.startsWith('[') && trimmed.endsWith(']');

    if (isHeader && hasMoves) {
      if (currentGameLines.length > 0) {
        await processGame(currentGameLines);
      }
      currentGameLines = [line];
      hasMoves = false;
      continue;
    }

    if (!isHeader && trimmed.length > 0 && !trimmed.startsWith('%')) {
      hasMoves = true;
    }

    currentGameLines.push(line);
  }

  if (currentGameLines.length > 0 && hasMoves) {
    await processGame(currentGameLines);
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n\n=============================================================`);
  console.log(` PGN Batch Import Complete!`);
  console.log(` - Games Imported: ${gamesImported}`);
  console.log(` - Games Skipped/Malformed: ${gamesSkipped}`);
  console.log(` - Transaction Failures: ${gamesFailed}`);
  console.log(` - Time Taken: ${durationSec}s`);
  console.log(`=============================================================`);

  await pool.end();
}

run().catch(err => {
  console.error('Fatal import error:', err);
  process.exit(1);
});

