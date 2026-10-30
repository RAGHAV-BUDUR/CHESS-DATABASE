import { NextRequest, NextResponse } from 'next/server';
import { query, withTransaction } from '@/lib/db';
import { PGNParser } from '@/lib/chess/pgn-parser';
import { VectorEngine } from '@/lib/chess/vector-search';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const offset = (page - 1) * limit;

    const white = searchParams.get('white');
    const black = searchParams.get('black');
    const player = searchParams.get('player');
    const opening = searchParams.get('opening');
    const eco = searchParams.get('eco');
    const tournament = searchParams.get('tournament');
    const result = searchParams.get('result');
    const minRating = searchParams.get('minRating');
    const maxRating = searchParams.get('maxRating');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const motif = searchParams.get('motif');
    const sortBy = searchParams.get('sortBy') || 'date';
    const sortOrder = searchParams.get('sortOrder')?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const conditions: string[] = [];
    const values: any[] = [];
    let pIdx = 1;

    if (white) {
      conditions.push(`wp.name ILIKE $${pIdx}`);
      values.push(`%${white}%`);
      pIdx++;
    }

    if (black) {
      conditions.push(`bp.name ILIKE $${pIdx}`);
      values.push(`%${black}%`);
      pIdx++;
    }

    if (player) {
      conditions.push(`(wp.name ILIKE $${pIdx} OR bp.name ILIKE $${pIdx})`);
      values.push(`%${player}%`);
      pIdx++;
    }

    if (opening) {
      conditions.push(`o.opening_name ILIKE $${pIdx}`);
      values.push(`%${opening}%`);
      pIdx++;
    }

    if (eco) {
      conditions.push(`o.eco_code = $${pIdx}`);
      values.push(eco.toUpperCase());
      pIdx++;
    }

    if (tournament) {
      conditions.push(`t.name ILIKE $${pIdx}`);
      values.push(`%${tournament}%`);
      pIdx++;
    }

    if (result && ['1-0', '0-1', '1/2-1/2'].includes(result)) {
      conditions.push(`g.result = $${pIdx}`);
      values.push(result);
      pIdx++;
    }

    if (minRating) {
      conditions.push(`(g.white_rating >= $${pIdx} AND g.black_rating >= $${pIdx})`);
      values.push(parseInt(minRating, 10));
      pIdx++;
    }

    if (maxRating) {
      conditions.push(`(g.white_rating <= $${pIdx} AND g.black_rating <= $${pIdx})`);
      values.push(parseInt(maxRating, 10));
      pIdx++;
    }

    if (startDate) {
      conditions.push(`g.game_date >= $${pIdx}`);
      values.push(startDate);
      pIdx++;
    }

    if (endDate) {
      conditions.push(`g.game_date <= $${pIdx}`);
      values.push(endDate);
      pIdx++;
    }

    if (motif) {
      conditions.push(`EXISTS (
        SELECT 1 FROM game_motifs gm2 
        JOIN tactical_motifs tm2 ON gm2.motif_id = tm2.motif_id 
        WHERE gm2.game_id = g.game_id AND tm2.motif_name = $${pIdx}
      )`);
      values.push(motif);
      pIdx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    let orderClause = 'ORDER BY g.game_date DESC NULLS LAST, g.game_id DESC';
    if (sortBy === 'moves') {
      orderClause = `ORDER BY g.move_count ${sortOrder}`;
    } else if (sortBy === 'rating') {
      orderClause = `ORDER BY ((COALESCE(g.white_rating, 0) + COALESCE(g.black_rating, 0)) / 2) ${sortOrder}`;
    }

    // Count query
    const countSql = `
      SELECT COUNT(DISTINCT g.game_id) AS total
      FROM games g
      JOIN players wp ON g.white_player_id = wp.player_id
      JOIN players bp ON g.black_player_id = bp.player_id
      LEFT JOIN openings o ON g.opening_id = o.opening_id
      LEFT JOIN tournaments t ON g.tournament_id = t.tournament_id
      ${whereClause}
    `;

    const countRes = await query(countSql, values);
    const totalCount = parseInt(countRes.rows[0]?.total || '0', 10);

    // Data query with aggregated motifs
    const dataSql = `
      SELECT 
        g.game_id,
        g.game_date,
        g.result,
        g.move_count,
        g.round,
        wp.player_id AS white_player_id,
        wp.name AS white_player,
        g.white_rating,
        bp.player_id AS black_player_id,
        bp.name AS black_player,
        g.black_rating,
        o.opening_id,
        o.opening_name,
        o.eco_code,
        t.tournament_id,
        t.name AS tournament_name,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object('name', tm.motif_name, 'category', tm.category)
          ) FILTER (WHERE tm.motif_name IS NOT NULL), '[]'
        ) AS motifs
      FROM games g
      JOIN players wp ON g.white_player_id = wp.player_id
      JOIN players bp ON g.black_player_id = bp.player_id
      LEFT JOIN openings o ON g.opening_id = o.opening_id
      LEFT JOIN tournaments t ON g.tournament_id = t.tournament_id
      LEFT JOIN game_motifs gm ON g.game_id = gm.game_id
      LEFT JOIN tactical_motifs tm ON gm.motif_id = tm.motif_id
      ${whereClause}
      GROUP BY g.game_id, wp.player_id, wp.name, bp.player_id, bp.name, o.opening_id, o.opening_name, o.eco_code, t.tournament_id, t.name
      ${orderClause}
      LIMIT $${pIdx} OFFSET $${pIdx + 1}
    `;

    const dataRes = await query(dataSql, [...values, limit, offset]);

    return NextResponse.json({
      success: true,
      data: dataRes.rows,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    let pgnText = body.pgn || body.pgnText || '';

    // If separate fields are provided without PGN headers, build standard PGN
    if (!pgnText.includes('[Event ') && body.moves) {
      const today = new Date().toISOString().split('T')[0].replace(/-/g, '.');
      pgnText = `[Event "${body.event || 'Casual Match'}"]
[Site "${body.site || 'ChessBase Analysis'}"]
[Date "${body.date || today}"]
[Round "${body.round || '1'}"]
[White "${body.whitePlayer || 'White Player'}"]
[Black "${body.blackPlayer || 'Black Player'}"]
[Result "${body.result || '*'}"]
${body.whiteRating ? `[WhiteElo "${body.whiteRating}"]\n` : ''}${body.blackRating ? `[BlackElo "${body.blackRating}"]\n` : ''}
${body.moves}`;
    }

    if (!pgnText || pgnText.trim().length === 0) {
      return NextResponse.json({ error: 'PGN or moves are required' }, { status: 400 });
    }

    const parsed = PGNParser.parseSingleGame(pgnText);
    if (!parsed) {
      return NextResponse.json({ error: 'Failed to parse game. Ensure PGN moves are syntactically valid.' }, { status: 400 });
    }

    // Override headers if explicitly provided in request body
    if (body.whitePlayer) parsed.whitePlayer = body.whitePlayer;
    if (body.blackPlayer) parsed.blackPlayer = body.blackPlayer;
    if (body.event) parsed.event = body.event;
    if (body.result) parsed.result = body.result;
    if (body.whiteRating) parsed.whiteRating = parseInt(body.whiteRating, 10);
    if (body.blackRating) parsed.blackRating = parseInt(body.blackRating, 10);

    // Check pgvector availability
    let hasPgVector = false;
    try {
      const extRes = await query("SELECT extname FROM pg_extension WHERE extname = 'vector'");
      hasPgVector = extRes.rows.length > 0;
    } catch {
      hasPgVector = false;
    }

    let createdGameId: number | null = null;

    await withTransaction(async (client) => {
      let whitePlayer = (parsed.whitePlayer || 'Unknown White').trim().slice(0, 100);
      let blackPlayer = (parsed.blackPlayer || 'Unknown Black').trim().slice(0, 100);
      if (whitePlayer.toLowerCase() === blackPlayer.toLowerCase()) {
        blackPlayer = `${blackPlayer} (Black)`.slice(0, 100);
      }

      // 1. Insert or get White Player
      const wRes = await client.query(`
        INSERT INTO players (name, fide_rating, country)
        VALUES ($1, $2::int, 'FIDE')
        ON CONFLICT (name) DO UPDATE SET 
          fide_rating = COALESCE(EXCLUDED.fide_rating, players.fide_rating)
        RETURNING player_id;
      `, [whitePlayer, parsed.whiteRating || null]);
      const whiteId = wRes.rows[0].player_id;

      // 2. Insert or get Black Player
      const bRes = await client.query(`
        INSERT INTO players (name, fide_rating, country)
        VALUES ($1, $2::int, 'FIDE')
        ON CONFLICT (name) DO UPDATE SET 
          fide_rating = COALESCE(EXCLUDED.fide_rating, players.fide_rating)
        RETURNING player_id;
      `, [blackPlayer, parsed.blackRating || null]);
      const blackId = bRes.rows[0].player_id;

      // 3. Tournament
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
          `, [eventName, (parsed.site || 'ChessBase').trim().slice(0, 100), parsed.date]);
          tournamentId = tRes.rows[0].tournament_id;
        }
      }

      // 4. Opening
      const opName = parsed.openingName || 'Custom Game';
      const oRes = await client.query(`
        INSERT INTO openings (eco_code, opening_name, description)
        VALUES ($1, $2, $3)
        ON CONFLICT (eco_code, opening_name) DO UPDATE SET description = EXCLUDED.description
        RETURNING opening_id;
      `, [parsed.ecoCode || 'A00', opName, opName]);
      const openingId = oRes.rows[0].opening_id;

      // 5. Insert Game
      const gRes = await client.query(`
        INSERT INTO games (
          white_player_id, black_player_id, tournament_id, opening_id,
          result, game_date, round, pgn, move_count, white_rating, black_rating
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING game_id;
      `, [
        whiteId, blackId, tournamentId, openingId,
        parsed.result || '*', parsed.date || new Date().toISOString().split('T')[0], parsed.round || '1', parsed.pgn,
        parsed.moveCount, parsed.whiteRating || null, parsed.blackRating || null,
      ]);
      createdGameId = gRes.rows[0].game_id;

      // 6. Insert Moves
      for (const m of parsed.moves) {
        await client.query(`
          INSERT INTO moves (game_id, move_number, color, san, uci, fen_after, is_check, is_capture)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8);
        `, [
          createdGameId, m.moveNumber, m.color, m.san, m.uci, m.fenAfter, m.isCheck, m.isCapture
        ]);
      }

      // 7. Insert Motifs
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
          `, [createdGameId, mId, dm.moveNumber, dm.color, dm.fenPosition, dm.moveSan, dm.materialChange, dm.rationale, dm.confidence]);
        }
      }

      // 8. Insert Vector Embedding
      if (createdGameId) {
        const vec = VectorEngine.generateEmbedding(parsed.searchableSummary);
        const vecStr = VectorEngine.toPgVectorString(vec);
        if (hasPgVector) {
          await client.query(`
            INSERT INTO game_embeddings (game_id, model_name, dimensions, source_text, embedding)
            VALUES ($1, $2, $3, $4, $5::vector)
            ON CONFLICT (game_id) DO UPDATE SET embedding = EXCLUDED.embedding, source_text = EXCLUDED.source_text;
          `, [createdGameId, VectorEngine.MODEL_NAME, VectorEngine.DIMENSIONS, parsed.searchableSummary, vecStr]);
        } else {
          await client.query(`
            INSERT INTO game_embeddings (game_id, model_name, dimensions, source_text, embedding)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (game_id) DO UPDATE SET embedding = EXCLUDED.embedding, source_text = EXCLUDED.source_text;
          `, [createdGameId, VectorEngine.MODEL_NAME, VectorEngine.DIMENSIONS, parsed.searchableSummary, vecStr]);
        }
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Game added successfully to database',
      gameId: createdGameId,
      parsed: {
        whitePlayer: parsed.whitePlayer,
        blackPlayer: parsed.blackPlayer,
        moveCount: parsed.moveCount,
        motifsDetected: parsed.detectedMotifs.length,
        eco: parsed.ecoCode,
      }
    });
  } catch (err: any) {
    console.error('Error creating game:', err);
    return NextResponse.json({ error: err.message || 'Failed to save game' }, { status: 500 });
  }
}

