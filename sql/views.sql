-- ===============================================================================
-- ChessBase Views
-- Provides convenient aggregated representations for the UI and reporting
-- ===============================================================================

-- 1. View: game_summary – combines game, players, opening, and tournament info
CREATE OR REPLACE VIEW game_summary AS
SELECT
    g.game_id,
    g.result,
    g.game_date,
    g.move_count,
    g.white_rating,
    g.black_rating,
    p_white.name AS white_player,
    p_white.fide_rating AS white_fide_rating,
    p_black.name AS black_player,
    p_black.fide_rating AS black_fide_rating,
    o.opening_name,
    o.eco_code,
    t.name AS tournament_name,
    g.pgn
FROM games g
LEFT JOIN players p_white ON g.white_player_id = p_white.player_id
LEFT JOIN players p_black ON g.black_player_id = p_black.player_id
LEFT JOIN openings o ON g.opening_id = o.opening_id
LEFT JOIN tournaments t ON g.tournament_id = t.tournament_id;

-- 2. View: player_statistics – aggregates win/draw/loss counts per player
CREATE OR REPLACE VIEW player_statistics AS
SELECT
    p.player_id,
    p.name,
    p.fide_rating,
    p.total_games,
    p.total_wins,
    p.total_losses,
    p.total_draws,
    (p.total_wins::numeric / NULLIF(p.total_games,0)) * 100 AS win_pct,
    (p.total_draws::numeric / NULLIF(p.total_games,0)) * 100 AS draw_pct,
    (p.total_losses::numeric / NULLIF(p.total_games,0)) * 100 AS loss_pct
FROM players p;

-- Add more views as needed for reporting (e.g., motif_statistics, opening_popularity)
