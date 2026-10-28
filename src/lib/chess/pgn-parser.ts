/**
 * ChessBase PGN Parser and Data Extraction Utility
 * DBMS Experiential Learning - Level 3 Project
 * Authors: Raghav Budur (PES1UG23AM225) & Prithviraj K (PES1UG24AM204)
 */

import { Chess } from 'chess.js';
import { TacticalFingerprintEngine, DetectedMotif } from './tactical-fingerprint';

export interface ParsedGameMove {
  moveNumber: number;
  color: 'white' | 'black';
  san: string;
  uci: string;
  fenAfter: string;
  isCheck: boolean;
  isCapture: boolean;
}

export interface ParsedGameRecord {
  event: string;
  site?: string;
  date: string; // YYYY-MM-DD
  round?: string;
  whitePlayer: string;
  whiteRating?: number;
  blackPlayer: string;
  blackRating?: number;
  result: '1-0' | '0-1' | '1/2-1/2' | '*';
  ecoCode: string;
  openingName: string;
  pgn: string;
  moveCount: number;
  moves: ParsedGameMove[];
  detectedMotifs: DetectedMotif[];
  searchableSummary: string;
}

export class PGNParser {
  /**
   * Split multiple games from a raw PGN text
   */
  public static splitPgnGames(rawPgn: string): string[] {
    const rawGames: string[] = [];
    const lines = rawPgn.split(/\r?\n/);
    let currentGameLines: string[] = [];
    let insideGame = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('[Event ') && currentGameLines.length > 0) {
        // Look ahead to check if this is the start of a new game
        const hasMoves = currentGameLines.some(l => !l.startsWith('[') && l.length > 0);
        if (hasMoves) {
          rawGames.push(currentGameLines.join('\n'));
          currentGameLines = [lines[i]];
          continue;
        }
      }
      currentGameLines.push(lines[i]);
    }

    if (currentGameLines.length > 0) {
      rawGames.push(currentGameLines.join('\n'));
    }

    return rawGames.filter(g => g.trim().length > 10);
  }

  /**
   * Parse a single PGN game into structured database-ready record
   */
  public static parseSingleGame(pgnText: string): ParsedGameRecord | null {
    const chess = new Chess();
    try {
      chess.loadPgn(pgnText);
    } catch {
      return null;
    }

    const headers = chess.header();
    // Supplement with regex in case non-standard headers were not parsed by chess.js
    const headerRegex = /\[([A-Za-z0-9_]+)\s+"([^"]*)"\]/g;
    let match;
    while ((match = headerRegex.exec(pgnText)) !== null) {
      if (!headers[match[1]]) {
        headers[match[1]] = match[2];
      }
    }
    const whitePlayer = headers['White'] || 'Unknown White';
    const blackPlayer = headers['Black'] || 'Unknown Black';
    const event = headers['Event'] || 'Casual Game';
    const site = headers['Site'] || 'Unknown Site';
    const round = headers['Round'] || '1';
    const rawResult = headers['Result'] || '*';
    const result = ['1-0', '0-1', '1/2-1/2'].includes(rawResult) 
      ? (rawResult as '1-0' | '0-1' | '1/2-1/2') 
      : '*';

    // Parse Ratings safely
    const whiteRating = parseInt(headers['WhiteElo'] || '0', 10) || undefined;
    const blackRating = parseInt(headers['BlackElo'] || '0', 10) || undefined;

    // Parse Date safely (handles "????.??.??" or "2023.05.12")
    let rawDate = headers['Date'] || headers['UTCDate'] || '2000.01.01';
    rawDate = rawDate.replace(/\?/g, '01');
    const parts = rawDate.split('.');
    let year = parts[0] || '2000';
    let month = (parts[1] || '01').padStart(2, '0');
    let day = (parts[2] || '01').padStart(2, '0');
    if (parseInt(month, 10) > 12) month = '12';
    if (parseInt(day, 10) > 28) day = '28';
    const date = `${year}-${month}-${day}`;

    // Opening & ECO
    const ecoCode = headers['ECO'] || 'A00';
    const openingName = headers['Opening'] || 'Chess Game';

    // Extract move list and FEN positions
    const history = chess.history({ verbose: true });
    const replay = new Chess();
    const moves: ParsedGameMove[] = [];

    for (let i = 0; i < history.length; i++) {
      const h = history[i];
      replay.move(h);
      moves.push({
        moveNumber: Math.floor(i / 2) + 1,
        color: h.color === 'w' ? 'white' : 'black',
        san: h.san,
        uci: `${h.from}${h.to}${h.promotion || ''}`,
        fenAfter: replay.fen(),
        isCheck: h.san.includes('+') || h.san.includes('#'),
        isCapture: h.captured !== undefined || h.san.includes('x')
      });
    }

    const moveCount = Math.ceil(history.length / 2);

    // Run deterministic Tactical Fingerprint Engine
    const analysis = TacticalFingerprintEngine.analyzeGame(pgnText);
    const detectedMotifs = analysis.detectedMotifs;

    // Generate enriched text for Vector Semantic Search
    const motifSummary = detectedMotifs.map(m => `${m.motifName} on move ${m.moveNumber} by ${m.color}`).join(', ');
    const movesSummary = history.slice(0, 30).map(m => m.san).join(' ');
    const searchableSummary = `Chess game between ${whitePlayer} (${whiteRating || 'unrated'}) and ${blackPlayer} (${blackRating || 'unrated'}). Event: ${event}. Opening: ${openingName} (${ecoCode}). Result: ${result}. Total moves: ${moveCount}. Key tactical motifs detected: ${motifSummary || 'Positional maneuvering'}. Move sequence: ${movesSummary}.`;

    return {
      event,
      site,
      date,
      round,
      whitePlayer,
      whiteRating,
      blackPlayer,
      blackRating,
      result,
      ecoCode,
      openingName,
      pgn: pgnText,
      moveCount,
      moves,
      detectedMotifs,
      searchableSummary
    };
  }

  /**
   * Helper to generate searchable summary from record and motifs
   */
  public static generateGameSummaryText(
    record: ParsedGameRecord,
    motifs: DetectedMotif[]
  ): string {
    const motifSummary = motifs.map(m => `${m.motifName} on move ${m.moveNumber} by ${m.color}`).join(', ');
    const movesSummary = record.moves.slice(0, 30).map(m => m.san).join(' ');
    return `Chess game between ${record.whitePlayer} (${record.whiteRating || 'unrated'}) and ${record.blackPlayer} (${record.blackRating || 'unrated'}). Event: ${record.event}. Opening: ${record.openingName} (${record.ecoCode}). Result: ${record.result}. Total moves: ${record.moveCount}. Key tactical motifs detected: ${motifSummary || 'Positional maneuvering'}. Move sequence: ${movesSummary}.`;
  }
}

