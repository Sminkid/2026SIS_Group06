export type ValidationSeverity = "error" | "warning" | "info";

export interface ValidationResult {
  severity: ValidationSeverity;
  code: string;
  message: string;
  subjectCode?: string;
  requirementGroupId?: string;
}

export interface RequirementProgress {
  requirementGroupId: string;
  title: string;
  plannedCreditPoints: number;
  requiredCreditPoints: number;
  complete: boolean;
}

export interface PlannerValidation {
  totalPlannedCreditPoints: number;
  degreeCreditPoints: number | null;
  degreeProgressPercent: number | null;
  requirementProgress: RequirementProgress[];
  results: ValidationResult[];
  errorCount: number;
  warningCount: number;
  infoCount: number;
}
