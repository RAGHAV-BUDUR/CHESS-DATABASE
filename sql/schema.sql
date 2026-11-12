-- ==============================================================================
-- ChessBase PostgreSQL Relational Schema with pgvector
-- DBMS Experiential Learning - Level 3 Project
-- Authors: Raghav Budur (PES1UG23AM225) & Prithviraj K (PES1UG24AM204)
-- ==============================================================================
-- Purpose of this file:
-- 1. Defines all foundational relational tables, constraints, foreign keys, and cascading rules.
-- 2. Sets up PostgreSQL extensions (uuid-ossp, pg_trgm for fuzzy search, pgvector for semantic search).
-- 3. Enforces data integrity at the database level using CHECK constraints, UNIQUE indices, and NOT NULL.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Enable Required PostgreSQL Extensions
-- ------------------------------------------------------------------------------
-- uuid-ossp: Generates RFC 4122 compliant UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- pg_trgm: Provides trigram matching for high-performance fuzzy text searching on player names & openings
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- pgvector: Enables 384-dimensional vector data types & distance operators (<=> for cosine distance)
DO $$
BEGIN
    BEGIN
        CREATE EXTENSION IF NOT EXISTS "vector";
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'pgvector extension not installed in PostgreSQL instance, continuing with fallback...';
    END;
END $$;

-- Drop existing tables in reverse dependency order if recreating the database schema
DROP TABLE IF EXISTS user_favourites CASCADE;
DROP TABLE IF EXISTS game_embeddings CASCADE;
DROP TABLE IF EXISTS game_motifs CASCADE;
DROP TABLE IF EXISTS tactical_motifs CASCADE;
DROP TABLE IF EXISTS game_annotations CASCADE;
DROP TABLE IF EXISTS moves CASCADE;
DROP TABLE IF EXISTS rating_history CASCADE;
DROP TABLE IF EXISTS games CASCADE;
DROP TABLE IF EXISTS openings CASCADE;
DROP TABLE IF EXISTS tournaments CASCADE;
DROP TABLE IF EXISTS players CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS pgn_import_jobs CASCADE;

-- ------------------------------------------------------------------------------
-- 2. User & Authentication Table
-- Stores user credentials and role-based access control (RBAC: ADMIN vs PLAYER).
-- Passwords must always be stored as bcrypt hashes, never plaintext.
-- ------------------------------------------------------------------------------
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,                                      -- Unique surrogate primary key
    username VARCHAR(50) UNIQUE NOT NULL,                            -- Unique human-readable login handle
    email VARCHAR(100) UNIQUE NOT NULL,                              -- Unique contact & login email address
    password_hash VARCHAR(255) NOT NULL,                             -- Secure bcrypt/argon2 hash with salt
    role VARCHAR(20) NOT NULL DEFAULT 'PLAYER' 
        CHECK (role IN ('ADMIN', 'PLAYER')),                         -- Strict RBAC authorization constraint
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP    -- Audit timestamp of user registration
);

