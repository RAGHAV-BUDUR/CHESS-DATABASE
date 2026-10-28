import { describe, it, expect } from 'vitest';
import { PGNParser } from '../src/lib/chess/pgn-parser';

describe('PGN Parser & Dataset Ingestion', () => {
  const samplePgn = `
[Event "F/S Return Match"]
[Site "Belgrade, Serbia JUG"]
[Date "1992.11.04"]
[Round "29"]
[White "Fischer, Robert J."]
[Black "Spassky, Boris V."]
[Result "1/2-1/2"]
[WhiteElo "2785"]
[BlackElo "2560"]
[ECO "B90"]
[Opening "Sicilian, Najdorf"]

1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6 6. Bc4 e6 7. Bb3 b5 8. O-O Be7 1/2-1/2
  `;

  it('correctly extracts structured metadata headers from standard PGN', () => {
    const parsed = PGNParser.parseSingleGame(samplePgn);

    expect(parsed).not.toBeNull();
    expect(parsed?.whitePlayer).toBe('Fischer, Robert J.');
    expect(parsed?.blackPlayer).toBe('Spassky, Boris V.');
    expect(parsed?.whiteRating).toBe(2785);
    expect(parsed?.blackRating).toBe(2560);
    expect(parsed?.result).toBe('1/2-1/2');
    expect(parsed?.ecoCode).toBe('B90');
    expect(parsed?.openingName).toBe('Sicilian, Najdorf');
    expect(parsed?.event).toBe('F/S Return Match');
  });

  it('reconstructs legal moves and outputs half-move records with FEN', () => {
    const parsed = PGNParser.parseSingleGame(samplePgn);

    expect(parsed?.moves.length).toBe(16); // 8 full moves = 16 half-moves
    expect(parsed?.moves[0].san).toBe('e4');
    expect(parsed?.moves[0].color).toBe('white');
    expect(parsed?.moves[0].moveNumber).toBe(1);
    expect(parsed?.moves[0].fenAfter).toContain('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR');
  });

  it('splits multi-game PGN string into individual games reliably', () => {
    const multiPgn = `
[Event "Game 1"]
[White "Player A"]
[Black "Player B"]
[Result "1-0"]

1. e4 e5 2. Nf3 1-0

[Event "Game 2"]
[White "Player C"]
[Black "Player D"]
[Result "0-1"]

1. d4 d5 2. c4 0-1
    `;

    const games = PGNParser.splitPgnGames(multiPgn);
    expect(games.length).toBe(2);
  });

  it('generates rich textual summary for semantic embedding ingestion', () => {
    const parsed = PGNParser.parseSingleGame(samplePgn);
    expect(parsed).not.toBeNull();
    if (parsed) {
      const summary = PGNParser.generateGameSummaryText(parsed, [
        { motifName: 'Pawn Storm Attack', moveSan: 'b5', moveNumber: 7, rationale: 'Flank advance' } as any
      ]);

      expect(summary).toContain('Fischer, Robert J.');
      expect(summary).toContain('Sicilian, Najdorf');
      expect(summary).toContain('Pawn Storm Attack');
    }
  });
});
