/**
 * ChessBase Tactical Fingerprint Engine
 * DBMS Experiential Learning - Level 3 Project
 * Authors: Raghav Budur (PES1UG23AM225) & Prithviraj K (PES1UG24AM204)
 * 
 * 100% Deterministic Chess Rules & Board-State Analysis Engine.
 * NO LLM or probabilistic model used for tactical detection.
 */

import { Chess, Square, PieceSymbol, Color, Move } from 'chess.js';

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
  category: 'Sacrifice' | 'Attack' | 'Pin/Skewer' | 'Fork' | 'Structural' | 'Endgame';
  moveNumber: number;
  color: 'white' | 'black';
  moveSan: string;
  fenPosition: string;
  materialChange: number;
  rationale: string;
  confidence: 'EXACT' | 'RULE_BASED' | 'HEURISTIC';
}

export interface GameFingerprintResult {
  fingerprints: PositionFingerprint[];
  detectedMotifs: DetectedMotif[];
  summarySignature: Record<string, number>; // motifName -> count
}

const PIECE_VALUES: Record<PieceSymbol, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0
};

export class TacticalFingerprintEngine {
  /**
   * Calculate static deterministic position fingerprint
   */
  public static analyzePosition(chess: Chess): PositionFingerprint {
    const fen = chess.fen();
    const sideToMove = chess.turn() === 'w' ? 'white' : 'black';
    const board = chess.board();

    let whiteMaterial = 0;
    let blackMaterial = 0;
    let whitePawns: Square[] = [];
    let blackPawns: Square[] = [];
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

    // King castling flags from FEN
    const fenParts = fen.split(' ');
    const castlingStr = fenParts[2] || '-';
    const castlingRights = {
      whiteKingside: castlingStr.includes('K'),
      whiteQueenside: castlingStr.includes('Q'),
      blackKingside: castlingStr.includes('k'),
      blackQueenside: castlingStr.includes('q')
    };

    // King safety & Pawn shield
    // White king file & rank
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

    // Opposite side castling: one king on c/b/a-file (queenside) and other on g/h-file (kingside)
    const whiteCastledQueenside = wKingFile <= 2;
    const whiteCastledKingside = wKingFile >= 5;
    const blackCastledQueenside = bKingFile <= 2;
    const blackCastledKingside = bKingFile >= 5;
    const oppositeSideCastling = (whiteCastledQueenside && blackCastledKingside) || (whiteCastledKingside && blackCastledQueenside);

    // Pawn storms: white pawns advanced on files f, g, h past rank 4 while black king is kingside
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
    try {
      game.loadPgn(pgn);
    } catch {
      return { fingerprints: [], detectedMotifs: [], summarySignature: {} };
    }

    const history = game.history({ verbose: true });
    const replay = new Chess();
    const fingerprints: PositionFingerprint[] = [];
    const detectedMotifs: DetectedMotif[] = [];
    const summarySignature: Record<string, number> = {};

    let prevMaterial = { white: 39, black: 39 };

    for (let i = 0; i < history.length; i++) {
      const move = history[i];
      const moveColor = move.color === 'w' ? 'white' : 'black';
      const moveNumber = Math.floor(i / 2) + 1;

      // Position before move
      const preMoveFen = replay.fen();
      const preMovePosition = this.analyzePosition(replay);

      // Execute move
      replay.move(move);
      const postMoveFen = replay.fen();
      const postMovePosition = this.analyzePosition(replay);
      fingerprints.push(postMovePosition);

      // Lookahead to next move for sacrifice validation
      const nextMove = i + 1 < history.length ? history[i + 1] : null;

      // Detect Motifs for this move
      const motifs = this.detectMoveMotifs(replay, move, moveNumber, moveColor, preMovePosition, postMovePosition, preMoveFen, postMoveFen, nextMove);

      for (const m of motifs) {
        detectedMotifs.push(m);
        summarySignature[m.motifName] = (summarySignature[m.motifName] || 0) + 1;
      }
    }

    return { fingerprints, detectedMotifs, summarySignature };
  }

