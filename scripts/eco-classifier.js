/**
 * Comprehensive Chess ECO Classifier (CommonJS for scripts & CLI utilities)
 * DBMS Experiential Learning - Level 3 Project
 * Authors: Raghav Budur (PES1UG23AM225) & Prithviraj K (PES1UG24AM204)
 */

const CANONICAL_ECO_BOOK = [
  // --- Sicilian Defense (B20-B99) ---
  { eco: 'B90', name: "Sicilian Defense, Najdorf Variation", moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6'] },
  { eco: 'B70', name: "Sicilian Defense, Dragon Variation", moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'g6'] },
  { eco: 'B72', name: "Sicilian Defense, Dragon Variation, Yugoslav Attack", moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'g6', 'Be3', 'Bg7', 'f3'] },
  { eco: 'B80', name: "Sicilian Defense, Scheveningen Variation", moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'e6'] },
  { eco: 'B60', name: "Sicilian Defense, Richter-Rauzer", moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'Nc6', 'Bg5'] },
  { eco: 'B50', name: "Sicilian Defense, Modern Variations", moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6'] },
  { eco: 'B50', name: "Sicilian Defense, Kopec System", moves: ['e4', 'c5', 'Nf3', 'd6', 'c3'] },
  { eco: 'B52', name: "Sicilian Defense, Canal Attack", moves: ['e4', 'c5', 'Nf3', 'd6', 'Bb5+'] },
  { eco: 'B41', name: "Sicilian Defense, Kan Variation", moves: ['e4', 'c5', 'Nf3', 'e6', 'd4', 'cxd4', 'Nxd4', 'a6'] },
  { eco: 'B44', name: "Sicilian Defense, Taimanov Variation", moves: ['e4', 'c5', 'Nf3', 'e6', 'd4', 'cxd4', 'Nxd4', 'Nc6'] },
  { eco: 'B40', name: "Sicilian Defense, French Variation", moves: ['e4', 'c5', 'Nf3', 'e6'] },
  { eco: 'B33', name: "Sicilian Defense, Sveshnikov (Pelikan) Variation", moves: ['e4', 'c5', 'Nf3', 'Nc6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'e5'] },
  { eco: 'B30', name: "Sicilian Defense, Old Sicilian", moves: ['e4', 'c5', 'Nf3', 'Nc6'] },
  { eco: 'B31', name: "Sicilian Defense, Nyezhmetdinov-Rossolimo Attack", moves: ['e4', 'c5', 'Nf3', 'Nc6', 'Bb5'] },
  { eco: 'B22', name: "Sicilian Defense, Alapin Variation", moves: ['e4', 'c5', 'c3'] },
  { eco: 'B22', name: "Sicilian Defense, Delayed Alapin", moves: ['e4', 'c5', 'Nf3', 'e6', 'c3'] },
  { eco: 'B22', name: "Sicilian Defense, Delayed Alapin", moves: ['e4', 'c5', 'Nf3', 'Nc6', 'c3'] },
  { eco: 'B23', name: "Sicilian Defense, Closed Variation", moves: ['e4', 'c5', 'Nc3'] },
  { eco: 'B25', name: "Sicilian Defense, Closed Variation, Traditional", moves: ['e4', 'c5', 'Nc3', 'Nc6', 'g3', 'g6', 'Bg2', 'Bg7', 'd3', 'd6'] },
  { eco: 'B21', name: "Sicilian Defense, Grand Prix Attack", moves: ['e4', 'c5', 'f4'] },
  { eco: 'B21', name: "Sicilian Defense, Smith-Morra Gambit", moves: ['e4', 'c5', 'd4', 'cxd4', 'c3'] },
  { eco: 'B20', name: "Sicilian Defense, Bowdler Attack", moves: ['e4', 'c5', 'Bc4'] },
  { eco: 'B20', name: "Sicilian Defense, Snyder Variation", moves: ['e4', 'c5', 'b3'] },
  { eco: 'B27', name: "Sicilian Defense, Hyperaccelerated Fianchetto", moves: ['e4', 'c5', 'Nf3', 'g6'] },
  { eco: 'B20', name: "Sicilian Defense", moves: ['e4', 'c5'] },

  // --- Italian Game & Open Games (C50-C59, C40-C49, C20-C39) ---
  { eco: 'C57', name: "Italian Game, Two Knights Defense, Fried Liver Attack", moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'Ng5', 'd5', 'exd5', 'Nxd5'] },
  { eco: 'C57', name: "Italian Game, Two Knights Defense, Knight Attack d5", moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'Ng5', 'd5', 'exd5', 'Na5'] },
  { eco: 'C57', name: "Italian Game, Two Knights Defense, Traxler Counterattack", moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'Ng5', 'Bc5'] },
  { eco: 'C55', name: "Italian Game, Anti-Fried Liver Defense", moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'd3', 'h6'] },
  { eco: 'C55', name: "Italian Game, Two Knights Defense", moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6'] },
  { eco: 'C54', name: "Italian Game, Giuoco Pianissimo", moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'd3'] },
  { eco: 'C53', name: "Italian Game, Classical Variation, Center Attack", moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'c3'] },
  { eco: 'C51', name: "Italian Game, Evans Gambit", moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'b4'] },
  { eco: 'C50', name: "Italian Game, Schilling-Kostic Gambit", moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nd4'] },
  { eco: 'C50', name: "Italian Game, Rousseau Gambit", moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'f5'] },
  { eco: 'C50', name: "Italian Game", moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'] },

  // --- Ruy Lopez (Spanish) (C60-C99) ---
  { eco: 'C68', name: "Ruy Lopez, Exchange Variation", moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Bxc6'] },
  { eco: 'C78', name: "Ruy Lopez, Archangelsk Defense", moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6', 'O-O', 'b5', 'Bb3', 'Bb7'] },
  { eco: 'C88', name: "Ruy Lopez, Closed Variation", moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6', 'O-O', 'Be7', 'Re1', 'b5', 'Bb3', 'd6', 'c3'] },
  { eco: 'C65', name: "Ruy Lopez, Berlin Defense", moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'Nf6'] },
  { eco: 'C60', name: "Ruy Lopez (Spanish Opening)", moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'] },

  // --- Other 1.e4 e5 lines ---
  { eco: 'C45', name: "Scotch Game, Mieses Variation", moves: ['e4', 'e5', 'Nf3', 'Nc6', 'd4', 'exd4', 'Nxd4', 'Nf6'] },
  { eco: 'C44', name: "Scotch Game", moves: ['e4', 'e5', 'Nf3', 'Nc6', 'd4'] },
  { eco: 'C42', name: "Russian Game (Petrov's Defense)", moves: ['e4', 'e5', 'Nf3', 'Nf6'] },
  { eco: 'C41', name: "Philidor Defense", moves: ['e4', 'e5', 'Nf3', 'd6'] },
  { eco: 'C46', name: "Three Knights Opening", moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Nc3'] },
  { eco: 'C47', name: "Four Knights Game", moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Nc3', 'Nf6'] },
  { eco: 'C30', name: "King's Gambit", moves: ['e4', 'e5', 'f4'] },
  { eco: 'C25', name: "Vienna Game", moves: ['e4', 'e5', 'Nc3'] },
  { eco: 'C23', name: "Bishop's Opening", moves: ['e4', 'e5', 'Bc4'] },
  { eco: 'C20', name: "King's Pawn Game", moves: ['e4', 'e5'] },

  // --- French Defense (C00-C19) ---
  { eco: 'C15', name: "French Defense, Winawer Variation", moves: ['e4', 'e6', 'd4', 'd5', 'Nc3', 'Bb4'] },
  { eco: 'C10', name: "French Defense, Classical Variation", moves: ['e4', 'e6', 'd4', 'd5', 'Nc3', 'Nf6'] },
  { eco: 'C03', name: "French Defense, Tarrasch Variation, Guimard Defense", moves: ['e4', 'e6', 'd4', 'd5', 'Nd2', 'Nc6'] },
  { eco: 'C07', name: "French Defense, Tarrasch Variation, Open System", moves: ['e4', 'e6', 'd4', 'd5', 'Nd2', 'c5'] },
  { eco: 'C03', name: "French Defense, Tarrasch Variation", moves: ['e4', 'e6', 'd4', 'd5', 'Nd2'] },
  { eco: 'C02', name: "French Defense, Advance Variation", moves: ['e4', 'e6', 'd4', 'd5', 'e5'] },
  { eco: 'C01', name: "French Defense, Exchange Variation", moves: ['e4', 'e6', 'd4', 'd5', 'exd5'] },
  { eco: 'C00', name: "French Defense, Normal Variation", moves: ['e4', 'e6', 'd4', 'd5'] },
  { eco: 'C00', name: "French Defense", moves: ['e4', 'e6'] },

  // --- Caro-Kann Defense (B10-B19) ---
  { eco: 'B12', name: "Caro-Kann Defense, Advance Variation", moves: ['e4', 'c6', 'd4', 'd5', 'e5'] },
  { eco: 'B13', name: "Caro-Kann Defense, Exchange Variation", moves: ['e4', 'c6', 'd4', 'd5', 'exd5'] },
  { eco: 'B13', name: "Caro-Kann Defense, Panov-Botvinnik Attack", moves: ['e4', 'c6', 'd4', 'd5', 'exd5', 'cxd5', 'c4'] },
  { eco: 'B15', name: "Caro-Kann Defense, Classical Variation", moves: ['e4', 'c6', 'd4', 'd5', 'Nc3', 'dxe4', 'Nxe4', 'Bf5'] },
  { eco: 'B17', name: "Caro-Kann Defense, Steinitz Variation", moves: ['e4', 'c6', 'd4', 'd5', 'Nc3', 'dxe4', 'Nxe4', 'Nd7'] },
  { eco: 'B15', name: "Caro-Kann Defense, Standard, Unorthodox Replies", moves: ['e4', 'c6', 'd4', 'd5', 'Nc3'] },
  { eco: 'B11', name: "Caro-Kann Defense, Two Knights Variation", moves: ['e4', 'c6', 'Nc3', 'd5', 'Nf3'] },
  { eco: 'B12', name: "Caro-Kann Defense", moves: ['e4', 'c6'] },

  // --- Scandinavian, Pirc, Modern, Alekhine (B00-B09) ---
  { eco: 'B01', name: "Scandinavian Defense, Modern Variation", moves: ['e4', 'd5', 'exd5', 'Nf6'] },
  { eco: 'B01', name: "Scandinavian Defense, Mieses-Kotroc Variation", moves: ['e4', 'd5', 'exd5', 'Qxd5', 'Nc3', 'Qa5'] },
  { eco: 'B01', name: "Scandinavian Defense", moves: ['e4', 'd5'] },
  { eco: 'B02', name: "Alekhine's Defense", moves: ['e4', 'Nf6'] },
  { eco: 'B07', name: "Pirc Defense", moves: ['e4', 'd6', 'd4', 'Nf6', 'Nc3', 'g6'] },
  { eco: 'B06', name: "Modern Defense, King Pawn Fianchetto", moves: ['e4', 'g6'] },
  { eco: 'B00', name: "Nimzowitsch Defense", moves: ['e4', 'Nc6'] },
  { eco: 'B00', name: "Owen Defense", moves: ['e4', 'b6'] },

  // --- Queen's Gambit & 1.d4 d5 (D00-D69) ---
  { eco: 'D35', name: "Queen's Gambit Declined, Exchange Variation", moves: ['d4', 'd5', 'c4', 'e6', 'Nc3', 'Nf6', 'cxd5'] },
  { eco: 'D37', name: "Queen's Gambit Declined, 4.Nf3 Be7", moves: ['d4', 'd5', 'c4', 'e6', 'Nc3', 'Nf6', 'Nf3', 'Be7'] },
  { eco: 'D53', name: "Queen's Gambit Declined, 4.Bg5 Be7", moves: ['d4', 'd5', 'c4', 'e6', 'Nc3', 'Nf6', 'Bg5', 'Be7'] },
  { eco: 'D37', name: "Queen's Gambit Declined, Harrwitz Attack", moves: ['d4', 'd5', 'c4', 'e6', 'Nc3', 'Nf6', 'Bf4'] },
  { eco: 'D30', name: "Queen's Gambit Declined", moves: ['d4', 'd5', 'c4', 'e6'] },
  { eco: 'D10', name: "Slav Defense, Exchange Variation", moves: ['d4', 'd5', 'c4', 'c6', 'cxd5'] },
  { eco: 'D11', name: "Slav Defense, Modern Line", moves: ['d4', 'd5', 'c4', 'c6', 'Nf3', 'Nf6'] },
  { eco: 'D10', name: "Slav Defense", moves: ['d4', 'd5', 'c4', 'c6'] },
  { eco: 'D43', name: "Semi-Slav Defense", moves: ['d4', 'd5', 'c4', 'e6', 'Nc3', 'Nf6', 'Nf3', 'c6'] },
  { eco: 'D20', name: "Queen's Gambit Accepted", moves: ['d4', 'd5', 'c4', 'dxc4'] },
  { eco: 'D06', name: "Queen's Gambit", moves: ['d4', 'd5', 'c4'] },
  { eco: 'D02', name: "Queen Pawn Game, London System", moves: ['d4', 'd5', 'Nf3', 'Nf6', 'Bf4'] },
  { eco: 'D00', name: "Queen Pawn Game, London System", moves: ['d4', 'd5', 'Bf4'] },
  { eco: 'D05', name: "Queen Pawn Game, Colle System", moves: ['d4', 'd5', 'Nf3', 'Nf6', 'e3'] },
  { eco: 'D01', name: "Queen Pawn Game, Veresov Attack", moves: ['d4', 'd5', 'Nc3', 'Nf6', 'Bg5'] },
  { eco: 'D00', name: "Queen Pawn Game, Sarratt Attack", moves: ['d4', 'd5', 'Bg5'] },
  { eco: 'D00', name: "Queen's Pawn Game", moves: ['d4', 'd5'] },

  // --- Indian Defenses (E00-E99, A45-A79) ---
  { eco: 'E60', name: "King's Indian Defense", moves: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'Bg7'] },
  { eco: 'E20', name: "Nimzo-Indian Defense", moves: ['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4'] },
  { eco: 'E12', name: "Queen's Indian Defense", moves: ['d4', 'Nf6', 'c4', 'e6', 'Nf3', 'b6'] },
  { eco: 'E00', name: "Catalan Opening", moves: ['d4', 'Nf6', 'c4', 'e6', 'g3'] },
  { eco: 'D80', name: "Grünfeld Defense", moves: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'd5'] },
  { eco: 'A56', name: "Benoni Defense", moves: ['d4', 'Nf6', 'c4', 'c5'] },
  { eco: 'A57', name: "Benko Gambit", moves: ['d4', 'Nf6', 'c4', 'c5', 'd5', 'b5'] },
  { eco: 'A45', name: "Trompowsky Attack", moves: ['d4', 'Nf6', 'Bg5'] },
  { eco: 'A48', name: "East Indian Defense", moves: ['d4', 'Nf6', 'Nf3', 'g6'] },
  { eco: 'A46', name: "Torre Attack", moves: ['d4', 'Nf6', 'Nf3', 'e6', 'Bg5'] },
  { eco: 'A45', name: "Indian Defense", moves: ['d4', 'Nf6'] },

  // --- Other Major Flank & First Moves ---
  { eco: 'A80', name: "Dutch Defense", moves: ['d4', 'f5'] },
  { eco: 'A10', name: "English Opening", moves: ['c4'] },
  { eco: 'A15', name: "English Opening, Anglo-Indian Defense", moves: ['c4', 'Nf6'] },
  { eco: 'A20', name: "English Opening, King's English Variation", moves: ['c4', 'e5'] },
  { eco: 'A30', name: "English Opening, Symmetrical Variation", moves: ['c4', 'c5'] },
  { eco: 'A04', name: "Reti Opening", moves: ['Nf3', 'd5', 'c4'] },
  { eco: 'A04', name: "Zukertort Opening", moves: ['Nf3'] },
  { eco: 'A02', name: "Bird's Opening", moves: ['f4'] },
  { eco: 'A01', name: "Nimzo-Larsen Attack", moves: ['b3'] },
  { eco: 'A00', name: "Polish Opening (Sokolsky)", moves: ['b4'] },
  { eco: 'A00', name: "Grob Opening", moves: ['g4'] },
  { eco: 'A00', name: "Van't Kruijs Opening", moves: ['e3'] },
  { eco: 'A00', name: "Van Geet Opening", moves: ['Nc3'] },
  { eco: 'A00', name: "Benko's Opening", moves: ['g3'] },
  { eco: 'B00', name: "King's Pawn Opening", moves: ['e4'] },
  { eco: 'A40', name: "Queen's Pawn Opening", moves: ['d4'] },
];

function cleanOpeningName(name) {
  if (!name) return '';
  return name
    .replace(/^QGD,\s*/i, "Queen's Gambit Declined, ")
    .replace(/^Caro,\s*/i, "Caro-Kann Defense, ")
    .replace(/^Sicilian,\s*/i, "Sicilian Defense, ")
    .replace(/Defense,/g, 'Defense,')
    .replace(/\s+/g, ' ')
    .trim();
}

function isPlaceholderName(name) {
  if (!name) return true;
  const lower = name.toLowerCase().trim();
  return (
    lower === 'chess game' ||
    lower === 'chess opening' ||
    lower === 'custom opening' ||
    lower === 'custom pgn opening' ||
    lower === '?' ||
    lower === ''
  );
}

function inferEcoFromName(name) {
  if (!name) return null;
  const lower = name.toLowerCase();
  if (lower.includes('najdorf')) return 'B90';
  if (lower.includes('dragon')) return 'B70';
  if (lower.includes('scheveningen')) return 'B80';
  if (lower.includes('sicilian')) return 'B20';
  if (lower.includes('french')) return 'C00';
  if (lower.includes('caro-kann') || lower.includes('caro')) return 'B12';
  if (lower.includes('scandinavian')) return 'B01';
  if (lower.includes('italian')) return 'C50';
  if (lower.includes('ruy lopez') || lower.includes('spanish')) return 'C60';
  if (lower.includes('scotch')) return 'C45';
  if (lower.includes("queen's gambit declined") || lower.includes('qgd')) return 'D30';
  if (lower.includes("queen's gambit accepted")) return 'D20';
  if (lower.includes("queen's gambit")) return 'D06';
  if (lower.includes('slav')) return 'D10';
  if (lower.includes('london system')) return 'D02';
  if (lower.includes("king's indian")) return 'E60';
  if (lower.includes('nimzo-indian')) return 'E20';
  if (lower.includes("queen's indian")) return 'E12';
  if (lower.includes('english')) return 'A10';
  if (lower.includes('reti') || lower.includes('zukertort')) return 'A04';
  if (lower.includes('dutch')) return 'A80';
  return null;
}

function inferNameFromEco(eco) {
  if (!eco) return null;
  const code = eco.toUpperCase();
  if (code.startsWith('B2') || code.startsWith('B3') || code.startsWith('B4') || code.startsWith('B5') || code.startsWith('B6') || code.startsWith('B7') || code.startsWith('B8') || code.startsWith('B9')) {
    return 'Sicilian Defense';
  }
  if (code.startsWith('C0') || code.startsWith('C1')) return 'French Defense';
  if (code.startsWith('B1')) return 'Caro-Kann Defense';
  if (code === 'B01') return 'Scandinavian Defense';
  if (code.startsWith('C5')) return 'Italian Game';
  if (code.startsWith('C6') || code.startsWith('C7') || code.startsWith('C8') || code.startsWith('C9')) return 'Ruy Lopez';
  if (code.startsWith('D3') || code.startsWith('D4') || code.startsWith('D5') || code.startsWith('D6')) return "Queen's Gambit Declined";
  if (code.startsWith('D1')) return 'Slav Defense';
  if (code.startsWith('D0')) return "Queen's Pawn Game";
  if (code.startsWith('E6') || code.startsWith('E7') || code.startsWith('E8') || code.startsWith('E9')) return "King's Indian Defense";
  if (code.startsWith('E2') || code.startsWith('E3') || code.startsWith('E4') || code.startsWith('E5')) return 'Nimzo-Indian Defense';
  if (code.startsWith('A1') || code.startsWith('A2') || code.startsWith('A3')) return 'English Opening';
  if (code.startsWith('A0')) return 'Flank Opening';
  return null;
}

function matchMoveSequence(sanMoves) {
  if (!sanMoves || sanMoves.length === 0) return null;
  for (const entry of CANONICAL_ECO_BOOK) {
    if (entry.moves.length > sanMoves.length) continue;
    let matches = true;
    for (let i = 0; i < entry.moves.length; i++) {
      if (sanMoves[i] !== entry.moves[i]) {
        matches = false;
        break;
      }
    }
    if (matches) {
      return {
        ecoCode: entry.eco,
        openingName: entry.name
      };
    }
  }
  return null;
}

function classify(pgnText, sanMoves = []) {
  if (!pgnText) pgnText = '';

  // 1. Embedded comment e.g. {Opening: C00: French Defense, Normal Variation}
  const commentMatch = pgnText.match(/\{Opening:\s*([A-E]\d{2})?:\s*([^}]+)\}/i);
  if (commentMatch) {
    const eco = (commentMatch[1] || 'A00').trim().toUpperCase();
    let name = commentMatch[2].trim();
    name = cleanOpeningName(name);
    if (name && !isPlaceholderName(name)) {
      return {
        ecoCode: eco.length === 3 ? eco : inferEcoFromName(name) || 'A00',
        openingName: name
      };
    }
  }

  // 2. Standard PGN Headers
  const headerOpening = pgnText.match(/\[Opening\s+"([^"]+)"\]/i);
  const headerEco = pgnText.match(/\[ECO\s+"([^"]+)"\]/i);
  const rawName = headerOpening ? headerOpening[1].trim() : '';
  const rawEco = headerEco ? headerEco[1].trim().toUpperCase() : '';

  if (rawName && !isPlaceholderName(rawName)) {
    const cleaned = cleanOpeningName(rawName);
    const eco = rawEco && rawEco.length === 3 ? rawEco : inferEcoFromName(cleaned) || 'A00';
    return {
      ecoCode: eco,
      openingName: cleaned
    };
  }

  // 3. Move-sequence matching
  if (sanMoves && sanMoves.length > 0) {
    const matched = matchMoveSequence(sanMoves);
    if (matched) return matched;
  }

  // 4. Fallback if rawEco is present
  if (rawEco && rawEco.length === 3 && rawEco !== 'A00') {
    return {
      ecoCode: rawEco,
      openingName: inferNameFromEco(rawEco) || 'Chess Opening'
    };
  }

  // 5. Ultimate fallback based on first move
  if (sanMoves && sanMoves.length > 0) {
    const first = sanMoves[0];
    if (first === 'e4') return { ecoCode: 'B00', openingName: "King's Pawn Opening" };
    if (first === 'd4') return { ecoCode: 'A40', openingName: "Queen's Pawn Opening" };
    if (first === 'c4') return { ecoCode: 'A10', openingName: "English Opening" };
    if (first === 'Nf3') return { ecoCode: 'A04', openingName: "Zukertort Opening" };
  }

  return {
    ecoCode: 'A00',
    openingName: 'Unclassified Opening'
  };
}

module.exports = {
  classify,
  matchMoveSequence,
  cleanOpeningName,
  inferEcoFromName,
  inferNameFromEco
};

