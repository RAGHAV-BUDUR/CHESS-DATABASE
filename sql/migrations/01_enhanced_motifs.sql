-- ==============================================================================
-- ChessBase Migration: Enhanced Tactical Motifs & Evidence Classification
-- Authors: Raghav Budur (PES1UG23AM225) & Prithviraj K (PES1UG24AM204)
-- ==============================================================================

-- 1. Insert New Master Tactical Motifs
INSERT INTO tactical_motifs (motif_name, category, description, severity_weight) VALUES
  ('Check', 'Attack', 'Direct check delivered by the moving piece against the opponent king.', 0.60),
  ('Checkmate', 'Attack', 'Direct king mating net delivering terminal checkmate.', 1.00),
  ('Discovered Check', 'Attack', 'Check delivered by unmasking a line attack when a piece vacates the ray.', 0.85),
  ('Double Check', 'Attack', 'Simultaneous check by two separate pieces, forcing king movement.', 0.95),
  ('Checking Sacrifice', 'Sacrifice', 'Deliberate sacrificial material offer that simultaneously delivers check.', 0.95),
  ('Tactical Sacrifice', 'Sacrifice', 'Material investment verified to recover material or achieve decisive mating attack.', 1.00),
  ('Candidate Sacrifice', 'Sacrifice', 'Material offer with speculative attacking or tactical potential awaiting deep proof.', 0.80),
  ('Positional Sacrifice', 'Sacrifice', 'Strategic material investment yielding compensation in pawn structure or activity.', 0.85),
  ('Material Loss', 'Tactical Error', 'Uncompensated material loss or tactical blunder.', 0.50),
  ('Fork Attack', 'Fork', 'Single piece attacking two or more enemy targets simultaneously.', 0.85),
  ('Pawn Fork', 'Fork', 'Pawn advancing to attack two enemy pieces simultaneously.', 0.85),
  ('Discovered Attack', 'Attack', 'Unmasking an attack on a valuable piece by moving an obstructing piece.', 0.80)
ON CONFLICT (motif_name) DO NOTHING;

-- 2. Expand Confidence Constraint in game_motifs to support GEOMETRIC, CANDIDATE, VERIFIED
DO $$
BEGIN
    ALTER TABLE game_motifs DROP CONSTRAINT IF EXISTS game_motifs_confidence_check;
    ALTER TABLE game_motifs ADD CONSTRAINT game_motifs_confidence_check 
        CHECK (confidence IN ('EXACT', 'RULE_BASED', 'HEURISTIC', 'GEOMETRIC', 'CANDIDATE', 'VERIFIED'));
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Constraint update skipped or not applicable.';
END $$;

-- 3. Add optional columns for engine analysis and evidence level if not present
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'game_motifs' AND column_name = 'evidence_level'
    ) THEN
        ALTER TABLE game_motifs ADD COLUMN evidence_level VARCHAR(20) DEFAULT 'CANDIDATE';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'game_motifs' AND column_name = 'engine_eval'
    ) THEN
        ALTER TABLE game_motifs ADD COLUMN engine_eval VARCHAR(50) DEFAULT NULL;
    END IF;
END $$;

