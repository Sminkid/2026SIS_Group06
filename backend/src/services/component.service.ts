import { mapComponentDetail } from "../mappers/component.mapper.js";
import { findComponentDetailRecord } from "../repositories/component.repository.js";
import type { ComponentDetailResponse } from "../types/component.js";
import { ApiError } from "../utils/api-error.js";
import { getPrisma } from "../db/prisma.js";
import { missingSubjectCodes, resolveSubjectReferences } from "../mappers/subject-reference.js";

export const getComponentDetail = async (
  componentIdentifier: string,
  universityCode: string,
  handbookYear: number,
): Promise<ComponentDetailResponse> => {
  const university = await findComponentDetailRecord(componentIdentifier, universityCode, handbookYear);
  if (!university) throw new ApiError(404, `University '${universityCode}' not found`);
  const handbook = university.HandbookVersion[0];
  if (!handbook) throw new ApiError(404, `No ${handbookYear} handbook found for university '${universityCode}'`);
  const component = handbook.Component[0];
  if (!component) throw new ApiError(404, `Component '${componentIdentifier}' not found in the ${handbookYear} ${universityCode} handbook`);
  const detail = mapComponentDetail(university, handbook, component);
  const codes = missingSubjectCodes(detail.requirements);
  if (!codes.length) return detail;
  const subjects = await getPrisma().subject.findMany({
    where: { code: { in: codes }, HandbookVersion: { year: handbookYear, University: { code: universityCode } } },
    select: { id: true, code: true, name: true, creditPoints: true },
  });
  return { ...detail, requirements: resolveSubjectReferences(detail.requirements, subjects) };
};
