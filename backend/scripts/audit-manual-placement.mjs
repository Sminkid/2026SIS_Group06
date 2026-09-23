// Read-only audit: component API results and exact imported subject references.
import { writeFile } from 'node:fs/promises';
import { getDegreeDetail } from '../dist/services/degree.service.js';
import { getComponentDetail } from '../dist/services/component.service.js';
import { getPrisma, disconnectPrisma } from '../dist/db/prisma.js';
const flat = groups => groups.flatMap(group => [group, ...flat(group.children)]);
try {
  const db = getPrisma();
  const degree = await getDegreeDetail('C10235', 'UTS', 2026);
  const components = [...new Map(flat(degree.requirements).flatMap(group => group.items.flatMap(item => item.component ? [[item.component.id, item.component]] : []))).values()];
  const details = {}, rows = [];
  for (const component of components) {
    const detail = await getComponentDetail(component.id, 'UTS', 2026);
    details[component.code] = detail;
    for (const group of flat(detail.requirements)) for (const item of group.items.filter(item => item.itemType === 'SUBJECT')) {
      rows.push({ component: `${component.name} (${component.code})`, group: group.title ?? group.id,
        code: item.subject?.code ?? item.rawCode, found: Boolean(item.subject), slotType: 'Empty component-owned position',
        candidateCount: group.items.filter(item => item.subject).length,
        problem: item.subject ? '' : 'Requirement has no linked or uniquely code-resolved Subject in UTS 2026', requirementItemId: item.id });
    }
  }
  const suspects = await db.subject.findMany({ where: { OR: [{ code: { contains: '21228' } }, { name: { contains: 'Management Consulting', mode: 'insensitive' } }] },
    select: { id: true, code: true, name: true, HandbookVersion: { select: { year: true, University: { select: { code: true } } } } } });
  const offerings = await db.subject.findMany({ where: { HandbookVersion: { year: 2026, University: { code: 'UTS' } }, code: { in: ['21510', '21511', '31251'] } }, select: { code: true, offerings: true } });
  const missingReferences = await db.requirementItem.findMany({ where: { id: { in: rows.filter(row => !row.found).map(row => row.requirementItemId) } }, select: { id: true, subjectId: true, rawCode: true, rawName: true } });
  const audit = { capturedAt: new Date().toISOString(), componentCount: components.length, rows, suspects21228: suspects, missingReferences, offerings, details };
  await writeFile(new URL('../../frontend/src/domain/fixtures/accounting-placement-audit.json', import.meta.url), JSON.stringify(audit, null, 2) + '\n');
  const table = ['# Accounting imported subject-reference audit', '', `Read-only UTS 2026 audit captured ${audit.capturedAt}. ${components.length} components; ${rows.length} subject references.`, '',
    '| Component | Requirement group | Subject code | Subject record found | Slot type | Candidate count | Problem |',
    '| --- | --- | --- | ---: | --- | ---: | --- |',
    ...rows.map(row => `| ${row.component} | ${row.group} | ${row.code} | ${row.found ? 'Yes' : 'No'} | ${row.slotType} | ${row.candidateCount} | ${row.problem || 'None'} |`)];
  await writeFile(new URL('../../docs/ACCOUNTING-SUBJECT-REFERENCE-AUDIT.md', import.meta.url), table.join('\n') + '\n');
  console.log(JSON.stringify({ components: components.length, references: rows.length, missing: rows.filter(row => !row.found), suspects21228: suspects, offerings }, null, 2));
} finally { await disconnectPrisma(); }
