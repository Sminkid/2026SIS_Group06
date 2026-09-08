# UTS roadmap repair and audit ? 8 September 2026

Work was performed directly on `main`. Initial working tree: clean. All changes are uncommitted. No branches, history, schema, migrations or database records were changed. Git commands needed a command-local safe.directory exception because the execution account differs from the repository owner.

## Scope and completion status

The implemented repairs and regression tests pass, but this is not a claim that every requested completion criterion is satisfied. Missing source records, incomplete legacy provenance, unsupported mixed-size optional groups, and inaccessible live 2026 course pages remain explicit limitations. No destructive import was attempted.

## Root causes and repaired behavior

1. StudyPlansSection stored the active variant independently from component selections. The API exposed no major relationship. The backend now resolves a stable major ID/code using an exact major field in the imported title plus corroborating subject IDs. This is an inferred legacy relationship, not a stored official foreign key. Ambiguous matches remain unresolved.
2. One pure reconciliation function chooses only variants belonging to the selected major, preserves commencement/mode where possible, and requests a choice when several candidates remain. Explicit variant actions update the major in the same event. The sole reconciliation persistence effect never writes major state, so there are no competing bidirectional effects. Only a valid resolved pair is saved.
3. Stream state was validated against all existing groups, not the selected major. The explicit imported aligned-stream/default-elective rule now reconciles dependent branches and removes inactive descendants. The rule is interpreted from imported text and exact component identities; live 2026 confirmation remains unavailable.
4. Choice resolution skipped leaf groups such as CBK92152 and relied on generic option labels. Exact handbook codes now resolve selected-component groups before degree groups and legacy fallbacks. An exact component group exposes only that group, preventing sibling pools from mixing. Existing legacy label fallbacks remain for unlinked Engineering slots and need source-backed replacement.
5. Accounting pathway selectors and previews existed, but roadmap items remained unsplit 12/12/24 CP aggregates. Code-linked pathway blocks now expand within their original sessions; the parent heading is rendered once and only child capacity is counted.
6. Generated children carry parent item, pathway, degree group, component ID/code, component group, CP capacity, candidate source and official period. IDs combine variant, parent, selection, formal group/item and ordinal. Clone, display conversion, storage and restoration preserve that provenance. Degree/year/university remain in the planner context.
7. Fixed ALL groups are populated only when the recorded item CP total proves the complete-all structure. Missing linked subjects get a reserved unresolved required position. Optional subjects and electives are never auto-selected. Mixed or unsupported nested choices keep a diagnostic aggregate.
8. Pathway revalidation rejects inactive saved pathway keys and duplicate component choices. Rebasing keeps unaffected generated slots by stable ID. Confirmation is shown for dependent manually selected subjects; cancel preserves the pathway. Broad external search results can be selected only for genuinely broad scopes; exact formal scopes cannot be bypassed with an unverified search result.
9. Subject selection checks duplicate codes and slot CP capacity at the mutation boundary as well as in the dialog. Prerequisite evaluation remains separate from membership. Dialogs support Escape, focus restoration, scroll locking and a sticky close control; the oversized fixed desktop height was removed.
10. The explicit-pathway backend mapper now derives CP allocations from formal parent/child capacities instead of fixed Accounting constants.

## Official sources checked

- Imported handbook source: https://coursehandbook.uts.edu.au (2026 records; root accessible).
- https://coursehandbook.uts.edu.au/course/2026/C09066 ? attempted; browser research tool could not retrieve the course page.
- https://coursehandbook.uts.edu.au/course/2026/C10235 ? attempted; could not retrieve.
- https://coursehandbook.uts.edu.au/aos/2026/CBK92152 ? attempted, including lowercase code; could not retrieve.
- https://cis.uts.edu.au/handbookfiles/courses/c10235.html ? accessible legacy official source; supports 54 + 48 + 48 = 150 CP, but is not independent confirmation of the 2026 version.
- https://www.uts.edu.au/globalassets/sites/default/files/2023-10/c09066-be-hon-v6-1-data-science.pdf ? accessible official template, internally dated 30 October 2023. Supports three 6 CP option positions and an 18 CP pool. It also lists 48016, absent from the imported 2026 pool; do not import an older candidate without 2026 verification.

## Engineering major audit

Counts below are imported 2026 API counts. Candidate count is distinct linked subjects directly represented in the major requirements, including fixed subjects; it does not expand unselected nested components. Every major control and all 19 mapped variants were exercised in the headless browser. Every unique nested stream/sub-major choice and prerequisite combination was NOT manually exercised.

