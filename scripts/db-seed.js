/**
 * ChessBase Database Seed Script
 * Populates Admin user, master tactical motifs, and ingests historical games
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// Import compiled or transpile-free modules or implement robust helper
const { Chess } = require('chess.js');

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/chessbase';

const MASTER_MOTIFS = [
  { name: 'Checkmate Attack', category: 'Attack', desc: 'Direct king mating net attack leading to mate or decisive advantage.', weight: 1.0 },
  { name: 'Check / Discovered Check', category: 'Attack', desc: 'Check delivered directly or unmasked by moving an obstructing piece.', weight: 0.8 },
  { name: 'Queen Sacrifice', category: 'Sacrifice', desc: 'Deliberate sacrifice of the queen for decisive attack or mate.', weight: 1.0 },
  { name: 'Exchange Sacrifice', category: 'Sacrifice', desc: 'Trading a rook for a bishop or knight to obtain positional advantage.', weight: 0.85 },
  { name: 'Minor Piece Sacrifice', category: 'Sacrifice', desc: 'Sacrificing knight or bishop to tear open king defences.', weight: 0.85 },
  { name: 'Knight Fork', category: 'Fork', desc: 'Knight attacking two or more valuable pieces simultaneously.', weight: 0.9 },
  { name: 'Absolute Pin on King', category: 'Pin/Skewer', desc: 'Piece pinned to the king, legally immobilized.', weight: 0.8 },
  { name: 'Relative Pin on Queen', category: 'Pin/Skewer', desc: 'Piece pinned to the queen, moving loses heavy material.', weight: 0.75 },
  { name: 'Skewer Attack', category: 'Pin/Skewer', desc: 'Attack on valuable piece forcing it to step aside and expose another piece.', weight: 0.8 },
  { name: 'Pawn Storm Attack', category: 'Attack', desc: 'Flank pawn avalanche against opponent castled king in opposite-side castling.', weight: 0.75 },
  { name: 'Promotion Threat', category: 'Endgame', desc: 'Advanced pawn on 7th/2nd rank threatening queen promotion.', weight: 0.7 },
  { name: 'Pawn Promotion', category: 'Endgame', desc: 'Successful pawn promotion to a higher piece.', weight: 0.85 }
];

// Inline 384-dim deterministic embedding generator
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
      h1 ^= token.charCodeAt(i); h1 = Math.imul(h1, 0x01000193);
      h2 ^= token.charCodeAt(i); h2 = Math.imul(h2, 0x01000193);
    }
    const idx1 = Math.abs(h1) % DIMENSIONS;
    const idx2 = Math.abs(h2) % DIMENSIONS;
    vector[idx1] += ((h1 & 1) === 0 ? 1 : -1) * weight;
    vector[idx2] += ((h2 & 1) === 0 ? 1 : -1) * (weight * 0.5);
  }

  for (let i = 0; i < tokens.length - 1; i++) {
    const bigram = `${tokens[i]}_${tokens[i+1]}`;
    let h = 0x811c9dc5 ^ 4242;
    for (let c = 0; c < bigram.length; c++) {
      h ^= bigram.charCodeAt(c); h = Math.imul(h, 0x01000193);
    }
    const idx = Math.abs(h) % DIMENSIONS;
    vector[idx] += ((h & 1) === 0 ? 1 : -1) * 2.0;
  }

  let sumSq = 0;
  for (let i = 0; i < DIMENSIONS; i++) sumSq += vector[i] * vector[i];
  const norm = Math.sqrt(sumSq);
  if (norm > 0) {
    for (let i = 0; i < DIMENSIONS; i++) {
      vector[i] = parseFloat((vector[i] / norm).toFixed(6));
    }
  }
  return vector;
}

// Inline Tactical Motif Detector for Seeder
function analyzeGameMotifs(pgnText) {
  const game = new Chess();
  try { game.loadPgn(pgnText); } catch { return []; }

  const history = game.history({ verbose: true });
  const replay = new Chess();
  const detected = [];

  for (let i = 0; i < history.length; i++) {
    const m = history[i];
    const color = m.color === 'w' ? 'white' : 'black';
    const moveNumber = Math.floor(i / 2) + 1;
    replay.move(m);
    const postFen = replay.fen();

    if (replay.isCheckmate()) {
      detected.push({
        motifName: 'Checkmate Attack',
        moveNumber,
        color,
        san: m.san,
        fen: postFen,
        materialChange: 0,
        rationale: `${color.toUpperCase()} delivered checkmate on move ${moveNumber} with ${m.san}.`,
        confidence: 'EXACT'
      });
    } else if (replay.inCheck()) {
      detected.push({
        motifName: 'Check / Discovered Check',
        moveNumber,
        color,
        san: m.san,
        fen: postFen,
        materialChange: 0,
        rationale: `${color.toUpperCase()} placed king in check with ${m.san}.`,
        confidence: 'EXACT'
      });
    }

    if (m.piece === 'q' && m.captured && ['p', 'n', 'b', 'r'].includes(m.captured)) {
      detected.push({
        motifName: 'Queen Sacrifice',
        moveNumber,
        color,
        san: m.san,
        fen: postFen,
        materialChange: -4,
        rationale: `${color.toUpperCase()} traded Queen for ${m.captured.toUpperCase()} on ${m.to}.`,
        confidence: 'RULE_BASED'
      });
    }

    if (m.piece === 'r' && (m.captured === 'n' || m.captured === 'b')) {
      detected.push({
        motifName: 'Exchange Sacrifice',
        moveNumber,
        color,
        san: m.san,
        fen: postFen,
        materialChange: -2,
        rationale: `${color.toUpperCase()} exchanged Rook for minor piece (${m.captured.toUpperCase()}).`,
        confidence: 'EXACT'
      });
    }

    if ((m.piece === 'n' || m.piece === 'b') && m.captured === 'p') {
      detected.push({
        motifName: 'Minor Piece Sacrifice',
        moveNumber,
        color,
        san: m.san,
        fen: postFen,
        materialChange: -2,
        rationale: `${color.toUpperCase()} sacrificed ${m.piece.toUpperCase()} on ${m.to} for pawn.`,
        confidence: 'RULE_BASED'
      });
    }

    if (m.promotion) {
      detected.push({
        motifName: 'Pawn Promotion',
        moveNumber,
        color,
        san: m.san,
        fen: postFen,
        materialChange: 8,
        rationale: `Pawn promoted to ${m.promotion.toUpperCase()} on ${m.to}.`,
        confidence: 'EXACT'
      });
    }
  }

  return detected;
}

async function seedDatabase() {
  const pool = new Pool({ connectionString });
  console.log('Starting ChessBase Database Seeding...');

  try {
    const client = await pool.connect();

    // 1. Seed Users (Admin & Standard Player)
    console.log('1. Seeding Users (Admin & Player)...');
    const adminPass = process.env.ADMIN_PASSWORD || 'AdminPassword123!';
    const adminHash = await bcrypt.hash(adminPass, 10);
    const playerHash = await bcrypt.hash('PlayerPassword123!', 10);

    await client.query(`
      INSERT INTO users (username, email, password_hash, role)
      VALUES 
        ('admin', 'admin@chessbase.local', $1, 'ADMIN'),
        ('raghav', 'raghav@chessbase.local', $2, 'PLAYER'),
        ('prithviraj', 'prithviraj@chessbase.local', $2, 'PLAYER')
      ON CONFLICT (email) DO NOTHING;
    `, [adminHash, playerHash]);
    console.log('✓ Admin user (admin@chessbase.local) and players seeded.');

    // 2. Seed Master Tactical Motifs
    console.log('2. Seeding Master Tactical Motifs...');
    for (const motif of MASTER_MOTIFS) {
      await client.query(`
        INSERT INTO tactical_motifs (motif_name, category, description, severity_weight)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (motif_name) DO UPDATE 
        SET description = EXCLUDED.description, severity_weight = EXCLUDED.severity_weight;
      `, [motif.name, motif.category, motif.desc, motif.weight]);
    }
    console.log('✓ Master tactical motifs seeded.');

    // 3. Ingest Sample PGN Games
    console.log('3. Ingesting Sample Historical Games...');
    const pgnFile = path.join(__dirname, '..', 'data', 'sample-games.pgn');
    const rawPgn = fs.readFileSync(pgnFile, 'utf8');

    // Split into individual games
    const games = [];
    const lines = rawPgn.split(/\r?\n/);
    let curLines = [];
    for (const line of lines) {
      if (line.startsWith('[Event ') && curLines.length > 0 && curLines.some(l => !l.startsWith('['))) {
        games.push(curLines.join('\n'));
        curLines = [line];
      } else {
        curLines.push(line);
      }
    }
    if (curLines.length > 0) games.push(curLines.join('\n'));

    console.log(`Found ${games.length} games in sample PGN file.`);

    for (let idx = 0; idx < games.length; idx++) {
      const gPgn = games[idx];
      const chess = new Chess();
      try { chess.loadPgn(gPgn); } catch (e) { continue; }

      const h = chess.header();
      const whiteName = h['White'] || 'White';
      const blackName = h['Black'] || 'Black';
      const wRating = parseInt(h['WhiteElo'] || '2500', 10);
      const bRating = parseInt(h['BlackElo'] || '2500', 10);
      const eventName = h['Event'] || 'Championship Tournament';
      const siteName = h['Site'] || 'Unknown Site';
      const eco = h['ECO'] || 'A00';
      const opName = h['Opening'] || 'Chess Opening';
      const res = ['1-0', '0-1', '1/2-1/2'].includes(h['Result']) ? h['Result'] : '1/2-1/2';
      
      let dateStr = (h['Date'] || '1970.01.01').replace(/\?/g, '01');
      const dparts = dateStr.split('.');
      const formattedDate = `${dparts[0] || '1970'}-${(dparts[1] || '01').padStart(2, '0')}-${(dparts[2] || '01').padStart(2, '0')}`;

      await client.query('BEGIN');

      // Player 1
      const wRes = await client.query(`
        INSERT INTO players (name, fide_rating, country)
        VALUES ($1, $2, 'FIDE')
        ON CONFLICT (name) DO UPDATE SET fide_rating = EXCLUDED.fide_rating
        RETURNING player_id;
      `, [whiteName, wRating]);
      const whiteId = wRes.rows[0].player_id;

      // Player 2
      const bRes = await client.query(`
        INSERT INTO players (name, fide_rating, country)
        VALUES ($1, $2, 'FIDE')
        ON CONFLICT (name) DO UPDATE SET fide_rating = EXCLUDED.fide_rating
        RETURNING player_id;
      `, [blackName, bRating]);
      const blackId = bRes.rows[0].player_id;

      // Tournament
      const tRes = await client.query(`
        INSERT INTO tournaments (name, location, start_date)
        VALUES ($1, $2, $3)
        RETURNING tournament_id;
      `, [eventName, siteName, formattedDate]);
      const tournamentId = tRes.rows[0].tournament_id;

      // Opening
      const oRes = await client.query(`
        INSERT INTO openings (eco_code, opening_name, description)
        VALUES ($1, $2, $2)
        ON CONFLICT (eco_code, opening_name) DO UPDATE SET description = EXCLUDED.description
        RETURNING opening_id;
      `, [eco, opName]);
      const openingId = oRes.rows[0].opening_id;

      // Game
      const history = chess.history({ verbose: true });
      const moveCount = Math.ceil(history.length / 2);

      const gRes = await client.query(`
        INSERT INTO games (white_player_id, black_player_id, tournament_id, opening_id, result, game_date, round, pgn, move_count, white_rating, black_rating)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING game_id;
      `, [whiteId, blackId, tournamentId, openingId, res, formattedDate, h['Round'] || '1', gPgn, moveCount, wRating, bRating]);
      const gameId = gRes.rows[0].game_id;

      // Moves
      const replay = new Chess();
      for (let mIdx = 0; mIdx < history.length; mIdx++) {
        const hm = history[mIdx];
        replay.move(hm);
        await client.query(`
          INSERT INTO moves (game_id, move_number, color, san, uci, fen_after, is_check, is_capture)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8);
        `, [
          gameId,
          Math.floor(mIdx / 2) + 1,
          hm.color === 'w' ? 'white' : 'black',
          hm.san,
          `${hm.from}${hm.to}${hm.promotion || ''}`,
          replay.fen(),
          hm.san.includes('+') || hm.san.includes('#'),
          hm.captured !== undefined || hm.san.includes('x')
        ]);
      }

      // Motifs
      const motifs = analyzeGameMotifs(gPgn);
      for (const m of motifs) {
        const motifIdRes = await client.query(`SELECT motif_id FROM tactical_motifs WHERE motif_name = $1;`, [m.motifName]);
        if (motifIdRes.rows.length > 0) {
          const mId = motifIdRes.rows[0].motif_id;
          await client.query(`
            INSERT INTO game_motifs (game_id, motif_id, move_number, color, fen_position, move_san, material_change, rationale, confidence)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT DO NOTHING;
          `, [gameId, mId, m.moveNumber, m.color, m.fen, m.san, m.materialChange, m.rationale, m.confidence]);
        }
      }

      // Vector Embedding
      const summaryText = `Game between ${whiteName} and ${blackName}. Event: ${eventName}. Opening: ${opName} (${eco}). Result: ${res}. Motifs: ${motifs.map(x => x.motifName).join(', ') || 'Positional play'}. Moves: ${history.slice(0, 25).map(x => x.san).join(' ')}.`;
      const vec = generateEmbedding(summaryText);
      const vecStr = `[${vec.join(',')}]`;

      await client.query(`
        INSERT INTO game_embeddings (game_id, model_name, dimensions, source_text, embedding)
        VALUES ($1, 'ChessBase-Semantic-384-Deterministic', 384, $2, $3::vector)
        ON CONFLICT (game_id) DO UPDATE SET embedding = EXCLUDED.embedding, source_text = EXCLUDED.source_text;
      `, [gameId, summaryText, vecStr]);

      await client.query('COMMIT');
      console.log(`✓ [Game ${idx+1}/${games.length}] Imported "${whiteName} vs ${blackName}" (${res}, ${moveCount} moves, ${motifs.length} motifs detected).`);
    }

    client.release();
    console.log('\nSeeding completed successfully!');
  } catch (err) {
    console.error('Seeding error:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seedDatabase();

