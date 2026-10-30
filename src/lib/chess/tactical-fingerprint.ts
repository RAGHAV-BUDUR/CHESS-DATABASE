/**
 * ChessBase Tactical Fingerprint Engine
 * DBMS Experiential Learning - Level 3 Project
 * Authors: Raghav Budur (PES1UG23AM225) & Prithviraj K (PES1UG24AM204)
 * 
 * 100% Deterministic Chess Rules & Legal Board-State Analysis Engine.
 * NO notation-string guessing; evaluates actual piece attacks, rays, board geometry, and move lookahead.
 */

import { Chess, Square, PieceSymbol, Color, Move } from 'chess.js';

export type EvidenceLevel = 'GEOMETRIC' | 'CANDIDATE' | 'VERIFIED';
export type ConfidenceLevel = 'EXACT' | 'RULE_BASED' | 'HEURISTIC' | 'VERIFIED' | 'CANDIDATE' | 'GEOMETRIC';
export type SacrificeClassification = 'MATERIAL_LOSS' | 'CANDIDATE_SACRIFICE' | 'TACTICAL_SACRIFICE' | 'POSITIONAL_SACRIFICE' | 'UNCLASSIFIED';

export interface PositionFingerprint {
  fen: string;
  sideToMove: 'white' | 'black';
  materialBalance: {
    white: number;
    black: number;
    diff: number; // positive = white ahead
  };
  castlingRights: {
    whiteKingside: boolean;
    whiteQueenside: boolean;
    blackKingside: boolean;
    blackQueenside: boolean;
  };
  kingSafety: {
    whitePawnShield: number;
    blackPawnShield: number;
    oppositeSideCastling: boolean;
  };
  pawnStructure: {
    whitePassedPawns: string[];
    blackPassedPawns: string[];
    isPawnStormKingside: boolean;
    isPawnStormQueenside: boolean;
  };
}

export interface DetectedMotif {
  motifName: string;
  category: 'Sacrifice' | 'Attack' | 'Pin/Skewer' | 'Fork' | 'Structural' | 'Endgame' | 'Tactical Error';
  moveNumber: number;
  color: 'white' | 'black';
  moveSan: string;
  fenPosition: string;
  materialChange: number;
  rationale: string;
  confidence: ConfidenceLevel;
  evidenceLevel?: EvidenceLevel;
  engineEval?: string;
}

export interface GameFingerprintResult {
  fingerprints: PositionFingerprint[];
  detectedMotifs: DetectedMotif[];
  summarySignature: Record<string, number>;
}

export interface MoveDiagnostic {
  gameId?: number;
  ply: number;
  fenBefore: string;
  fenAfter: string;
  san: string;
  uci: string;
  sideToMove: 'white' | 'black';
  materialBalanceBefore: { white: number; black: number; diff: number };
  materialBalanceAfter: { white: number; black: number; diff: number };
  materialDeltaForSide: number;
  isCheck: boolean;
  isCheckmate: boolean;
  isDoubleCheck: boolean;
  isDiscoveredCheck: boolean;
  sacrificeClass?: SacrificeClassification;
  attackedTargets: Array<{ square: string; piece: string; value: number }>;
  motifs: DetectedMotif[];
  evidenceSummary: string[];
  searchDepth: number;
  confidence: ConfidenceLevel;
  evidenceLevel: EvidenceLevel;
}

export const PIECE_VALUES: Record<PieceSymbol, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0
};

export class TacticalFingerprintEngine {
  /**
   * Coordinate helpers: square ('e4') <-> [rank (0..7), file (0..7)]
   */
  public static squareToCoords(sq: Square): [number, number] {
    const file = sq.charCodeAt(0) - 97;
    const rank = 8 - parseInt(sq[1], 10);
    return [rank, file];
  }

  public static coordsToSquare(rank: number, file: number): Square {
    return `${String.fromCharCode(97 + file)}${8 - rank}` as Square;
  }

  /**
   * Determine all pieces of a specific color that attack a target square on the board
   */
  public static getAttackers(
    board: ({ square: Square; type: PieceSymbol; color: Color } | null)[][],
    targetSq: Square,
    byColor: Color
  ): Array<{ square: Square; type: PieceSymbol; color: Color }> {
    const attackers: Array<{ square: Square; type: PieceSymbol; color: Color }> = [];
    const [tr, tc] = this.squareToCoords(targetSq);

    // 1. Pawns attacking targetSq
    const pawnRow = byColor === 'w' ? tr + 1 : tr - 1;
    if (pawnRow >= 0 && pawnRow < 8) {
      for (const pawnCol of [tc - 1, tc + 1]) {
        if (pawnCol >= 0 && pawnCol < 8) {
          const piece = board[pawnRow]?.[pawnCol];
          if (piece && piece.color === byColor && piece.type === 'p') {
            attackers.push(piece);
          }
        }
      }
    }

    // 2. Knights attacking targetSq
    const knightOffsets = [
      [-2, -1], [-2, 1], [-1, -2], [-1, 2],
      [1, -2], [1, 2], [2, -1], [2, 1]
    ];
    for (const [dr, dc] of knightOffsets) {
      const nr = tr + dr;
      const nc = tc + dc;
      if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
        const piece = board[nr]?.[nc];
        if (piece && piece.color === byColor && piece.type === 'n') {
          attackers.push(piece);
        }
      }
    }

    // 3. Kings attacking targetSq
    const kingOffsets = [
      [-1, -1], [-1, 0], [-1, 1],
      [0, -1],           [0, 1],
      [1, -1],  [1, 0],  [1, 1]
    ];
    for (const [dr, dc] of kingOffsets) {
      const kr = tr + dr;
      const kc = tc + dc;
      if (kr >= 0 && kr < 8 && kc >= 0 && kc < 8) {
        const piece = board[kr]?.[kc];
        if (piece && piece.color === byColor && piece.type === 'k') {
          attackers.push(piece);
        }
      }
    }

