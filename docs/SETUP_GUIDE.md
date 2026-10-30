# ChessBase — Windows Setup & Local Execution Guide

**Project Title:** ChessBase — A Chess Game Database & Move-Based Search Platform  
**Course:** DBMS Experiential Learning — Level 3 Project  
**Authors:** Raghav Budur (`PES1UG23AM225`) & Prithviraj K (`PES1UG24AM204`)  

---

## 1. Quick Start for Windows (PowerShell & VS Code)

You can run ChessBase locally on Windows using either **Option A (Docker Desktop — Recommended)** or **Option B (Native PostgreSQL)**.

---

### Option A: Docker-Based Setup (Recommended)

This option automatically provisions PostgreSQL 16 with the `pgvector` extension pre-installed in a lightweight container.

#### Step 1: Clone and Navigate to Directory
Open PowerShell in VS Code:
```powershell
cd C:\Users\Lenovo\Desktop\DBMSLAB\MINI
```

#### Step 2: Configure Environment Variables
Copy `.env.example` to `.env` if not already present:
```powershell
Copy-Item .env.example .env
```
Default `.env` configuration:
```ini
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/chessbase"
JWT_SECRET="chessbase_super_secret_jwt_key_2026_pes_dbms_level3"
ADMIN_EMAIL="admin@chessbase.local"
ADMIN_PASSWORD="AdminPassword123!"
PORT=3000
EMBEDDING_PROVIDER="local"
```

#### Step 3: Start PostgreSQL with pgvector via Docker Compose
```powershell
docker compose up -d
```
Verify the container is healthy:
```powershell
docker ps
```
*(You will see container `chessbase_postgres` running on port 5432).*

#### Step 4: Initialize Schema and Seed Database
```powershell
# 1. Execute DDL (Tables, Stored Functions, Triggers, Views, Indexes)
npm run db:init

# 2. Seed Master Tactical Motifs, Admin Account, and Master Games
npm run db:seed

# 3. Run Benchmark Suite
npm run db:benchmark
```

#### Step 5: Start the Web Application
```powershell
npm run dev
```
Open your browser at: **[http://localhost:3000](http://localhost:3000)**

---

### Option B: Native Windows PostgreSQL Setup

If you prefer using an existing native PostgreSQL installation on Windows:

#### Step 1: Install pgvector Extension
1. Download compatible pgvector binary for your PostgreSQL version from [pgvector Releases](https://github.com/pgvector/pgvector/releases).
2. Copy `vector.dll` into `C:\Program Files\PostgreSQL\16\lib` and `vector.control` / `vector--*.sql` into `C:\Program Files\PostgreSQL\16\share\extension`.

#### Step 2: Create Database
In `psql` or pgAdmin:
```sql
CREATE DATABASE chessbase;
\c chessbase
CREATE EXTENSION vector;
```

#### Step 3: Update `.env` with Your Native Credentials
```ini
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/chessbase"
```

#### Step 4: Run Initialization & Dev Server
```powershell
npm run db:init
npm run db:seed
npm run dev
```

---

## 2. Default Test Accounts

| Role | Email | Password | Access Privileges |
| :--- | :--- | :--- | :--- |
| **ADMIN** | `admin@chessbase.local` | `AdminPassword123!` | PGN Dataset Ingestion, Job Monitor, Re-indexing |
| **PLAYER** | `player@chessbase.local` | `PlayerPassword123!` | Games Replay, Pattern Search, Bookmarks, Analytics |

---

## 3. Running Automated Tests

Run the full Vitest suite in PowerShell:
```powershell
npm run test
```
All 17 tests verify:
- Deterministic Tactical Motif Detection (Queen Sacrifices, Knight Forks, Pins, Checkmates)
- 384-dimensional vector embedding generation and cosine normalization
- PGN parsing and metadata extraction
- Password hashing (bcrypt) and JWT session token validation

---

## 4. Troubleshooting Common Windows Issues

### Issue 1: Port 5432 Already in Use
**Symptom:** `Error: bind: address already in use` when starting Docker.  
**Resolution:** A local PostgreSQL Windows Service is already occupying port 5432. Stop the local service:
```powershell
Stop-Service -Name postgresql* -Force
```
Or edit `docker-compose.yml` to map host port `"5433:5432"` and update `DATABASE_URL` in `.env` to port `5433`.

### Issue 2: EPERM / Access Denied on `.next` Cache
**Symptom:** Webpack fails with `EPERM: operation not permitted`.  
**Resolution:** Close any file explorer windows open to `.next` and run:
```powershell
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm run dev
```

