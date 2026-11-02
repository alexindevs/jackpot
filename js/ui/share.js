// "Share on X": the post is only opened when the player presses a Share button. It carries the result in the game's own
// words and a link to the game's page on start.ng. Nothing is sent before that.
const PAGE = 'https://start.ng/games/jackpot';
const CALL = 'Can you beat them?';

// "4-2", or "4-2-1" with more teams: the wins, best first
export const scoreOf = (wins) => Object.values(wins || {}).sort((a, b) => b - a).join('-');

export function roundText(winners, score) {
  return `${winners || 'A team'} won a round of Jackpot (${score}). ${CALL}`;
}

// result: the game's result ({winner, draw, reason}) or null when it is not known
export function gameText(winners, score, result) {
  if (result && result.draw) return `Jackpot ended in a draw (${score}). Who's next?`;
  if (!result || result.winner === undefined || !winners) return 'I just played Jackpot. Can you beat me?';
  if (result.reason === 'forfeit') return `${winners} won Jackpot by forfeit. ${CALL}`;
  return `${winners} won Jackpot ${score}. ${CALL}`;
}

export const shareUrl = (text) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(PAGE)}`;

export const openShare = (text) => window.open(shareUrl(text), '_blank', 'noopener');

export const shareButton = (kind) => `<button class="cream" data-act="share" data-kind="${kind}">Share</button>`;