| Major | Code / stable ID | Degree-required CP | Imported variants | Stream/elective rule | Groups | Linked candidates | Status |
| --- | --- | ---: | ---: | --- | ---: | ---: | --- |
| Biomedical Engineering | MAJ03472 / cmszs24ub004rkwtzxgg5304t | 120 | 2 | CBK90011 elective structure | 2 | 24 | API and variant UI checked; detailed pool coverage partial |
| Chemical Process Engineering | MAJ03544 / cmszs24ub0054kwtzvh80rp6x | 120 | 1 | CBK90011 elective structure | 1 | 20 | API and variant UI checked; detailed pool coverage partial |
| Civil Engineering | MAJ03001 / cmszs24ub005hkwtzqrlq8jvu | 120 | 3 | CBK90011 elective structure | 6 | 27 | API and variant UI checked; detailed pool coverage partial |
| Civil and Environmental Engineering | MAJ03002 / cmszs24ub005gkwtz240pa8d8 | 120 | 1 | Civil and Environmental Engineering specialist stream | 1 | 20 | API and variant UI checked; detailed pool coverage partial |
| Data Science Engineering | MAJ03518 / cmszs24ub005skwtzcghkt7hg | 120 | 1 | CBK90011 elective structure | 3 | 28 | API and variant UI checked; detailed pool coverage partial |
| Electrical Engineering | MAJ03005 / cmszs24ub0062kwtz46ekkebr | 120 | 1 | CBK90011 elective structure | 4 | 16 | API and variant UI checked; detailed pool coverage partial |
| Electrical and Electronic Engineering | MAJ03537 / cmszs24ub0061kwtzcaijp1u5 | 120 | 1 | Electrical and Electronic Engineering specialist stream | 5 | 18 | API and variant UI checked; detailed pool coverage partial |
| Electronic Engineering | MAJ03524 / cmszs24ub0066kwtzzh0wcgv9 | 120 | 1 | CBK90011 elective structure | 5 | 22 | API and variant UI checked; detailed pool coverage partial |
| Flexible Engineering | MAJ03540 / cmszs24ub006rkwtzgd3fq9ka | 120 | 0 | CBK90011 elective structure | 6 | 18 | No imported variant; explicit diagnostic |
| Mechanical Engineering | MAJ03007 / cmszs24uc0089kwtzido9nmxz | 120 | 2 | CBK90011 elective structure | 5 | 21 | API and variant UI checked; detailed pool coverage partial |
| Mechanical and Mechatronic Engineering | MAJ03012 / cmszs24uc0086kwtzx1liboqo | 120 | 2 | Mechanical and Mechatronic Engineering specialist stream | 7 | 23 | API and variant UI checked; detailed pool coverage partial |
| Mechatronic Engineering | MAJ03504 / cmszs24uc008akwtzt5mx9p5a | 120 | 2 | CBK90011 elective structure | 5 | 21 | API and variant UI checked; detailed pool coverage partial |
| Renewable Energy Engineering | MAJ03549 / cmszs24uc009hkwtz87kv1viv | 120 | 1 | CBK90011 elective structure | 1 | 20 | API and variant UI checked; detailed pool coverage partial |
| Software Engineering | MAJ03523 / cmszs24uc009okwtz1797uvuc | 120 | 1 | CBK90011 elective structure | 5 | 45 | API and variant UI checked; detailed pool coverage partial |

Cybersecurity Engineering is not in the imported major list. Flexible Engineering is imported but has no study plan. No variant was invented for either.

## Data Science comparison

The imported Autumn/full-time variant has exactly three CBK92152 positions: Year 2 Spring, Year 3 Autumn, Year 3 Spring; 6 CP each, 18 CP total. Each resolves the same eleven linked 6 CP subjects through the exact major requirement group:

`41891, 41180, 32146, 31253, 42028, 31256, 41043, 41183, 48024, 42050, 42913`.

All eleven exist as linked database subjects and are returned by the component API. Their absence from dialogs was a resolver problem, not a missing CBK92152 import. Browser tests verify eleven displayed candidates in a Data Science slot. The 2023 PDF overlaps this list but includes an additional 48016 entry; exact 2026 external-source equivalence and every prerequisite scenario remain unverified.

## Accounting pathway audit

Imported compulsory core 54 CP + compulsory Accounting major 48 CP + selected pathway 48 CP = 150 CP. The official pathway placement is Year 2 Autumn 12 CP, Year 2 Spring 12 CP, Year 3 Spring 24 CP. Tests assert per-period capacity equality and 150 CP total after expansion; parent headings add no CP.

