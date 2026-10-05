import type { ComponentDetailResponse, RequirementComponent, RequirementGroup, StudyPlan, StudyPlanItem } from "../types/handbook";
import type { PlannerContext, PlannerItem } from "../types/planner";
import type { ChoiceScope } from "./studyPathChoiceScope";
import { matchUsydEngineeringSpecialisation, usydEngineeringSpecialisations, type UsydSpecialisationKind } from "./usydEngineeringSpecialisations";

export const usydGroups = (groups: RequirementGroup[]): RequirementGroup[] => groups.flatMap(group => [group, ...usydGroups(group.children)]);
const words = (value: string) => value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).filter(Boolean);

export function usydPreviewStream(requirements: RequirementGroup[], pathway: string): RequirementComponent | undefined {
  return usydGroups(requirements).flatMap(group => group.items).flatMap(item => item.component?.type === "STREAM" ? [item.component] : [])
    .find(component => words(component.name).join(" ") === words(pathway).join(" "));
}

export function usydPreviewSpecialisation(detail: ComponentDetailResponse | undefined, name: string | null,
  kind?: UsydSpecialisationKind): RequirementComponent | undefined {
  if (!detail || !name) return undefined;
  return matchUsydEngineeringSpecialisation(usydEngineeringSpecialisations(detail), name, kind)?.component;
}

/** Copy only capacity and provenance. No CUSP subject or handbook relationship is invented. */
export function adaptUsydEngineeringPlan(plan: StudyPlan): StudyPlan {
  return { ...plan, years: plan.years.filter(year => !/^Year 0$/i.test(year.name.trim())).map(year => ({ ...year,
    periods: year.periods.map(period => ({ ...period, items: period.items.flatMap(item => {
      if (item.itemType !== "CHOICE") return [{ ...item }];
      const capacity = item.creditPoints;
      const count = capacity && capacity > 6 && capacity % 6 === 0 && !(item.numberOfPeriods && item.numberOfPeriods > 1) ? capacity / 6 : 1;
      return Array.from({ length: count }, (_, index): StudyPlanItem => ({ ...item,
        id: count > 1 ? `${item.id}:capacity:${index}` : item.id,
        creditPoints: count > 1 ? 6 : capacity,
        choiceOrigin: { officialChoiceItemId: item.id, originalPeriodId: period.id, title: item.title,
          rawCode: item.rawCode, creditPoints: count > 1 ? 6 : capacity,
          ...(capacity !== null ? { maximumCreditPoints: count > 1 ? 6 : capacity } : {}),
          ...(count > 1 ? { parentAggregateItemId: item.id, parentAggregateTitle: item.title, parentAggregateCreditPoints: capacity! } : {}),
        },
      }));
    }) })),
  })) };
}

export function usydPlannerContext(year: number, degree: string, stream?: string, specialisation?: string, dalyell = false): PlannerContext {
  return { universityCode: "USYD", handbookYear: year, degreeCode: degree,
    selectedComponentCodes: [stream, specialisation].filter((code): code is string => Boolean(code)),
    activePathwayRequirementGroupIds: dalyell ? ["USYD:DALYELL"] : [], knownPathwayRequirementGroupIds: [],
  };
}

/** The personal plan permits ordinary subjects to move, while sensitive USYD activities stay fixed. */
export function isUsydMovable(item: PlannerItem): boolean {
  return Boolean(item.subject) && !item.scheduleLocked && !(item.numberOfPeriods && item.numberOfPeriods > 1)
    && !/^ENGP\d/i.test(item.subject?.code ?? "")
    && !/\b(thesis|project|placement|practicum|internship|professional engagement|practical experience)\b/i.test(item.title);
}

function allocationGroup(group: RequirementGroup): RequirementGroup {
  const title = group.title ?? "";
  const minimum = /minimum of (\d+) credit points/i.exec(title)?.[1];
  const maximum = /maximum of (\d+) credit points/i.exec(title)?.[1];
  return { ...group, requiredCreditPoints: group.requiredCreditPoints ?? (minimum ? Number(minimum) : null),
    maximumCreditPoints: group.maximumCreditPoints ?? (maximum ? Number(maximum) : null) };
}

const poolTokens = (value: string) => words(value).filter(word => !["unit", "units", "stream", "level", "or", "the", "engineering"].includes(word))
  .map(word => word === "electives" ? "elective" : word);

