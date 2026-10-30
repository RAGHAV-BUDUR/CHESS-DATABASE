# ChessBase — A Chess Game Database & Move-Based Search Platform

> **DBMS Experiential Learning — Level 3 Project**  
> **Department of Computer Science & Engineering**

### Team Members
- **Raghav Budur** — SRN: `PES1UG23AM225`
- **Prithviraj K** — SRN: `PES1UG24AM204`

---

## 1. Problem Statement & Motivation

Millions of historical chess games are freely available in PGN (Portable Game Notation) format across platforms like Lichess, Chess.com, and FIDE archives. However, traditional database software and chess portals index games almost exclusively on surface-level metadata:
- Player names
- Tournament event and date
- Static ECO opening codes (e.g. `B90`)
- Game outcome (`1-0`, `0-1`, `1/2-1/2`)

### The Core Problem:
Conventional relational databases cannot query or index chess games based on the **tactical, strategic, and move-sequence content** of what actually transpired on the 64 squares. Queries such as:
- *"Find master games featuring a Queen Sacrifice that led to a forced checkmate attack"*
- *"Show games where Black transposed into an Accelerated Dragon with an opposite-side pawn storm"*
- *"Display games that reached this exact piece placement regardless of move order (transpositions)"*

are fundamentally impossible in standard CRUD databases without full board state reconstruction, combinatorial motif detection, and high-dimensional semantic search.

---

## 2. System Architecture & Dual-Paradigm Database Design

ChessBase implements an original **Dual-Paradigm Database Architecture** pairing PostgreSQL (Relational + Full-Text Search) with `pgvector` (Vector Database):

```
+-----------------------------------------------------------------------------------+
|                                 Next.js 14 Frontend                               |
|  - Database Cockpit (/database)       - Interactive Board Replay (/games/[id])    |
|  - Master Games Explorer (/games)     - Analysis & Input Board (/analysis)        |
|  - Opening ECO Explorer (/openings)   - Hybrid Semantic Search (/search)          |
|  - Player Career Analytics (/players) - 12 SQL Diagnostic Reports (/reports)      |
+-----------------------------------------------------------------------------------+
                                          |
                                          | REST API Routes (JSON / Parameterized)
                                          v
+-----------------------------------------------------------------------------------+
|                             Next.js API & Backend Layer                           |
|  - Tactical Fingerprint Engine (Deterministic Rules-Based Evaluator)              |
|  - ECO Move Sequence Classifier (Regex & Deep Move Hierarchy)                     |
|  - JWT Authentication & RBAC (Admin vs Player)                                    |
|  - Ingestion Engine (Transaction-Wrapped PGN Parser)                              |
+-----------------------------------------------------------------------------------+
                    |                                           |
                    | ACID Relational Pool                      | HNSW Vector Search
                    v                                           v
+---------------------------------------+   +---------------------------------------+
|        PostgreSQL 16 Relational       |   |       pgvector Extension (HNSW)       |
|  - 10 Tables with Strict Constraints  |   |  - 384-dimensional Normalized Vectors |
|  - Cascading Foreign Keys             |   |  - Cosine Distance Metric (<=>)       |
|  - Automatic Triggers (Stats Sync)    |   |  - Sub-millisecond ANN Similarity     |
|  - Stored Functions & Procedures      |   |  - Semantic Tactical Descriptions     |
|  - Views for Analytical Aggregation   |   |                                       |
|  - GIN Indexes (pg_trgm & tsvector)   |   |                                       |
+---------------------------------------+   +---------------------------------------+
```

---

## 3. Entity-Relationship (ER) Diagram

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

## 4. Key Novelties & Advanced Features

### 1. Deterministic Tactical Fingerprint Engine
Instead of black-box ML or generic heuristic labels, the engine uses **rigorous board-state reconstruction**:
- Replays full move history with accurate en-passant, castling rights, promotion, and check status.
- Evaluates true material balance differences between consecutive positions.
- Differentiates standard captures/exchanges from genuine **Queen Sacrifices**, **Exchange Sacrifices**, and **Minor Piece Sacrifices**.
- Verified with comprehensive automated test suites (`tests/tactical-fingerprint.test.ts`, `tests/tactical-motif-rigorous.test.ts`).

### 2. Dual-Paradigm Hybrid Search (SQL + Vector)
- **Vector Search:** Converts game move sequences, openings, and tactical motifs into unit-normalized 384-dimensional embeddings stored in `game_embeddings`.
- **HNSW Index:** Uses Hierarchical Navigable Small World graphs (`vector_cosine_ops`) for sub-millisecond retrieval.
- **Hybrid Scoring:** Combines cosine similarity with exact SQL filtering (player name, rating range, ECO code, game outcome) and tactical motif bonus multipliers.

### 3. Database Cockpit with Live Opening Tree & Position Matching
- Reconstructs FEN on every piece drop or move step.
- Queries `moves.fen_after` across the database to detect **identical positions and transpositions** in real-time.
- Dynamically computes the **Opening Tree & Stats** for all candidate moves (Games played, Win %, Average Elo, Repertoire share %).
- Live Stockfish evaluation and deterministic line simulator.

