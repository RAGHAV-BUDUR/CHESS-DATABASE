# ChessBase — Entity-Relationship (ER) Diagram & Schema Specification

**Project Title:** ChessBase — A Chess Game Database & Move-Based Search Platform  
**Course:** DBMS Experiential Learning — Level 3 Project  
**Authors:** Raghav Budur (`PES1UG23AM225`) & Prithviraj K (`PES1UG24AM204`)  

---

## 1. Visual Entity-Relationship Diagram (Crow's Foot Notation)

```mermaid
erDiagram
    USERS ||--o{ USER_FAVOURITES : "saves"
    PLAYERS ||--o{ GAMES : "plays as White"
    PLAYERS ||--o{ GAMES : "plays as Black"
    PLAYERS ||--o{ RATING_HISTORY : "tracks rating"
    PLAYERS ||--o{ USER_FAVOURITES : "bookmarked by"
    TOURNAMENTS ||--o{ GAMES : "hosts"
    OPENINGS ||--o{ GAMES : "categorizes"
    GAMES ||--|{ MOVES : "contains move sequence"
    GAMES ||--o{ GAME_ANNOTATIONS : "annotates"
    GAMES ||--o{ GAME_MOTIFS : "features tactical motif"
    TACTICAL_MOTIFS ||--o{ GAME_MOTIFS : "classifies"
    GAMES ||--|| GAME_EMBEDDINGS : "vector embedding (1-to-1)"
    GAMES ||--o{ USER_FAVOURITES : "bookmarked by"
    PGN_IMPORT_JOBS ||--o{ GAMES : "imports audit"

    USERS {
        int user_id PK
        varchar username UK
        varchar email UK
        varchar password_hash
        varchar role
        timestamp created_at
    }

    PLAYERS {
        int player_id PK
        varchar name UK
        int fide_rating
        varchar title
        varchar country
        int total_games
        int total_wins
        int total_losses
        int total_draws
        timestamp created_at
    }

    TOURNAMENTS {
        int tournament_id PK
        varchar name
        varchar location
        date start_date
        date end_date
        varchar time_control
        timestamp created_at
    }

    OPENINGS {
        int opening_id PK
        varchar eco_code
        varchar opening_name
        text pgn_moves
        text description
        timestamp created_at
    }

    GAMES {
        int game_id PK
        int white_player_id FK
        int black_player_id FK
        int tournament_id FK
        int opening_id FK
        varchar result
        date game_date
        varchar round
        text pgn
        int move_count
        int white_rating
        int black_rating
        varchar termination
        timestamp imported_at
    }

    MOVES {
        int move_id PK
        int game_id FK
        int move_number
        varchar color
        varchar san
        varchar uci
        text fen_after
        numeric evaluation
        boolean is_check
        boolean is_capture
    }

    TACTICAL_MOTIFS {
        int motif_id PK
        varchar motif_name UK
        varchar category
        text description
        numeric severity_weight
    }

    GAME_MOTIFS {
        int id PK
        int game_id FK
        int motif_id FK
        int move_number
        varchar color
        text fen_position
        varchar move_san
        int material_change
        text rationale
        varchar confidence
    }

    GAME_EMBEDDINGS {
        int embedding_id PK
        int game_id FK,UK
        varchar model_name
        int dimensions
        text source_text
        vector embedding
        timestamp created_at
    }

    USER_FAVOURITES {
        int id PK
        int user_id FK
        int game_id FK
        int player_id FK
        text note
        timestamp created_at
    }

    RATING_HISTORY {
        int id PK
        int player_id FK
        int rating
        date recorded_date
        int game_id FK
    }

    PGN_IMPORT_JOBS {
        int job_id PK
        varchar filename
        varchar status
        int total_games
        int imported_games
        int skipped_games
        int failed_games
        text error_log
        timestamp started_at
        timestamp completed_at
    }
```

---

## 2. Relational Schema Data Dictionary

### 2.1 Table: `players`
- **Primary Key:** `player_id` (`SERIAL`)
- **Unique Constraint:** `name` (`VARCHAR(100)`)
- **Check Constraints:** `fide_rating >= 0`, `total_games >= 0`, `total_wins >= 0`, `total_losses >= 0`, `total_draws >= 0`
- **Audit Columns:** `created_at`
- **Indexes:** B-tree on `name`, GIN trigram index `idx_players_name_trgm` on `name` using `gin_trgm_ops`.

### 2.2 Table: `games`
- **Primary Key:** `game_id` (`SERIAL`)
- **Foreign Keys:**
  - `white_player_id -> players(player_id) ON DELETE RESTRICT`
  - `black_player_id -> players(player_id) ON DELETE RESTRICT`
  - `tournament_id -> tournaments(tournament_id) ON DELETE SET NULL`
  - `opening_id -> openings(opening_id) ON DELETE SET NULL`
- **Check Constraints:**
  - `white_player_id <> black_player_id` (Ensures player cannot play against themselves)
  - `result IN ('1-0', '0-1', '1/2-1/2', '*')`
  - `move_count >= 0`, `white_rating >= 0`, `black_rating >= 0`
- **Indexes:** B-tree on `white_player_id`, `black_player_id`, `tournament_id`, `opening_id`, `result`, `game_date`.

### 2.3 Table: `moves`
- **Primary Key:** `move_id` (`SERIAL`)
- **Foreign Key:** `game_id -> games(game_id) ON DELETE CASCADE`
- **Unique Constraint:** `(game_id, move_number, color)` (Prevents duplicate half-move entries)
- **Check Constraints:** `color IN ('white', 'black')`
- **Replay Data:** `fen_after` (full Forsyth–Edwards Notation after move execution), `san` (Standard Algebraic Notation), `uci` (Universal Chess Interface coordinate).

### 2.4 Table: `game_motifs`
- **Primary Key:** `id` (`SERIAL`)
- **Foreign Keys:**
  - `game_id -> games(game_id) ON DELETE CASCADE`
  - `motif_id -> tactical_motifs(motif_id) ON DELETE CASCADE`
- **Unique Constraint:** `(game_id, motif_id, move_number, color)`
- **Check Constraints:** `confidence IN ('EXACT', 'RULE_BASED', 'HEURISTIC')`

### 2.5 Table: `game_embeddings` (Vector Database Paradigm)
- **Primary Key:** `embedding_id` (`SERIAL`)
- **Foreign Key / Unique:** `game_id -> games(game_id) ON DELETE CASCADE` (1-to-1 relationship)
- **Vector Column:** `embedding vector(384) NOT NULL`
- **Vector Index:** Hierarchical Navigable Small World (`HNSW`) index:
  ```sql
  CREATE INDEX idx_game_embeddings_vector_hnsw 
  ON game_embeddings 
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
  ```