-- ------------------------------------------------------------------------------
-- 3. Players Table
-- Master entity representing chess masters, grandmasters, and recorded competitors.
-- Pre-aggregates match summary statistics (games, wins, losses, draws) updated via triggers.
-- ------------------------------------------------------------------------------
CREATE TABLE players (
    player_id SERIAL PRIMARY KEY,                                    -- Unique surrogate primary key
    name VARCHAR(100) UNIQUE NOT NULL,                               -- Master name (e.g. 'Magnus Carlsen')
    fide_rating INT CHECK (fide_rating >= 0),                        -- Official FIDE Elo rating
    title VARCHAR(10),                                               -- FIDE title designation (GM, IM, FM, WGM)
    country VARCHAR(60),                                             -- Player's federation (e.g. 'NOR', 'IND', 'USA')
    total_games INT DEFAULT 0 CHECK (total_games >= 0),              -- Total games recorded in the database
    total_wins INT DEFAULT 0 CHECK (total_wins >= 0),                -- Aggregated white/black victory count
    total_losses INT DEFAULT 0 CHECK (total_losses >= 0),            -- Aggregated white/black defeat count
    total_draws INT DEFAULT 0 CHECK (total_draws >= 0),              -- Aggregated draw/stalemate count
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------------------------
-- 4. Tournaments Table
-- Represents competitive events, Olympiads, and World Championships.
-- ------------------------------------------------------------------------------
CREATE TABLE tournaments (
    tournament_id SERIAL PRIMARY KEY,                                -- Unique tournament identifier
    name VARCHAR(150) NOT NULL,                                      -- Event name (e.g. 'FIDE Candidates 2024')
    location VARCHAR(100),                                           -- Host city/country (e.g. 'Toronto, CAN')
    start_date DATE,                                                 -- Tournament commencement date
    end_date DATE,                                                   -- Tournament conclusion date
    time_control VARCHAR(50),                                        -- Format description ('Classical', 'Blitz', 'Rapid')
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------------------------
-- 5. Openings Table (ECO Classification)
-- Standard Encyclopedia of Chess Openings (ECO) catalog (A00 through E99).
-- ------------------------------------------------------------------------------
CREATE TABLE openings (
    opening_id SERIAL PRIMARY KEY,                                   -- Unique opening surrogate ID
    eco_code VARCHAR(3) NOT NULL,                                    -- 3-character standard ECO code (e.g. 'B90')
    opening_name VARCHAR(150) NOT NULL,                              -- Descriptive name (e.g. 'Sicilian Defense: Najdorf')
    pgn_moves TEXT,                                                  -- Canonical initial move sequence (e.g. '1. e4 c5 2. Nf3 d6...')
    description TEXT,                                                -- Strategic ideas, pawn structures, and key plans
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unq_eco_opening_name UNIQUE (eco_code, opening_name)  -- Prevents duplicate opening catalog entries
);

-- ------------------------------------------------------------------------------
-- 6. Games Table
-- Central relational entity recording individual match instances.
-- Enforces integrity rules: White and Black players must not be the same person.
-- ------------------------------------------------------------------------------
CREATE TABLE games (
    game_id SERIAL PRIMARY KEY,                                      -- Unique game primary key
    white_player_id INT NOT NULL 
        REFERENCES players(player_id) ON DELETE RESTRICT,            -- Foreign key to players table (White)
    black_player_id INT NOT NULL 
        REFERENCES players(player_id) ON DELETE RESTRICT,            -- Foreign key to players table (Black)
    tournament_id INT 
        REFERENCES tournaments(tournament_id) ON DELETE SET NULL,    -- Nullable FK: match may be casual/unrated
    opening_id INT 
        REFERENCES openings(opening_id) ON DELETE SET NULL,          -- Nullable FK: classified ECO opening
    result VARCHAR(7) NOT NULL 
        CHECK (result IN ('1-0', '0-1', '1/2-1/2', '*')),            -- FIDE standard result notation (* = ongoing)
    game_date DATE,                                                  -- Date the game was played
    round VARCHAR(20),                                               -- Tournament round number or stage (e.g. 'Round 7')
    pgn TEXT NOT NULL,                                               -- Raw Portable Game Notation text
    move_count INT DEFAULT 0 CHECK (move_count >= 0),                -- Total number of completed moves
    white_rating INT CHECK (white_rating >= 0),                      -- White player's rating at time of game
    black_rating INT CHECK (black_rating >= 0),                      -- Black player's rating at time of game
    termination VARCHAR(100),                                        -- Reason for game conclusion (e.g. 'Normal', 'Time forfeit')
    imported_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,  -- Ingestion audit timestamp
    CONSTRAINT chk_different_players CHECK (white_player_id <> black_player_id) -- Business rule: Player cannot play themselves
);

-- ------------------------------------------------------------------------------
-- 7. Moves Table (Move-by-Move Replay Data)
-- Stores each ply (half-move) in sequence for board reconstruction and FEN indexing.
-- ------------------------------------------------------------------------------
CREATE TABLE moves (
    move_id SERIAL PRIMARY KEY,                                      -- Unique move surrogate ID
    game_id INT NOT NULL 
        REFERENCES games(game_id) ON DELETE CASCADE,                 -- Deleting a game automatically purges all moves
    move_number INT NOT NULL,                                        -- Turn index (1, 2, 3...)
    color VARCHAR(5) NOT NULL CHECK (color IN ('white', 'black')),   -- Moving side
    san VARCHAR(15) NOT NULL,                                        -- Standard Algebraic Notation (e.g. 'Nf3', 'O-O', 'Qxh7#')
    uci VARCHAR(10),                                                 -- Universal Chess Interface coordinate (e.g. 'g1f3', 'e1g1')
    fen_after TEXT NOT NULL,                                         -- Complete FEN string representing board state after move
    evaluation NUMERIC(6,2),                                         -- Stockfish engine evaluation in centipawns (+1.25, -0.40)
    is_check BOOLEAN DEFAULT FALSE,                                  -- Flag: indicates move delivered a check (+)
    is_capture BOOLEAN DEFAULT FALSE,                                -- Flag: indicates move captured opposing piece (x)
    CONSTRAINT unq_game_move_step UNIQUE (game_id, move_number, color) -- Guarantees strict linear sequence per game
);

-- ------------------------------------------------------------------------------
-- 8. Game Annotations Table
-- Stores human or engine commentary attached to specific game moves or game headers.
-- ------------------------------------------------------------------------------
CREATE TABLE game_annotations (
    annotation_id SERIAL PRIMARY KEY,                                -- Unique annotation ID
    game_id INT NOT NULL 
        REFERENCES games(game_id) ON DELETE CASCADE,                 -- Cascades on game deletion
    move_id INT 
        REFERENCES moves(move_id) ON DELETE CASCADE,                 -- Optional move target (NULL for game-level comment)
    comment TEXT NOT NULL,                                           -- Analytical commentary or strategic note
    nag VARCHAR(10),                                                 -- Numeric Annotation Glyph ($1 = '!', $2 = '?', $4 = '??')
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------------------------
-- 9. Tactical Motifs Master Table (Novelty Component)
-- Catalog of tactical concepts detected by the Tactical Fingerprint Engine.
-- ------------------------------------------------------------------------------
CREATE TABLE tactical_motifs (
    motif_id SERIAL PRIMARY KEY,                                     -- Unique motif identifier
    motif_name VARCHAR(80) UNIQUE NOT NULL,                          -- Name (e.g. 'Queen Sacrifice', 'Fork', 'Pin')
    category VARCHAR(50) NOT NULL,                                   -- Classification ('Sacrifice', 'Geometric', 'Mating Net')
    description TEXT,                                                -- Formal tactical definition and detection rules
    severity_weight NUMERIC(3,2) DEFAULT 1.00                        -- Importance multiplier used in hybrid similarity ranking
);

-- ------------------------------------------------------------------------------
-- 10. Game Motifs Table (Fingerprint Engine Output)
-- Many-to-Many associative entity linking games and detected tactical motifs.
-- Records exact ply, FEN state, material delta, and rule rationale.
-- ------------------------------------------------------------------------------
CREATE TABLE game_motifs (
    id SERIAL PRIMARY KEY,                                           -- Unique motif occurrence ID
    game_id INT NOT NULL 
        REFERENCES games(game_id) ON DELETE CASCADE,                 -- Parent game link
    motif_id INT NOT NULL 
        REFERENCES tactical_motifs(motif_id) ON DELETE CASCADE,      -- Master motif definition link
    move_number INT NOT NULL,                                        -- Turn index where motif materialized
    color VARCHAR(5) NOT NULL CHECK (color IN ('white', 'black')),   -- Executing side
    fen_position TEXT NOT NULL,                                      -- Board position at the tactical moment
    move_san VARCHAR(15) NOT NULL,                                   -- Tactical move SAN (e.g. 'Qxf7+')
    material_change INT DEFAULT 0,                                   -- Net piece value sacrificed (-9 for Q, -3 for minor)
    rationale TEXT NOT NULL,                                         -- Deterministic engine justification text
    confidence VARCHAR(20) DEFAULT 'RULE_BASED' 
        CHECK (confidence IN ('EXACT', 'RULE_BASED', 'HEURISTIC', 'GEOMETRIC', 'CANDIDATE', 'VERIFIED')),
    evidence_level VARCHAR(20) DEFAULT 'CANDIDATE',                  -- Verification tier
    engine_eval VARCHAR(50) DEFAULT NULL,                            -- Engine score or mate depth at this juncture
    CONSTRAINT unq_game_motif_instance UNIQUE (game_id, motif_id, move_number, color) -- Prevents duplicate motif tagging on same ply
);

-- ------------------------------------------------------------------------------
-- 11. Vector Embeddings Table (pgvector 384 dimensions)
-- High-dimensional semantic representation of games for similarity search.
-- Uses 384-dimensional dense vectors with cosine distance indexing.
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vector') THEN
        CREATE TABLE IF NOT EXISTS game_embeddings (
            embedding_id SERIAL PRIMARY KEY,                         -- Unique embedding surrogate ID
            game_id INT NOT NULL UNIQUE 
                REFERENCES games(game_id) ON DELETE CASCADE,         -- 1-to-1 relationship with games table
            model_name VARCHAR(100) NOT NULL,                        -- Embedding model name (e.g. 'all-MiniLM-L6-v2')
            dimensions INT NOT NULL,                                 -- Vector dimension length (384)
            source_text TEXT NOT NULL,                               -- Textual summary fed into model (tactics + opening + result)
            embedding vector(384) NOT NULL,                          -- 384-dimensional pgvector column for HNSW cosine search
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    ELSE
        -- Fallback table if pgvector is not installed on the PostgreSQL instance
        CREATE TABLE IF NOT EXISTS game_embeddings (
            embedding_id SERIAL PRIMARY KEY,
            game_id INT NOT NULL UNIQUE 
                REFERENCES games(game_id) ON DELETE CASCADE,
            model_name VARCHAR(100) NOT NULL,
            dimensions INT NOT NULL,
            source_text TEXT NOT NULL,
            embedding TEXT NOT NULL,                                 -- Stored as JSON or comma-separated string fallback
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 12. User Favourites Table
-- Allows registered users to bookmark specific games or favorite players.
-- Enforces XOR check: A bookmark targets EITHER a game OR a player, never both or neither.
-- ------------------------------------------------------------------------------
CREATE TABLE user_favourites (
    id SERIAL PRIMARY KEY,                                           -- Unique bookmark ID
    user_id INT NOT NULL 
        REFERENCES users(user_id) ON DELETE CASCADE,                 -- Bookmarking user
    game_id INT 
        REFERENCES games(game_id) ON DELETE CASCADE,                 -- Targeted game (nullable)
    player_id INT 
        REFERENCES players(player_id) ON DELETE CASCADE,             -- Targeted player (nullable)
    note TEXT,                                                       -- User's personal study notes
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_favorite_target CHECK (
        (game_id IS NOT NULL AND player_id IS NULL) OR 
        (game_id IS NULL AND player_id IS NOT NULL)
    ),                                                               -- XOR constraint ensuring exactly one target
    CONSTRAINT unq_user_game UNIQUE (user_id, game_id),              -- Prevents duplicate bookmark of the same game
    CONSTRAINT unq_user_player UNIQUE (user_id, player_id)           -- Prevents duplicate bookmark of the same player
);

-- ------------------------------------------------------------------------------
-- 13. Rating History Table
-- Historical time-series tracking player Elo changes over chronological games.
-- ------------------------------------------------------------------------------
CREATE TABLE rating_history (
    id SERIAL PRIMARY KEY,                                           -- Unique snapshot record ID
    player_id INT NOT NULL 
        REFERENCES players(player_id) ON DELETE CASCADE,             -- Tracked player
    rating INT NOT NULL CHECK (rating >= 0),                         -- Rating on that specific date
    recorded_date DATE NOT NULL,                                     -- Date of snapshot
    game_id INT 
        REFERENCES games(game_id) ON DELETE SET NULL,                -- Reference game that caused the rating update
    CONSTRAINT unq_player_recorded_date UNIQUE (player_id, recorded_date) -- One rating record per player per date
);

-- ------------------------------------------------------------------------------
-- 14. PGN Import Jobs (Audit & Background Tracking)
-- Tracks batch PGN upload processing, error logs, and throughput statistics.
-- ------------------------------------------------------------------------------
CREATE TABLE pgn_import_jobs (
    job_id SERIAL PRIMARY KEY,                                       -- Unique job tracking identifier
    filename VARCHAR(255) NOT NULL,                                  -- Uploaded file name
    status VARCHAR(20) DEFAULT 'PENDING' 
        CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')), -- Lifecycle state machine
    total_games INT DEFAULT 0,                                       -- Total PGN game headers detected in file
    imported_games INT DEFAULT 0,                                    -- Count of successfully parsed and committed games
    skipped_games INT DEFAULT 0,                                     -- Count of duplicates or malformed games bypassed
    failed_games INT DEFAULT 0,                                      -- Count of transactions aborted due to errors
    error_log TEXT,                                                  -- Detailed parsing or SQL exception message
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);
