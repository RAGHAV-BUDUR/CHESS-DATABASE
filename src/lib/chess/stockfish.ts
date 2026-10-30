/**
 * ChessBase Optional Stockfish Engine Service
 * Provides UCI-based evaluation verification when Stockfish is locally installed.
 * 
 * 100% Optional: If Stockfish is absent, the deterministic baseline functions without interruption.
 */

import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import path from 'path';
import fs from 'fs';

export interface StockfishEvaluation {
  available: boolean;
  scoreCentipawns?: number;
  mateInMoves?: number;
  bestMove?: string;
  depth?: number;
  engineVersion?: string;
  isTacticallySound?: boolean;
}

export class StockfishService {
  private static stockfishPath: string | null = null;
  private static isChecked: boolean = false;

  /**
   * Find local Stockfish binary if configured or installed
   */
  public static getBinaryPath(): string | null {
    if (this.isChecked) return this.stockfishPath;

    this.isChecked = true;
    const candidates = [
      process.env.STOCKFISH_PATH,
      'stockfish',
      'stockfish.exe',
      'C:\\Program Files\\Stockfish\\stockfish.exe',
      'C:\\tools\\stockfish\\stockfish.exe',
    ].filter(Boolean) as string[];

    for (const p of candidates) {
      try {
        if (fs.existsSync(p)) {
          this.stockfishPath = p;
          return p;
        }
      } catch {
        // continue
      }
    }

    return null;
  }

  /**
   * Run bounded position evaluation (depth 10, timeout 1000ms)
   */
  public static async evaluatePosition(fen: string, maxDepth = 10, timeoutMs = 800): Promise<StockfishEvaluation> {
    const bin = this.getBinaryPath();
    if (!bin) {
      return { available: false };
    }

    return new Promise((resolve) => {
      let proc: ChildProcessWithoutNullStreams;
      try {
        proc = spawn(bin);
      } catch {
        return resolve({ available: false });
      }

      let bestMove = '';
      let scoreCp: number | undefined;
      let mateScore: number | undefined;
      let reachedDepth = 0;
      let engineName = 'Stockfish';

      const timer = setTimeout(() => {
        try {
          proc.stdin.write('quit\n');
          proc.kill();
        } catch {}
        resolve({
          available: true,
          scoreCentipawns: scoreCp,
          mateInMoves: mateScore,
          bestMove,
          depth: reachedDepth,
          engineVersion: engineName,
        });
      }, timeoutMs);

      proc.stdout.on('data', (chunk: Buffer) => {
        const text = chunk.toString();
        const lines = text.split('\n');

        for (const line of lines) {
          if (line.startsWith('id name')) {
            engineName = line.replace('id name', '').trim();
          }

          if (line.includes('score cp')) {
            const match = line.match(/score cp (-?\d+)/);
            if (match) scoreCp = parseInt(match[1], 10);
          } else if (line.includes('score mate')) {
            const match = line.match(/score mate (-?\d+)/);
            if (match) mateScore = parseInt(match[1], 10);
          }

          if (line.includes('depth')) {
            const match = line.match(/depth (\d+)/);
            if (match) reachedDepth = parseInt(match[1], 10);
          }

          if (line.startsWith('bestmove')) {
            bestMove = line.split(' ')[1] || '';
            clearTimeout(timer);
            try {
              proc.stdin.write('quit\n');
              proc.kill();
            } catch {}
            resolve({
              available: true,
              scoreCentipawns: scoreCp,
              mateInMoves: mateScore,
              bestMove,
              depth: reachedDepth,
              engineVersion: engineName,
              isTacticallySound: mateScore !== undefined || (scoreCp !== undefined && scoreCp > -150),
            });
          }
        }
      });

      proc.stdin.write('uci\n');
      proc.stdin.write('isready\n');
      proc.stdin.write(`position fen ${fen}\n`);
      proc.stdin.write(`go depth ${maxDepth}\n`);
    });
  }
}