/** Match named source tables within the selected stream; missing alternatives remain explicitly limited. */
export function resolveUsydEngineeringChoice(item: StudyPlanItem | null, requirements: RequirementGroup[],
  stream: ComponentDetailResponse | undefined, _specialisation: ComponentDetailResponse | undefined, dalyell: boolean): ChoiceScope {
  if (!item) return { kind: "UNRESOLVED" };
  const title = item.choiceOrigin?.title ?? item.title;
  const phrases = title.split(/\s+or\s+/i).map(phrase => phrase.split(/Note:/i)[0].trim()).filter(Boolean);
  const groups = new Map<string, RequirementGroup>();
  const owners: Record<string, string> = {};
  let defaultPoolGroupId: string | undefined;
  const allDegree = usydGroups(requirements);
  let missing = false;
  for (const phrase of phrases) {
    if (/^Free Electives?$/i.test(phrase)) {
      const free = allDegree.find(group => group.candidateSources.some(source => source.title === "Engineering undergraduate units")
        && group.candidateSources.some(source => source.tableName === "Table S"));
      if (free) {
        // USYD 2026 Environmental table explicitly permits Stream Electives within the Free Elective block.
        // https://www.sydney.edu.au/handbooks/engineering/engineering-honours/streams/environmental/unit-of-study-table.html
        const environmental = stream?.component.code === "USYD:ENGINEERING:STREAM:ENVIRONMENTAL-ENGINEERING"
          && stream.component.handbookYear === 2026 && stream.component.university.code === "USYD"
          ? usydGroups(stream.requirements).filter(group => group.title === "Stream Elective units").flatMap(group => group.items.filter(item => item.subject)) : [];
        groups.set(free.id, { ...free, title: "Free Electives", logic: "ANY",
          items: [...new Map([...free.items, ...environmental].map(item => [item.subject?.id ?? item.id, item])).values()] });
        if (phrase === phrases[0]) defaultPoolGroupId = free.id;
      } else missing = true;
      if (dalyell) {
        const tableD = allDegree.find(group => group.candidateSources.some(source => source.tableName === "Table D"));
        if (tableD) groups.set(tableD.id, { ...tableD, title: "Dalyell · Table D", logic: "ANY",
          requiredCreditPoints: tableD.requiredCreditPoints ?? Number(/(\d+) credit points/i.exec(tableD.description ?? "")?.[1] ?? 12),
          maximumCreditPoints: tableD.maximumCreditPoints });
      }
      continue;
    }
    if (/Table S/i.test(phrase) || /Dalyell|Table D/i.test(phrase)) {
      const table = /Table S/i.test(phrase) ? "Table S" : "Table D";
      const group = allDegree.find(group => group.candidateSources.some(source => source.tableName === table));
      if (group && (table !== "Table D" || dalyell)) {
        groups.set(group.id, { ...group, title: table,
          candidateSources: group.candidateSources.filter(source => source.tableName === table), logic: "ANY" });
        if (phrase === phrases[0]) defaultPoolGroupId = group.id;
      }
      else missing = true;
      continue;
    }
    const phraseWords = new Set(poolTokens(phrase));
    const candidates = usydGroups(stream?.requirements ?? []).filter(group => group.items.some(item => item.subject)
      && poolTokens(group.title ?? "").length > 0
      && poolTokens(group.title ?? "").every(word => phraseWords.has(word))
      && /elective|core extension|industry\/enterprise|project/i.test(group.title ?? ""));
    const longest = Math.max(0, ...candidates.map(group => poolTokens(group.title ?? "").length));
    const matches = candidates.filter(group => poolTokens(group.title ?? "").length === longest);
    if (matches.length === 1) {
      const group = matches[0]; groups.set(group.id, allocationGroup(group)); owners[group.id] = stream!.component.code;
      if (phrase === phrases[0]) defaultPoolGroupId = group.id;
    } else missing = true;
  }
  // Specialisation membership is a separate focused view. Allocation always uses actual slot pools.
  if (!groups.size) return { kind: "UNRESOLVED", label: /Dalyell|Table D/i.test(title) && !dalyell
    ? "Table D is available only when you confirm Dalyell enrolment." : "This CUSP choice does not identify an available eligible pool. Check the official source." };
  return { kind: "FORMAL", label: title, groups: [...groups.values()], selectableGroupIds: [...groups.keys()],
    union: true, componentCodesByGroup: owners,
    defaultPoolGroupId,
    ...(missing ? { limitation: "Some CUSP alternatives could not be mapped. Only the verified pools below are available." } : {}),
  };
}
