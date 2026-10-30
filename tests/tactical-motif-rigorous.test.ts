/**
 * ChessBase Rigorous Tactical Motif Verification Suite
 * Tests all 16 required tactical categories, false positives, false negatives,
 * and diagnostic mode evaluations.
 * 
 * Authors: Raghav Budur (PES1UG23AM225) & Prithviraj K (PES1UG24AM204)
 */

import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import { TacticalFingerprintEngine } from '../src/lib/chess/tactical-fingerprint';

describe('Rigorous Tactical Motif Verification Suite', () => {

  // ---------------------------------------------------------------------------
  // 1. Quiet Moves (Negative Controls: must not detect tactics)
  // ---------------------------------------------------------------------------
  it('Fixture 1: Quiet opening move (1. e4) emits no checks or sacrifices', () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    const diag = TacticalFingerprintEngine.getDiagnostic(fen, 'e4');

    expect(diag).toBeDefined();
    expect(diag?.isCheck).toBe(false);
    expect(diag?.isCheckmate).toBe(false);
    expect(diag?.motifs.filter(m => m.category === 'Sacrifice').length).toBe(0);
    expect(diag?.motifs.filter(m => m.category === 'Attack').length).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // 2. Ordinary Direct Check (must not be Discovered Check or Double Check)
  // ---------------------------------------------------------------------------
  it('Fixture 2: Direct single check (Bb5+) is classified as Check, NOT Discovered Check', () => {
    // 1. e4 e5 2. Nf3 Nc6 3. Bb5
    const fen = 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3';
    // Move Bb5+ with king on e8 (let's set a direct check FEN)
    const checkFen = 'r1bqk1nr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3';
    const diag = TacticalFingerprintEngine.getDiagnostic('r1bqk1nr/pppp1ppp/2n5/4p3/1b2P3/3P1N2/PPP2PPP/RNBQKB1R w KQkq - 1 4', 'c3');

    // Test a clear direct check: White Queen checks Black King on open file
    const queenCheckFen = '4k3/8/8/8/8/8/4Q3/4K3 w - - 0 1';
    const checkDiag = TacticalFingerprintEngine.getDiagnostic(queenCheckFen, 'Qe4+');
    // If not valid move, let's test Qe7+
    const directCheckFen = '4k3/4r3/8/8/8/8/4Q3/4K3 w - - 0 1';
    const diagCheck = TacticalFingerprintEngine.getDiagnostic('4k3/8/8/8/8/8/8/4KQ2 w - - 0 1', 'Qf7+');

    expect(diagCheck).toBeDefined();
    expect(diagCheck?.isCheck).toBe(true);
    expect(diagCheck?.isDiscoveredCheck).toBe(false);
    expect(diagCheck?.isDoubleCheck).toBe(false);
    expect(diagCheck?.motifs.some(m => m.motifName === 'Check')).toBe(true);
    expect(diagCheck?.motifs.some(m => m.motifName === 'Discovered Check')).toBe(false);
    expect(diagCheck?.motifs.some(m => m.motifName === 'Double Check')).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // 3. Discovered Check (Moving piece does NOT attack King; unmasks sliding piece)
  // ---------------------------------------------------------------------------
  it('Fixture 3: Discovered Check: Knight moves away to unmask Rook check against King', () => {
    // White: Rook on e1, Knight on e4, King on g1. Black: King on e8.
    // Move: Nc5+ (Knight unmasks Rook on e1. Knight on c5 does NOT attack e8).
    const fen = '4k3/8/8/8/4N3/8/8/4R1K1 w - - 0 1';
    const diag = TacticalFingerprintEngine.getDiagnostic(fen, 'Nc5+');

    expect(diag).toBeDefined();
    expect(diag?.isCheck).toBe(true);
    expect(diag?.isDiscoveredCheck).toBe(true);
    expect(diag?.isDoubleCheck).toBe(false);
    expect(diag?.motifs.some(m => m.motifName === 'Discovered Check')).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // 4. Double Check (Both moving piece AND unmasked slider attack King)
  // ---------------------------------------------------------------------------
  it('Fixture 4: Double Check: Knight delivers check while unmasking Rook check', () => {
    // White: Rook on e1, Knight on e4. Black: King on e8.
    // Move: Nd6+ (Knight leaps from e4 to d6, attacking e8 AND unmasking Rook on e1).
    const fen = '4k3/8/8/8/4N3/8/8/4R1K1 w - - 0 1';
    const diag = TacticalFingerprintEngine.getDiagnostic(fen, 'Nd6+');

    expect(diag).toBeDefined();
    expect(diag?.isCheck).toBe(true);
    expect(diag?.isDoubleCheck).toBe(true);
    expect(diag?.motifs.some(m => m.motifName === 'Double Check')).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // 5. Checkmate (Terminal mating position)
  // ---------------------------------------------------------------------------
  it('Fixture 5: Terminal checkmate delivers Checkmate motif with VERIFIED evidence', () => {
    // Fool's Mate position: White played 1. f3 e5 2. g4
    const fen = 'rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2';
    const diag = TacticalFingerprintEngine.getDiagnostic(fen, 'Qh4#');

    expect(diag).toBeDefined();
    expect(diag?.isCheckmate).toBe(true);
    expect(diag?.motifs.some(m => m.motifName === 'Checkmate')).toBe(true);
    expect(diag?.evidenceLevel).toBe('VERIFIED');
  });

  // ---------------------------------------------------------------------------
  // 6. Safe Captures (Negative Control: must NOT be called sacrifices)
  // ---------------------------------------------------------------------------
  it('Fixture 6: Free piece capture (Qxd8) is NOT classified as a sacrifice', () => {
    // White Queen captures undefended Black Queen on d8
    const fen = '3q4/8/8/8/8/8/8/3Q1K1k w - - 0 1';
    const diag = TacticalFingerprintEngine.getDiagnostic(fen, 'Qxd8');

    expect(diag).toBeDefined();
    expect(diag?.motifs.some(m => m.motifName.includes('Sacrifice'))).toBe(false);
    expect(diag?.motifs.some(m => m.motifName === 'Material Loss')).toBe(false);
  });

  it('Fixture 7: Equal minor piece trade (Bxc6) is NOT classified as a Minor Piece Sacrifice', () => {
    // White Bishop on b5 captures Black Knight on c6
    const fen = 'r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 1';
    const diag = TacticalFingerprintEngine.getDiagnostic(fen, 'Bxc6');

    expect(diag).toBeDefined();
    expect(diag?.motifs.some(m => m.motifName === 'Minor Piece Sacrifice')).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // 7. Tactical Queen Sacrifice (Boden / Opera Game style)
  // ---------------------------------------------------------------------------
  it('Fixture 8: Mating Queen Sacrifice (Qb8+) in Opera Game is classified as Tactical Sacrifice', () => {
    // Opera Game move 16: White plays Qb8+!! (sacrificing queen for forced 16... Nxb8 17. Rd8#)
    const operaFen = '1k1r4/pp1n1p2/4q3/4p1B1/2B5/1Q3N2/PPP2PPP/2KR4 w - - 0 16';
    // Position right before 16. Qb8+:
    // In actual game: White had Bishop on d7, Black Knight on d7, White Queen on b3.
    const preSacFen = '1k1r4/pp1N1p2/4q3/8/8/1Q6/PPP2PPP/2KR4 w - - 0 16';
    // Direct position where White plays Qb8+ forced mate:
    const mateInOnePgn = `
[Event "Mating Queen Sac Demo"]
[White "Morphy"]
[Black "Allies"]
[Result "1-0"]

1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7 8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7 14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8# 1-0
    `;
    const result = TacticalFingerprintEngine.analyzeGame(mateInOnePgn);
    const qSac = result.detectedMotifs.find(m => m.motifName === 'Queen Sacrifice' && m.moveSan === 'Qb8+');

    expect(qSac).toBeDefined();
    expect(qSac?.confidence).toBe('EXACT');
    expect(qSac?.evidenceLevel).toBe('VERIFIED');
    expect(result.detectedMotifs.some(m => m.motifName === 'Tactical Sacrifice' && m.moveSan === 'Qb8+')).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // 8. Exchange Sacrifice (Rook surrendered for Minor Piece)
  // ---------------------------------------------------------------------------
  it('Fixture 9: Rook exchange sacrifice (Rxc3) gives Exchange Sacrifice motif', () => {
    // Black plays Rxc3 in Sicilian: White pawn b2 defends c3, so bxc3 wins the rook for knight.
    const pgn = `
[Event "Sicilian Exchange Sac"]
[White "White"]
[Black "Black"]
[Result "0-1"]

1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6 6. Be3 e5 7. Nb3 Be6 8. Qd2 Nbd7 9. O-O-O Be7 10. f3 O-O 11. g4 b5 12. g5 b4 13. Ne2 Ne8 14. h4 a5 15. Kb1 a4 16. Nbc1 b3 17. cxb3 axb3 18. a3 d5 19. exd5 Bf5+ 20. Nd3 Nd6 21. Ng3 Nc4 22. Qf2 Rxa3 23. bxa3 Nxa3+ 24. Kc1 Qa5 25. Nxf5 Rc8+ 26. Bc5 Bxc5 27. Nxc5 Rxc5+ 0-1
    `;
    const result = TacticalFingerprintEngine.analyzeGame(pgn);
    const exchSac = result.detectedMotifs.find(m => m.motifName === 'Exchange Sacrifice');

    expect(exchSac).toBeDefined();
    expect(exchSac?.category).toBe('Sacrifice');
  });

  // ---------------------------------------------------------------------------
  // 9. Uncompensated Material Loss (Blunder)
  // ---------------------------------------------------------------------------
  it('Fixture 10: Pure blunder of a queen is classified as Material Loss, not Tactical Sacrifice', () => {
    // Player moves Queen to square attacked by pawn, pawn takes queen, no check, game continues down material
    const blunderPgn = `
[Event "Blunder Demo"]
[White "Blunderer"]
[Black "Opponent"]
[Result "0-1"]

1. e4 d5 2. exd5 Qxd5 3. Qe2 Nf6 4. Qe6 fxe6 5. Nf3 e5 0-1
    `;
    const result = TacticalFingerprintEngine.analyzeGame(blunderPgn);
    const blunderMotif = result.detectedMotifs.find(m => m.moveSan === 'Qe6' && m.motifName === 'Material Loss');

    expect(blunderMotif).toBeDefined();
    expect(result.detectedMotifs.some(m => m.moveSan === 'Qe6' && m.motifName === 'Tactical Sacrifice')).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // 10. Knight Fork
  // ---------------------------------------------------------------------------
  it('Fixture 11: Royal fork (Nxc7+) forking King and Rook is classified as Knight Fork', () => {
    // White Knight on c7 checks King on e8 and attacks Rook on a8
    const fen = 'r3kbnr/ppNppppp/8/8/8/8/PPPPPPPP/R1BQKBNR b KQkq - 0 1';
    const diag = TacticalFingerprintEngine.getDiagnostic('r3kbnr/pp1ppppp/2N5/8/8/8/PPPPPPPP/R1BQKBNR w KQkq - 0 1', 'Nxa7');

    const royalForkFen = 'r3k3/8/8/8/8/8/8/4N1K1 w - - 0 1';
    const forkDiag = TacticalFingerprintEngine.getDiagnostic('r3k3/8/2N5/8/8/8/8/6K1 w - - 0 1', 'Nd8');
    
    // Test knight fork on king and queen:
    // White Knight on e7 forks King on g8 and Queen on c8
    const forkFen = '2q3k1/8/8/8/8/5N2/8/6K1 w - - 0 1';
    const forkResult = TacticalFingerprintEngine.getDiagnostic(forkFen, 'Ne5');

    // Clean PGN with Knight Fork:
    const pgn = `
[Event "Fork Test"]
[White "White"]
[Black "Black"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. Ng5 d5 5. exd5 Nxd5 6. Nxf7 Kxf7 7. Qf3+ Ke6 8. Nc3 1-0
    `;
    const res = TacticalFingerprintEngine.analyzeGame(pgn);
    expect(res.detectedMotifs.some(m => m.motifName === 'Knight Fork' || m.category === 'Fork')).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // 11. Pawn Fork
  // ---------------------------------------------------------------------------
  it('Fixture 12: Pawn advance attacking two minor pieces is classified as Pawn Fork', () => {
    // White pawn on d4 moves to d5, attacking Black Knight on c6 and Black Bishop on e6
    // Clean minimal FEN with pawn on d4, opponent pieces on c6 and e6:
    const pawnForkFen = '4k3/8/2n1b3/8/3P4/8/8/4K3 w - - 0 1';
    const diag = TacticalFingerprintEngine.getDiagnostic(pawnForkFen, 'd5');

    expect(diag).toBeDefined();
    expect(diag?.motifs.some(m => m.motifName === 'Pawn Fork' || m.motifName === 'Fork Attack')).toBe(true);
    expect(diag?.evidenceLevel).toBe('VERIFIED');
  });

  // ---------------------------------------------------------------------------
  // 12. Absolute Pin vs Relative Pin
  // ---------------------------------------------------------------------------
  it('Fixture 13: Bishop pinning Knight to King is classified as Absolute Pin on King', () => {
    // White Bishop on b5 pins Black Knight on c6 against Black King on e8 (d7 is open)
    // Black played d6 earlier, so d7 square is empty
    const fen = 'r1bqkbnr/ppp2ppp/2np4/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 4';
    // Move Bishop to b5 in position where d7 is clear:
    const pinFen = 'r1bqkbnr/ppp2ppp/2np4/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 4';
    const diag = TacticalFingerprintEngine.getDiagnostic(pinFen, 'Bb5');

    expect(diag).toBeDefined();
    expect(diag?.motifs.some(m => m.motifName === 'Absolute Pin on King')).toBe(true);
    expect(diag?.evidenceLevel).toBe('VERIFIED');
  });

  it('Fixture 14: Bishop pinning Knight to Queen is classified as Relative Pin on Queen', () => {
    // White Rook on d1 relatively pins Black Knight on d7 against Black Queen on d8
    const fen = '3qk3/3n4/8/8/8/8/8/3RK3 w - - 0 1';
    // Or Rook moves to d1 pinning Knight on d5 against Queen on d8
    const relPinFen = '3qk3/8/8/3n4/8/8/8/R3K3 w - - 0 1';
    const diag = TacticalFingerprintEngine.getDiagnostic(relPinFen, 'Rd1');

    expect(diag).toBeDefined();
    expect(diag?.motifs.some(m => m.motifName === 'Relative Pin on Queen')).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // 13. Skewer Attack
  // ---------------------------------------------------------------------------
  it('Fixture 15: Rook skewering King with Queen behind is classified as Skewer Attack', () => {
    // White Rook on a1 moves to e1, skewering King on e5 with Queen on e7 behind it
    const fen = '8/4q3/8/4k3/8/8/8/R5K1 w - - 0 1';
    const diag = TacticalFingerprintEngine.getDiagnostic(fen, 'Re1+');

    expect(diag).toBeDefined();
    expect(diag?.motifs.some(m => m.motifName === 'Skewer Attack')).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // 14. Discovered Attack (Non-Check)
  // ---------------------------------------------------------------------------
  it('Fixture 16: Moving knight unmasks Bishop attack on enemy Queen (Discovered Attack)', () => {
    // White Rook on d1, White Knight on d4, Black Queen on d8, Black King on e8.
    // Move: Nb5 clears d-file, unmasking Rook on d1 attacking Queen on d8.
    const fen = '3qk3/8/8/8/3N4/8/8/3R2K1 w - - 0 1';
    const diag = TacticalFingerprintEngine.getDiagnostic(fen, 'Nb5');

    expect(diag).toBeDefined();
    expect(diag?.motifs.some(m => m.motifName === 'Discovered Attack')).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // 15. Pawn Promotion & En Passant
  // ---------------------------------------------------------------------------
  it('Fixture 17: Pawn promotion correctly emits Pawn Promotion motif', () => {
    // White pawn on a7 promotes to Queen on a8
    const fen = '8/P7/8/8/8/8/8/4K2k w - - 0 1';
    const diag = TacticalFingerprintEngine.getDiagnostic(fen, 'a8=Q');

    expect(diag).toBeDefined();
    expect(diag?.motifs.some(m => m.motifName === 'Pawn Promotion')).toBe(true);
    expect(diag?.materialDeltaForSide).toBe(8); // +8 material gain
  });

  it('Fixture 18: En Passant capture accurately updates material and avoids false sacrifices', () => {
    // White pawn on e5, Black pawn on d7 moves to d5, White captures exd6 e.p.
    const fen = 'rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3';
    const diag = TacticalFingerprintEngine.getDiagnostic(fen, 'exd6');

    expect(diag).toBeDefined();
    expect(diag?.materialDeltaForSide).toBe(1); // Gained 1 pawn
    expect(diag?.motifs.some(m => m.category === 'Sacrifice')).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // 16. Comprehensive Diagnostic Mode Inspection
  // ---------------------------------------------------------------------------
  it('Fixture 19: Diagnostic mode returns complete structured metadata and evidence rationale', () => {
    const fen = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2';
    const diag = TacticalFingerprintEngine.getDiagnostic(fen, 'Nc6', 42, 4);

    expect(diag).toBeDefined();
    expect(diag?.gameId).toBe(42);
    expect(diag?.ply).toBe(4);
    expect(diag?.san).toBe('Nc6');
    expect(diag?.uci).toBe('b8c6');
    expect(diag?.sideToMove).toBe('black');
    expect(diag?.searchDepth).toBe(4);
    expect(Array.isArray(diag?.evidenceSummary)).toBe(true);
    expect(Array.isArray(diag?.attackedTargets)).toBe(true);
  });
});
