-- ==============================================================================
-- ChessBase PostgreSQL Triggers
-- DBMS Experiential Learning - Level 3 Project
-- Authors: Raghav Budur (PES1UG23AM225) & Prithviraj K (PES1UG24AM204)
-- ==============================================================================
-- Purpose of this file:
-- 1. Automates denormalized data maintenance and real-time counter consistency.
-- 2. trg_game_stats_sync: Instantly adjusts player total_games, wins, losses, and draws
--    on INSERT, UPDATE, or DELETE on the games table without requiring expensive full-table scans.
-- 3. trg_game_rating_history: Automatically records player Elo snapshots into the rating_history
--    time-series table whenever a game with rated players is registered.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Trigger Function: Automatically Update Player Statistics on Game Mutation
-- Invoked automatically AFTER any INSERT, UPDATE, or DELETE operation on 'games'.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_update_player_stats_fn()
RETURNS TRIGGER AS $$
BEGIN
    -- --------------------------------------------------------------------------
    -- CASE A: New game is inserted
    -- --------------------------------------------------------------------------
    IF (TG_OP = 'INSERT') THEN
        -- Increment statistics for the White player
        UPDATE players
        SET 
            total_games = total_games + 1,
            total_wins = total_wins + CASE WHEN NEW.result = '1-0' THEN 1 ELSE 0 END,
            total_losses = total_losses + CASE WHEN NEW.result = '0-1' THEN 1 ELSE 0 END,
            total_draws = total_draws + CASE WHEN NEW.result = '1/2-1/2' THEN 1 ELSE 0 END
        WHERE player_id = NEW.white_player_id;

        -- Increment statistics for the Black player (inverts 1-0 and 0-1)
        UPDATE players
        SET 
            total_games = total_games + 1,
            total_wins = total_wins + CASE WHEN NEW.result = '0-1' THEN 1 ELSE 0 END,
            total_losses = total_losses + CASE WHEN NEW.result = '1-0' THEN 1 ELSE 0 END,
            total_draws = total_draws + CASE WHEN NEW.result = '1/2-1/2' THEN 1 ELSE 0 END
        WHERE player_id = NEW.black_player_id;

        RETURN NEW;

    -- --------------------------------------------------------------------------
    -- CASE B: Existing game is deleted
    -- --------------------------------------------------------------------------
    ELSIF (TG_OP = 'DELETE') THEN
        -- Decrement statistics for the White player (using GREATEST to guard against negative counters)
        UPDATE players
        SET 
            total_games = GREATEST(0, total_games - 1),
            total_wins = GREATEST(0, total_wins - CASE WHEN OLD.result = '1-0' THEN 1 ELSE 0 END),
            total_losses = GREATEST(0, total_losses - CASE WHEN OLD.result = '0-1' THEN 1 ELSE 0 END),
            total_draws = GREATEST(0, total_draws - CASE WHEN OLD.result = '1/2-1/2' THEN 1 ELSE 0 END)
        WHERE player_id = OLD.white_player_id;

        -- Decrement statistics for the Black player
        UPDATE players
        SET 
            total_games = GREATEST(0, total_games - 1),
            total_wins = GREATEST(0, total_wins - CASE WHEN OLD.result = '0-1' THEN 1 ELSE 0 END),
            total_losses = GREATEST(0, total_losses - CASE WHEN OLD.result = '1-0' THEN 1 ELSE 0 END),
            total_draws = GREATEST(0, total_draws - CASE WHEN OLD.result = '1/2-1/2' THEN 1 ELSE 0 END)
        WHERE player_id = OLD.black_player_id;

        RETURN OLD;

    -- --------------------------------------------------------------------------
    -- CASE C: Game result or participant players were modified
    -- --------------------------------------------------------------------------
    ELSIF (TG_OP = 'UPDATE') THEN
        -- If critical outcome fields changed, run a clean re-aggregation procedure
        IF (OLD.result <> NEW.result OR 
            OLD.white_player_id <> NEW.white_player_id OR 
            OLD.black_player_id <> NEW.black_player_id) THEN
            CALL refresh_player_aggregates();
        END IF;
        RETURN NEW;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to the 'games' table
DROP TRIGGER IF EXISTS trg_game_stats_sync ON games;
CREATE TRIGGER trg_game_stats_sync
AFTER INSERT OR UPDATE OR DELETE ON games
FOR EACH ROW
EXECUTE FUNCTION trg_update_player_stats_fn();


-- ------------------------------------------------------------------------------
-- 2. Trigger Function: Validate and Track Player Rating History on Game Insert
-- Automatically records a point in time Elo rating snapshot whenever a game is added.
-- Uses UPSERT (ON CONFLICT DO UPDATE) to keep the latest rating for any given date.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_track_rating_history_fn()
RETURNS TRIGGER AS $$
BEGIN
    -- Record White player's rating snapshot if present
    IF (NEW.white_rating IS NOT NULL AND NEW.game_date IS NOT NULL) THEN
        INSERT INTO rating_history (player_id, rating, recorded_date, game_id)
        VALUES (NEW.white_player_id, NEW.white_rating, NEW.game_date, NEW.game_id)
        ON CONFLICT (player_id, recorded_date) 
        DO UPDATE SET rating = EXCLUDED.rating, game_id = EXCLUDED.game_id;
    END IF;

    -- Record Black player's rating snapshot if present
    IF (NEW.black_rating IS NOT NULL AND NEW.game_date IS NOT NULL) THEN
        INSERT INTO rating_history (player_id, rating, recorded_date, game_id)
        VALUES (NEW.black_player_id, NEW.black_rating, NEW.game_date, NEW.game_id)
        ON CONFLICT (player_id, recorded_date) 
        DO UPDATE SET rating = EXCLUDED.rating, game_id = EXCLUDED.game_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to the 'games' table on INSERT
DROP TRIGGER IF EXISTS trg_game_rating_history ON games;
CREATE TRIGGER trg_game_rating_history
AFTER INSERT ON games
FOR EACH ROW
EXECUTE FUNCTION trg_track_rating_history_fn();
