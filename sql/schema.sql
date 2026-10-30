-- ==============================================================================
-- ChessBase PostgreSQL Relational Schema with pgvector
-- DBMS Experiential Learning - Level 3 Project
-- Authors: Raghav Budur (PES1UG23AM225) & Prithviraj K (PES1UG24AM204)
-- ==============================================================================

-- 1. Enable Required PostgreSQL Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
DO $$
BEGIN
    BEGIN
        CREATE EXTENSION IF NOT EXISTS "vector";
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'pgvector extension not installed in PostgreSQL instance, continuing with fallback...';
    END;
END $$;

-- Drop existing tables in reverse dependency order if recreating
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

-- 2. User & Authentication Table
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'PLAYER' CHECK (role IN ('ADMIN', 'PLAYER')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Players Table
CREATE TABLE players (
    player_id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    fide_rating INT CHECK (fide_rating >= 0),
    title VARCHAR(10),
    country VARCHAR(60),
    total_games INT DEFAULT 0 CHECK (total_games >= 0),
    total_wins INT DEFAULT 0 CHECK (total_wins >= 0),
    total_losses INT DEFAULT 0 CHECK (total_losses >= 0),
    total_draws INT DEFAULT 0 CHECK (total_draws >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Tournaments Table
CREATE TABLE tournaments (
    tournament_id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    location VARCHAR(100),
    start_date DATE,
    end_date DATE,
    time_control VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Openings Table (ECO classification)
CREATE TABLE openings (
    opening_id SERIAL PRIMARY KEY,
    eco_code VARCHAR(3) NOT NULL,
    opening_name VARCHAR(150) NOT NULL,
    pgn_moves TEXT,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unq_eco_opening_name UNIQUE (eco_code, opening_name)
);

-- 6. Games Table
CREATE TABLE games (
    game_id SERIAL PRIMARY KEY,
    white_player_id INT NOT NULL REFERENCES players(player_id) ON DELETE RESTRICT,
    black_player_id INT NOT NULL REFERENCES players(player_id) ON DELETE RESTRICT,
    tournament_id INT REFERENCES tournaments(tournament_id) ON DELETE SET NULL,
    opening_id INT REFERENCES openings(opening_id) ON DELETE SET NULL,
    result VARCHAR(7) NOT NULL CHECK (result IN ('1-0', '0-1', '1/2-1/2', '*')),
    game_date DATE,
    round VARCHAR(20),
    pgn TEXT NOT NULL,
    move_count INT DEFAULT 0 CHECK (move_count >= 0),
    white_rating INT CHECK (white_rating >= 0),
    black_rating INT CHECK (black_rating >= 0),
    termination VARCHAR(100),
    imported_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_different_players CHECK (white_player_id <> black_player_id)
);

-- 7. Moves Table (Move-by-move replay data)
CREATE TABLE moves (
    move_id SERIAL PRIMARY KEY,
    game_id INT NOT NULL REFERENCES games(game_id) ON DELETE CASCADE,
    move_number INT NOT NULL,
    color VARCHAR(5) NOT NULL CHECK (color IN ('white', 'black')),
    san VARCHAR(15) NOT NULL,
    uci VARCHAR(10),
    fen_after TEXT NOT NULL,
    evaluation NUMERIC(6,2),
    is_check BOOLEAN DEFAULT FALSE,
    is_capture BOOLEAN DEFAULT FALSE,
    CONSTRAINT unq_game_move_step UNIQUE (game_id, move_number, color)
);

-- 8. Game Annotations Table
CREATE TABLE game_annotations (
    annotation_id SERIAL PRIMARY KEY,
    game_id INT NOT NULL REFERENCES games(game_id) ON DELETE CASCADE,
    move_id INT REFERENCES moves(move_id) ON DELETE CASCADE,
    comment TEXT NOT NULL,
    nag VARCHAR(10),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. Tactical Motifs Master Table (Novelty Component)
CREATE TABLE tactical_motifs (
    motif_id SERIAL PRIMARY KEY,
    motif_name VARCHAR(80) UNIQUE NOT NULL,
    category VARCHAR(50) NOT NULL,
    description TEXT,
    severity_weight NUMERIC(3,2) DEFAULT 1.00
);

-- 10. Game Motifs Table (Fingerprint Engine Output)
CREATE TABLE game_motifs (
    id SERIAL PRIMARY KEY,
    game_id INT NOT NULL REFERENCES games(game_id) ON DELETE CASCADE,
    motif_id INT NOT NULL REFERENCES tactical_motifs(motif_id) ON DELETE CASCADE,
    move_number INT NOT NULL,
    color VARCHAR(5) NOT NULL CHECK (color IN ('white', 'black')),
    fen_position TEXT NOT NULL,
    move_san VARCHAR(15) NOT NULL,
    material_change INT DEFAULT 0,
    rationale TEXT NOT NULL,
    confidence VARCHAR(20) DEFAULT 'RULE_BASED' CHECK (confidence IN ('EXACT', 'RULE_BASED', 'HEURISTIC', 'GEOMETRIC', 'CANDIDATE', 'VERIFIED')),
    evidence_level VARCHAR(20) DEFAULT 'CANDIDATE',
    engine_eval VARCHAR(50) DEFAULT NULL,
    CONSTRAINT unq_game_motif_instance UNIQUE (game_id, motif_id, move_number, color)
);

-- 11. Vector Embeddings Table (pgvector 384 dimensions if vector extension is active, else TEXT)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vector') THEN
        CREATE TABLE IF NOT EXISTS game_embeddings (
            embedding_id SERIAL PRIMARY KEY,
            game_id INT NOT NULL UNIQUE REFERENCES games(game_id) ON DELETE CASCADE,
            model_name VARCHAR(100) NOT NULL,
            dimensions INT NOT NULL,
            source_text TEXT NOT NULL,
            embedding vector(384) NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    ELSE
        CREATE TABLE IF NOT EXISTS game_embeddings (
            embedding_id SERIAL PRIMARY KEY,
            game_id INT NOT NULL UNIQUE REFERENCES games(game_id) ON DELETE CASCADE,
            model_name VARCHAR(100) NOT NULL,
            dimensions INT NOT NULL,
            source_text TEXT NOT NULL,
            embedding TEXT NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    END IF;
END $$;

-- 12. User Favourites Table
CREATE TABLE user_favourites (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    game_id INT REFERENCES games(game_id) ON DELETE CASCADE,
    player_id INT REFERENCES players(player_id) ON DELETE CASCADE,
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_favorite_target CHECK (
        (game_id IS NOT NULL AND player_id IS NULL) OR 
        (game_id IS NULL AND player_id IS NOT NULL)
    ),
    CONSTRAINT unq_user_game UNIQUE (user_id, game_id),
    CONSTRAINT unq_user_player UNIQUE (user_id, player_id)
);

-- 13. Rating History Table
CREATE TABLE rating_history (
    id SERIAL PRIMARY KEY,
    player_id INT NOT NULL REFERENCES players(player_id) ON DELETE CASCADE,
    rating INT NOT NULL CHECK (rating >= 0),
    recorded_date DATE NOT NULL,
    game_id INT REFERENCES games(game_id) ON DELETE SET NULL,
    CONSTRAINT unq_player_recorded_date UNIQUE (player_id, recorded_date)
);

-- 14. PGN Import Jobs (Audit & Background Tracking)
CREATE TABLE pgn_import_jobs (
    job_id SERIAL PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')),
    total_games INT DEFAULT 0,
    imported_games INT DEFAULT 0,
    skipped_games INT DEFAULT 0,
    failed_games INT DEFAULT 0,
    error_log TEXT,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

