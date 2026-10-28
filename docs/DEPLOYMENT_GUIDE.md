# ChessBase — Public Web Hosting & Production Deployment Guide

**Project Title:** ChessBase — A Chess Game Database & Move-Based Search Platform  
**Course:** DBMS Experiential Learning — Level 3 Project  
**Authors:** Raghav Budur (`PES1UG23AM225`) & Prithviraj K (`PES1UG24AM204`)  

---

## 1. Production Hosting Architecture

To deploy ChessBase publicly with zero hosting cost on free-tier services:
1. **Frontend & Backend API:** [Vercel](https://vercel.com) (Native Next.js 14 App Router hosting)
2. **Managed Database with `pgvector`:** [Neon](https://neon.tech) or [Supabase](https://supabase.com) (Both provide managed PostgreSQL 16 with native `pgvector` pre-enabled)

---

## 2. Step-by-Step Deployment Instructions

### Step 1: Provision Managed PostgreSQL with pgvector (Neon / Supabase)
1. Sign up at [Neon.tech](https://neon.tech) (Free Serverless PostgreSQL).
2. Create a new project named `chessbase-db`.
3. In the SQL Editor on Neon, confirm `pgvector` is enabled:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
   CREATE EXTENSION IF NOT EXISTS "pg_trgm";
   ```
4. Copy the connection string (pooled connection mode):
   ```
   postgresql://user:password@ep-xyz.us-east-2.aws.neon.tech/chessbase?sslmode=require
   ```

### Step 2: Initialize Production Schema & Seed
Run the database initialization script against your cloud database from your local PowerShell:

```powershell
# Set temporary DATABASE_URL pointing to cloud database
$env:DATABASE_URL = "postgresql://user:password@ep-xyz.us-east-2.aws.neon.tech/chessbase?sslmode=require"

# Execute DDL
node scripts/db-init.js

# Seed master admin and sample historical games
node scripts/db-seed.js
```

### Step 3: Deploy to Vercel
1. Push your repository to GitHub:
   ```powershell
   git add .
   git commit -m "feat: complete ChessBase dual-paradigm platform"
   git push origin main
   ```
2. Import the repository in your [Vercel Dashboard](https://vercel.com/new).
3. In **Environment Variables**, add:
   - `DATABASE_URL`: Your cloud PostgreSQL connection string.
   - `JWT_SECRET`: A secure 64-character random string.
   - `ADMIN_EMAIL`: `admin@chessbase.local` (or your personal admin email).
   - `ADMIN_PASSWORD`: Your chosen secure production admin password.
   - `EMBEDDING_PROVIDER`: `local`
4. Click **Deploy**. Vercel will run `next build` and publish your application.

---

## 3. Production Smoke-Test Checklist

Once deployed to your public Vercel URL (e.g. `https://chessbase-dbms.vercel.app`):

- [ ] **Home Page:** Loads database statistics and featured grandmaster games.
- [ ] **Game Explorer:** Navigate through moves on the visual chessboard using arrow keys.
- [ ] **Tactical Pattern Search:** Run a hybrid search query like *"Queen sacrifice followed by a mating attack"*.
- [ ] **Opening Explorer:** Search by ECO code (`B90`) and inspect White/Black success rates.
- [ ] **Player Dashboard:** Check player rating trajectory chart and career statistics.
- [ ] **12 SQL Analytics Reports:** Verify query execution time and inspect the evaluator SQL proof panel.
- [ ] **Authentication & Roles:** Log in as Admin (`admin@chessbase.local`) and verify non-admins cannot access `/api/admin/import`.
