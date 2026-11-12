/**
 * ChessBase PGN Parser and Data Extraction Utility
 * DBMS Experiential Learning - Level 3 Project
 * Authors: Raghav Budur (PES1UG23AM225) & Prithviraj K (PES1UG24AM204)
 */

import { Chess } from 'chess.js';
import { TacticalFingerprintEngine, DetectedMotif } from './tactical-fingerprint';
import { ECOClassifier } from './eco-classifier';

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
    // Normalize newlines and clean non-printable control characters
    const sanitizedInput = rawPgn.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');
    const lines = sanitizedInput.split(/\r?\n/);
    let currentGameLines: string[] = [];
    let hasMoves = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const isHeader = line.startsWith('[') && line.endsWith(']');

      // If we encounter a PGN header tag after having already read moves,
      // it marks the definitive start of the next game
      if (isHeader && hasMoves) {
        if (currentGameLines.length > 0) {
          rawGames.push(currentGameLines.join('\n'));
        }
        currentGameLines = [lines[i]];
        hasMoves = false;
        continue;
      }

      if (!isHeader && line.length > 0 && !line.startsWith('%')) {
        hasMoves = true;
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
    let loaded = false;

    // 1. Attempt standard PGN load
    try {
      chess.loadPgn(pgnText);
      loaded = chess.history().length > 0;
    } catch {
      loaded = false;
    }

    // 2. Fallback: sanitize Chessis / engine comments { ... }, variations ( ... ), and NAGs $1
    if (!loaded) {
      try {
        const cleaned = pgnText
          .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '')
          .replace(/\{[^}]*\}/g, ' ')
          .replace(/\([^)]*\)/g, ' ')
          .replace(/\$\d+/g, ' ');
        chess.loadPgn(cleaned);
        loaded = chess.history().length > 0;
      } catch {
        return null;
      }
    }

    if (!loaded) return null;

    const headers = chess.header();
    // Supplement with regex in case non-standard headers were not parsed by chess.js
    const headerRegex = /\[([A-Za-z0-9_]+)\s+"([^"]*)"\]/g;
    let match;
    while ((match = headerRegex.exec(pgnText)) !== null) {
      if (!headers[match[1]]) {
        headers[match[1]] = match[2];
      }
    }
    const rawWhite = headers['White'] ? headers['White'].trim() : '';
    const rawBlack = headers['Black'] ? headers['Black'].trim() : '';

    const normPlayer = (name: string, fallback: string) => {
      if (!name || name === '?') return fallback;
      if (/^raghav(\s+budur)?$/i.test(name) || name.toLowerCase().includes('raghav')) {
        return 'Raghav Budur';
      }
      return name;
    };

    let whitePlayer = normPlayer(rawWhite, 'Unknown White').slice(0, 100);
    let blackPlayer = normPlayer(rawBlack, 'Unknown Black').slice(0, 100);

    if (whitePlayer.toLowerCase() === blackPlayer.toLowerCase()) {
      blackPlayer = `${blackPlayer} (Black)`.slice(0, 100);
    }

    const event = (!headers['Event'] || headers['Event'].trim() === '?' ? 'Casual Game' : headers['Event'].trim()).slice(0, 200);
    const site = (headers['Site'] || 'Unknown Site').trim().slice(0, 200);
    const round = (headers['Round'] || '1').trim().slice(0, 20);
    const rawResult = (headers['Result'] || '*').trim();
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

    // Extract move list and FEN positions
    const history = chess.history({ verbose: true });
    const replay = new Chess();
    if (headers['FEN']) {
      try {
        replay.load(headers['FEN']);
      } catch {
        replay.reset();
      }
    }
    const moves: ParsedGameMove[] = [];

    for (let i = 0; i < history.length; i++) {
      const h = history[i];
      try {
        replay.move(h);
      } catch {
        // Fallback move attempt
        try {
          replay.move(h.san);
        } catch {}
      }
      moves.push({
        moveNumber: Math.floor(i / 2) + 1,
        color: h.color === 'w' ? 'white' : 'black',
        san: h.san.slice(0, 20),
        uci: `${h.from}${h.to}${h.promotion || ''}`.slice(0, 10),
        fenAfter: replay.fen(),
        isCheck: h.san.includes('+') || h.san.includes('#'),
        isCapture: h.captured !== undefined || h.san.includes('x')
      });
    }

    // Opening & ECO deterministic classification
    const openingClassification = ECOClassifier.classify(pgnText, history.map(m => m.san));
    const ecoCode = headers['ECO'] ? headers['ECO'].trim() : openingClassification.ecoCode;
    const openingName = headers['Opening'] ? headers['Opening'].trim() : openingClassification.openingName;

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