| Pathway | Required CP | Selected components | Fixed linked subjects | Optional slots | Elective slots | Unresolved required slots | Represented CP | Status |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | --- |
| Empty | 48 | None | 0 | 8 awaiting pathway | 0 | 0 | 48 | No auto-selection; browser checked |
| Two sub-majors | 48 | Management Consulting + Marketing | 5 | 2 | 0 | 1 | 48 | Separate groups; 21228 missing |
| Sub-major + electives | 48 | Marketing | 3 | 1 | 4 | 0 | 48 | Search, select, confirmed/cancelled transition checked |
| Second major | 48 | Marketing | 5 | 3 | 0 | 0 | 48 | 30 CP fixed + 18 CP options; browser checked |

Two-sub-major tests verify independent component IDs, separate preview groups, duplicate prevention, changing only one component, replacing/removing a selected option and persisted reload. Subject-sized non-6 CP fixed capacity is covered by a synthetic four-by-12 CP test. Mixed-size optional pools are diagnosed rather than forced into 6 CP slots; this is a remaining feature limitation.

Both no-code internships remain at their original official positions and retain unknown/zero CP placement behavior. Session 1, Autumn session and Spring session are not renamed.

## Missing record and import boundary

Additional unresolved subject references in the captured API: 48210 in Flexible Engineering introduction options; 24205 and 24212 in both the Marketing major and sub-major options. Dialogs now list these missing codes explicitly rather than silently presenting the linked subset as complete. Only 21228 was additionally checked directly against the subject table; the other entries are confirmed missing relationships in the API snapshot, not independently checked for absent subject rows.

Management Consulting (SMJ08109) Core requires 18 CP and contains three 6 CP items. Item 21228 Management Consulting has a null subject relationship. A read-only query confirmed no UTS 2026 Subject row for 21228. Expected repair: verify https://coursehandbook.uts.edu.au/subject/2026/21228 and the SMJ08109 2026 structure, then add the verified subject and link the existing requirement item. The collector/importer is not in this repository, so a safe executable import command cannot be established here. No guessed import command, schema change or database write was performed.

The safest available reproducible command is a read-only audit, not an import: from backend, run `npm run build` then `node scripts/audit-handbook.mjs`. It refreshes the retained test fixture and makes no database mutations. The future importer needs scoped non-destructive upserts, authoritative plan/component and item/group relationships, and explicit affected-row review.

## Other UTS structural audit

All imported UTS study plans were scanned for CHOICE blocks larger than 6 CP; 58 degrees were found. This identifies potential aggregates, not proof they should all expand (some are legitimate larger subjects). Only exact code-linked explicit pathways with provable capacity use the generic expansion. Other structures remain unchanged and need degree-specific source verification. Specialist and empty-candidate structures without large blocks were not exhaustively audited.

