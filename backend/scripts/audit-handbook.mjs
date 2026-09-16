// Read-only database audit. Run from backend after npm run build.
// Retained fixtures are API responses, not collector source data.
import { mkdir, writeFile } from 'node:fs/promises';
import { getDegreeDetail, getDegreeStudyPlans } from '../dist/services/degree.service.js';
import { getComponentDetail } from '../dist/services/component.service.js';
import { getPrisma, disconnectPrisma } from '../dist/db/prisma.js';

const flat = groups => groups.flatMap(group => [group, ...flat(group.children)]);
try {
  const engineering = await getDegreeDetail('C09066', 'UTS', 2026);
  const accounting = await getDegreeDetail('C10235', 'UTS', 2026);
  const engineeringPlans = await getDegreeStudyPlans('C09066', 'UTS', 2026);
  const accountingPlans = await getDegreeStudyPlans('C10235', 'UTS', 2026);
  const majors = flat(engineering.requirements).flatMap(group => group.items.flatMap(item => item.component?.type === 'MAJOR' ? [item.component] : []));
  const accountingComponents = flat(accounting.requirements).flatMap(group => group.items.flatMap(item => item.component ? [item.component] : []));
  const references = [...majors, ...accountingComponents.filter(component => /^(Management Consulting|Marketing|Accounting)$/.test(component.name))];
  const details = {};
  for (const component of references) details[component.code] = await getComponentDetail(component.id, 'UTS', 2026);
  const db = getPrisma();
  const otherPlans = await db.studyPlan.findMany({ where: { Degree: { HandbookVersion: { University: { code: 'UTS' }, year: 2026 } } },
    select: { Degree: { select: { code: true, name: true } }, StudyPlanYear: { select: { StudyPlanPeriod: {
      select: { StudyPlanItem: { where: { itemType: 'CHOICE' }, select: { title: true, creditPoints: true, rawCode: true } } },
    } } } } });
  const aggregateDegrees = new Map();
  for (const plan of otherPlans) {
    const choices = plan.StudyPlanYear.flatMap(year => year.StudyPlanPeriod.flatMap(period => period.StudyPlanItem));
    const aggregates = choices.filter(item => (item.creditPoints ?? 0) > 6);
    if (aggregates.length) aggregateDegrees.set(plan.Degree.code, { ...plan.Degree,
      aggregates: [...(aggregateDegrees.get(plan.Degree.code)?.aggregates ?? []), ...aggregates] });
  }
  const usydDegree = await db.degree.findFirst({ where: { HandbookVersion: { University: { code: 'USYD' }, year: 2026 } }, select: { code: true } });
  const usyd = usydDegree ? await getDegreeDetail(usydDegree.code, 'USYD', 2026) : null;
  const usydComponents = usyd ? flat(usyd.requirements).flatMap(group => group.items.flatMap(item => item.component ? [item.component] : [])) : [];
  const usydComponent = usydComponents[0] ? await getComponentDetail(usydComponents[0].id, 'USYD', 2026) : null;
  const audit = { capturedAt: new Date().toISOString(), engineering, accounting, engineeringPlans, accountingPlans, details,
    aggregateDegrees: [...aggregateDegrees.values()], usyd, usydComponent };
  const folder = new URL('../../frontend/src/domain/fixtures/', import.meta.url);
  await mkdir(folder, { recursive: true });
  await writeFile(new URL('handbook-2026.json', folder), JSON.stringify(audit, null, 2) + '\n');
  console.log(JSON.stringify({ engineeringMajors: majors.length, engineeringPlans: engineeringPlans.length,
    accountingPlans: accountingPlans.length, sampledComponents: references.length, aggregateDegrees: aggregateDegrees.size,
    usyd: usyd?.degree.code, fixture: 'frontend/src/domain/fixtures/handbook-2026.json' }));
} finally { await disconnectPrisma(); }
