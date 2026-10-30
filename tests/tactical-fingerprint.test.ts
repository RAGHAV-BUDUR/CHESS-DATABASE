import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import { TacticalFingerprintEngine } from '../src/lib/chess/tactical-fingerprint';

describe('Tactical Fingerprint Engine (Deterministic Rule-Based Detection)', () => {
  it('analyzes board position and calculates accurate material balance and pawn structure', () => {
    const chess = new Chess();
    const fp = TacticalFingerprintEngine.analyzePosition(chess);

    expect(fp.sideToMove).toBe('white');
    expect(fp.materialBalance.white).toBe(39); // 8p(8) + 2n(6) + 2b(6) + 2r(10) + 1q(9) = 39
    expect(fp.materialBalance.black).toBe(39);
    expect(fp.materialBalance.diff).toBe(0);
    expect(fp.castlingRights.whiteKingside).toBe(true);
    expect(fp.castlingRights.blackKingside).toBe(true);
  });

  it('detects checkmate attack correctly', () => {
    // Scholar's Mate: 1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7#
    const pgn = `
[Event "Scholar's Mate Demo"]
[White "Player White"]
[Black "Player Black"]
[Result "1-0"]

1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7# 1-0
    `;

    const result = TacticalFingerprintEngine.analyzeGame(pgn);
    expect(result.detectedMotifs.length).toBeGreaterThan(0);

    const mateMotif = result.detectedMotifs.find(m => m.motifName === 'Checkmate Attack');
    expect(mateMotif).toBeDefined();
    expect(mateMotif?.moveSan).toBe('Qxf7#');
    expect(mateMotif?.color).toBe('white');
    expect(mateMotif?.confidence).toBe('EXACT');
  });

  it('detects Queen Sacrifice motif accurately without LLM', () => {
    // Operatic Queen Sacrifice (Opera Game: Morphy vs Duke of Brunswick & Count Isouard)
    const operaPgn = `
[Event "Opera Game"]
[Site "Paris Opera"]
[Date "1858.10.21"]
[White "Morphy, Paul"]
[Black "Duke of Brunswick / Count Isouard"]
[Result "1-0"]

1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7 8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7 14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8# 1-0
    `;

    const result = TacticalFingerprintEngine.analyzeGame(operaPgn);
    const queenSac = result.detectedMotifs.find(m => m.motifName === 'Queen Sacrifice');

    expect(queenSac).toBeDefined();
    expect(queenSac?.moveSan).toBe('Qb8+');
    expect(queenSac?.color).toBe('white');
    expect(queenSac?.category).toBe('Sacrifice');
  });

  it('detects Minor Piece Sacrifice on an unprovoked defended pawn/square', () => {
    // Morphy's 10. Nxb5 in the Opera Game is a classic piece sacrifice for attack
    const pgn = `
[Event "Opera Game"]
[White "Morphy, Paul"]
[Black "Allies"]
[Result "1-0"]

1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7 8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 1-0
    `;

    const result = TacticalFingerprintEngine.analyzeGame(pgn);
    const minorSac = result.detectedMotifs.find(m => m.motifName === 'Minor Piece Sacrifice');

    expect(minorSac).toBeDefined();
    expect(minorSac?.color).toBe('white');
  });

  it('produces 100% deterministic results across multiple executions', () => {
    const pgn = `
[Event "Test Determinism"]
[White "White"]
[Black "Black"]
[Result "1-0"]

1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6 6. Bg5 e6 7. f4 Be7 8. Qf3 Qc7 9. O-O-O Nbd7 10. g4 b5 1-0
    `;

    const run1 = TacticalFingerprintEngine.analyzeGame(pgn);
    const run2 = TacticalFingerprintEngine.analyzeGame(pgn);

    expect(run1.detectedMotifs.length).toBe(run2.detectedMotifs.length);
    expect(JSON.stringify(run1.summarySignature)).toBe(JSON.stringify(run2.summarySignature));
    expect(run1.fingerprints.length).toBe(run2.fingerprints.length);
  });
});

