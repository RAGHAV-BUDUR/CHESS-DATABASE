-- ==============================================================================
-- ChessBase PostgreSQL Stored Functions and Procedures
-- DBMS Experiential Learning - Level 3 Project
-- Authors: Raghav Budur (PES1UG23AM225) & Prithviraj K (PES1UG24AM204)
-- ==============================================================================

-- 1. Stored Function: Get Player Statistics (Wins, Losses, Draws, Performance)
CREATE OR REPLACE FUNCTION get_player_stats(p_player_id INT)
RETURNS TABLE (
    player_id INT,
    player_name VARCHAR(100),
    fide_rating INT,
    country VARCHAR(60),
    total_games BIGINT,
    white_games BIGINT,
    black_games BIGINT,
    wins BIGINT,
    losses BIGINT,
    draws BIGINT,
    win_rate NUMERIC(5,2),
    loss_rate NUMERIC(5,2),
    draw_rate NUMERIC(5,2),
    avg_opponent_rating NUMERIC(6,1)
) AS $$
BEGIN
    RETURN QUERY
    WITH player_matches AS (
        SELECT 
            g.game_id,
            CASE WHEN g.white_player_id = p_player_id THEN 'white' ELSE 'black' END AS side,
            g.result,
            CASE 
                WHEN g.white_player_id = p_player_id THEN g.black_rating 
                ELSE g.white_rating 
            END AS opponent_rating,
            CASE 
                WHEN (g.white_player_id = p_player_id AND g.result = '1-0') OR 
                     (g.black_player_id = p_player_id AND g.result = '0-1') THEN 1
                ELSE 0
            END AS is_win,
            CASE 
                WHEN (g.white_player_id = p_player_id AND g.result = '0-1') OR 
                     (g.black_player_id = p_player_id AND g.result = '1-0') THEN 1
                ELSE 0
            END AS is_loss,
            CASE 
                WHEN g.result = '1/2-1/2' THEN 1
                ELSE 0
            END AS is_draw
        FROM games g
        WHERE g.white_player_id = p_player_id OR g.black_player_id = p_player_id
    )
    SELECT 
        p.player_id,
        p.name,
        p.fide_rating,
        p.country,
        COUNT(pm.game_id)::BIGINT AS total_games,
        COUNT(pm.game_id) FILTER (WHERE pm.side = 'white')::BIGINT AS white_games,
        COUNT(pm.game_id) FILTER (WHERE pm.side = 'black')::BIGINT AS black_games,
        COALESCE(SUM(pm.is_win), 0)::BIGINT AS wins,
        COALESCE(SUM(pm.is_loss), 0)::BIGINT AS losses,
        COALESCE(SUM(pm.is_draw), 0)::BIGINT AS draws,
        ROUND((COALESCE(SUM(pm.is_win), 0)::NUMERIC / NULLIF(COUNT(pm.game_id), 0)) * 100, 2) AS win_rate,
        ROUND((COALESCE(SUM(pm.is_loss), 0)::NUMERIC / NULLIF(COUNT(pm.game_id), 0)) * 100, 2) AS loss_rate,
        ROUND((COALESCE(SUM(pm.is_draw), 0)::NUMERIC / NULLIF(COUNT(pm.game_id), 0)) * 100, 2) AS draw_rate,
        ROUND(AVG(pm.opponent_rating), 1) AS avg_opponent_rating
    FROM players p
    LEFT JOIN player_matches pm ON true
    WHERE p.player_id = p_player_id
    GROUP BY p.player_id, p.name, p.fide_rating, p.country;
END;
$$ LANGUAGE plpgsql STABLE;

