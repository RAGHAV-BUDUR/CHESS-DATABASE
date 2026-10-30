# ChessBase — SQL Reports & Analytical Queries Specification

**Project Title:** ChessBase — A Chess Game Database & Move-Based Search Platform  
**Course:** DBMS Experiential Learning — Level 3 Project  
**Authors:** Raghav Budur (`PES1UG23AM225`) & Prithviraj K (`PES1UG24AM204`)  

---

## 12 Analytical Reports Catalog

This document details the 12 SQL reports executed on the populated database through the Analytics & Reports page (`/reports`), mapping each to its demonstrated database concepts.

---

### Report 1: Opening Popularity
- **Purpose:** Ranks the most frequently chosen opening systems across historical tournament records.
- **Concepts Demonstrated:** `JOIN`, `GROUP BY`, `COUNT(*)`, `DENSE_RANK() OVER (ORDER BY ...)`.
```sql
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
```

---

### Report 2: Opening Success Rates
- **Purpose:** Compares White wins, Black wins, and draw percentages for each opening.
- **Concepts Demonstrated:** `JOIN`, `GROUP BY`, `HAVING`, conditional aggregation (`FILTER`), `NULLIF`.
```sql
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
```

---

### Report 3: Player Performance
- **Purpose:** Calculates wins, losses, draws, and win rate across all recorded games for each player, whether playing as White or Black.
- **Concepts Demonstrated:** Multi-key `JOIN (IN)`, `GROUP BY`, `FILTER`, `DENSE_RANK()`.
```sql
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
```

---

### Report 4: Rating-Band Analysis
- **Purpose:** Groups games into FIDE rating tiers (Super GM, Grandmaster, Master) and evaluates draw and victory rates.
- **Concepts Demonstrated:** `VIEW`, `CASE` statements, statistical binning.
```sql
SELECT * FROM v_rating_band_performance;
```

---

### Report 5: Color Advantage
- **Purpose:** Evaluates first-move advantage across all completed games in the database.
- **Concepts Demonstrated:** Aggregate `FILTER`, global denominator ratios.
```sql
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
```

---

### Report 6: Tournament Leaderboard
- **Purpose:** Evaluates tournament performance applying standard chess scoring (Win = 1.0, Draw = 0.5, Loss = 0.0) partitioned by tournament.
- **Concepts Demonstrated:** `VIEW`, `PARTITION BY` window function, custom point weighting.
```sql
SELECT * FROM v_tournament_leaderboard LIMIT 20;
```

---

### Report 7: Country-Level Performance
- **Purpose:** Calculates average FIDE rating, player count, and total victories by country.
- **Concepts Demonstrated:** `COALESCE`, `AVG`, `MAX`, `SUM`, `GROUP BY`.
```sql
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
```

---

### Report 8: Rating Delta vs Empirical Win Rate
- **Purpose:** Tests Elo predictive accuracy by binning rating differences ($R_{white} - R_{black}$) into five delta bands ($\ge +200, +50\text{ to }+199, \pm 50, -50\text{ to }-199, \le -200$).
- **Concepts Demonstrated:** Common Table Expressions (`WITH`), conditional binning, outcome correlation.
```sql
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
```

---

### Report 9: Tactical Motif Frequency & Outcome
- **Purpose:** Queries view `v_tactical_motif_summary` to correlate detected tactical motifs with initiator victory.
- **Concepts Demonstrated:** `VIEW`, `JOIN` on novelty engine relations.
```sql
SELECT * FROM v_tactical_motif_summary ORDER BY occurrence_count DESC;
```

---

### Report 10: Semantic Search & Algorithmic Benchmark
- **Purpose:** Evaluates retrieval precision and recall of vector search vs deterministic fingerprint matching.
- **Concepts Demonstrated:** Ground-truth precision/recall benchmark verification, latency timing.

---

### Report 11: Data Quality & Integrity Audit
- **Purpose:** Identifies database anomalies, missing tournament or opening foreign keys, unindexed games, and failed ingestion jobs.
- **Concepts Demonstrated:** Scalar Subqueries, Left Outer Join Null Detection, Audit Verification.
```sql
SELECT 
    (SELECT COUNT(*) FROM games WHERE opening_id IS NULL) AS games_missing_opening,
    (SELECT COUNT(*) FROM games WHERE tournament_id IS NULL) AS games_missing_tournament,
    (SELECT COUNT(*) FROM games WHERE white_rating IS NULL OR black_rating IS NULL) AS games_missing_ratings,
    (SELECT COUNT(*) FROM games g LEFT JOIN game_embeddings ge ON g.game_id = ge.game_id WHERE ge.embedding_id IS NULL) AS unindexed_embeddings_count,
    (SELECT COUNT(*) FROM players WHERE fide_rating IS NULL) AS unrated_players_count,
    (SELECT COUNT(*) FROM pgn_import_jobs WHERE status = 'FAILED') AS failed_import_jobs;
```

---

### Report 12: Database Performance (EXPLAIN ANALYZE)
- **Purpose:** Shows PostgreSQL Query Planner execution plan, verify index scanning on multi-table joins.
- **Concepts Demonstrated:** `EXPLAIN (ANALYZE, FORMAT JSON)`.
```sql
EXPLAIN (ANALYZE, FORMAT JSON)
SELECT g.game_id, wp.name, bp.name, o.opening_name, g.result
FROM games g
JOIN players wp ON g.white_player_id = wp.player_id
JOIN players bp ON g.black_player_id = bp.player_id
JOIN openings o ON g.opening_id = o.opening_id
WHERE g.result = '1-0' AND g.white_rating >= 2600
ORDER BY g.game_date DESC;
```

