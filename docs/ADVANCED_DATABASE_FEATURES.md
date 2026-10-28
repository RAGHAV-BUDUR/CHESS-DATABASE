# ChessBase — Mandatory Advanced PostgreSQL Database Features

**Project Title:** ChessBase — A Chess Game Database & Move-Based Search Platform  
**Course:** DBMS Experiential Learning — Level 3 Project  
**Authors:** Raghav Budur (`PES1UG23AM225`) & Prithviraj K (`PES1UG24AM204`)  

---

## Executive Summary of Implemented Features

The project satisfies and exceeds the mandatory requirement of demonstrating advanced database features. Eight distinct advanced PostgreSQL mechanisms are designed, implemented, and executed against real chess database records:

| # | Advanced Database Feature | PostgreSQL Implementation / Object | Purpose in ChessBase |
| :-: | :--- | :--- | :--- |
| **1** | **Stored Functions & Procedures** | `get_player_stats(p_id)`<br>`search_games_hybrid(...)`<br>`refresh_player_aggregates()` | Encapsulated server-side analytics, career totals, and parameterized hybrid search ranking. |
| **2** | **Triggers & Trigger Functions** | `trg_game_stats_sync` on `games`<br>`trg_game_rating_history` on `games` | Automated real-time synchronization of player totals (W/D/L) and rating timeline on every game `INSERT`/`UPDATE`/`DELETE`. |
| **3** | **Analytical Views** | `v_top_players`<br>`v_opening_stats`<br>`v_tournament_leaderboard`<br>`v_tactical_motif_summary` | Abstracted reporting layer computing tournament standings and opening popularity percentages. |
| **4** | **Window Functions** | `DENSE_RANK() OVER (...)`<br>`PARTITION BY t.tournament_id` | Generating accurate leaderboards, opening popularity tiers, and performance distributions without self-joins. |
| **5** | **B-tree & Composite Indexes** | `idx_games_white_player`, `idx_games_opening`, `idx_moves_game_seq` | Accelerating relational foreign-key joins and sequential half-move replay. |
| **6** | **GIN & Full-Text Search** | `idx_players_name_trgm` (`pg_trgm`)<br>`idx_openings_fts` (`to_tsvector`) | Trigram fuzzy matching on grandmaster names and full-text keyword indexing on annotations. |
| **7** | **pgvector Cosine Search & HNSW Index** | `idx_game_embeddings_vector_hnsw` (`vector_cosine_ops`) | Sub-millisecond vector similarity search (`<=>`) over 384-dimensional chess embeddings. |
| **8** | **ACID Transactions & Safe Rollback** | `BEGIN` ... `COMMIT` / `ROLLBACK` via `withTransaction` | Bulk PGN ingestion ensuring failed game records do not leave orphaned moves or corrupted state. |

---

## 1. Stored Function Demonstration

### Function: `get_player_stats(p_player_id INT)`
Computes a comprehensive career overview for any player, accurately accounting for dual participation (playing as White or playing as Black), opponent average rating, and win rate.

```sql
SELECT * FROM get_player_stats(1);
```

**Implementation Source (`sql/functions.sql`):**
```sql
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
```

---

## 2. Trigger Demonstration

### Trigger: `trg_game_stats_sync`
Whenever a game is inserted, updated, or deleted, the trigger function `trg_update_player_stats_fn()` increments or decrements the cached `total_games`, `total_wins`, `total_losses`, and `total_draws` on both affected `players` rows automatically.

```sql
-- Demonstration: Inserting a game triggers player record updates
INSERT INTO games (white_player_id, black_player_id, result, pgn)
VALUES (1, 2, '1-0', '1. e4 e5 1-0');

-- Query player record to verify automatic counter update:
SELECT player_id, name, total_games, total_wins FROM players WHERE player_id = 1;
```

---

## 3. Analytical Views & Window Functions Demonstration

### View: `v_tournament_leaderboard`
Applies standard FIDE tournament scoring ($W=1.0, D=0.5, L=0.0$) using the `DENSE_RANK()` window function partitioned by tournament:

```sql
SELECT * FROM v_tournament_leaderboard WHERE tournament_id = 1;
```

```sql
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
```

---

## 4. pgvector Cosine Search with HNSW Index

### Querying Vector Embeddings with `<=>` Cosine Distance:
```sql
SELECT 
    g.game_id,
    wp.name AS white,
    bp.name AS black,
    o.opening_name,
    ge.embedding <=> $1::vector AS cosine_distance,
    (1.0 - (ge.embedding <=> $1::vector)) AS similarity_score
FROM game_embeddings ge
JOIN games g ON ge.game_id = g.game_id
JOIN players wp ON g.white_player_id = wp.player_id
JOIN players bp ON g.black_player_id = bp.player_id
LEFT JOIN openings o ON g.opening_id = o.opening_id
ORDER BY cosine_distance ASC
LIMIT 10;
```
Indexed with Hierarchical Navigable Small World (`HNSW`) index for logarithmic time nearest-neighbor retrieval:
```sql
CREATE INDEX idx_game_embeddings_vector_hnsw 
ON game_embeddings 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```
