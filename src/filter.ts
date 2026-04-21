// Regex patterns compiled at module level for performance
const PROMPT_PATTERNS = /please\s+(choose|select|confirm|decide|let me know|advise|specify)|which\s+(option|approach|file|method|way|one)|what\s+do\s+you\s+(think|prefer|want|suggest|recommend)|should\s+i\s+|would\s+you\s+(like|prefer|want)|do\s+you\s+want|let\s+me\s+know|your\s+(input|decision|preference|choice)|confirm\s+before|approve\s+before|need\s+your/i;

// Question words at sentence start (after period, exclamation, or at beginning)
const QUESTION_WORD = /(?:^|[.!]\s+)(What|Which|How|Where|When|Why|Can\s+you|Could\s+you|Should\s+I|Would\s+you|Do\s+you|Does\s+it|Is\s+it|Are\s+you|Will\s+you)\b/i;

/**
 * Aggressive question/pause detection filter for chat messages.
 * Returns true if the text contains a question or request for user input.
 * Strategy: err on the side of notifying (better false positive than false negative).
 */
export function shouldNotify(text: string): boolean {
  // Strip code blocks (```...```) to avoid false positives from ternary operators (e.g., `a ? b : c`)
  const stripped = text.replace(/```[\s\S]*?```/g, "").trim();

  if (stripped.length === 0) return false;

  // Check 1: Text ends with question mark
  if (stripped.endsWith("?")) return true;

  // Check 2: Explicit prompt patterns (case-insensitive)
  if (PROMPT_PATTERNS.test(stripped)) return true;

  // Check 3: Question word at sentence start
  if (QUESTION_WORD.test(stripped)) return true;

  return false;
}
