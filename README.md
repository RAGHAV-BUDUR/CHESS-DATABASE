# ChessBase — A Chess Game Database & Move-Based Search Platform

**DBMS Experiential Learning — Level 3 Project**  
**Department of Computer Science & Engineering**  

### Team Members
- **Raghav Budur** — SRN: `PES1UG23AM225`
- **Prithviraj K** — SRN: `PES1UG24AM204`

---

## 1. Project Abstract & Motivation

Millions of historical chess games are freely available in PGN (Portable Game Notation) format, yet traditional chess software indexes games exclusively on surface metadata (player names, tournament dates, and ECO opening codes). Conventional systems are fundamentally incapable of querying games based on the tactical and strategic content of the moves played—such as *"games with a queen sacrifice leading to a mating attack"* or *"opposite-side castling with a kingside pawn storm"*.

**ChessBase** solves this by implementing an original **Dual-Paradigm Database Architecture**:
1. **Relational Database Management System (PostgreSQL):** Enforces strict ACID relational models across players, tournaments, openings, games, move sequences, and user bookmarks with versioned migrations, triggers, views, and stored functions.
2. **Vector Database Paradigm (`pgvector`):** Generates 384-dimensional unit-normalized semantic embeddings of move sequences and opening narratives, enabling high-performance cosine similarity retrieval (`<=>`) with an HNSW index.
3. **ChessBase Tactical Fingerprint Engine (Original Algorithmic Novelty):** A 100% deterministic, rules-based engine that evaluates board states to extract and verify genuine tactical motifs (Queen Sacrifices, Knight Forks, Absolute Pins, and Checkmates) without relying on Large Language Models.

---

## 2. Key Implemented Features

- **Home Page & System Overview:** Live statistics directly from PostgreSQL (`games`, `players`, `openings`, `game_motifs`, `game_embeddings`).
- **Interactive Game Explorer:** Move-by-move visual board replay using `react-chessboard` and `chess.js`, previous/next step controls, keyboard navigation (Arrow keys / Home / End), board orientation flipping (White/Black), algebraic move list, and PGN copy/download.
- **Tactical Pattern & Semantic Hybrid Search:** Natural language search powered by `pgvector` combined with exact relational SQL filters (ECO code, result, player, rating band) and deterministic motif boosts.
- **Opening Explorer (ECO Tree):** Statistical analysis of opening repertoires showing White win %, Black win %, draw %, and continuation frequencies.
- **Player Career Dashboard:** Career statistics (W/L/D and win rates) computed via PostgreSQL stored function `get_player_stats()`, historical rating trajectory chart (Recharts), and most frequently played openings.
- **12 SQL Analytics Reports:** Dedicated reports demonstrating window functions (`DENSE_RANK()`, `PARTITION BY`), conditional aggregations (`FILTER`), Common Table Expressions (`WITH`), Views, and `EXPLAIN ANALYZE` query planner execution.
- **Role-Based Authentication (RBAC):** Server-enforced roles (`ADMIN` vs `PLAYER`) using signed JSON Web Tokens (`jose`) and bcrypt password hashing.
- **Admin Ingestion & Background Job Tracking:** ACID multi-game PGN bulk ingestion with automatic deduplication, player normalization, tactical motif indexing, and pgvector embeddings recorded in `pgn_import_jobs`.

---

## 3. Technology Stack

- **Frontend:** Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS
- **Backend / API:** Next.js Server Route Handlers
- **Primary Database:** PostgreSQL 16
- **Vector Database:** PostgreSQL with `pgvector` extension (HNSW index)
- **Database Driver:** `pg` (Node-Postgres with parameterized queries & ACID connection pool)
- **Chess Validation & Replay:** `chess.js`, `react-chessboard`
- **Data Visualization:** `recharts`
- **Security & Auth:** `bcryptjs` (password hashing), `jose` (JWT cookies)
- **Automated Testing:** Vitest (17 passing unit & integration tests)

---

## 4. Documentation Catalog

Comprehensive academic project deliverables are located in the `docs/` folder:

1. [Architecture & System Design](docs/ARCHITECTURE.md)
2. [Entity-Relationship Diagram & Schema Data Dictionary](docs/ER_DIAGRAM.md)
3. [Mandatory Advanced PostgreSQL Features](docs/ADVANCED_DATABASE_FEATURES.md)
4. [Tactical Fingerprint Engine & Algorithmic Novelty](docs/TACTICAL_FINGERPRINT_ENGINE.md)
5. [12 SQL Reports & Query Explanations](docs/SQL_REPORTS.md)
6. [Windows Local Setup Guide](docs/SETUP_GUIDE.md)
7. [Public Hosting & Deployment Guide](docs/DEPLOYMENT_GUIDE.md)
8. [Software Dependencies & Inventory](docs/DEPENDENCIES.md)
9. [Benchmark Results JSON](docs/BENCHMARK_RESULTS.json)

---

## 5. Local Setup on Windows (PowerShell)

### Quick Run with Docker Compose
```powershell
# 1. Start PostgreSQL with pgvector container
docker compose up -d

# 2. Run DDL migrations (Tables, Stored Functions, Triggers, Views, Indexes)
npm run db:init

# 3. Seed Master Motifs, Admin Account, and Historical Games
npm run db:seed

# 4. Start Next.js Development Server
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

### Default Login Accounts for Evaluation
- **Admin:** `admin@chessbase.local` / `AdminPassword123!`
- **Player:** `player@chessbase.local` / `PlayerPassword123!`

---

## 6. Running Automated Tests & Benchmarks

```powershell
# Run the 17 Vitest unit & integration tests
npm run test

# Run the Tactical Fingerprint Benchmark suite
npm run db:benchmark
```

---

## 7. Team Contributions

| Team Member | SRN | Core Contributions |
| :--- | :--- | :--- |
| **Raghav Budur** | `PES1UG23AM225` | PostgreSQL schema design, stored functions (`get_player_stats`), analytical views, pgvector HNSW integration, and hybrid search pipeline. |
| **Prithviraj K** | `PES1UG24AM204` | Tactical Fingerprint Engine (deterministic sacrifice/fork/pin detectors), PGN ingestion pipeline, interactive chessboard replay UI, and automated test suite. |