| Degree | Name | Imported large choice blocks |
| --- | --- | ---: |
| C10235 | Bachelor of Accounting | 3 |
| C10347 | Bachelor of Advanced Science | 11 |
| C10352 | Bachelor of Advanced Science Bachelor of Creative Intelligence and Innovation | 7 |
| C10026 | Bachelor of Business | 76 |
| C10326 | Bachelor of Business Bachelor of Creative Intelligence and Innovation | 8 |
| C10125 | Bachelor of Business Bachelor of Laws | 3 |
| C10411 | Bachelor of Business Bachelor of Sustainability and Environment | 8 |
| C10378 | Bachelor of Communication in Creative Writing Bachelor of Laws | 1 |
| C10455 | Bachelor of Communication in Media Business Bachelor of Laws | 1 |
| C10379 | Bachelor of Communication in Digital and Social Media Bachelor of Laws | 1 |
| C10380 | Bachelor of Communication in Journalism Bachelor of Laws | 1 |
| C10456 | Bachelor of Communication in Media Business Bachelor of Laws (Honours) | 1 |
| C10382 | Bachelor of Communication in Public Relations and Advertising Bachelor of Laws | 1 |
| C10383 | Bachelor of Communication in Social and Political Sciences Bachelor of Laws | 1 |
| C09119 | Bachelor of Computing Science (Honours) | 2 |
| C10460 | Bachelor of Creative Production in Animation | 2 |
| C10461 | Bachelor of Creative Production in Animation Bachelor of Creative Intelligence and Innovation | 2 |
| C10381 | Bachelor of Creative Production in Media Arts Bachelor of Laws | 1 |
| C10446 | Bachelor of Criminology | 2 |
| C10448 | Bachelor of Criminology Bachelor of Forensic Science | 4 |
| C10413 | Bachelor of Design in Architecture Master of Architecture | 3 |
| C10304 | Bachelor of Design in Product Design | 1 |
| C10348 | Bachelor of Economics | 16 |
| C10386 | Bachelor of Economics Bachelor of Laws | 3 |
| C10445 | Bachelor of Economics Bachelor of Sustainability and Environment | 6 |
| C10223 | Bachelor of Environmental Biology | 3 |
| C10482 | Bachelor of Food Science and Technology | 2 |
| C10483 | Bachelor of Food Science and Technology Bachelor of Business | 5 |
| C10387 | Bachelor of Forensic Science | 8 |
| C10389 | Bachelor of Forensic Science Bachelor of Creative Intelligence and Innovation | 4 |
| C10391 | Bachelor of Forensic Science Bachelor of Laws | 4 |
| C10278 | Bachelor of Information Systems Bachelor of Business | 2 |
| C10143 | Bachelor of Information Technology (Co-op) | 1 |
| C10327 | Bachelor of Information Technology Bachelor of Creative Intelligence and Innovation | 2 |
| C10245 | Bachelor of Information Technology Bachelor of Laws | 1 |
| C10124 | Bachelor of Laws | 13 |
| C09083 | Bachelor of Laws (Honours) | 3 |
| C10338 | Bachelor of Laws Bachelor of Creative Intelligence and Innovation | 2 |
| C10342 | Bachelor of Management | 20 |
| C10355 | Bachelor of Management Bachelor of Creative Intelligence and Innovation | 1 |
| C10412 | Bachelor of Management Bachelor of Sustainability and Environment | 26 |
| C10228 | Bachelor of Marine Biology and Climate Change | 1 |
| C10457 | Bachelor of Mathematical Sciences | 6 |
| C10184 | Bachelor of Medical Science | 4 |
| C10481 | Bachelor of Medical Science (Laboratory Medicine Professional) | 1 |
| C10163 | Bachelor of Medical Science Bachelor of Business | 6 |
| C10131 | Bachelor of Medical Science Bachelor of Laws | 2 |
| C10172 | Bachelor of Molecular Biotechnology | 4 |
| C10169 | Bachelor of Molecular Biotechnology Bachelor of Business | 4 |
| C10477 | Bachelor of Psychology | 1 |
| C09169 | Bachelor of Psychology (Honours) | 1 |
| C10242 | Bachelor of Science | 48 |
| C10162 | Bachelor of Science Bachelor of Business | 50 |
| C10330 | Bachelor of Science Bachelor of Creative Intelligence and Innovation | 16 |
| C10126 | Bachelor of Science Bachelor of Laws | 10 |
| C10399 | Bachelor of Science Bachelor of Sustainability and Environment | 16 |
| C10300 | Bachelor of Sport and Exercise Science | 1 |
| C20061 | Diploma in Fashion and Sustainability | 1 |

## USYD regression protection

The read-only API smoke sample was BPADVCMP-01 (Bachelor of Advanced Computing) and Accounting. Requirements, completion summaries and component groups load. The fixture test checks duplicate group fingerprints. A browser smoke test checks the degree page, absence of undefined text and absence of UTS aggregate expansion. Existing role-specific component tests remain passing. Full USYD degree coverage was not claimed.

## Verification

- Backend and frontend type-checks: passed.
- Backend and frontend production builds: passed.
- Frontend domain tests: 24 passed (including 15 new audit cases).
- Backend tests: 3 passed.
- Headless Edge browser suite: six passed; captured API responses, not a live database-backed HTTP session.
- Browser checks include actual selection/replacement/removal, localStorage reload, confirmation cancel/accept, correct candidate pools, all major/variant controls, focus return, Escape, background scroll lock, visible close button at 390 px and horizontal-overflow check.
- Initial verification obstacles were resolved: Powershell npm.ps1 policy by npm.cmd; sandbox account lookup/esbuild directory restrictions by approved normal execution; registry certificate chain by Node --use-system-ca. An initial browser API glob accidentally intercepted Vite source modules; the test harness was corrected. A test assumption about a 12 CP Management Consulting subject revealed missing 21228 and was corrected to assert the missing record.

## Remaining limitations

- Live official 2026 course/AOS verification is incomplete.
- The legacy plan-major relationship uses exact title plus subject evidence; authoritative stored relationships are still missing.
- Some Engineering labels lack exact requirement links, and legacy heuristics remain. Full stream/sub-major/elective interaction coverage is incomplete.
- Variant changes can discard a custom draft when its source plan ID changes; unrelated compatible manual choices across different official variants are not migrated automatically.
- Flexible Engineering lacks imported variants; Cybersecurity is not an imported major; Management Consulting lacks subject 21228.
- Mixed-CP optional groups and unsupported nested alternative allocation remain diagnostic aggregates.
- Other UTS structural audit identifies aggregate candidates only; it does not certify every degree or missing-candidate scenario.

