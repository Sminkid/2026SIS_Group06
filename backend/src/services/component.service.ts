import { mapComponentDetail } from "../mappers/component.mapper.js";
import { findComponentDetailRecord } from "../repositories/component.repository.js";
import type { ComponentDetailResponse } from "../types/component.js";
import { ApiError } from "../utils/api-error.js";

export const getComponentDetail = async (
  componentCode: string,
  universityCode: string,
  handbookYear: number,
): Promise<ComponentDetailResponse> => {
  const university = await findComponentDetailRecord(componentCode, universityCode, handbookYear);
  if (!university) throw new ApiError(404, `University '${universityCode}' not found`);
  const handbook = university.HandbookVersion[0];
  if (!handbook) throw new ApiError(404, `No ${handbookYear} handbook found for university '${universityCode}'`);
  const component = handbook.Component[0];
  if (!component) throw new ApiError(404, `Component '${componentCode}' not found in the ${handbookYear} ${universityCode} handbook`);
  return mapComponentDetail(university, handbook, component);
};
