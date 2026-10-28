/**
 * ChessBase PostgreSQL Database Connection Client
 * DBMS Experiential Learning - Level 3 Project
 * Authors: Raghav Budur (PES1UG23AM225) & Prithviraj K (PES1UG24AM204)
 */

import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/chessbase';

let pool: Pool;

declare global {
  // eslint-disable-next-line no-var
  var __dbPool: Pool | undefined;
}

if (process.env.NODE_ENV === 'production') {
  pool = new Pool({
    connectionString,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
} else {
  if (!global.__dbPool) {
    global.__dbPool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }
  pool = global.__dbPool;
}

export { pool };

/**
 * Execute parameterized query with automatic connection management
 */
export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const start = Date.now();
  try {
    const res = await pool.query<T>(text, params);
    const duration = Date.now() - start;
    if (process.env.DEBUG_SQL === 'true') {
      console.log('Executed SQL Query', { text, duration, rows: res.rowCount });
    }
    return res;
  } catch (error: any) {
    console.error('Database Query Error:', {
      text,
      params,
      message: error?.message,
      code: error?.code,
    });
    throw error;
  }
}

/**
 * Execute a unit of work inside an explicit ACID transaction with automatic rollback
 */
export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Check database connection status and pgvector availability
 */
export async function checkDatabaseHealth(): Promise<{
  connected: boolean;
  version?: string;
  hasPgVector: boolean;
  error?: string;
}> {
  try {
    const res = await pool.query('SELECT version();');
    const extRes = await pool.query("SELECT extname FROM pg_extension WHERE extname = 'vector';");
    return {
      connected: true,
      version: res.rows[0]?.version,
      hasPgVector: extRes.rows.length > 0,
    };
  } catch (err: any) {
    return {
      connected: false,
      hasPgVector: false,
      error: err.message,
    };
  }
}