    // 4. Sliding pieces: Diagonals (Bishops and Queens)
    const diagDirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    for (const [dr, dc] of diagDirs) {
      let r = tr + dr;
      let c = tc + dc;
      while (r >= 0 && r < 8 && c >= 0 && c < 8) {
        const piece = board[r]?.[c];
        if (piece) {
          if (piece.color === byColor && (piece.type === 'b' || piece.type === 'q')) {
            attackers.push(piece);
          }
          break; // Ray blocked
        }
        r += dr;
        c += dc;
      }
    }

    // 5. Sliding pieces: Orthogonals (Rooks and Queens)
    const orthoDirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (const [dr, dc] of orthoDirs) {
      let r = tr + dr;
      let c = tc + dc;
      while (r >= 0 && r < 8 && c >= 0 && c < 8) {
        const piece = board[r]?.[c];
        if (piece) {
          if (piece.color === byColor && (piece.type === 'r' || piece.type === 'q')) {
            attackers.push(piece);
          }
          break; // Ray blocked
        }
        r += dr;
        c += dc;
      }
    }

    return attackers;
  }

  /**
   * Calculate static deterministic position fingerprint
   */
  public static analyzePosition(chess: Chess): PositionFingerprint {
    const fen = chess.fen();
    const sideToMove = chess.turn() === 'w' ? 'white' : 'black';
    const board = chess.board();

    let whiteMaterial = 0;
    let blackMaterial = 0;
    const whitePawns: Square[] = [];
    const blackPawns: Square[] = [];
    let whiteKingSq: Square = 'e1';
    let blackKingSq: Square = 'e8';

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (!piece) continue;
        const square = piece.square;
        const val = PIECE_VALUES[piece.type];
        if (piece.color === 'w') {
          whiteMaterial += val;
          if (piece.type === 'p') whitePawns.push(square);
          if (piece.type === 'k') whiteKingSq = square;
        } else {
          blackMaterial += val;
          if (piece.type === 'p') blackPawns.push(square);
          if (piece.type === 'k') blackKingSq = square;
        }
      }
    }

    const fenParts = fen.split(' ');
    const castlingStr = fenParts[2] || '-';
    const castlingRights = {
      whiteKingside: castlingStr.includes('K'),
      whiteQueenside: castlingStr.includes('Q'),
      blackKingside: castlingStr.includes('k'),
      blackQueenside: castlingStr.includes('q')
    };

    const wKingFile = whiteKingSq.charCodeAt(0) - 97;
    const wKingRank = parseInt(whiteKingSq[1], 10);
    let whiteShield = 0;
    for (let f = Math.max(0, wKingFile - 1); f <= Math.min(7, wKingFile + 1); f++) {
      for (const p of whitePawns) {
        const pf = p.charCodeAt(0) - 97;
        const pr = parseInt(p[1], 10);
        if (pf === f && pr === wKingRank + 1) whiteShield++;
      }
    }

    const bKingFile = blackKingSq.charCodeAt(0) - 97;
    const bKingRank = parseInt(blackKingSq[1], 10);
    let blackShield = 0;
    for (let f = Math.max(0, bKingFile - 1); f <= Math.min(7, bKingFile + 1); f++) {
      for (const p of blackPawns) {
        const pf = p.charCodeAt(0) - 97;
        const pr = parseInt(p[1], 10);
        if (pf === f && pr === bKingRank - 1) blackShield++;
      }
    }

    const whiteCastledQueenside = wKingFile <= 2;
    const whiteCastledKingside = wKingFile >= 5;
    const blackCastledQueenside = bKingFile <= 2;
    const blackCastledKingside = bKingFile >= 5;
    const oppositeSideCastling = (whiteCastledQueenside && blackCastledKingside) || (whiteCastledKingside && blackCastledQueenside);

    let wKingsideStorm = false;
    let wQueensideStorm = false;
    for (const p of whitePawns) {
      const f = p[0];
      const r = parseInt(p[1], 10);
      if (['f', 'g', 'h'].includes(f) && r >= 5 && blackCastledKingside) wKingsideStorm = true;
      if (['a', 'b', 'c'].includes(f) && r >= 5 && blackCastledQueenside) wQueensideStorm = true;
    }

    return {
      fen,
      sideToMove,
      materialBalance: {
        white: whiteMaterial,
        black: blackMaterial,
        diff: whiteMaterial - blackMaterial
      },
      castlingRights,
      kingSafety: {
        whitePawnShield: whiteShield,
        blackPawnShield: blackShield,
        oppositeSideCastling
      },
      pawnStructure: {
        whitePassedPawns: [],
        blackPassedPawns: [],
        isPawnStormKingside: wKingsideStorm,
        isPawnStormQueenside: wQueensideStorm
      }
    };
  }

  /**
   * Process an entire game move by move and detect tactical motifs deterministically
   */
  public static analyzeGame(pgn: string): GameFingerprintResult {
    const game = new Chess();
    let loaded = false;
    try {
      game.loadPgn(pgn);
      loaded = true;
    } catch {
      loaded = false;
    }

    if (!loaded) {
      try {
        const sanitized = pgn
          .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '')
          .replace(/\{[^}]*\}/g, ' ')
          .replace(/\([^)]*\)/g, ' ')
          .replace(/\$\d+/g, ' ');
        game.loadPgn(sanitized);
        loaded = true;
      } catch {
        return { fingerprints: [], detectedMotifs: [], summarySignature: {} };
      }
    }

    const history = game.history({ verbose: true });
    const replay = new Chess();
    const fingerprints: PositionFingerprint[] = [];
    const detectedMotifs: DetectedMotif[] = [];
    const summarySignature: Record<string, number> = {};

    for (let i = 0; i < history.length; i++) {
      const move = history[i];
      const moveColor = move.color === 'w' ? 'white' : 'black';
      const moveNumber = Math.floor(i / 2) + 1;

      const preMoveFen = replay.fen();
      const preMovePosition = this.analyzePosition(replay);

      replay.move(move);
      const postMoveFen = replay.fen();
      const postMovePosition = this.analyzePosition(replay);
      fingerprints.push(postMovePosition);

      // Remaining future moves in game for historical tactical validation
      const futureMoves = history.slice(i + 1, i + 5);

      const motifs = this.detectMoveMotifs(
        replay,
        move,
        moveNumber,
        moveColor,
        preMovePosition,
        postMovePosition,
        preMoveFen,
        postMoveFen,
        futureMoves
      );

      for (const m of motifs) {
        detectedMotifs.push(m);
        summarySignature[m.motifName] = (summarySignature[m.motifName] || 0) + 1;
      }
    }

    return { fingerprints, detectedMotifs, summarySignature };
  }

  /**
   * Core Rule-Based Tactical Motif Classifier for an Individual Move
   */
  public static detectMoveMotifs(
    postGame: Chess,
    move: Move,
    moveNumber: number,
    moveColor: 'white' | 'black',
    prePos: PositionFingerprint,
    postPos: PositionFingerprint,
    preFen: string,
    postFen: string,
    futureMoves?: Move[]
  ): DetectedMotif[] {
    const motifs: DetectedMotif[] = [];
    const sideColor: Color = move.color;
    const oppColor: Color = sideColor === 'w' ? 'b' : 'w';
    const board = postGame.board();

    // =========================================================================
    // 1. LEGAL CHECK & CHECKMATE CLASSIFICATION
    // =========================================================================
    if (postGame.isCheckmate()) {
      motifs.push({
        motifName: 'Checkmate',
        category: 'Attack',
        moveNumber,
        color: moveColor,
        moveSan: move.san,
        fenPosition: postFen,
        materialChange: 0,
        rationale: `${moveColor.toUpperCase()} executed terminal checkmate on move ${moveNumber} with ${move.san}.`,
        confidence: 'EXACT',
        evidenceLevel: 'VERIFIED'
      });
      // Backward compatibility alias
      motifs.push({
        motifName: 'Checkmate Attack',
        category: 'Attack',
        moveNumber,
        color: moveColor,
        moveSan: move.san,
        fenPosition: postFen,
        materialChange: 0,
        rationale: `${moveColor.toUpperCase()} delivered checkmate.`,
        confidence: 'EXACT',
        evidenceLevel: 'VERIFIED'
      });
    } else if (postGame.inCheck()) {
      // Find opponent king position
      let oppKingSq: Square = 'e8';
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const p = board[r][c];
          if (p && p.color === oppColor && p.type === 'k') {
            oppKingSq = p.square;
            break;
          }
        }
      }

      const checkers = this.getAttackers(board, oppKingSq, sideColor);

      if (checkers.length >= 2) {
        // DOUBLE CHECK
        motifs.push({
          motifName: 'Double Check',
          category: 'Attack',
          moveNumber,
          color: moveColor,
          moveSan: move.san,
          fenPosition: postFen,
          materialChange: 0,
          rationale: `${moveColor.toUpperCase()} delivered Double Check with ${move.san} (${checkers.map(c => c.type.toUpperCase() + ' on ' + c.square).join(' and ')}).`,
          confidence: 'EXACT',
          evidenceLevel: 'VERIFIED'
        });
      } else if (checkers.length === 1) {
        const soleChecker = checkers[0];
        if (soleChecker.square === move.to) {
          // DIRECT CHECK
          motifs.push({
            motifName: 'Check',
            category: 'Attack',
            moveNumber,
            color: moveColor,
            moveSan: move.san,
            fenPosition: postFen,
            materialChange: 0,
            rationale: `${moveColor.toUpperCase()} delivered direct check with ${move.san}.`,
            confidence: 'EXACT',
            evidenceLevel: 'VERIFIED'
          });
        } else {
          // DISCOVERED CHECK: moving piece is NOT the checker; unmasked a sliding piece
          motifs.push({
            motifName: 'Discovered Check',
            category: 'Attack',
            moveNumber,
            color: moveColor,
            moveSan: move.san,
            fenPosition: postFen,
            materialChange: 0,
            rationale: `${moveColor.toUpperCase()} played ${move.san}, unmasking Discovered Check from ${soleChecker.type.toUpperCase()} on ${soleChecker.square}.`,
            confidence: 'EXACT',
            evidenceLevel: 'VERIFIED'
          });
        }
      }

      // Backward compatibility alias
      motifs.push({
        motifName: 'Check / Discovered Check',
        category: 'Attack',
        moveNumber,
        color: moveColor,
        moveSan: move.san,
        fenPosition: postFen,
        materialChange: 0,
        rationale: `${moveColor.toUpperCase()} delivered check with ${move.san}.`,
        confidence: 'EXACT',
        evidenceLevel: 'VERIFIED'
      });
    }

    // =========================================================================
    // 2. DISCOVERED ATTACK (Non-Check)
    // =========================================================================
    if (!postGame.inCheck()) {
      const discoveredAttack = this.detectDiscoveredAttack(preFen, postFen, move, moveNumber, moveColor);
      if (discoveredAttack) {
        motifs.push(discoveredAttack);
      }
    }

    // =========================================================================
    // 3. PINS AND SKEWERS
    // =========================================================================
    const pinOrSkewerMotifs = this.detectPinsAndSkewers(postGame, move, moveNumber, moveColor, postFen);
    for (const p of pinOrSkewerMotifs) {
      motifs.push(p);
    }

    // =========================================================================
    // 4. FORKS (Pawns, Knights, Pieces)
    // =========================================================================
    const forkMotifs = this.detectForks(postGame, move, moveNumber, moveColor, postFen);
    for (const f of forkMotifs) {
      motifs.push(f);
    }

    // =========================================================================
    // 5. SACRIFICE CLASSIFICATION & VALIDATION
    // =========================================================================
    const sacrificeMotifs = this.classifySacrifice(
      preFen,
      postFen,
      postGame,
      move,
      moveNumber,
      moveColor,
      prePos,
      postPos,
      futureMoves
    );
    for (const s of sacrificeMotifs) {
      motifs.push(s);
    }

    // =========================================================================
    // 6. PAWN PROMOTION & PROMOTION THREAT
    // =========================================================================
    if (move.promotion) {
      motifs.push({
        motifName: 'Pawn Promotion',
        category: 'Endgame',
        moveNumber,
        color: moveColor,
        moveSan: move.san,
        fenPosition: postFen,
        materialChange: 8,
        rationale: `Pawn promoted to ${move.promotion.toUpperCase()} on ${move.to}.`,
        confidence: 'EXACT',
        evidenceLevel: 'VERIFIED'
      });
    } else if (move.piece === 'p' && ((moveColor === 'white' && move.to[1] === '7') || (moveColor === 'black' && move.to[1] === '2'))) {
      motifs.push({
        motifName: 'Promotion Threat',
        category: 'Endgame',
        moveNumber,
        color: moveColor,
        moveSan: move.san,
        fenPosition: postFen,
        materialChange: 0,
        rationale: `Pawn advanced to ${move.to}, creating an immediate promotion threat.`,
        confidence: 'EXACT',
        evidenceLevel: 'CANDIDATE'
      });
    }

    // =========================================================================
    // 7. PAWN STORM ATTACK
    // =========================================================================
    if (postPos.kingSafety.oppositeSideCastling && move.piece === 'p') {
      if (postPos.pawnStructure.isPawnStormKingside || postPos.pawnStructure.isPawnStormQueenside) {
        motifs.push({
          motifName: 'Pawn Storm Attack',
          category: 'Attack',
          moveNumber,
          color: moveColor,
          moveSan: move.san,
          fenPosition: postFen,
          materialChange: 0,
          rationale: `Opposite-side castling attack: ${moveColor.toUpperCase()} launches pawn storm with ${move.san}.`,
          confidence: 'RULE_BASED',
          evidenceLevel: 'CANDIDATE'
        });
      }
    }

    return motifs;
  }

  /**
   * Discovered Attack Detection: Moving a piece unblocks a friendly sliding piece's ray
   * against an opponent valuable piece (Queen, Rook, or undefended minor piece).
   */
  private static detectDiscoveredAttack(
    preFen: string,
    postFen: string,
    move: Move,
    moveNumber: number,
    moveColor: 'white' | 'black'
  ): DetectedMotif | null {
    const preChess = new Chess(preFen);
    const postChess = new Chess(postFen);
    const preBoard = preChess.board();
    const postBoard = postChess.board();
    const sideColor: Color = move.color;
    const oppColor: Color = sideColor === 'w' ? 'b' : 'w';

    const [vacatedR, vacatedC] = this.squareToCoords(move.from);

    // Examine the 8 ray directions through vacated square
    const allDirs = [
      [-1, -1], [-1, 1], [1, -1], [1, 1],
      [-1, 0], [1, 0], [0, -1], [0, 1]
    ];

    for (const [dr, dc] of allDirs) {
      const isDiag = Math.abs(dr) === 1 && Math.abs(dc) === 1;

      // 1. Look backwards from vacated square for friendly sliding piece
      let br = vacatedR - dr;
      let bc = vacatedC - dc;
      let friendlySlider: { square: Square; type: PieceSymbol } | null = null;

      while (br >= 0 && br < 8 && bc >= 0 && bc < 8) {
        const p = postBoard[br]?.[bc];
        if (p) {
          if (p.color === sideColor) {
            if (isDiag && (p.type === 'b' || p.type === 'q')) {
              friendlySlider = p;
            } else if (!isDiag && (p.type === 'r' || p.type === 'q')) {
              friendlySlider = p;
            }
          }
          break; // First piece in direction
        }
        br -= dr;
        bc -= dc;
      }

      if (!friendlySlider) continue;

      // 2. Look forward from vacated square for opponent target
      let fr = vacatedR + dr;
      let fc = vacatedC + dc;
      let oppTarget: { square: Square; type: PieceSymbol } | null = null;

      while (fr >= 0 && fr < 8 && fc >= 0 && fc < 8) {
        const p = postBoard[fr]?.[fc];
        if (p) {
          if (p.color === oppColor) {
            oppTarget = p;
          }
          break;
        }
        fr += dr;
        fc += dc;
      }

      if (!oppTarget) continue;

      // Ensure the moving piece itself did not merely land on the ray
      if (move.to === oppTarget.square) continue;

      // Check target significance: Queen, Rook, or Minor Piece
      if (PIECE_VALUES[oppTarget.type] >= 3 && oppTarget.type !== 'k') {
        // Verify this attack was blocked before the move
        const wasAttackingBefore = this.getAttackers(preBoard, oppTarget.square, sideColor)
          .some(a => a.square === friendlySlider?.square);

        if (!wasAttackingBefore) {
          return {
            motifName: 'Discovered Attack',
            category: 'Attack',
            moveNumber,
            color: moveColor,
            moveSan: move.san,
            fenPosition: postFen,
            materialChange: 0,
            rationale: `Moving ${move.piece.toUpperCase()} from ${move.from} unmasked Discovered Attack from ${friendlySlider.type.toUpperCase()} on ${friendlySlider.square} against opponent ${oppTarget.type.toUpperCase()} on ${oppTarget.square}.`,
            confidence: 'EXACT',
            evidenceLevel: 'VERIFIED'
          };
        }
      }
    }

    return null;
  }

  /**
   * Pins & Skewers Detection along legal board rays
   */
  private static detectPinsAndSkewers(
    game: Chess,
    move: Move,
    moveNumber: number,
    moveColor: 'white' | 'black',
    postFen: string
  ): DetectedMotif[] {
    const motifs: DetectedMotif[] = [];
    const board = game.board();
    const sideColor: Color = move.color;
    const oppColor: Color = sideColor === 'w' ? 'b' : 'w';

    // Only sliding pieces can pin or skewer
    if (!['b', 'r', 'q'].includes(move.piece)) return motifs;

    const [tr, tc] = this.squareToCoords(move.to);
    const deltas: number[][] = [];
    if (['b', 'q'].includes(move.piece)) {
      deltas.push([-1, -1], [-1, 1], [1, -1], [1, 1]);
    }
    if (['r', 'q'].includes(move.piece)) {
      deltas.push([-1, 0], [1, 0], [0, -1], [0, 1]);
    }

    for (const [dr, dc] of deltas) {
      let r = tr + dr;
      let c = tc + dc;
      let p1: { square: Square; type: PieceSymbol; color: Color } | null = null;
      let p2: { square: Square; type: PieceSymbol; color: Color } | null = null;

      while (r >= 0 && r < 8 && c >= 0 && c < 8) {
        const piece = board[r]?.[c];
        if (piece) {
          if (!p1) {
            p1 = piece;
          } else if (!p2) {
            p2 = piece;
            break;
          }
        }
        r += dr;
        c += dc;
      }

      if (p1 && p2 && p1.color === oppColor && p2.color === oppColor) {
        // 1. ABSOLUTE PIN ON KING: Second piece is opponent King
        if (p2.type === 'k') {
          motifs.push({
            motifName: 'Absolute Pin on King',
            category: 'Pin/Skewer',
            moveNumber,
            color: moveColor,
            moveSan: move.san,
            fenPosition: postFen,
            materialChange: 0,
            rationale: `${move.piece.toUpperCase()} on ${move.to} absolutely pins ${p1.type.toUpperCase()} on ${p1.square} to the King on ${p2.square}.`,
            confidence: 'EXACT',
            evidenceLevel: 'VERIFIED'
          });
        }
        // 2. RELATIVE PIN ON QUEEN: Second piece is Queen, first piece is of lesser value
        else if (p2.type === 'q' && PIECE_VALUES[p1.type] < 9) {
          motifs.push({
            motifName: 'Relative Pin on Queen',
            category: 'Pin/Skewer',
            moveNumber,
            color: moveColor,
            moveSan: move.san,
            fenPosition: postFen,
            materialChange: 0,
            rationale: `${move.piece.toUpperCase()} on ${move.to} relatively pins ${p1.type.toUpperCase()} on ${p1.square} against Queen on ${p2.square}.`,
            confidence: 'RULE_BASED',
            evidenceLevel: 'CANDIDATE'
          });
        }
        // 3. SKEWER ATTACK: First piece is higher value than second piece (King = highest priority)
        const p1Val = p1.type === 'k' ? 999 : PIECE_VALUES[p1.type];
        const p2Val = p2.type === 'k' ? 999 : PIECE_VALUES[p2.type];
        if (p1Val > p2Val && ['k', 'q', 'r'].includes(p1.type)) {
          motifs.push({
            motifName: 'Skewer Attack',
            category: 'Pin/Skewer',
            moveNumber,
            color: moveColor,
            moveSan: move.san,
            fenPosition: postFen,
            materialChange: 0,
            rationale: `${move.piece.toUpperCase()} on ${move.to} skewers ${p1.type.toUpperCase()} on ${p1.square}, exposing ${p2.type.toUpperCase()} on ${p2.square}.`,
            confidence: 'RULE_BASED',
            evidenceLevel: 'CANDIDATE'
          });
        }
      }
    }

    return motifs;
  }

  /**
   * Fork Detection: piece directly attacks 2 or more valuable enemy pieces simultaneously
   */
  private static detectForks(
    game: Chess,
    move: Move,
    moveNumber: number,
    moveColor: 'white' | 'black',
    postFen: string
  ): DetectedMotif[] {
    const motifs: DetectedMotif[] = [];
    const board = game.board();
    const sideColor: Color = move.color;
    const oppColor: Color = sideColor === 'w' ? 'b' : 'w';

    const attackedTargets: Array<{ square: Square; type: PieceSymbol; value: number }> = [];

    // Find all opponent pieces attacked directly by the piece on move.to
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (p && p.color === oppColor) {
          const attackers = this.getAttackers(board, p.square, sideColor);
          if (attackers.some(a => a.square === move.to)) {
            attackedTargets.push({
              square: p.square,
              type: p.type,
              value: PIECE_VALUES[p.type]
            });
          }
        }
      }
    }

    // Filter targets that make a genuine tactical fork
    let isGenuineFork = false;
    let forkRationale = '';

    if (move.piece === 'p') {
      // Pawn fork: attacks 2 pieces of value >= 1 (e.g. 2 minor pieces, or rook + minor)
      if (attackedTargets.length >= 2 && attackedTargets.filter(t => t.value >= 3).length >= 1) {
        isGenuineFork = true;
        forkRationale = `Pawn on ${move.to} forks ${attackedTargets.map(t => t.type.toUpperCase() + ' on ' + t.square).join(' and ')}.`;
        motifs.push({
          motifName: 'Pawn Fork',
          category: 'Fork',
          moveNumber,
          color: moveColor,
          moveSan: move.san,
          fenPosition: postFen,
          materialChange: 0,
          rationale: forkRationale,
          confidence: 'EXACT',
          evidenceLevel: 'VERIFIED'
        });
      }
    } else if (move.piece === 'n') {
      // Knight fork: attacks 2 pieces (one being King/Queen/Rook or undefended piece)
      if (attackedTargets.length >= 2) {
        const hasMajorOrKing = attackedTargets.some(t => ['k', 'q', 'r'].includes(t.type));
        if (hasMajorOrKing) {
          isGenuineFork = true;
          forkRationale = `Knight on ${move.to} forks ${attackedTargets.map(t => t.type.toUpperCase() + ' on ' + t.square).join(' and ')}.`;
          motifs.push({
            motifName: 'Knight Fork',
            category: 'Fork',
            moveNumber,
            color: moveColor,
            moveSan: move.san,
            fenPosition: postFen,
            materialChange: 0,
            rationale: forkRationale,
            confidence: 'EXACT',
            evidenceLevel: 'VERIFIED'
          });
        }
      }
    } else {
      // General piece fork (Bishop, Rook, Queen)
      if (attackedTargets.length >= 2) {
        const highValueTargets = attackedTargets.filter(t => t.value > PIECE_VALUES[move.piece] || t.type === 'k');
        if (highValueTargets.length >= 1 || attackedTargets.length >= 3) {
          isGenuineFork = true;
          forkRationale = `${move.piece.toUpperCase()} on ${move.to} forks ${attackedTargets.map(t => t.type.toUpperCase() + ' on ' + t.square).join(' and ')}.`;
        }
      }
    }

    if (isGenuineFork) {
      motifs.push({
        motifName: 'Fork Attack',
        category: 'Fork',
        moveNumber,
        color: moveColor,
        moveSan: move.san,
        fenPosition: postFen,
        materialChange: 0,
        rationale: forkRationale,
        confidence: 'RULE_BASED',
        evidenceLevel: 'VERIFIED'
      });
    }

    return motifs;
  }

  /**
   * Rigorous Sacrifice Classification & Bounded Tactical Lookahead
   * Distinguishes MATERIAL_LOSS, CANDIDATE_SACRIFICE, TACTICAL_SACRIFICE, POSITIONAL_SACRIFICE.
   */
  private static classifySacrifice(
    preFen: string,
    postFen: string,
    postGame: Chess,
    move: Move,
    moveNumber: number,
    moveColor: 'white' | 'black',
    prePos: PositionFingerprint,
    postPos: PositionFingerprint,
    futureMoves?: Move[]
  ): DetectedMotif[] {
    const motifs: DetectedMotif[] = [];
    const sideColor: Color = move.color;
    const oppColor: Color = sideColor === 'w' ? 'b' : 'w';
    const board = postGame.board();

    const movingPieceVal = PIECE_VALUES[move.piece];
    const capturedVal = move.captured ? PIECE_VALUES[move.captured] : 0;
    const [toR, toC] = this.squareToCoords(move.to);

    // Opponent attackers on destination square
    const oppAttackersOnTo = this.getAttackers(board, move.to, oppColor);
    const friendlyDefendersOnTo = this.getAttackers(board, move.to, sideColor);

    let isSacrificeOffer = false;
    let netLoss = 0;
    let sacrificeType: 'QUEEN' | 'EXCHANGE' | 'MINOR' | 'GENERIC' = 'GENERIC';

    // 1. Direct Unequal Trade on Defended Square (e.g. Rook takes Knight on defended square, Queen takes Rook)
    if (move.captured && movingPieceVal > capturedVal && oppAttackersOnTo.length > 0) {
      netLoss = movingPieceVal - capturedVal;
      isSacrificeOffer = true;
      if (move.piece === 'q') sacrificeType = 'QUEEN';
      else if (move.piece === 'r' && (move.captured === 'n' || move.captured === 'b')) sacrificeType = 'EXCHANGE';
      else if ((move.piece === 'b' || move.piece === 'n') && move.captured === 'p') sacrificeType = 'MINOR';
    }
    // 2. Moving Piece to Attacked Square where opponent can capture with lesser value or for free
    else if (!move.captured && oppAttackersOnTo.length > 0) {
      const minOppAttackerVal = Math.min(...oppAttackersOnTo.map(a => PIECE_VALUES[a.type]));
      if (minOppAttackerVal < movingPieceVal || oppAttackersOnTo.length > friendlyDefendersOnTo.length) {
        netLoss = movingPieceVal - (friendlyDefendersOnTo.length > 0 ? minOppAttackerVal : 0);
        if (netLoss >= 2) {
          isSacrificeOffer = true;
          if (move.piece === 'q') sacrificeType = 'QUEEN';
          else if (move.piece === 'r') sacrificeType = 'EXCHANGE';
          else if (move.piece === 'b' || move.piece === 'n') sacrificeType = 'MINOR';
        }
      }
    }

    if (!isSacrificeOffer) return motifs;

    // -------------------------------------------------------------------------
    // Bounded Tactical Lookahead: Test compensation & consequences
    // -------------------------------------------------------------------------
    let isTactical = false;
    let isPositional = false;
    let isMaterialLoss = false;
    let rationaleDetail = '';

    // A. Immediate Mate Check
    if (postGame.isCheckmate()) {
      isTactical = true;
      rationaleDetail = 'Delivers immediate terminal checkmate.';
    }

    // B. Historical game lookahead (if game record available)
    if (!isTactical && futureMoves && futureMoves.length > 0) {
      const nextMove = futureMoves[0];
      const nextNextMove = futureMoves[1];
      const afterThatMove = futureMoves[2];

      // Did opponent capture the offered piece?
      const pieceCapturedNext = nextMove && (
        nextMove.to === move.to || 
        nextMove.captured === move.piece
      );

      if (pieceCapturedNext) {
        // Test if sacrificing side executed mating sequence, gave check, or regained material
        const replay = new Chess(postFen);
        try {
          replay.move(nextMove);
          if (nextNextMove) {
            replay.move(nextNextMove);
            if (replay.isCheckmate()) {
              isTactical = true;
              rationaleDetail = `Forced mating continuation: ${nextNextMove.san} leads to checkmate.`;
            } else if (replay.inCheck()) {
              // Sacrifice immediately creates a checking attack against the opponent king
              isTactical = true;
              rationaleDetail = `Tactical attack: ${nextNextMove.san} delivers check against exposed king.`;
            } else if (nextNextMove.captured && PIECE_VALUES[nextNextMove.captured] >= netLoss) {
              isTactical = true;
              rationaleDetail = `Tactical recovery: ${nextNextMove.san} recovers ${PIECE_VALUES[nextNextMove.captured]} material.`;
            }
          }
          if (!isTactical && afterThatMove) {
            replay.move(afterThatMove);
            const postFp = this.analyzePosition(replay);
            const sideAdvantage = sideColor === 'w' ? postFp.materialBalance.diff : -postFp.materialBalance.diff;
            if (sideAdvantage >= 0) {
              isTactical = true;
              rationaleDetail = `Material fully recovered within 4 plies.`;
            }
          }
        } catch {
          // ignore parsing error
        }
      }
    }

    // C. Positional compensation criteria
    if (!isTactical) {
      const preShield = sideColor === 'w' ? prePos.kingSafety.blackPawnShield : prePos.kingSafety.whitePawnShield;
      const postShield = sideColor === 'w' ? postPos.kingSafety.blackPawnShield : postPos.kingSafety.whitePawnShield;
      if (preShield - postShield >= 1) {
        isPositional = true;
        rationaleDetail = 'Damaged opponent king pawn shield for attacking lines.';
      }
    }

    // D. Only classify as Material Loss if player made an unprovoked blunder without checks or king attack
    if (!isTactical && !isPositional && futureMoves && futureMoves.length > 0) {
      const nextMove = futureMoves[0];
      if (nextMove && (nextMove.to === move.to || nextMove.captured === move.piece)) {
        isMaterialLoss = true;
        rationaleDetail = `Material sacrificed (-${netLoss}) without proven tactical recovery.`;
      }
    }

    // -------------------------------------------------------------------------
    // Emit Strict Specific Classifications
    // -------------------------------------------------------------------------
    const isChecking = postGame.inCheck();

    if (isTactical) {
      motifs.push({
        motifName: 'Tactical Sacrifice',
        category: 'Sacrifice',
        moveNumber,
        color: moveColor,
        moveSan: move.san,
        fenPosition: postFen,
        materialChange: -netLoss,
        rationale: `${moveColor.toUpperCase()} executed verified Tactical Sacrifice with ${move.san}: ${rationaleDetail}`,
        confidence: 'EXACT',
        evidenceLevel: 'VERIFIED'
      });
    } else if (isPositional) {
      motifs.push({
        motifName: 'Positional Sacrifice',
        category: 'Sacrifice',
        moveNumber,
        color: moveColor,
        moveSan: move.san,
        fenPosition: postFen,
        materialChange: -netLoss,
        rationale: `${moveColor.toUpperCase()} invested material with ${move.san} for strategic compensation: ${rationaleDetail}`,
        confidence: 'RULE_BASED',
        evidenceLevel: 'CANDIDATE'
      });
    } else if (isMaterialLoss) {
      motifs.push({
        motifName: 'Material Loss',
        category: 'Tactical Error',
        moveNumber,
        color: moveColor,
        moveSan: move.san,
        fenPosition: postFen,
        materialChange: -netLoss,
        rationale: `Uncompensated material loss on move ${moveNumber} with ${move.san}: ${rationaleDetail}`,
        confidence: 'RULE_BASED',
        evidenceLevel: 'VERIFIED'
      });
    } else {
      motifs.push({
        motifName: 'Candidate Sacrifice',
        category: 'Sacrifice',
        moveNumber,
        color: moveColor,
        moveSan: move.san,
        fenPosition: postFen,
        materialChange: -netLoss,
        rationale: `${moveColor.toUpperCase()} offered candidate material investment with ${move.san}.`,
        confidence: 'RULE_BASED',
        evidenceLevel: 'CANDIDATE'
      });
    }

    // Always emit specific piece sacrifice subtype when a Queen/Rook/Minor sacrifice is offered
    if (sacrificeType === 'QUEEN') {
      motifs.push({
        motifName: 'Queen Sacrifice',
        category: 'Sacrifice',
        moveNumber,
        color: moveColor,
        moveSan: move.san,
        fenPosition: postFen,
        materialChange: -netLoss,
        rationale: `${moveColor.toUpperCase()} sacrificed the Queen with ${move.san} (${rationaleDetail || 'decisive attack'}).`,
        confidence: isTactical ? 'EXACT' : 'RULE_BASED',
        evidenceLevel: isTactical ? 'VERIFIED' : 'CANDIDATE'
      });
    } else if (sacrificeType === 'EXCHANGE') {
      motifs.push({
        motifName: 'Exchange Sacrifice',
        category: 'Sacrifice',
        moveNumber,
        color: moveColor,
        moveSan: move.san,
        fenPosition: postFen,
        materialChange: -netLoss,
        rationale: `${moveColor.toUpperCase()} sacrificed the Exchange with ${move.san} (${rationaleDetail || 'positional advantage'}).`,
        confidence: isTactical ? 'EXACT' : 'RULE_BASED',
        evidenceLevel: isTactical ? 'VERIFIED' : 'CANDIDATE'
      });
    } else if (sacrificeType === 'MINOR') {
      motifs.push({
        motifName: 'Minor Piece Sacrifice',
        category: 'Sacrifice',
        moveNumber,
        color: moveColor,
        moveSan: move.san,
        fenPosition: postFen,
        materialChange: -netLoss,
        rationale: `${moveColor.toUpperCase()} sacrificed Minor Piece on ${move.to} with ${move.san} (${rationaleDetail || 'attacking initiative'}).`,
        confidence: isTactical ? 'EXACT' : 'RULE_BASED',
        evidenceLevel: isTactical ? 'VERIFIED' : 'CANDIDATE'
      });
    }

    if (isChecking && (isTactical || isPositional || !isMaterialLoss)) {
      motifs.push({
        motifName: 'Checking Sacrifice',
        category: 'Sacrifice',
        moveNumber,
        color: moveColor,
        moveSan: move.san,
        fenPosition: postFen,
        materialChange: -netLoss,
        rationale: `${moveColor.toUpperCase()} delivered Checking Sacrifice with ${move.san}.`,
        confidence: isTactical ? 'EXACT' : 'RULE_BASED',
        evidenceLevel: isTactical ? 'VERIFIED' : 'CANDIDATE'
      });
    }

    return motifs;
  }

  /**
   * Diagnostic Mode: Detailed move-by-move inspection and explanation
   */
  public static getDiagnostic(
    fenBefore: string,
    moveSanOrUci: string,
    gameId?: number,
    ply: number = 1
  ): MoveDiagnostic | null {
    const game = new Chess(fenBefore);
    let move: Move | null = null;

    try {
      move = game.move(moveSanOrUci);
    } catch {
      return null;
    }

    if (!move) return null;

    const fenAfter = game.fen();
    const sideToMove = move.color === 'w' ? 'white' : 'black';
    const prePos = this.analyzePosition(new Chess(fenBefore));
    const postPos = this.analyzePosition(game);

    const isCheck = game.inCheck();
    const isCheckmate = game.isCheckmate();

    let isDoubleCheck = false;
    let isDiscoveredCheck = false;

    if (isCheck && !isCheckmate) {
      const oppColor: Color = move.color === 'w' ? 'b' : 'w';
      const board = game.board();
      let oppKingSq: Square = 'e8';
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const p = board[r][c];
          if (p && p.color === oppColor && p.type === 'k') oppKingSq = p.square;
        }
      }
      const checkers = this.getAttackers(board, oppKingSq, move.color);
      if (checkers.length >= 2) isDoubleCheck = true;
      else if (checkers.length === 1 && checkers[0].square !== move.to) isDiscoveredCheck = true;
    }

    const moveNumber = Math.floor(ply / 2) + 1;
    const motifs = this.detectMoveMotifs(
      game,
      move,
      moveNumber,
      sideToMove,
      prePos,
      postPos,
      fenBefore,
      fenAfter
    );

    const matDelta = (sideToMove === 'white' ? postPos.materialBalance.diff : -postPos.materialBalance.diff) -
                     (sideToMove === 'white' ? prePos.materialBalance.diff : -prePos.materialBalance.diff);

    const evidenceSummary = motifs.map(m => `[${m.evidenceLevel || 'CANDIDATE'}] ${m.motifName}: ${m.rationale}`);

    const primaryEvidence: EvidenceLevel = motifs.some(m => m.evidenceLevel === 'VERIFIED')
      ? 'VERIFIED'
      : motifs.some(m => m.evidenceLevel === 'CANDIDATE')
      ? 'CANDIDATE'
      : 'GEOMETRIC';

    const attackedTargets: Array<{ square: string; piece: string; value: number }> = [];
    const board = game.board();
    const oppColor: Color = move.color === 'w' ? 'b' : 'w';
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (p && p.color === oppColor) {
          const atks = this.getAttackers(board, p.square, move.color);
          if (atks.some(a => a.square === move.to)) {
            attackedTargets.push({ square: p.square, piece: p.type.toUpperCase(), value: PIECE_VALUES[p.type] });
          }
        }
      }
    }

    return {
      gameId,
      ply,
      fenBefore,
      fenAfter,
      san: move.san,
      uci: `${move.from}${move.to}${move.promotion || ''}`,
      sideToMove,
      materialBalanceBefore: prePos.materialBalance,
      materialBalanceAfter: postPos.materialBalance,
      materialDeltaForSide: matDelta,
      isCheck,
      isCheckmate,
      isDoubleCheck,
      isDiscoveredCheck,
      attackedTargets,
      motifs,
      evidenceSummary,
      searchDepth: 4,
      confidence: primaryEvidence === 'VERIFIED' ? 'EXACT' : 'RULE_BASED',
      evidenceLevel: primaryEvidence
    };
  }
}