-- 2. Stored Function: Hybrid Pattern & Structured Search
CREATE OR REPLACE FUNCTION search_games_hybrid(
    p_query_embedding vector(384) DEFAULT NULL,
    p_motif_name VARCHAR(80) DEFAULT NULL,
    p_opening_eco VARCHAR(3) DEFAULT NULL,
    p_player_name VARCHAR(100) DEFAULT NULL,
    p_result VARCHAR(7) DEFAULT NULL,
    p_min_rating INT DEFAULT NULL,
    p_max_rating INT DEFAULT NULL,
    p_limit INT DEFAULT 20,
    p_offset INT DEFAULT 0
)
RETURNS TABLE (
    game_id INT,
    game_date DATE,
    result VARCHAR(7),
    white_player VARCHAR(100),
    white_rating INT,
    black_player VARCHAR(100),
    black_rating INT,
    opening_name VARCHAR(150),
    eco_code VARCHAR(3),
    tournament_name VARCHAR(150),
    detected_motif VARCHAR(80),
    semantic_distance DOUBLE PRECISION,
    combined_score DOUBLE PRECISION
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        g.game_id,
        g.game_date,
        g.result,
        wp.name AS white_player,
        g.white_rating,
        bp.name AS black_player,
        g.black_rating,
        o.opening_name,
        o.eco_code,
        t.name AS tournament_name,
        tm.motif_name AS detected_motif,
        CASE 
            WHEN p_query_embedding IS NOT NULL AND ge.embedding IS NOT NULL 
            THEN (ge.embedding <=> p_query_embedding)::DOUBLE PRECISION
            ELSE 1.0::DOUBLE PRECISION 
        END AS semantic_distance,
        (
            -- Normalized hybrid ranking scoring model:
            -- 1. Semantic component (1 - distance)
            CASE 
                WHEN p_query_embedding IS NOT NULL AND ge.embedding IS NOT NULL 
                THEN (1.0 - (ge.embedding <=> p_query_embedding)) * 0.5
                ELSE 0.0 
            END +
            -- 2. Motif match bonus
            CASE 
                WHEN p_motif_name IS NOT NULL AND tm.motif_name = p_motif_name THEN 0.3
                ELSE 0.0
            END +
            -- 3. High quality/rating game signal
            COALESCE(LEAST(((g.white_rating + g.black_rating) / 2.0) / 3000.0 * 0.2, 0.2), 0.05)
        )::DOUBLE PRECISION AS combined_score
    FROM games g
    JOIN players wp ON g.white_player_id = wp.player_id
    JOIN players bp ON g.black_player_id = bp.player_id
    LEFT JOIN openings o ON g.opening_id = o.opening_id
    LEFT JOIN tournaments t ON g.tournament_id = t.tournament_id
    LEFT JOIN game_embeddings ge ON g.game_id = ge.game_id
    LEFT JOIN game_motifs gm ON g.game_id = gm.game_id
    LEFT JOIN tactical_motifs tm ON gm.motif_id = tm.motif_id
    WHERE 
        (p_opening_eco IS NULL OR o.eco_code = p_opening_eco) AND
        (p_result IS NULL OR g.result = p_result) AND
        (p_player_name IS NULL OR wp.name ILIKE '%' || p_player_name || '%' OR bp.name ILIKE '%' || p_player_name || '%') AND
        (p_min_rating IS NULL OR (g.white_rating >= p_min_rating AND g.black_rating >= p_min_rating)) AND
        (p_max_rating IS NULL OR (g.white_rating <= p_max_rating AND g.black_rating <= p_max_rating)) AND
        (p_motif_name IS NULL OR tm.motif_name = p_motif_name)
    GROUP BY g.game_id, wp.name, bp.name, o.opening_name, o.eco_code, t.name, tm.motif_name, ge.embedding
    ORDER BY combined_score DESC, g.game_date DESC NULLS LAST
    LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE;

-- 3. Stored Procedure: Refresh All Player Aggregates in a Safe Transaction
CREATE OR REPLACE PROCEDURE refresh_player_aggregates()
AS $$
BEGIN
    UPDATE players p
    SET 
        total_games = sub.total_g,
        total_wins = sub.total_w,
        total_losses = sub.total_l,
        total_draws = sub.total_d
    FROM (
        SELECT 
            pl.player_id,
            COUNT(g.game_id) AS total_g,
            COUNT(g.game_id) FILTER (WHERE (g.white_player_id = pl.player_id AND g.result = '1-0') OR (g.black_player_id = pl.player_id AND g.result = '0-1')) AS total_w,
            COUNT(g.game_id) FILTER (WHERE (g.white_player_id = pl.player_id AND g.result = '0-1') OR (g.black_player_id = pl.player_id AND g.result = '1-0')) AS total_l,
            COUNT(g.game_id) FILTER (WHERE g.result = '1/2-1/2') AS total_d
        FROM players pl
        LEFT JOIN games g ON pl.player_id = g.white_player_id OR pl.player_id = g.black_player_id
        GROUP BY pl.player_id
    ) sub
    WHERE p.player_id = sub.player_id;
END;
$$ LANGUAGE plpgsql;

