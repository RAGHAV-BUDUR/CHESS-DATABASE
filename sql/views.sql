-- ==============================================================================
-- ChessBase PostgreSQL Analytical Views
-- DBMS Experiential Learning - Level 3 Project
-- Authors: Raghav Budur (PES1UG23AM225) & Prithviraj K (PES1UG24AM204)
-- ==============================================================================

-- 1. View: Top Players Leaderboard with DENSE_RANK() Window Function
CREATE OR REPLACE VIEW v_top_players AS
SELECT 
    p.player_id,
    p.name,
    p.fide_rating,
    p.country,
    p.total_games,
    p.total_wins,
    p.total_losses,
    p.total_draws,
    ROUND((p.total_wins::NUMERIC / NULLIF(p.total_games, 0)) * 100, 2) AS win_percentage,
    ROUND(((p.total_wins + 0.5 * p.total_draws)::NUMERIC / NULLIF(p.total_games, 0)) * 100, 2) AS score_percentage,
    DENSE_RANK() OVER (ORDER BY p.fide_rating DESC NULLS LAST, p.total_wins DESC) AS rating_rank,
    DENSE_RANK() OVER (ORDER BY (p.total_wins::NUMERIC / NULLIF(p.total_games, 0)) DESC NULLS LAST) AS win_rate_rank
FROM players p
WHERE p.total_games > 0;

-- 2. View: Comprehensive Opening Success Rates & Popularity
CREATE OR REPLACE VIEW v_opening_stats AS
SELECT 
    o.opening_id,
    o.eco_code,
    o.opening_name,
    COUNT(g.game_id) AS total_games_played,
    COUNT(g.game_id) FILTER (WHERE g.result = '1-0') AS white_wins,
    COUNT(g.game_id) FILTER (WHERE g.result = '0-1') AS black_wins,
    COUNT(g.game_id) FILTER (WHERE g.result = '1/2-1/2') AS draws,
    ROUND((COUNT(g.game_id) FILTER (WHERE g.result = '1-0')::NUMERIC / NULLIF(COUNT(g.game_id), 0)) * 100, 2) AS white_win_pct,
    ROUND((COUNT(g.game_id) FILTER (WHERE g.result = '0-1')::NUMERIC / NULLIF(COUNT(g.game_id), 0)) * 100, 2) AS black_win_pct,
    ROUND((COUNT(g.game_id) FILTER (WHERE g.result = '1/2-1/2')::NUMERIC / NULLIF(COUNT(g.game_id), 0)) * 100, 2) AS draw_pct,
    ROUND(AVG(g.move_count), 1) AS avg_move_count,
    ROUND(AVG(g.white_rating), 0) AS avg_white_rating,
    ROUND(AVG(g.black_rating), 0) AS avg_black_rating,
    DENSE_RANK() OVER (ORDER BY COUNT(g.game_id) DESC) AS popularity_rank
FROM openings o
LEFT JOIN games g ON o.opening_id = g.opening_id
GROUP BY o.opening_id, o.eco_code, o.opening_name;

-- 3. View: Tournament Standings Leaderboard with Standard Chess Scoring (W=1, D=0.5, L=0)
CREATE OR REPLACE VIEW v_tournament_leaderboard AS
SELECT 
    t.tournament_id,
    t.name AS tournament_name,
    p.player_id,
    p.name AS player_name,
    p.country,
    COUNT(g.game_id) AS games_played,
    SUM(
        CASE 
            WHEN (g.white_player_id = p.player_id AND g.result = '1-0') OR 
                 (g.black_player_id = p.player_id AND g.result = '0-1') THEN 1.0
            WHEN g.result = '1/2-1/2' THEN 0.5
            ELSE 0.0 
        END
    ) AS total_points,
    COUNT(g.game_id) FILTER (
        WHERE (g.white_player_id = p.player_id AND g.result = '1-0') OR 
              (g.black_player_id = p.player_id AND g.result = '0-1')
    ) AS wins,
    COUNT(g.game_id) FILTER (WHERE g.result = '1/2-1/2') AS draws,
    COUNT(g.game_id) FILTER (
        WHERE (g.white_player_id = p.player_id AND g.result = '0-1') OR 
              (g.black_player_id = p.player_id AND g.result = '1-0')
    ) AS losses,
    DENSE_RANK() OVER (
        PARTITION BY t.tournament_id 
        ORDER BY SUM(
            CASE 
                WHEN (g.white_player_id = p.player_id AND g.result = '1-0') OR 
                     (g.black_player_id = p.player_id AND g.result = '0-1') THEN 1.0
                WHEN g.result = '1/2-1/2' THEN 0.5
                ELSE 0.0 
            END
        ) DESC
    ) AS tournament_rank