### 4. Advanced PostgreSQL Features Implemented
- **Automated Triggers:** `trg_update_player_stats_fn()` maintains `players` win/loss/draw counts and `total_games` automatically on game `INSERT`, `UPDATE`, or `DELETE`.
- **Rating History Tracking:** `trg_track_rating_history_fn()` automatically records player historical ratings on every game entry.
- **Stored Functions & Procedures:** `get_player_stats()`, `refresh_player_aggregates()`, `search_similar_games()`.
- **Analytical Views:** `game_summary` and `player_statistics` join complex multi-table relationships for optimized UI presentation.
- **GIN & Trigram Indexes:** `pg_trgm` fuzzy trigram indexes on player and opening names, and full-text tsvector indexes on game descriptions.

### 5. Full CRUD & Move Explorer Controls
- **Create:** Interactive board and PGN paste modal to save new games.
- **Read:** Master Games Explorer with pagination and filters; deep Replay view with algebraic notation.
- **Update:** Inline editing of game metadata (players, ratings, tournament, result, ECO code).
- **Delete:** Cascade deletion removing games, moves, motifs, embeddings, and rating history with a single click.

---

## 5. Prerequisites & Dependencies

### Prerequisites
- **Docker Desktop** (for PostgreSQL 16 + pgvector)
- **Node.js 18+ / 20+** and **npm**

---

## 6. How to Run Locally

Follow these 4 simple steps to set up and run the project locally:

```powershell
# 1. Start the PostgreSQL 16 with pgvector database container
docker compose up -d

# 2. Initialize the database schema, functions, triggers, views, and indexes
npm run db:init

# 3. Seed master tactical motifs, default admin user, and sample master games
npm run db:seed

# 4. Start the Next.js development server
npm run dev
```

Open **[http://localhost:3000](http://localhost:3000)** in your web browser.

---

## 7. Default Credentials for Evaluation

| Role | Email | Password |
|---|---|---|
| **Admin** | `admin@chessbase.local` | `AdminPassword123!` |
| **Player / User** | `player@chessbase.local` | `PlayerPassword123!` |

---

## 8. Automated Testing & Verification

Run the test suite to verify data validation, PGN parsing, vector search, and tactical motif detection:

```powershell
# Run all Vitest unit and integration tests
npm run test
```

---

## 9. Project Directory Structure

```
├── docker-compose.yml          # Container configuration (PostgreSQL 16 + pgvector)
├── package.json                # Project dependencies and operational scripts
├── .env.example                # Sample environment configuration template
├── README.md                   # Complete project documentation & guide
│
├── sql/                        # Declarative PostgreSQL DDL & Logic
│   ├── schema.sql              # Relational schema (tables, constraints, foreign keys)
│   ├── functions.sql           # Stored functions and procedures
│   ├── triggers.sql            # Event triggers for player stats and rating history
│   ├── views.sql               # Analytical views (game_summary, player_statistics)
│   └── indexes.sql             # B-tree, GIN trigram, tsvector, and HNSW vector indexes
│
├── src/
│   ├── app/                    # Next.js App Router (Pages & API Routes)
│   │   ├── page.tsx            # Home / Dashboard summary
│   │   ├── database/           # Database Cockpit (Live Board + Opening Tree + Position Matching)
│   │   ├── games/              # Master Games Explorer (with Edit/Delete operations)
│   │   │   └── [id]/           # Move-by-move visual game replay & motif inspector
│   │   ├── analysis/           # Interactive Analysis & PGN Input Board
│   │   ├── openings/           # Opening Repertoire Tree (ECO codes & win rates)
│   │   ├── players/            # Player Career Analytics & Rating History
│   │   ├── search/             # Hybrid Semantic & Relational Search
│   │   ├── reports/            # 12 Complex SQL Analytical Reports
│   │   ├── admin/              # Admin Ingestion & Job Audit Panel
│   │   └── api/                # REST API backend route handlers
│   │
│   ├── lib/
│   │   ├── db.ts               # PostgreSQL connection pool & transaction helper
│   │   └── chess/
│   │       ├── pgn-parser.ts   # PGN parser with move validation
│   │       ├── eco-classifier.ts # Deterministic ECO opening classification
│   │       ├── tactical-fingerprint.ts # Rules-based Tactical Fingerprint Engine
│   │       └── vector-search.ts # Embedding generator & pgvector query client
│   │
│   └── components/             # Reusable UI widgets and navigation
│
├── scripts/                    # Database CLI management utilities
│   ├── db-init.js              # Initializes schema, triggers, views, and indexes
│   ├── db-seed.js              # Seeds admin, tactical motifs, and master games
│   ├── clear-games.js          # Resets all game data cleanly
│   ├── repair-pgn.js           # PGN normalization and ECO classifier utility
│   └── reanalyze-games.js      # Batch re-evaluator for tactical motifs
│
├── data/                       # Datasets
│   ├── sample-games.pgn        # Initial sample historical games
│   └── repaired_games.pgn      # Verified benchmark games
│
└── tests/                      # Automated Vitest test specifications
    ├── pgn-parser.test.ts
    ├── tactical-fingerprint.test.ts
    ├── tactical-motif-rigorous.test.ts
    └── vector-search.test.ts
```
