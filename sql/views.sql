-- ===============================================================================
-- ChessBase Views
-- Provides convenient aggregated representations for the UI and reporting
-- ===============================================================================
-- Purpose of this file:
-- 1. Encapsulates multi-table JOINs into clean, queryable virtual tables.
-- 2. game_summary: Flattens game metadata, player names, Elo ratings, openings, and tournaments.
-- 3. player_statistics: Pre-computes win/draw/loss percentage distributions per player.
-- ===============================================================================

-- -------------------------------------------------------------------------------
-- 1. View: game_summary
-- Combines the core 'games' table with two separate joins on 'players' (for White and Black),
-- as well as 'openings' and 'tournaments'. Simplifies queries in Next.js API routes.
-- -------------------------------------------------------------------------------
CREATE OR REPLACE VIEW game_summary AS
SELECT
    g.game_id,
    g.result,
    g.game_date,
    g.move_count,
    g.white_rating,
    g.black_rating,
    -- White player details
    p_white.name AS white_player,
    p_white.fide_rating AS white_fide_rating,
    -- Black player details
    p_black.name AS black_player,
    p_black.fide_rating AS black_fide_rating,
    -- Opening metadata
    o.opening_name,
    o.eco_code,
    -- Tournament event metadata
    t.name AS tournament_name,
    -- Full game notation
    g.pgn
FROM games g
-- Dual LEFT JOINs on players table to extract both competitors simultaneously
LEFT JOIN players p_white ON g.white_player_id = p_white.player_id
LEFT JOIN players p_black ON g.black_player_id = p_black.player_id
-- Nullable joins for unclassified openings or non-tournament games
LEFT JOIN openings o ON g.opening_id = o.opening_id
LEFT JOIN tournaments t ON g.tournament_id = t.tournament_id;

-- -------------------------------------------------------------------------------
-- 2. View: player_statistics
-- Calculates real-time career win, draw, and loss percentages per player.
-- NULLIF is used to safely prevent division-by-zero errors for newly created players with 0 games.
-- -------------------------------------------------------------------------------
CREATE OR REPLACE VIEW player_statistics AS
SELECT
    p.player_id,
    p.name,
    p.fide_rating,
    p.total_games,
    p.total_wins,
    p.total_losses,
    p.total_draws,
    -- Percentage calculations rounded naturally
    (p.total_wins::numeric / NULLIF(p.total_games, 0)) * 100 AS win_pct,
    (p.total_draws::numeric / NULLIF(p.total_games, 0)) * 100 AS draw_pct,
    (p.total_losses::numeric / NULLIF(p.total_games, 0)) * 100 AS loss_pct
FROM players p;
