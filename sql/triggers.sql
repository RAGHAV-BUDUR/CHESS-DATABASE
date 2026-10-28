-- ==============================================================================
-- ChessBase PostgreSQL Triggers
-- DBMS Experiential Learning - Level 3 Project
-- Authors: Raghav Budur (PES1UG23AM225) & Prithviraj K (PES1UG24AM204)
-- ==============================================================================

-- 1. Trigger Function: Automatically Update Player Statistics on Game Insert/Update/Delete
CREATE OR REPLACE FUNCTION trg_update_player_stats_fn()
RETURNS TRIGGER AS $$
BEGIN
    -- Handle INSERT
    IF (TG_OP = 'INSERT') THEN
        -- Update White Player
        UPDATE players
        SET 
            total_games = total_games + 1,
            total_wins = total_wins + CASE WHEN NEW.result = '1-0' THEN 1 ELSE 0 END,
            total_losses = total_losses + CASE WHEN NEW.result = '0-1' THEN 1 ELSE 0 END,
            total_draws = total_draws + CASE WHEN NEW.result = '1/2-1/2' THEN 1 ELSE 0 END
        WHERE player_id = NEW.white_player_id;

        -- Update Black Player
        UPDATE players
        SET 
            total_games = total_games + 1,
            total_wins = total_wins + CASE WHEN NEW.result = '0-1' THEN 1 ELSE 0 END,
            total_losses = total_losses + CASE WHEN NEW.result = '1-0' THEN 1 ELSE 0 END,
            total_draws = total_draws + CASE WHEN NEW.result = '1/2-1/2' THEN 1 ELSE 0 END
        WHERE player_id = NEW.black_player_id;

        RETURN NEW;

    -- Handle DELETE
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE players
        SET 
            total_games = GREATEST(0, total_games - 1),
            total_wins = GREATEST(0, total_wins - CASE WHEN OLD.result = '1-0' THEN 1 ELSE 0 END),
            total_losses = GREATEST(0, total_losses - CASE WHEN OLD.result = '0-1' THEN 1 ELSE 0 END),
            total_draws = GREATEST(0, total_draws - CASE WHEN OLD.result = '1/2-1/2' THEN 1 ELSE 0 END)
        WHERE player_id = OLD.white_player_id;

        UPDATE players
        SET 
            total_games = GREATEST(0, total_games - 1),
            total_wins = GREATEST(0, total_wins - CASE WHEN OLD.result = '0-1' THEN 1 ELSE 0 END),
            total_losses = GREATEST(0, total_losses - CASE WHEN OLD.result = '1-0' THEN 1 ELSE 0 END),
            total_draws = GREATEST(0, total_draws - CASE WHEN OLD.result = '1/2-1/2' THEN 1 ELSE 0 END)
        WHERE player_id = OLD.black_player_id;

        RETURN OLD;

    -- Handle UPDATE of result
    ELSIF (TG_OP = 'UPDATE') THEN
        IF (OLD.result <> NEW.result OR OLD.white_player_id <> NEW.white_player_id OR OLD.black_player_id <> NEW.black_player_id) THEN
            -- Recompute explicitly for the affected players
            CALL refresh_player_aggregates();
        END IF;
        RETURN NEW;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_game_stats_sync ON games;
CREATE TRIGGER trg_game_stats_sync
AFTER INSERT OR UPDATE OR DELETE ON games
FOR EACH ROW
EXECUTE FUNCTION trg_update_player_stats_fn();


-- 2. Trigger Function: Validate and Track Player Rating History on Game Insert
CREATE OR REPLACE FUNCTION trg_track_rating_history_fn()
RETURNS TRIGGER AS $$
BEGIN
    IF (NEW.white_rating IS NOT NULL AND NEW.game_date IS NOT NULL) THEN
        INSERT INTO rating_history (player_id, rating, recorded_date, game_id)
        VALUES (NEW.white_player_id, NEW.white_rating, NEW.game_date, NEW.game_id)
        ON CONFLICT (player_id, recorded_date) 
        DO UPDATE SET rating = EXCLUDED.rating, game_id = EXCLUDED.game_id;
    END IF;

    IF (NEW.black_rating IS NOT NULL AND NEW.game_date IS NOT NULL) THEN
        INSERT INTO rating_history (player_id, rating, recorded_date, game_id)
        VALUES (NEW.black_player_id, NEW.black_rating, NEW.game_date, NEW.game_id)
        ON CONFLICT (player_id, recorded_date) 
        DO UPDATE SET rating = EXCLUDED.rating, game_id = EXCLUDED.game_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_game_rating_history ON games;
CREATE TRIGGER trg_game_rating_history
AFTER INSERT ON games
FOR EACH ROW
EXECUTE FUNCTION trg_track_rating_history_fn();

