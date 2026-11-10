// Pure helpers: turn a saved { rank, level, points } into numbers for sorting.
const rankIdx = (ranks, p) => (p ? ranks.findIndex((r) => r.title === p.rank) : -1);

// One number that orders heroes by rank, then level, then points (null = not tracked)
export function rankScore(ranks, p) {
  const i = rankIdx(ranks, p);
  return i < 0 ? null : i * 1e9 + (p.level ?? 0) * 1e5 + (p.points ?? 0);
}

// Points still needed to reach the next level ('level') or the next rank ('rank').
// null when it can't be worked out (no level entered) or nothing is higher (max rank/level).
export function pointsToGo(ranks, p, scope) {
  const i = rankIdx(ranks, p);
  if (i < 0 || p.level == null) return null;
  const r = ranks[i];
  if (i === ranks.length - 1 && (scope === 'rank' || p.level >= r.maxLvl)) return null;
  const levels = scope === 'rank' ? r.maxLvl - p.level + 1 : 1;
  return levels * r.ppl - (p.points ?? 0);
}

// Saved progress, or Agent level 1 / 0 points for an untracked hero when auto-track is on
export const effectiveProgress = (ranks, saved, autoTrack) =>
  saved ?? (autoTrack && ranks[0] ? { rank: ranks[0].title, level: ranks[0].minLvl, points: 0 } : null);

// Every point earned from the very start, so progress can be averaged even though ranks cost different amounts per level
export function totalPoints(ranks, p) {
  const i = rankIdx(ranks, p);
  if (i < 0) return null;
  let total = 0;
  for (let k = 0; k < i; k++) total += (ranks[k].maxLvl - ranks[k].minLvl + 1) * ranks[k].ppl;
  const r = ranks[i];
  return total + ((p.level ?? r.minLvl) - r.minLvl) * r.ppl + (p.points ?? 0);
}

// Turns a total back into { rank, level, points }
export function fromTotalPoints(ranks, total) {
  let left = Math.max(0, total);
  for (const r of ranks) {
    const span = (r.maxLvl - r.minLvl + 1) * r.ppl;
    if (left < span || r === ranks.at(-1)) {
      const level = Math.min(r.maxLvl, r.minLvl + Math.floor(left / r.ppl));
      return { rank: r.title, level, points: Math.round(Math.min(r.ppl, left - (level - r.minLvl) * r.ppl)) };
    }
    left -= span;
  }
}