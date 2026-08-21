export interface UniversitySummary {
  id: string;
  code: string;
  name: string;
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
