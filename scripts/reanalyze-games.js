/**
 * ChessBase - Safe Idempotent Game Reanalysis CLI
 * Reprocesses games using the enhanced Tactical Fingerprint Engine without destroying data.
 * 
 * Usage:
 *   node scripts/reanalyze-games.js [--game-id <id>] [--limit <number>]
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Manually load .env
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

// Inline TypeScript transpiler or load compiled classes
const { Chess } = require('chess.js');

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/chessbase';

const PIECE_VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

function squareToCoords(sq) {
  const file = sq.charCodeAt(0) - 97;
  const rank = 8 - parseInt(sq[1], 10);
  return [rank, file];
}

function getAttackers(board, targetSq, byColor) {
  const attackers = [];
  const [tr, tc] = squareToCoords(targetSq);

  const pawnRow = byColor === 'w' ? tr + 1 : tr - 1;
  if (pawnRow >= 0 && pawnRow < 8) {
    for (const pawnCol of [tc - 1, tc + 1]) {
      if (pawnCol >= 0 && pawnCol < 8) {
        const piece = board[pawnRow]?.[pawnCol];
        if (piece && piece.color === byColor && piece.type === 'p') attackers.push(piece);
      }
    }
  }

  const knightOffsets = [
    [-2, -1], [-2, 1], [-1, -2], [-1, 2],
    [1, -2], [1, 2], [2, -1], [2, 1]
  ];
  for (const [dr, dc] of knightOffsets) {
    const nr = tr + dr;
    const nc = tc + dc;
    if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
      const piece = board[nr]?.[nc];
      if (piece && piece.color === byColor && piece.type === 'n') attackers.push(piece);
    }
  }

  const kingOffsets = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],           [0, 1],
    [1, -1],  [1, 0],  [1, 1]
  ];
  for (const [dr, dc] of kingOffsets) {
    const kr = tr + dr;
    const kc = tc + dc;
    if (kr >= 0 && kr < 8 && kc >= 0 && kc < 8) {
      const piece = board[kr]?.[kc];
      if (piece && piece.color === byColor && piece.type === 'k') attackers.push(piece);
    }
  }

  const diagDirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  for (const [dr, dc] of diagDirs) {
    let r = tr + dr;
    let c = tc + dc;
    while (r >= 0 && r < 8 && c >= 0 && c < 8) {
      const piece = board[r]?.[c];
      if (piece) {
        if (piece.color === byColor && (piece.type === 'b' || piece.type === 'q')) attackers.push(piece);
        break;
      }
      r += dr;
      c += dc;
    }
  }

  const orthoDirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  for (const [dr, dc] of orthoDirs) {
    let r = tr + dr;
    let c = tc + dc;
    while (r >= 0 && r < 8 && c >= 0 && c < 8) {
      const piece = board[r]?.[c];
      if (piece) {
        if (piece.color === byColor && (piece.type === 'r' || piece.type === 'q')) attackers.push(piece);
        break;
      }
      r += dr;
      c += dc;
    }
  }

  return attackers;
}

function analyzeGameMotifs(pgn) {
  const game = new Chess();
  try {
    game.loadPgn(pgn);
  } catch {
    return [];
  }

  const history = game.history({ verbose: true });
  const replay = new Chess();
  const detectedMotifs = [];

  for (let i = 0; i < history.length; i++) {
    const move = history[i];
    const moveColor = move.color === 'w' ? 'white' : 'black';
    const oppColor = move.color === 'w' ? 'b' : 'w';
    const moveNumber = Math.floor(i / 2) + 1;

    try {
      replay.move({ from: move.from, to: move.to, promotion: move.promotion });
    } catch {
      try {
        replay.move(move.san);
      } catch {
        continue;
      }
    }
    const postFen = replay.fen();
    const board = replay.board();
    const futureMoves = history.slice(i + 1, i + 5);

    // 1. Checkmate
    if (replay.isCheckmate()) {
      detectedMotifs.push({
        motifName: 'Checkmate',
        category: 'Attack',
        moveNumber,
        color: moveColor,
        moveSan: move.san,
        fenPosition: postFen,
        materialChange: 0,
        rationale: `${moveColor.toUpperCase()} delivered checkmate with ${move.san}.`,
        confidence: 'EXACT',
        evidenceLevel: 'VERIFIED'
      });
      detectedMotifs.push({
        motifName: 'Checkmate Attack',
        category: 'Attack',
        moveNumber,
        color: moveColor,
        moveSan: move.san,
        fenPosition: postFen,
        materialChange: 0,
        rationale: `${moveColor.toUpperCase()} delivered checkmate.`,
        confidence: 'EXACT',
        evidenceLevel: 'VERIFIED'
      });
    } else if (replay.inCheck()) {
      let oppKingSq = 'e8';
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const p = board[r][c];
          if (p && p.color === oppColor && p.type === 'k') {
            oppKingSq = p.square;
            break;
          }
        }
      }
      const checkers = getAttackers(board, oppKingSq, move.color);
      if (checkers.length >= 2) {
        detectedMotifs.push({
          motifName: 'Double Check',
          category: 'Attack',
          moveNumber,
          color: moveColor,
          moveSan: move.san,
          fenPosition: postFen,
          materialChange: 0,
          rationale: `${moveColor.toUpperCase()} delivered Double Check with ${move.san}.`,
          confidence: 'EXACT',
          evidenceLevel: 'VERIFIED'
        });
      } else if (checkers.length === 1) {
        if (checkers[0].square === move.to) {
          detectedMotifs.push({
            motifName: 'Check',
            category: 'Attack',
            moveNumber,
            color: moveColor,
            moveSan: move.san,
            fenPosition: postFen,
            materialChange: 0,
            rationale: `${moveColor.toUpperCase()} delivered check with ${move.san}.`,
            confidence: 'EXACT',
            evidenceLevel: 'VERIFIED'
          });
        } else {
          detectedMotifs.push({
            motifName: 'Discovered Check',
            category: 'Attack',
            moveNumber,
            color: moveColor,
            moveSan: move.san,
            fenPosition: postFen,
            materialChange: 0,
            rationale: `${moveColor.toUpperCase()} delivered Discovered Check with ${move.san}.`,
            confidence: 'EXACT',
            evidenceLevel: 'VERIFIED'
          });
        }
      }
      detectedMotifs.push({
        motifName: 'Check / Discovered Check',
        category: 'Attack',
        moveNumber,
        color: moveColor,
        moveSan: move.san,
        fenPosition: postFen,
        materialChange: 0,
        rationale: `${moveColor.toUpperCase()} delivered check with ${move.san}.`,
        confidence: 'EXACT',
        evidenceLevel: 'VERIFIED'
      });
    }

    // 2. Knight Fork
    if (move.piece === 'n') {
      const attackedTargets = [];
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const p = board[r][c];
          if (p && p.color === oppColor) {
            const atks = getAttackers(board, p.square, move.color);
            if (atks.some(a => a.square === move.to)) {
              attackedTargets.push(p);
            }
          }
        }
      }
      if (attackedTargets.length >= 2 && attackedTargets.some(t => ['k', 'q', 'r'].includes(t.type))) {
        detectedMotifs.push({
          motifName: 'Knight Fork',
          category: 'Fork',
          moveNumber,
          color: moveColor,
          moveSan: move.san,
          fenPosition: postFen,
          materialChange: 0,
          rationale: `Knight on ${move.to} forks ${attackedTargets.map(t => t.type.toUpperCase() + ' on ' + t.square).join(' and ')}.`,
          confidence: 'EXACT',
          evidenceLevel: 'VERIFIED'
        });
      }
    }

    // 3. Absolute Pin on King / Skewer
    if (['b', 'r', 'q'].includes(move.piece)) {
      const [tr, tc] = squareToCoords(move.to);
      const deltas = [];
      if (['b', 'q'].includes(move.piece)) deltas.push([-1, -1], [-1, 1], [1, -1], [1, 1]);
      if (['r', 'q'].includes(move.piece)) deltas.push([-1, 0], [1, 0], [0, -1], [0, 1]);

      for (const [dr, dc] of deltas) {
        let r = tr + dr;
        let c = tc + dc;
        let p1 = null;
        let p2 = null;
        while (r >= 0 && r < 8 && c >= 0 && c < 8) {
          const p = board[r]?.[c];
          if (p) {
            if (!p1) p1 = p;
            else if (!p2) { p2 = p; break; }
          }
          r += dr;
          c += dc;
        }

        if (p1 && p2 && p1.color === oppColor && p2.color === oppColor) {
          if (p2.type === 'k') {
            detectedMotifs.push({
              motifName: 'Absolute Pin on King',
              category: 'Pin/Skewer',
              moveNumber,
              color: moveColor,
              moveSan: move.san,
              fenPosition: postFen,
              materialChange: 0,
              rationale: `${move.piece.toUpperCase()} on ${move.to} pins ${p1.type.toUpperCase()} against King on ${p2.square}.`,
              confidence: 'EXACT',
              evidenceLevel: 'VERIFIED'
            });
          } else if (p2.type === 'q' && PIECE_VALUES[p1.type] < 9) {
            detectedMotifs.push({
              motifName: 'Relative Pin on Queen',
              category: 'Pin/Skewer',
              moveNumber,
              color: moveColor,
              moveSan: move.san,
              fenPosition: postFen,
              materialChange: 0,
              rationale: `${move.piece.toUpperCase()} pins ${p1.type.toUpperCase()} against Queen on ${p2.square}.`,
              confidence: 'RULE_BASED',
              evidenceLevel: 'CANDIDATE'
            });
          } else {
            const p1Val = p1.type === 'k' ? 999 : PIECE_VALUES[p1.type];
            const p2Val = p2.type === 'k' ? 999 : PIECE_VALUES[p2.type];
            if (p1Val > p2Val && ['k', 'q', 'r'].includes(p1.type)) {
              detectedMotifs.push({
                motifName: 'Skewer Attack',
                category: 'Pin/Skewer',
                moveNumber,
                color: moveColor,
                moveSan: move.san,
                fenPosition: postFen,
                materialChange: 0,
                rationale: `${move.piece.toUpperCase()} skewers ${p1.type.toUpperCase()} on ${p1.square}, exposing ${p2.type.toUpperCase()} on ${p2.square}.`,
                confidence: 'RULE_BASED',
                evidenceLevel: 'CANDIDATE'
              });
            }
          }
        }
      }
    }

    // 4. Sacrifices
    const movingPieceVal = PIECE_VALUES[move.piece];
    const capturedVal = move.captured ? PIECE_VALUES[move.captured] : 0;
    const oppAttackers = getAttackers(board, move.to, oppColor);
    const friendlyDefenders = getAttackers(board, move.to, move.color);

    let isSacrifice = false;
    let netLoss = 0;
    let sacType = 'GENERIC';

    if (move.captured && movingPieceVal > capturedVal && oppAttackers.length > 0) {
      netLoss = movingPieceVal - capturedVal;
      isSacrifice = true;
      if (move.piece === 'q') sacType = 'QUEEN';
      else if (move.piece === 'r' && (move.captured === 'n' || move.captured === 'b')) sacType = 'EXCHANGE';
      else if ((move.piece === 'b' || move.piece === 'n') && move.captured === 'p') sacType = 'MINOR';
    } else if (!move.captured && oppAttackers.length > 0) {
      const minOpp = Math.min(...oppAttackers.map(a => PIECE_VALUES[a.type]));
      if (minOpp < movingPieceVal || oppAttackers.length > friendlyDefenders.length) {
        netLoss = movingPieceVal - (friendlyDefenders.length > 0 ? minOpp : 0);
        if (netLoss >= 2) {
          isSacrifice = true;
          if (move.piece === 'q') sacType = 'QUEEN';
          else if (move.piece === 'r') sacType = 'EXCHANGE';
          else if (move.piece === 'b' || move.piece === 'n') sacType = 'MINOR';
        }
      }
    }

    if (isSacrifice) {
      let isTactical = false;
      let rationale = '';

      if (replay.isCheckmate()) {
        isTactical = true;
        rationale = 'Delivers immediate checkmate.';
      } else if (futureMoves.length > 0) {
        const nm = futureMoves[0];
        const nnm = futureMoves[1];
        if (nm && (nm.to === move.to || nm.captured === move.piece)) {
          const testR = new Chess(postFen);
          try {
            testR.move(nm);
            if (nnm) {
              testR.move(nnm);
              if (testR.isCheckmate() || testR.inCheck() || (nnm.captured && PIECE_VALUES[nnm.captured] >= netLoss)) {
                isTactical = true;
                rationale = `Tactical continuation: ${nnm.san} attacks king or recovers material.`;
              }
            }
          } catch {}
        }
      }

      const sacName = isTactical ? 'Tactical Sacrifice' : 'Candidate Sacrifice';
      detectedMotifs.push({
        motifName: sacName,
        category: 'Sacrifice',
        moveNumber,
        color: moveColor,
        moveSan: move.san,
        fenPosition: postFen,
        materialChange: -netLoss,
        rationale: `${moveColor.toUpperCase()} sacrificed ${move.piece.toUpperCase()} with ${move.san} (${rationale || 'positional investment'}).`,
        confidence: isTactical ? 'EXACT' : 'RULE_BASED',
        evidenceLevel: isTactical ? 'VERIFIED' : 'CANDIDATE'
      });

      if (sacType === 'QUEEN') {
        detectedMotifs.push({
          motifName: 'Queen Sacrifice',
          category: 'Sacrifice',
          moveNumber,
          color: moveColor,
          moveSan: move.san,
          fenPosition: postFen,
          materialChange: -netLoss,
          rationale: `${moveColor.toUpperCase()} sacrificed Queen on ${move.to} with ${move.san}.`,
          confidence: isTactical ? 'EXACT' : 'RULE_BASED',
          evidenceLevel: isTactical ? 'VERIFIED' : 'CANDIDATE'
        });
      } else if (sacType === 'EXCHANGE') {
        detectedMotifs.push({
          motifName: 'Exchange Sacrifice',
          category: 'Sacrifice',
          moveNumber,
          color: moveColor,
          moveSan: move.san,
          fenPosition: postFen,
          materialChange: -netLoss,
          rationale: `${moveColor.toUpperCase()} traded Rook for Minor Piece with ${move.san}.`,
          confidence: isTactical ? 'EXACT' : 'RULE_BASED',
          evidenceLevel: isTactical ? 'VERIFIED' : 'CANDIDATE'
        });
      } else if (sacType === 'MINOR') {
        detectedMotifs.push({
          motifName: 'Minor Piece Sacrifice',
          category: 'Sacrifice',
          moveNumber,
          color: moveColor,
          moveSan: move.san,
          fenPosition: postFen,
          materialChange: -netLoss,
          rationale: `${moveColor.toUpperCase()} sacrificed Minor Piece on ${move.to} with ${move.san}.`,
          confidence: isTactical ? 'EXACT' : 'RULE_BASED',
          evidenceLevel: isTactical ? 'VERIFIED' : 'CANDIDATE'
        });
      }
    }
  }

  return detectedMotifs;
}

async function run() {
  const args = process.argv.slice(2);
  let targetGameId = null;
  let limit = 1000;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--game-id' && args[i + 1]) targetGameId = parseInt(args[i + 1], 10);
    if (args[i] === '--limit' && args[i + 1]) limit = parseInt(args[i + 1], 10);
  }

  const pool = new Pool({ connectionString });
  console.log(`\n=============================================================`);
  console.log(` ChessBase Tactical Motifs Idempotent Reanalysis`);
  console.log(`=============================================================`);

  try {
    const client = await pool.connect();

    // 1. Run migration for new columns/motifs
    const migrationPath = path.join(__dirname, '../sql/migrations/01_enhanced_motifs.sql');
    if (fs.existsSync(migrationPath)) {
      console.log('Applying database migration for enhanced motifs...');
      const sql = fs.readFileSync(migrationPath, 'utf8');
      await client.query(sql);
      console.log('✓ Migration applied successfully.\n');
    }

    // 2. Fetch games to reanalyze
    let queryText = 'SELECT game_id, pgn FROM games';
    const params = [];
    if (targetGameId) {
      queryText += ' WHERE game_id = $1';
      params.push(targetGameId);
    } else {
      queryText += ' ORDER BY game_id ASC LIMIT $1';
      params.push(limit);
    }

    const gamesRes = await client.query(queryText, params);
    const games = gamesRes.rows;
    console.log(`Found ${games.length} game(s) to reanalyze.\n`);

    let totalMotifsInserted = 0;
    const motifStats = {};
    const startTime = Date.now();

    for (let gIdx = 0; gIdx < games.length; gIdx++) {
      const g = games[gIdx];
      const gId = g.game_id;

      await client.query('BEGIN');

      // Safe invalidation: clear old motif records for this game
      await client.query('DELETE FROM game_motifs WHERE game_id = $1;', [gId]);

      // Re-run enhanced detection
      const motifs = analyzeGameMotifs(g.pgn);

      for (const m of motifs) {
        // Get or insert motif_id
        let mIdRes = await client.query('SELECT motif_id FROM tactical_motifs WHERE motif_name = $1;', [m.motifName]);
        if (mIdRes.rows.length === 0) {
          mIdRes = await client.query(
            'INSERT INTO tactical_motifs (motif_name, category, description) VALUES ($1, $2, $3) RETURNING motif_id;',
            [m.motifName, m.category, m.rationale]
          );
        }
        const mId = mIdRes.rows[0].motif_id;

        // Insert new motif record
        await client.query(`
          INSERT INTO game_motifs (game_id, motif_id, move_number, color, fen_position, move_san, material_change, rationale, confidence, evidence_level)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (game_id, motif_id, move_number, color) DO NOTHING;
        `, [
          gId,
          mId,
          m.moveNumber,
          m.color,
          m.fenPosition,
          m.moveSan,
          m.materialChange,
          m.rationale,
          m.confidence || 'RULE_BASED',
          m.evidenceLevel || 'CANDIDATE'
        ]);

        totalMotifsInserted++;
        motifStats[m.motifName] = (motifStats[m.motifName] || 0) + 1;
      }

      await client.query('COMMIT');
      process.stdout.write(`\rReanalyzing games: [${gIdx + 1}/${games.length}] (Game ID: ${gId}, ${motifs.length} motifs detected)`);
    }

    const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n\n=============================================================`);
    console.log(` Reanalysis Completed Successfully in ${durationSec}s!`);
    console.log(` - Games Reprocessed: ${games.length}`);
    console.log(` - Motifs Re-classified: ${totalMotifsInserted}`);
    console.log(`\n Motifs Distribution:`);
    for (const [name, count] of Object.entries(motifStats)) {
      console.log(`   • ${name.padEnd(28)} : ${count}`);
    }
    console.log(`=============================================================\n`);

    client.release();
  } catch (err) {
    console.error('Fatal reanalysis error:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();

