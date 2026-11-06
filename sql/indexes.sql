-- ==============================================================================
-- ChessBase PostgreSQL Indexes & Performance Optimizations
-- DBMS Experiential Learning - Level 3 Project
-- Authors: Raghav Budur (PES1UG23AM225) & Prithviraj K (PES1UG24AM204)
-- ==============================================================================
-- Purpose of this file:
-- 1. Eliminates Sequential Scans (Seq Scan) on multi-thousand row datasets.
-- 2. B-Tree Indexes: Optimizes equality checks, range comparisons, and foreign key joins.
-- 3. Composite Indexes: Optimizes sequential move replay (game_id, move_number, color) and FEN lookups.
-- 4. GIN Indexes with Trigram (pg_trgm): Enables sub-millisecond autocomplete and fuzzy search.
-- 5. Full-Text Search (FTS) Indexes: GIN on tsvector for English annotations and descriptions.
-- 6. HNSW Vector Index: Provides sub-millisecond approximate nearest neighbor (ANN) vector search.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. B-tree Indexes for High-Frequency Foreign Key & Relational Filtering
-- Speeds up JOIN operations between games, players, tournaments, and openings.
-- ------------------------------------------------------------------------------
-- Fast lookup of all games played by a specific White player
CREATE INDEX IF NOT EXISTS idx_games_white_player ON games(white_player_id);

-- Fast lookup of all games played by a specific Black player
CREATE INDEX IF NOT EXISTS idx_games_black_player ON games(black_player_id);

-- Filter games associated with a particular tournament
CREATE INDEX IF NOT EXISTS idx_games_tournament ON games(tournament_id);

-- Group or filter games by their classified opening
CREATE INDEX IF NOT EXISTS idx_games_opening ON games(opening_id);

-- Quick filtering on game outcome ('1-0', '0-1', '1/2-1/2')
CREATE INDEX IF NOT EXISTS idx_games_result ON games(result);

-- Accelerates chronological ordering and date range queries
CREATE INDEX IF NOT EXISTS idx_games_date ON games(game_date);

-- Composite B-Tree index for player rating range queries (e.g. Master games >= 2500)
CREATE INDEX IF NOT EXISTS idx_games_ratings ON games(white_rating, black_rating);

-- ------------------------------------------------------------------------------
-- 2. Composite Indexes for Moves Replay and Analysis
-- Critical for the interactive board replay and Cockpit live move navigation.
-- ------------------------------------------------------------------------------
-- Composite index ensures moves for a game are retrieved in strict chronological order with Index-Only scans
CREATE INDEX IF NOT EXISTS idx_moves_game_seq ON moves(game_id, move_number, color);

-- Position Matching Index: Allows instant retrieval of games reaching an identical board state
CREATE INDEX IF NOT EXISTS idx_moves_fen ON moves(fen_after);

-- ------------------------------------------------------------------------------
-- 3. Tactical Motifs Join Indexes
-- Accelerates associative queries between games and detected tactical motifs.
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_game_motifs_game_id ON game_motifs(game_id);
CREATE INDEX IF NOT EXISTS idx_game_motifs_motif_id ON game_motifs(motif_id);

-- ------------------------------------------------------------------------------
-- 4. GIN Index with pg_trgm for Fuzzy Trigram Search on Players & Openings
-- Supports LIKE '%term%', ILIKE, and similarity searches with sub-linear response time.
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_players_name_trgm ON players USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_openings_name_trgm ON openings USING GIN (opening_name gin_trgm_ops);

-- ------------------------------------------------------------------------------
-- 5. Full-Text Search (tsvector) GIN Index on Openings & Game PGN Annotations
-- Tokenizes text into stems and removes stop-words for natural language document search.
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_openings_fts ON openings 
    USING GIN (to_tsvector('english', opening_name || ' ' || COALESCE(description, '')));

CREATE INDEX IF NOT EXISTS idx_embeddings_source_fts ON game_embeddings 
    USING GIN (to_tsvector('english', source_text));

-- ------------------------------------------------------------------------------
-- 6. pgvector Vector Index (HNSW - Hierarchical Navigable Small World)
-- Optimized for cosine distance (<=> operator) across 384 dimensions.
-- m = 16: Max bidirectional links per node in the graph.
-- ef_construction = 64: Size of the dynamic candidate list evaluated during index build.
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vector') THEN
        CREATE INDEX IF NOT EXISTS idx_game_embeddings_vector_hnsw 
        ON game_embeddings 
        USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64);
    END IF;
END $$;