FROM tournaments t
JOIN games g ON t.tournament_id = g.tournament_id
JOIN players p ON p.player_id IN (g.white_player_id, g.black_player_id)
GROUP BY t.tournament_id, t.name, p.player_id, p.name, p.country;

-- 4. View: Tactical Motif Occurrence & Outcome Correlation
CREATE OR REPLACE VIEW v_tactical_motif_summary AS
SELECT 
    tm.motif_id,
    tm.motif_name,
    tm.category,
    COUNT(gm.id) AS occurrence_count,
    COUNT(DISTINCT gm.game_id) AS games_affected,
    COUNT(g.game_id) FILTER (
        WHERE (gm.color = 'white' AND g.result = '1-0') OR 
              (gm.color = 'black' AND g.result = '0-1')
    ) AS motif_initiator_wins,
    COUNT(g.game_id) FILTER (
        WHERE (gm.color = 'white' AND g.result = '0-1') OR 
              (gm.color = 'black' AND g.result = '1-0')
    ) AS motif_initiator_losses,
    COUNT(g.game_id) FILTER (WHERE g.result = '1/2-1/2') AS motif_initiator_draws,
    ROUND(
        (COUNT(g.game_id) FILTER (
            WHERE (gm.color = 'white' AND g.result = '1-0') OR 
                  (gm.color = 'black' AND g.result = '0-1')
        )::NUMERIC / NULLIF(COUNT(DISTINCT gm.game_id), 0)) * 100, 2
    ) AS motif_win_rate_pct
FROM tactical_motifs tm
LEFT JOIN game_motifs gm ON tm.motif_id = gm.motif_id
LEFT JOIN games g ON gm.game_id = g.game_id
GROUP BY tm.motif_id, tm.motif_name, tm.category;

-- 5. View: Rating Band Analysis
CREATE OR REPLACE VIEW v_rating_band_performance AS
WITH categorized_games AS (
    SELECT 
        game_id,
        result,
        CASE 
            WHEN (white_rating + black_rating)/2 >= 2700 THEN 'Elite (2700+)'
            WHEN (white_rating + black_rating)/2 >= 2500 THEN 'Grandmaster (2500-2699)'
            WHEN (white_rating + black_rating)/2 >= 2300 THEN 'Master (2300-2499)'
            WHEN (white_rating + black_rating)/2 >= 2000 THEN 'Expert (2000-2299)'
            ELSE 'Club / Intermediate (<2000)'
        END AS rating_tier,
        CASE 
            WHEN (white_rating + black_rating)/2 >= 2700 THEN 5
            WHEN (white_rating + black_rating)/2 >= 2500 THEN 4
            WHEN (white_rating + black_rating)/2 >= 2300 THEN 3
            WHEN (white_rating + black_rating)/2 >= 2000 THEN 2
            ELSE 1
        END AS tier_order
    FROM games
    WHERE white_rating IS NOT NULL AND black_rating IS NOT NULL
)
SELECT 
    rating_tier,
    tier_order,
    COUNT(*) AS total_games,
    COUNT(*) FILTER (WHERE result = '1-0') AS white_wins,
    COUNT(*) FILTER (WHERE result = '0-1') AS black_wins,
    COUNT(*) FILTER (WHERE result = '1/2-1/2') AS draws,
    ROUND((COUNT(*) FILTER (WHERE result = '1-0')::NUMERIC / COUNT(*)) * 100, 2) AS white_win_pct,
    ROUND((COUNT(*) FILTER (WHERE result = '0-1')::NUMERIC / COUNT(*)) * 100, 2) AS black_win_pct,
    ROUND((COUNT(*) FILTER (WHERE result = '1/2-1/2')::NUMERIC / COUNT(*)) * 100, 2) AS draw_pct
FROM categorized_games
GROUP BY rating_tier, tier_order
ORDER BY tier_order DESC;

