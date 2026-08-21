import type { ComponentType } from "../generated/prisma/enums.js";
import type { DegreeRequirementGroup } from "./degree.js";

export interface ComponentDetailResponse {
  component: {
    id: string;
    code: string;
    name: string;
    type: ComponentType;
    originalType: string | null;
    creditPoints: number | null;
    handbookYear: number;
    university: {
      id: string;
      code: string;
      name: string;
    };
  };
  requirements: DegreeRequirementGroup[];
}
