# ChessBase — Software Dependencies and Environment Inventory

**Project Title:** ChessBase — A Chess Game Database & Move-Based Search Platform  
**Course:** DBMS Experiential Learning — Level 3 Project  
**Team Members:**  
- **Raghav Budur** (SRN: `PES1UG23AM225`)
- **Prithviraj K** (SRN: `PES1UG24AM204`)

---

## 1. Runtime & Environment Prerequisites

| Dependency / Tool | Version / Compatibility | Purpose | Mandatory / Optional | Installation Command | Environment |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Node.js LTS** | `>= 20.x` (v20.17.0+ / v22.x) | Next.js server runtime, API endpoints, background scripts | Mandatory | Download from [nodejs.org](https://nodejs.org) | Local & Production |
| **npm** | `>= 10.x` | Package manager for frontend, backend, and build tools | Mandatory | Bundled with Node.js | Local & Production |
| **PostgreSQL** | `>= 15.x` (Recommended: PostgreSQL 16) | Primary Relational Database Management System | Mandatory | Native Windows installer or Docker container | Local & Production |
| **pgvector** | `>= 0.5.0` (Recommended: 0.7.0+) | Vector similarity search extension for PostgreSQL | Mandatory | Bundled in Docker `pgvector/pgvector:pg16` or compiled | Local & Production |
| **Docker Desktop** | `>= 4.x` | One-command containerized PostgreSQL + pgvector environment | Optional (Alternative to native Postgres) | Download from [docker.com](https://www.docker.com) | Local Development |
| **Git** | `>= 2.40+` | Source code control, team commits, version tracking | Mandatory | Download from [git-scm.com](https://git-scm.com) | Local & Production |

---

## 2. Production Application Dependencies (`package.json`)

| Package Name | Exact / Compatible Version | Purpose | Academic Justification |
| :--- | :--- | :--- | :--- |
| **`next`** | `^14.2.15` | Full-stack framework with React App Router, dynamic server rendering, API Route Handlers | Web application presentation and application tier (Academic syllabus requirement). |
| **`react`** | `^18.3.1` | Declarative UI component library | Frontend interactive state rendering. |
| **`react-dom`** | `^18.3.1` | DOM renderer for React | Browser DOM reconciliation. |
| **`pg`** | `^8.13.1` | Native PostgreSQL connection pool and query client for Node.js | Direct parameterized SQL execution, transaction support (`BEGIN`/`COMMIT`/`ROLLBACK`), stored functions. |
| **`pgvector`** | `^0.2.0` | Helper library for formatting vectors into PostgreSQL pgvector format | Interoperability with PostgreSQL vector columns. |
| **`chess.js`** | `^1.0.0-beta.9` / `1.4.0` | Chess rules, board-state validation, move generation, FEN/PGN replay | Move validation and board reconstruction for the deterministic Tactical Fingerprint Engine. |
| **`react-chessboard`** | `^4.7.2` | Interactive SVG chessboard component | Move-by-move visual board replay and orientation toggles in Game Explorer. |
| **`bcryptjs`** | `^2.4.3` | One-way cryptographic password hashing (bcrypt) | Secure credential storage preventing plain-text password leakage in `users` table. |
| **`jose`** | `^5.9.6` | JSON Web Token (JWT) cryptographic signing and verification | Stateless session management and role-based authentication (ADMIN vs PLAYER). |
| **`recharts`** | `^2.13.0` | Composable charting library built on React components | Statistical data visualization for player rating history and opening success rates. |
| **`lucide-react`** | `^0.453.0` | Iconography library | Accessible visual UI navigation indicators. |
| **`clsx`** / **`tailwind-merge`** | `^2.1.1` / `^2.5.4` | Utility classes conditional merging | Dynamic styling for tactical badges and move list rows. |

---

## 3. Development and Testing Dependencies

| Package Name | Version | Purpose |
| :--- | :--- | :--- |
| **`typescript`** | `^5.6.3` | Type-safe static analysis and contract enforcement across API and client components |
| **`vitest`** | `^2.1.3` | High-performance unit test runner for deterministic chess algorithms and vector distance |
| **`tailwindcss`** | `^3.4.14` | Utility-first responsive CSS framework for professional chess UI |
| **`postcss`** | `^8.4.47` | CSS transformation pipeline tool |
| **`autoprefixer`** | `^10.4.20` | Vendor prefix parser for cross-browser CSS support |
| **`@types/node`** | `^20.17.0` | TypeScript definitions for Node.js runtime |
| **`@types/pg`** | `^8.11.10` | TypeScript definitions for `pg` connection pool and query results |
| **`@types/bcryptjs`** | `^2.4.6` | TypeScript definitions for bcrypt hashing |

---

## 4. Verification Commands

To verify all required tools and packages locally:

```powershell
# 1. Verify Node.js version
node -v

# 2. Verify npm
npm -v

# 3. Check installed packages without missing dependencies
npm ls --depth=0

# 4. Run automated test suite
npm run test

# 5. Verify TypeScript compilation
npx tsc --noEmit
```

