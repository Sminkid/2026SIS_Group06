export interface UniversityRankingSummary {
  source: string;
  category: string;
  year: number;
  rank: number;
  rankBand: string | null;
}

export interface UniversitySummary {
  id: string;
  code: string;
  name: string;
  rankings: UniversityRankingSummary[];
}

export interface HandbookSummary {
  id: string;
  universityCode: string;
  year: number;
  sourceUrl: string | null;
}

export interface DegreeSummary {
  id: string;
  code: string;
  name: string;
  creditPoints: number | null;
  handbookYear: number;
}
