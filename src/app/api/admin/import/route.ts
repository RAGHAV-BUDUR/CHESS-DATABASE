import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { query, withTransaction } from '@/lib/db';
import { PGNParser } from '@/lib/chess/pgn-parser';
import { VectorEngine } from '@/lib/chess/vector-search';

export async function POST(req: NextRequest) {
  try {
    // 1. Enforce ADMIN Role on Server
    await requireAdmin(req);

    // 2. Parse form data or JSON
    let pgnText = '';
    let filename = 'manual_import.pgn';

    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      if (!file) {
        return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
      }
      if (!file.name.endsWith('.pgn') && !file.name.endsWith('.txt')) {
        return NextResponse.json({ error: 'Invalid file format. Only .pgn or .txt allowed' }, { status: 400 });
      }
      filename = file.name;
      pgnText = await file.text();
    } else {
      const json = await req.json();
      pgnText = json.pgnText || '';
      filename = json.filename || 'text_paste.pgn';
    }

    if (!pgnText || pgnText.trim().length === 0) {
      return NextResponse.json({ error: 'PGN content is empty' }, { status: 400 });
    }

    // 3. Create Import Job Record
    const jobRes = await query(`
      INSERT INTO pgn_import_jobs (filename, status)
      VALUES ($1, 'PROCESSING')
      RETURNING job_id;
    `, [filename]);
    const jobId = jobRes.rows[0].job_id;

    // 4. Split games
    const rawGames = PGNParser.splitPgnGames(pgnText);
    let imported = 0;
    let skipped = 0;
    let failed = 0;
    const errors: string[] = [];

    // Check pgvector extension availability
    let hasPgVector = false;
    try {
      const extRes = await query("SELECT extname FROM pg_extension WHERE extname = 'vector'");
      hasPgVector = extRes.rows.length > 0;
    } catch {
      hasPgVector = false;
    }

    // Process each game inside safe ACID transaction
    for (let i = 0; i < rawGames.length; i++) {
      const rawG = rawGames[i];
      const parsed = PGNParser.parseSingleGame(rawG);

      if (!parsed) {
        failed++;
        errors.push(`Game ${i + 1}: Malformed PGN syntax or unable to parse.`);
        continue;
      }

      try {
        await withTransaction(async (client) => {
          let whitePlayer = (parsed.whitePlayer || 'Unknown White').trim().slice(0, 100);
          let blackPlayer = (parsed.blackPlayer || 'Unknown Black').trim().slice(0, 100);
          if (whitePlayer.toLowerCase() === blackPlayer.toLowerCase()) {
            blackPlayer = `${blackPlayer} (Black)`.slice(0, 100);
          }

          // A. Insert or get White Player
          const wRes = await client.query(`
            INSERT INTO players (name, fide_rating, country)
            VALUES ($1, $2, 'FIDE')
            ON CONFLICT (name) DO UPDATE SET 
              fide_rating = COALESCE(EXCLUDED.fide_rating, players.fide_rating)
            RETURNING player_id;
          `, [whitePlayer, parsed.whiteRating || null]);
          const whiteId = wRes.rows[0].player_id;

          // B. Insert or get Black Player
          const bRes = await client.query(`
            INSERT INTO players (name, fide_rating, country)
            VALUES ($1, $2, 'FIDE')
            ON CONFLICT (name) DO UPDATE SET 
              fide_rating = COALESCE(EXCLUDED.fide_rating, players.fide_rating)
            RETURNING player_id;
          `, [blackPlayer, parsed.blackRating || null]);
          const blackId = bRes.rows[0].player_id;

          // C. Tournament
          let tournamentId = null;
          if (parsed.event && parsed.event.trim().length > 0) {
            const eventName = parsed.event.trim().slice(0, 150);
            const existingTourn = await client.query(`SELECT tournament_id FROM tournaments WHERE name = $1 LIMIT 1;`, [eventName]);
            if (existingTourn.rows.length > 0) {
              tournamentId = existingTourn.rows[0].tournament_id;
            } else {
              const tRes = await client.query(`
                INSERT INTO tournaments (name, location, start_date)
                VALUES ($1, $2, $3)
                RETURNING tournament_id;
              `, [eventName, (parsed.site || 'Unknown').trim().slice(0, 100), parsed.date]);
              tournamentId = tRes.rows[0].tournament_id;
            }
          }

          // D. Opening
          const oName = (parsed.openingName || 'Custom Opening').trim().slice(0, 150);
          const ecoCode = (parsed.ecoCode || 'A00').trim().slice(0, 10);
          const oRes = await client.query(`
            INSERT INTO openings (eco_code, opening_name, description)
            VALUES ($1, $2, $3)
            ON CONFLICT (eco_code, opening_name) DO UPDATE SET description = EXCLUDED.description
            RETURNING opening_id;
          `, [ecoCode, oName, oName]);
          const openingId = oRes.rows[0].opening_id;

          // E. Insert Game
          const gRes = await client.query(`
            INSERT INTO games (
              white_player_id, black_player_id, tournament_id, opening_id,
              result, game_date, round, pgn, move_count, white_rating, black_rating
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING game_id;
          `, [
            whiteId, blackId, tournamentId, openingId,
            parsed.result, parsed.date, (parsed.round || '1').slice(0, 20), parsed.pgn,
            parsed.moveCount, parsed.whiteRating || null, parsed.blackRating || null,
          ]);
          const gameId = gRes.rows[0].game_id;

          // F. Insert Moves
          for (const m of parsed.moves) {
            await client.query(`
              INSERT INTO moves (game_id, move_number, color, san, uci, fen_after, is_check, is_capture)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8);
            `, [
              gameId, m.moveNumber, m.color, m.san, m.uci, m.fenAfter, m.isCheck, m.isCapture
            ]);
          }

          // G. Insert Motifs from Tactical Fingerprint Engine
          for (const dm of parsed.detectedMotifs) {
            const mRes = await client.query(`
              SELECT motif_id FROM tactical_motifs WHERE motif_name = $1;
            `, [dm.motifName]);
            if (mRes.rows.length > 0) {
              const mId = mRes.rows[0].motif_id;
              await client.query(`
                INSERT INTO game_motifs (game_id, motif_id, move_number, color, fen_position, move_san, material_change, rationale, confidence)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                ON CONFLICT DO NOTHING;
              `, [gameId, mId, dm.moveNumber, dm.color, dm.fenPosition, dm.moveSan, dm.materialChange, dm.rationale, dm.confidence]);
            }
          }

          // H. Insert Vector Embedding
          const vec = VectorEngine.generateEmbedding(parsed.searchableSummary);
          const vecStr = VectorEngine.toPgVectorString(vec);
          if (hasPgVector) {
            await client.query(`
              INSERT INTO game_embeddings (game_id, model_name, dimensions, source_text, embedding)
              VALUES ($1, $2, $3, $4, $5::vector)
              ON CONFLICT (game_id) DO UPDATE SET embedding = EXCLUDED.embedding, source_text = EXCLUDED.source_text;
            `, [gameId, VectorEngine.MODEL_NAME, VectorEngine.DIMENSIONS, parsed.searchableSummary, vecStr]);
          } else {
            await client.query(`
              INSERT INTO game_embeddings (game_id, model_name, dimensions, source_text, embedding)
              VALUES ($1, $2, $3, $4, $5)
              ON CONFLICT (game_id) DO UPDATE SET embedding = EXCLUDED.embedding, source_text = EXCLUDED.source_text;
            `, [gameId, VectorEngine.MODEL_NAME, VectorEngine.DIMENSIONS, parsed.searchableSummary, vecStr]);
          }
        });

        imported++;
      } catch (err: any) {
        failed++;
        errors.push(`Game ${i + 1} transaction failed: ${err.message}`);
      }
    }

    // 5. Update Job Status
    const status = failed > 0 && imported === 0 ? 'FAILED' : 'COMPLETED';
    await query(`
      UPDATE pgn_import_jobs
      SET 
        status = $1,
        total_games = $2,
        imported_games = $3,
        skipped_games = $4,
        failed_games = $5,
        error_log = $6,
        completed_at = CURRENT_TIMESTAMP
      WHERE job_id = $7;
    `, [status, rawGames.length, imported, skipped, failed, errors.slice(0, 10).join('\n'), jobId]);

    return NextResponse.json({
      success: true,
      jobId,
      summary: {
        total: rawGames.length,
        imported,
        skipped,
        failed,
        errors: errors.slice(0, 5),
      },
    });
  } catch (err: any) {
    if (err.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (err.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Administrative privileges required (HTTP 403)' }, { status: 403 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