## Files and artifacts

Implementation changes are in the backend study-plan relationship/service and degree-pathway mapper, frontend roadmap expansion/reconciliation/provenance, component selection validation, pathway selector, dialog and styles. Added tests include captured API fixtures, backend relationship/pathway tests, frontend domain audit tests and a Playwright browser suite. The Playwright dependency and test:e2e script are retained. The tracked frontend tsbuildinfo changed during the required build and was not restored.

Temporary browser error-context files and test-results are removed after the final test run. The handbook fixture is intentionally retained test evidence, not a temporary dump. Existing logs and user files are preserved.
## Final verification and Git state

Final result: backend/frontend type-check and production builds passed; 24 frontend domain tests, 3 backend tests and 6 headless browser tests passed. git diff --check passed. No new conflict markers, random roadmap IDs or temporary debug logging were found. Existing chat UUIDs and server startup logging were preserved.

Temporary frontend/test-results output was removed. No screenshots, one-off logs or debug scripts were retained; required test fixtures and the reusable audit script remain.

The stat below includes tracked changes only. New implementation/tests/fixtures/report files are listed separately by git status; none were staged.

```text
 .gitignore                                      |  3 +-
 backend/src/mappers/degree.mapper.ts            | 21 +++---
 backend/src/services/degree.service.ts          | 20 +++++-
 backend/src/types/study-plan.ts                 |  4 ++
 frontend/package.json                           |  6 +-
 frontend/src/components/StudyPathSelector.tsx   | 22 +++---
 frontend/src/components/StudyPlansSection.tsx   | 93 +++++++++++++++++++++----
 frontend/src/components/SubjectChoiceDialog.tsx | 16 ++++-
 frontend/src/domain/studyPathChoiceScope.ts     | 31 ++++++++-
 frontend/src/hooks/useComponentSelections.ts    | 17 +++--
 frontend/src/hooks/usePlannerState.ts           | 42 +++++++++--
 frontend/src/pages/DegreePage.tsx               |  1 +
 frontend/src/styles/global.css                  | 11 +--
 frontend/src/types/handbook.ts                  | 16 ++++-
 frontend/src/types/planner.ts                   | 18 ++---
 frontend/tsconfig.app.tsbuildinfo               |  2 +-
 package-lock.json                               | 46 ++++++++++++
 17 files changed, 301 insertions(+), 68 deletions(-)
```

```text
On branch main
Your branch is up to date with 'origin/main'.

Changes not staged for commit:
  (use "git add <file>..." to update what will be committed)
  (use "git restore <file>..." to discard changes in working directory)
	modified:   .gitignore
	modified:   backend/src/mappers/degree.mapper.ts
	modified:   backend/src/services/degree.service.ts
	modified:   backend/src/types/study-plan.ts
	modified:   frontend/package.json
	modified:   frontend/src/components/StudyPathSelector.tsx
	modified:   frontend/src/components/StudyPlansSection.tsx
	modified:   frontend/src/components/SubjectChoiceDialog.tsx
	modified:   frontend/src/domain/studyPathChoiceScope.ts
	modified:   frontend/src/hooks/useComponentSelections.ts
	modified:   frontend/src/hooks/usePlannerState.ts
	modified:   frontend/src/pages/DegreePage.tsx
	modified:   frontend/src/styles/global.css
	modified:   frontend/src/types/handbook.ts
	modified:   frontend/src/types/planner.ts
	modified:   frontend/tsconfig.app.tsbuildinfo
	modified:   package-lock.json

Untracked files:
  (use "git add <file>..." to include in what will be committed)
	backend/scripts/audit-handbook.mjs
	backend/src/mappers/degree-pathway.test.ts
	backend/src/mappers/study-plan-relationship.test.ts
	backend/src/mappers/study-plan-relationship.ts
	docs/UTS-ROADMAP-AUDIT.md
	frontend/e2e/roadmap.spec.ts
	frontend/playwright.config.ts
	frontend/src/domain/fixtures/handbook-2026.json
	frontend/src/domain/roadmapAudit.test.ts
	frontend/src/domain/roadmapSlots.ts
	frontend/src/domain/studyPathDependencies.ts
	frontend/src/domain/studyPlanSelection.ts

no changes added to commit (use "git add" and/or "git commit -a")
```
