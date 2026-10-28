import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import fs from 'fs';
import path from 'path';

export async function GET(
  req: NextRequest,
  { params }: { params: { type: string } }
) {
  try {
    const reportType = params.type;
    const startTime = Date.now();
    let sql = '';
    let explanation = '';
    let sqlConcepts: string[] = [];

    switch (reportType) {
      case 'opening_popularity':
        sql = `
          SELECT 
            o.eco_code,
            o.opening_name,
            COUNT(g.game_id) AS game_count,
            ROUND(AVG(g.move_count), 1) AS avg_moves,
            DENSE_RANK() OVER (ORDER BY COUNT(g.game_id) DESC) AS rank
          FROM openings o
          JOIN games g ON o.opening_id = g.opening_id
          GROUP BY o.eco_code, o.opening_name
          ORDER BY game_count DESC
          LIMIT 10;
        `;
        explanation = 'Calculates opening popularity by joining games to openings and applying GROUP BY and DENSE_RANK() window function.';
        sqlConcepts = ['JOIN', 'GROUP BY', 'AGGREGATION (COUNT, AVG)', 'WINDOW FUNCTION (DENSE_RANK)'];
        break;

      case 'opening_success_rates':
        sql = `
          SELECT 
            o.eco_code,
            o.opening_name,
            COUNT(g.game_id) AS total_games,
            COUNT(g.game_id) FILTER (WHERE g.result = '1-0') AS white_wins,
            COUNT(g.game_id) FILTER (WHERE g.result = '0-1') AS black_wins,
            COUNT(g.game_id) FILTER (WHERE g.result = '1/2-1/2') AS draws,
            ROUND((COUNT(g.game_id) FILTER (WHERE g.result = '1-0')::NUMERIC / NULLIF(COUNT(g.game_id), 0)) * 100, 2) AS white_win_pct,
            ROUND((COUNT(g.game_id) FILTER (WHERE g.result = '0-1')::NUMERIC / NULLIF(COUNT(g.game_id), 0)) * 100, 2) AS black_win_pct,
            ROUND((COUNT(g.game_id) FILTER (WHERE g.result = '1/2-1/2')::NUMERIC / NULLIF(COUNT(g.game_id), 0)) * 100, 2) AS draw_pct
          FROM openings o
          JOIN games g ON o.opening_id = g.opening_id
          GROUP BY o.eco_code, o.opening_name
          HAVING COUNT(g.game_id) >= 1
          ORDER BY total_games DESC;
        `;
        explanation = 'Evaluates winning percentages for White and Black across openings using conditional aggregation (FILTER) and HAVING clauses.';
        sqlConcepts = ['JOIN', 'GROUP BY', 'HAVING', 'CONDITIONAL AGGREGATION (FILTER)', 'NULLIF'];
        break;

      case 'player_performance':
        sql = `
          SELECT 
            p.player_id,
            p.name AS player_name,
            p.fide_rating,
            p.country,
            COUNT(g.game_id) AS total_games,
            COUNT(g.game_id) FILTER (
              WHERE (g.white_player_id = p.player_id AND g.result = '1-0') OR 
                    (g.black_player_id = p.player_id AND g.result = '0-1')
            ) AS wins,
            COUNT(g.game_id) FILTER (
              WHERE (g.white_player_id = p.player_id AND g.result = '0-1') OR 
                    (g.black_player_id = p.player_id AND g.result = '1-0')
            ) AS losses,
            COUNT(g.game_id) FILTER (WHERE g.result = '1/2-1/2') AS draws,
            ROUND((COUNT(g.game_id) FILTER (
              WHERE (g.white_player_id = p.player_id AND g.result = '1-0') OR 
                    (g.black_player_id = p.player_id AND g.result = '0-1')
            )::NUMERIC / NULLIF(COUNT(g.game_id), 0)) * 100, 2) AS win_rate,
            DENSE_RANK() OVER (ORDER BY p.fide_rating DESC NULLS LAST) AS rating_rank
          FROM players p
          JOIN games g ON p.player_id IN (g.white_player_id, g.black_player_id)
          GROUP BY p.player_id, p.name, p.fide_rating, p.country
          ORDER BY wins DESC, win_rate DESC;
        `;
        explanation = 'Queries multi-role participation (as White or Black) using IN condition, conditional logic, and ranking.';
        sqlConcepts = ['MULTI-KEY JOIN (IN)', 'GROUP BY', 'CASE/FILTER', 'WINDOW FUNCTIONS'];
        break;

      case 'rating_band_analysis':
        sql = `
          SELECT * FROM v_rating_band_performance;
        `;
        explanation = 'Queries the analytical view v_rating_band_performance which groups games into FIDE rating bands using Common Table Expressions (CTE) and calculates outcome distributions.';
        sqlConcepts = ['POSTGRESQL VIEW', 'COMMON TABLE EXPRESSION (CTE)', 'CASE STATEMENTS', 'STATISTICAL BUCKETING'];
        break;

      case 'color_advantage':
        sql = `
          SELECT 
            COUNT(*) AS total_games_analyzed,
            COUNT(*) FILTER (WHERE result = '1-0') AS white_wins,
            COUNT(*) FILTER (WHERE result = '0-1') AS black_wins,
            COUNT(*) FILTER (WHERE result = '1/2-1/2') AS draws,
            ROUND((COUNT(*) FILTER (WHERE result = '1-0')::NUMERIC / COUNT(*)) * 100, 2) AS white_win_pct,
            ROUND((COUNT(*) FILTER (WHERE result = '0-1')::NUMERIC / COUNT(*)) * 100, 2) AS black_win_pct,
            ROUND((COUNT(*) FILTER (WHERE result = '1/2-1/2')::NUMERIC / COUNT(*)) * 100, 2) AS draw_pct
          FROM games
          WHERE result IN ('1-0', '0-1', '1/2-1/2');
        `;
        explanation = 'Demonstrates first-move advantage across the entire database population through aggregate calculations.';
        sqlConcepts = ['GLOBAL AGGREGATION', 'FILTER CONSTRUCTS', 'RATIO COMPUTATION'];
        break;

      case 'tournament_leaderboard':
        sql = `
          SELECT * FROM v_tournament_leaderboard LIMIT 20;
        `;
        explanation = 'Pulls tournament standings from v_tournament_leaderboard, implementing international chess scoring rules (W=1.0, D=0.5, L=0.0) partitioned by tournament.';
        sqlConcepts = ['VIEW QUERY', 'PARTITION BY WINDOW FUNCTION', 'CUSTOM SCORE WEIGHING'];
        break;

      case 'country_performance':
        sql = `
          SELECT 
            COALESCE(p.country, 'Unknown') AS country,
            COUNT(DISTINCT p.player_id) AS player_count,
            ROUND(AVG(p.fide_rating), 1) AS avg_fide_rating,
            MAX(p.fide_rating) AS peak_rating,
            SUM(p.total_games) AS total_games_played,
            SUM(p.total_wins) AS total_wins
          FROM players p
          GROUP BY p.country
          ORDER BY avg_fide_rating DESC NULLS LAST;
        `;
        explanation = 'Aggregates country-level descriptive demographics using GROUP BY, AVG, MAX, and COALESCE.';
        sqlConcepts = ['GROUP BY', 'AGGREGATE FUNCTIONS (AVG, MAX, SUM)', 'COALESCE'];
        break;

      case 'rating_vs_performance':
        sql = `
          WITH rating_diff_table AS (
            SELECT 
              game_id,
              result,
              (white_rating - black_rating) AS rating_diff,
              CASE 
                WHEN (white_rating - black_rating) >= 200 THEN 'White Heavily Favored (+200)'
                WHEN (white_rating - black_rating) >= 50 THEN 'White Slightly Favored (+50 to +199)'
                WHEN (white_rating - black_rating) BETWEEN -49 AND 49 THEN 'Evenly Matched (±50)'
                WHEN (white_rating - black_rating) BETWEEN -199 AND -50 THEN 'Black Slightly Favored (-50 to -199)'
                ELSE 'Black Heavily Favored (-200)'
              END AS rating_delta_band,
              CASE 
                WHEN (white_rating - black_rating) >= 200 THEN 1
                WHEN (white_rating - black_rating) >= 50 THEN 2
                WHEN (white_rating - black_rating) BETWEEN -49 AND 49 THEN 3
                WHEN (white_rating - black_rating) BETWEEN -199 AND -50 THEN 4
                ELSE 5
              END AS sort_order
            FROM games
            WHERE white_rating IS NOT NULL AND black_rating IS NOT NULL
          )
          SELECT 
            rating_delta_band,
            COUNT(*) AS total_games,
            COUNT(*) FILTER (WHERE result = '1-0') AS white_wins,
            COUNT(*) FILTER (WHERE result = '0-1') AS black_wins,
            COUNT(*) FILTER (WHERE result = '1/2-1/2') AS draws,
            ROUND((COUNT(*) FILTER (WHERE result = '1-0')::NUMERIC / COUNT(*)) * 100, 2) AS white_win_pct,
            ROUND((COUNT(*) FILTER (WHERE result = '0-1')::NUMERIC / COUNT(*)) * 100, 2) AS black_win_pct
          FROM rating_diff_table
          GROUP BY rating_delta_band, sort_order
          ORDER BY sort_order;
        `;
        explanation = 'Calculates rating differential vs empirical game outcome to evaluate Elo predictive validity, controlling for side color.';
        sqlConcepts = ['COMMON TABLE EXPRESSION (CTE)', 'CONDITIONAL BINNING', 'DIFFERENTIAL ANALYSIS'];
        break;

      case 'tactical_motif_report':
        sql = `
          SELECT * FROM v_tactical_motif_summary ORDER BY occurrence_count DESC;
        `;
        explanation = 'Queries v_tactical_motif_summary to measure how frequently each tactical motif occurs and its empirical correlation with game victory.';
        sqlConcepts = ['VIEW QUERY', 'JOIN ON NOVELTY ENGINE RELATIONS', 'WIN CORRELATION METRICS'];
        break;

      case 'semantic_search_evaluation':
        // Load benchmark JSON results directly
        try {
          const bPath = path.join(process.cwd(), 'docs', 'BENCHMARK_RESULTS.json');
          const bData = JSON.parse(fs.readFileSync(bPath, 'utf8'));
          return NextResponse.json({
            success: true,
            reportType,
            data: bData.benchmarkResults,
            metadata: {
              datasetSize: bData.datasetSize,
              positionsAnalyzed: bData.totalPositionsAnalyzed,
              throughput: bData.throughputPositionsPerSec,
              motifsDetected: bData.motifsDetected,
            },
            explanation: 'Evaluation benchmark comparing deterministic tactical pattern matching with semantic vector search across precision, recall, and throughput.',
            sqlConcepts: ['BENCHMARK VERIFICATION', 'GROUND-TRUTH RECALL', 'PRECISION EVALUATION'],
            durationMs: Date.now() - startTime,
          });
        } catch {
          sql = 'SELECT * FROM v_tactical_motif_summary;';
        }
        break;

      case 'data_quality_report':
        sql = `
          SELECT 
            (SELECT COUNT(*) FROM games WHERE opening_id IS NULL) AS games_missing_opening,
            (SELECT COUNT(*) FROM games WHERE tournament_id IS NULL) AS games_missing_tournament,
            (SELECT COUNT(*) FROM games WHERE white_rating IS NULL OR black_rating IS NULL) AS games_missing_ratings,
            (SELECT COUNT(*) FROM games g LEFT JOIN game_embeddings ge ON g.game_id = ge.game_id WHERE ge.embedding_id IS NULL) AS unindexed_embeddings_count,
            (SELECT COUNT(*) FROM players WHERE fide_rating IS NULL) AS unrated_players_count,
            (SELECT COUNT(*) FROM pgn_import_jobs WHERE status = 'FAILED') AS failed_import_jobs;
        `;
        explanation = 'Integrity audit query calculating missing foreign keys, null rating values, unindexed vector rows, and failed import job instances.';
        sqlConcepts = ['SCALAR SUBQUERIES', 'AUDIT & DATA INTEGRITY', 'LEFT JOIN NULL DETECTION'];
        break;

      case 'database_performance_report':
        sql = `
          EXPLAIN (ANALYZE, FORMAT JSON)
          SELECT g.game_id, wp.name, bp.name, o.opening_name, g.result
          FROM games g
          JOIN players wp ON g.white_player_id = wp.player_id
          JOIN players bp ON g.black_player_id = bp.player_id
          JOIN openings o ON g.opening_id = o.opening_id
          WHERE g.result = '1-0' AND g.white_rating >= 2600
          ORDER BY g.game_date DESC;
        `;
        explanation = 'Executes EXPLAIN ANALYZE on a complex multi-join relational query to demonstrate index scanning and query execution planning.';
        sqlConcepts = ['EXPLAIN ANALYZE', 'QUERY PLANNER INSPECTION', 'INDEX USAGE VERIFICATION'];
        break;

      default:
        return NextResponse.json({ error: 'Unknown report type' }, { status: 400 });
    }

    const res = await query(sql);
    const durationMs = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      reportType,
      data: res.rows,
      rowCount: res.rows.length,
      durationMs,
      sql: sql.trim(),
      explanation,
      sqlConcepts,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

