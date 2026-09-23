import type { ComponentSelections } from "../../hooks/useComponentSelections";
import type { DegreeDetailResponse } from "../../types/handbook";

export interface DegreeStructureProps {
  detail: DegreeDetailResponse;
  universityCode: string;
  handbookYear: number;
  selections: ComponentSelections;
  selectionNotice: boolean;
  onSelectComponent: (groupId: string, componentCode: string) => void;
  onOpenSubject: (subjectCode: string) => void;
}