  /**
   * Rule-based detector for individual move
   */
  private static detectMoveMotifs(
    game: Chess,
    move: Move,
    moveNumber: number,
    moveColor: 'white' | 'black',
    prePos: PositionFingerprint,
    postPos: PositionFingerprint,
    preFen: string,
    postFen: string,
    nextMove?: Move | null
  ): DetectedMotif[] {
    const motifs: DetectedMotif[] = [];
    const oppColor = moveColor === 'white' ? 'black' : 'white';

    // 1. Checkmate
    if (game.isCheckmate()) {
      motifs.push({
        motifName: 'Checkmate Attack',
        category: 'Attack',
        moveNumber,
        color: moveColor,
        moveSan: move.san,
        fenPosition: postFen,
        materialChange: 0,
        rationale: `${moveColor.toUpperCase()} executed terminal checkmate on move ${moveNumber} with ${move.san}.`,
        confidence: 'EXACT'
      });
    }

    // 2. Discovered Check / Double Check
    if (game.inCheck() && !game.isCheckmate()) {
      // Check if the moving piece is giving the check or if another sliding piece unmasked it
      const movingPieceType = move.piece;
      // If moving piece doesn't directly hit king, it's discovered check
      if (move.san.includes('#')) {
        // Handled in checkmate
      } else if (move.san.includes('+')) {
        // Check for double check (marked by ++ in some notations or multiple checkers)
        motifs.push({
          motifName: 'Check / Discovered Check',
          category: 'Attack',
          moveNumber,
          color: moveColor,
          moveSan: move.san,
          fenPosition: postFen,
          materialChange: 0,
          rationale: `${moveColor.toUpperCase()} delivered check with ${move.san}.`,
          confidence: 'EXACT'
        });
      }
    }

    // 3. Material Sacrifices
    // Queen Sacrifice: Player moves Queen, and on the immediate next move the Queen is captured
    if (move.piece === 'q') {
      const queenCapturedNext = nextMove && (nextMove.captured === 'q' || nextMove.to === move.to);
      if (queenCapturedNext) {
        const materialGained = move.captured ? PIECE_VALUES[move.captured] : 0;
        if (materialGained < 9) {
          motifs.push({
            motifName: 'Queen Sacrifice',
            category: 'Sacrifice',
            moveNumber,
            color: moveColor,
            moveSan: move.san,
            fenPosition: postFen,
            materialChange: materialGained - 9,
            rationale: `${moveColor.toUpperCase()} sacrificed the Queen with ${move.san} for initiative (material change: ${materialGained - 9}).`,
            confidence: 'EXACT'
          });
        }
      }
    }

    // Rook Exchange Sacrifice (Rook given for Knight or Bishop)
    if (move.piece === 'r' && move.captured && (move.captured === 'n' || move.captured === 'b')) {
      motifs.push({
        motifName: 'Exchange Sacrifice',
        category: 'Sacrifice',
        moveNumber,
        color: moveColor,
        moveSan: move.san,
        fenPosition: postFen,
        materialChange: -2,
        rationale: `${moveColor.toUpperCase()} traded Rook (5) for Minor Piece (${move.captured.toUpperCase()}=3) to seize initiative.`,
        confidence: 'EXACT'
      });
    }

    // Minor Piece Sacrifice (Bishop/Knight for pawns or attack)
    if (move.piece === 'b' || move.piece === 'n') {
      const pieceCapturedNext = nextMove && (nextMove.captured === move.piece || nextMove.to === move.to);
      if (pieceCapturedNext) {
        const gained = move.captured ? PIECE_VALUES[move.captured] : 0;
        if (gained < 3) {
          motifs.push({
            motifName: 'Minor Piece Sacrifice',
            category: 'Sacrifice',
            moveNumber,
            color: moveColor,
            moveSan: move.san,
            fenPosition: postFen,
            materialChange: gained - 3,
            rationale: `${moveColor.toUpperCase()} sacrificed ${move.piece.toUpperCase()} on ${move.to} with ${move.san} to break defenses (material change: ${gained - 3}).`,
            confidence: 'EXACT'
          });
        }
      } else if (move.captured === 'p') {
        motifs.push({
          motifName: 'Minor Piece Sacrifice',
          category: 'Sacrifice',
          moveNumber,
          color: moveColor,
          moveSan: move.san,
          fenPosition: postFen,
          materialChange: -2,
          rationale: `${moveColor.toUpperCase()} sacrificed ${move.piece.toUpperCase()} on ${move.to} for pawn to break defenses.`,
          confidence: 'RULE_BASED'
        });
      }
    }

    // 4. Knight Fork / Multi-target Fork
    if (move.piece === 'n') {
      const attackedSquares = this.getAttackedSquaresByKnight(move.to);
      const highValueTargets: string[] = [];
      const board = game.board();

      for (const sq of attackedSquares) {
        const file = sq.charCodeAt(0) - 97;
        const rank = 8 - parseInt(sq[1], 10);
        const targetPiece = board[rank]?.[file];
        if (targetPiece && targetPiece.color !== move.color && ['k', 'q', 'r'].includes(targetPiece.type)) {
          highValueTargets.push(`${targetPiece.type.toUpperCase()} on ${sq}`);
        }
      }

      if (highValueTargets.length >= 2) {
        motifs.push({
          motifName: 'Knight Fork',
          category: 'Fork',
          moveNumber,
          color: moveColor,
          moveSan: move.san,
          fenPosition: postFen,
          materialChange: 0,
          rationale: `Knight on ${move.to} forks ${highValueTargets.join(' and ')}.`,
          confidence: 'EXACT'
        });
      }
    }

    // 5. Pawn Storm & Opposite-Side Castling Attack
    if (postPos.kingSafety.oppositeSideCastling) {
      if (move.piece === 'p' && (postPos.pawnStructure.isPawnStormKingside || postPos.pawnStructure.isPawnStormQueenside)) {
        motifs.push({
          motifName: 'Pawn Storm Attack',
          category: 'Attack',
          moveNumber,
          color: moveColor,
          moveSan: move.san,
          fenPosition: postFen,
          materialChange: 0,
          rationale: `Opposite-side castling pawn advance: ${moveColor.toUpperCase()} launches pawn storm with ${move.san}.`,
          confidence: 'RULE_BASED'
        });
      }
    }

    // 6. Pawn Promotion / Promotion Threat
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
        confidence: 'EXACT'
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
        rationale: `Pawn reached penultimate rank (${move.to}), creating immediate promotion threat.`,
        confidence: 'EXACT'
      });
    }

    // 7. Pin / Skewer Detection (Bishop or Rook alignment with King/Queen)
    if (['b', 'r', 'q'].includes(move.piece)) {
      const pinMotif = this.detectPinOrSkewer(game, move, moveNumber, moveColor, postFen);
      if (pinMotif) motifs.push(pinMotif);
    }

    return motifs;
  }

  /**
   * Helper: Calculate squares attacked by knight at square
   */
  private static getAttackedSquaresByKnight(sq: Square): Square[] {
    const file = sq.charCodeAt(0) - 97;
    const rank = parseInt(sq[1], 10);
    const knightDeltas = [
      [1, 2], [2, 1], [-1, 2], [-2, 1],
      [1, -2], [2, -1], [-1, -2], [-2, -1]
    ];
    const squares: Square[] = [];
    for (const [df, dr] of knightDeltas) {
      const nf = file + df;
      const nr = rank + dr;
      if (nf >= 0 && nf < 8 && nr >= 1 && nr <= 8) {
        squares.push(`${String.fromCharCode(97 + nf)}${nr}` as Square);
      }
    }
    return squares;
  }

  /**
   * Helper: Detect Pin or Skewer along ray
   */
  private static detectPinOrSkewer(
    game: Chess,
    move: Move,
    moveNumber: number,
    moveColor: 'white' | 'black',
    postFen: string
  ): DetectedMotif | null {
    const board = game.board();
    const moveSqFile = move.to.charCodeAt(0) - 97;
    const moveSqRank = 8 - parseInt(move.to[1], 10);

    // Directions for bishop/queen (diagonals) and rook/queen (orthogonals)
    const deltas = [];
    if (['b', 'q'].includes(move.piece)) {
      deltas.push([1, 1], [1, -1], [-1, 1], [-1, -1]);
    }
    if (['r', 'q'].includes(move.piece)) {
      deltas.push([1, 0], [-1, 0], [0, 1], [0, -1]);
    }

    for (const [dr, dc] of deltas) {
      let r = moveSqRank + dr;
      let c = moveSqFile + dc;
      let firstPiece = null;
      let secondPiece = null;

      while (r >= 0 && r < 8 && c >= 0 && c < 8) {
        const p = board[r][c];
        if (p) {
          if (!firstPiece) {
            firstPiece = p;
          } else if (!secondPiece) {
            secondPiece = p;
            break;
          }
        }
        r += dr;
        c += dc;
      }

      if (firstPiece && secondPiece && firstPiece.color !== move.color && secondPiece.color !== move.color) {
        // Pin: First piece is lesser value (e.g. Knight/Bishop/Rook) shielding King or Queen
        if (secondPiece.type === 'k' || (secondPiece.type === 'q' && firstPiece.type !== 'q')) {
          return {
            motifName: secondPiece.type === 'k' ? 'Absolute Pin on King' : 'Relative Pin on Queen',
            category: 'Pin/Skewer',
            moveNumber,
            color: moveColor,
            moveSan: move.san,
            fenPosition: postFen,
            materialChange: 0,
            rationale: `${move.piece.toUpperCase()} pins ${firstPiece.type.toUpperCase()} against ${secondPiece.type.toUpperCase()} along the line.`,
            confidence: 'RULE_BASED'
          };
        }
        // Skewer: Higher value piece in front of lower value piece
        if (PIECE_VALUES[firstPiece.type] > PIECE_VALUES[secondPiece.type] && ['k', 'q', 'r'].includes(firstPiece.type)) {
          return {
            motifName: 'Skewer Attack',
            category: 'Pin/Skewer',
            moveNumber,
            color: moveColor,
            moveSan: move.san,
            fenPosition: postFen,
            materialChange: 0,
            rationale: `${move.piece.toUpperCase()} skewers ${firstPiece.type.toUpperCase()} forcing it to yield ${secondPiece.type.toUpperCase()}.`,
            confidence: 'RULE_BASED'
          };
        }
      }
    }

    return null;
  }
}

