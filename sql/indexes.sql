-- ==============================================================================
-- ChessBase PostgreSQL Indexes & Performance Optimizations
-- DBMS Experiential Learning - Level 3 Project
-- Authors: Raghav Budur (PES1UG23AM225) & Prithviraj K (PES1UG24AM204)
-- ==============================================================================

-- 1. B-tree Indexes for High-Frequency Foreign Key & Relational Filtering
CREATE INDEX IF NOT EXISTS idx_games_white_player ON games(white_player_id);
CREATE INDEX IF NOT EXISTS idx_games_black_player ON games(black_player_id);
CREATE INDEX IF NOT EXISTS idx_games_tournament ON games(tournament_id);
CREATE INDEX IF NOT EXISTS idx_games_opening ON games(opening_id);
CREATE INDEX IF NOT EXISTS idx_games_result ON games(result);
CREATE INDEX IF NOT EXISTS idx_games_date ON games(game_date);
CREATE INDEX IF NOT EXISTS idx_games_ratings ON games(white_rating, black_rating);

-- 2. Composite Indexes for Moves Replay and Analysis
CREATE INDEX IF NOT EXISTS idx_moves_game_seq ON moves(game_id, move_number, color);
CREATE INDEX IF NOT EXISTS idx_moves_fen ON moves(fen_after);

-- 3. Tactical Motifs Join Indexes
CREATE INDEX IF NOT EXISTS idx_game_motifs_game_id ON game_motifs(game_id);
CREATE INDEX IF NOT EXISTS idx_game_motifs_motif_id ON game_motifs(motif_id);

-- 4. GIN Index with pg_trgm for Fuzzy Trigram Search on Players & Openings
CREATE INDEX IF NOT EXISTS idx_players_name_trgm ON players USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_openings_name_trgm ON openings USING GIN (opening_name gin_trgm_ops);

-- 5. Full-Text Search (tsvector) GIN Index on Openings & Game PGN Annotations
CREATE INDEX IF NOT EXISTS idx_openings_fts ON openings USING GIN (to_tsvector('english', opening_name || ' ' || COALESCE(description, '')));
CREATE INDEX IF NOT EXISTS idx_embeddings_source_fts ON game_embeddings USING GIN (to_tsvector('english', source_text));

-- 6. pgvector Vector Index (HNSW - Hierarchical Navigable Small World for Cosine Distance)
-- Note: HNSW gives superior speed & recall for cosine similarity (<=>) compared to ivfflat
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vector') THEN
        CREATE INDEX IF NOT EXISTS idx_game_embeddings_vector_hnsw 
        ON game_embeddings 
        USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64);
    END IF;
END $$;

