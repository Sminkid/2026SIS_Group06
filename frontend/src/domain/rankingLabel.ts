import type { RankingSummary } from "../types/handbook";

export const rankingPosition = (ranking: RankingSummary): string => `#${ranking.rankBand ?? ranking.rank}`;

/** Picks the most recent ranking to summarise a list, e.g. on a compact card - keeps cards comparable across universities that share an edition year. Falls back to the stronger (lower) rank to break a tie within the same year. */
export const latestRanking = (rankings: RankingSummary[]): RankingSummary | null =>
  rankings.reduce<RankingSummary | null>((latest, ranking) => {
    if (latest === null || ranking.year > latest.year) return ranking;
    if (ranking.year === latest.year && ranking.rank < latest.rank) return ranking;
    return latest;
  }, null);
