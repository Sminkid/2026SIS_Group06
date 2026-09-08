# Manual component placement, pathway rules and schedule swaps

1. **Initial branch and working tree.** Work began on `Study-plan-customise`, at `3549377` (`Implement customise study plan with good structure and follow selection choice on major/sub-major-elective`), with a clean working tree. The attachment named `main`; the user explicitly confirmed continuing on the existing separate branch. No branch change, fetch, pull, merge, reset, restore, commit or push was performed. All work below is uncommitted.

2. **Inconsistent Accounting slots.** The previous aggregate expansion generated fixed Core items, a separate unresolved slot for a missing Core record, and group-specific Option slots. Those different origins drove different candidate scopes. The unresolved item had no verified candidates. Expansion now uses formal Core/Option CP to establish capacity, then creates empty component-owned positions. Every equivalent position resolves the same component's required Core and eligible Options. Its allocated group is recorded only when a real subject is chosen. Group quotas and duplicate checks still apply.

3. **Exact `21228` trace.** Requirement item `cmszss10h09jikwtz3horak09`, Management Consulting `SMJ08109`, Core: `rawCode=21228`, `rawName=Management Consulting`, `subjectId=null`. The component response correctly has `subject=null`. Exact UTS 2026 code lookup found no Subject, and a wider read-only query across the database for codes containing `21228` or names containing `Management Consulting` also found none. There is no evidence of a differently coded imported equivalent; the source website/import history was not available to establish why ingestion omitted it. The former frontend converted this missing compulsory record into a misleading choice position. It now remains an outstanding required Core diagnostic, separate from the four ordinary empty positions. No synthetic Subject, unrestricted search fallback, or database repair was added. The API now resolves missing links by a unique real code match within the requested university and handbook year when one exists; a fabricated identifier or description match is never accepted.

4. **Other Accounting missing records.** The read-only audit covered all 38 component references exposed by Accounting, with 503 formal subject references. Twelve references remain unresolved, representing six unique codes. All twelve have null `subjectId`. Apart from compulsory `21228`, the missing references are Options: Finance major/sub-major `25627`, `25500`; International Business major and International Management sub-major `22240`; Marketing major/sub-major `24205`, `24212`; Strategic Marketing sub-major `24205`. The full requested component/group/code/found/slot/candidate-count/problem table is in [ACCOUNTING-SUBJECT-REFERENCE-AUDIT.md](ACCOUNTING-SUBJECT-REFERENCE-AUDIT.md). The retained API fixture includes raw missing-reference evidence and published offering samples. No database records were changed.

5. **Automatic Core placement cause.** Aggregate expansion interpreted `ALL` subject groups whose CP sum equals required CP as subjects to insert into the earliest available official capacity. That conflated compulsory graduation requirements with a student's scheduling decision.

6. **Required versus placed model.** Generated component positions now begin empty. Required Core remains in the component preview and candidate list, including unavailable required records. Placement progress counts actual subjects owned by that component and their allocated formal groups. It shows selected CP, filled positions, and required Core remaining. Completion requires every compulsory Core subject and the formal group CP quotas. An Option cannot consume more than its formal quota to hide missing Core. Removing a subject restores empty capacity at its current location and makes the original requirement outstanding. The genuine fixed subjects supplied directly by the official study-plan source remain fixed. Unsupported mixed-size/nested aggregate structures retain an explicit unresolved state rather than inventing capacity.

7. **Engineering reversion cause.** The UI offered an unrestricted stream selector while `reconcileDependentBranches`, called during selection/restoration, enforced the imported mandatory aligned-stream/default-Electives rule. An invalid visible choice was therefore overwritten immediately. This was a disagreement between UI options and domain rules, rather than an ID type mismatch or a variant effect. `requiredBranch` now supplies the same rule to both layers. The three deterministically required streams and default Electives are shown as required pathways. Before choosing a major, the student is prompted to select one. Genuine choices without this explicit rule remain selected; a changed genuine pathway confirms dependent subject removal.

8. **Engineering validity matrix.** [ENGINEERING-PATHWAY-MATRIX.md](ENGINEERING-PATHWAY-MATRIX.md) contains all 14 majors × four top-level pathways, 56 rows, plus the imported rule. Civil and Environmental, Electrical and Electronic, and Mechanical and Mechatronic Engineering each require their matching specialist stream. The other eleven majors require Electives. Invalid alternatives are hidden, not offered then reverted. Nested permitted Electives choices remain available. This verifies the imported UTS 2026 rule, not an independent live handbook certification. Flexible Engineering still has no mapped official variant in the supplied data; the existing explicit notice remains.

9. **Swap state/model.** Each planner item's stable identity represents its requirement allocation. `schedulePositionId` separately identifies its physical position; its containing year/period and array order represent current placement. Swapping exchanges two allocation objects between positions and exchanges their position keys. A selected-to-empty exchange moves the selected allocation and carries the empty capacity back. The proposal is immutable. Cancel changes no state. The confirmation handler rechecks the latest stored plan before applying it.

10. **Ownership through swaps.** Subject identity/code, subject CP, formal component ID/code, requirement group ID, source type, group label, and original source metadata travel with the allocation unchanged. Thus Marketing Core stays Marketing Core after moving into a former elective position. Empty capacity also retains its own formal source. Subsequent replacement resolves that allocation's pool, not the physical slot's previous pool. The UI displays `Scheduled` and `Counts toward`. JSON storage retains placement keys; rebasing matches allocation identity and component/pathway compatibility, preserves legal exchanged positions, and removes obsolete generated automatic Core subjects while retaining manual selections. Legacy positions without a placement key fall back to their official position. The existing v2-to-v3 upgrade remains in place; new fields are optional within v3.

11. **Hard validation and warnings.** Both allocations must exist in the same plan and be different. A selected source is required. Official fixed items, placements, multi-period items and explicit locks are protected. Duplicate subjects, explicit period restrictions, explicit hard session CP limits, and definitively incompatible published teaching periods block confirmation. Subject/period workloads use actual CP and are recalculated after movement. Resolved prerequisite/corequisite/prohibition groups are evaluated across the whole proposed plan, including dependents that did not move. A known violation affecting a moved subject, or a newly introduced violation elsewhere, blocks. Unchanged unrelated violations are shown as existing warnings. Missing/unknown access conditions, unresolved rule text, missing offering data and absent hard workload limits remain warnings. The imported plan API does **not** supply comprehensive mandatory commencement, capstone, degree sequencing or hard session CP limits. These are not inferred from recommendations; explicit locks/allowed periods/maximum CP are enforced when present, and a visible warning requests verification for remaining course-specific rules. No swap is presented as a fully verified enrolment plan.

12. **Accounting browser verification.** Verified two sub-majors and sub-major + electives, initial empty capacity, real candidates in every Consulting position, required Core labels and outstanding counts, missing `21228` diagnostic with no synthetic candidate/search, manual placement of `21510` and `21511`, the 6 CP Options quota, Core removal, replacement, pathway-change cancel/confirm, preserved official compulsory subjects, reloads and narrow layout. Management Consulting intentionally cannot reach completion while its required `21228` record is unavailable.

13. **Engineering browser verification.** Exercised all 14 imported majors and 19 mapped variants. For each major, asserted the required branch, loaded preview, and absence of every invalid top-level stream option. Tested Data Science's exact eleven imported option candidates and its three 6 CP option positions, major/variant synchronization, transition from aligned majors back to Electives, and persisted selection. Engineering subjects explicitly positioned by the official source remain fixed; no component Core is automatically added to customizable aggregates.

14. **Swap browser verification.** Manually placed Accounting Core and an elective, cancelled a proposed swap, confirmed a selected-to-selected swap, checked both changed locations and unchanged Core allocation, reloaded, moved into empty elective capacity, then removed Core and checked outstanding status. Checked locked targets. Engineering option-to-Free-Elective movement retained formal allocation across reload. A published Autumn-only offering fixture correctly blocked a Spring swap with an explanation and disabled confirmation. Tests run in headless Edge against local Vite with captured API responses and controlled offering/access responses, not against the live production API.

15. **USYD smoke test.** The captured USYD degree requirements and component structure still render. No UTS aggregate expansion is applied, and no `undefined` content appears. This is a degree/requirements smoke test; the captured USYD example has no official roadmap variant.

16. **Automated tests.** Frontend: **37 passed**. Backend: **5 passed**. Browser: **10 passed**. Domain coverage includes consistent pools, compulsory Core completion/removal, missing data, code fallback, all major/pathway combinations, selected-to-selected and selected-to-empty swaps, two electives, cross-component ownership, unchanged component progress/total CP, changed session workload, offerings, prerequisites/corequisites/prohibitions, duplicates, locks, legacy auto-Core normalization, and reload rebasing. Proposal immutability covers cancellation; browser tests cover the actual cancel interaction. Browser console checks reject duplicate-key and update-depth errors.

17. **Type checks/builds.** Root `npm.cmd run typecheck` and `npm.cmd run build` passed for backend and frontend. Builds regenerate Prisma client artifacts without schema/database writes. The final frontend build/type check is rerun after the final UI adjustments. `git diff --check` is clean. Test commands require execution outside this environment's restrictive Node sandbox; no dependencies were added for this task.

18. **Files changed.** Backend: component response fallback, its mapper/tests, read-only audit script. Frontend: roadmap expansion, scope/pool resolution, requirement progress, required pathway UI, subject dialog, swap proposal and offering parser, swap dialog and roadmap UI, planner types/storage/rebase, styles, domain and browser tests. Evidence: full Accounting audit fixture/table, Engineering matrix, this report. The existing tracked TypeScript build cache is regenerated by the required checks. Exact tracked/untracked paths and the tracked diff statistics follow below; Git's ordinary diff statistics do not include untracked new files.

19. **Final `git diff --stat`.**

<!-- FINAL_GIT_EVIDENCE -->

```text
 backend/src/services/component.service.ts       |  11 ++-
 frontend/e2e/roadmap.spec.ts                    | 126 +++++++++++++++++++++++-
 frontend/src/components/StudyPathSelector.tsx   |  36 +++++--
 frontend/src/components/StudyPlansSection.tsx   |  25 ++++-
 frontend/src/components/SubjectChoiceDialog.tsx |  24 ++---
 frontend/src/domain/plannerValidation.ts        |   7 +-
 frontend/src/domain/roadmapAudit.test.ts        |  23 +++--
 frontend/src/domain/roadmapSlots.ts             |  11 ++-
 frontend/src/domain/studyPathChoiceScope.ts     |   2 +-
 frontend/src/domain/studyPathDependencies.ts    |  18 ++--
 frontend/src/domain/subjectChoiceEligibility.ts |   2 +-
 frontend/src/hooks/usePlannerState.ts           | 123 ++++++++++++-----------
 frontend/src/styles/global.css                  |  12 +++
 frontend/src/types/handbook.ts                  |   3 +-
 frontend/src/types/planner.ts                   |   6 ++
 frontend/tsconfig.app.tsbuildinfo               |   2 +-
 16 files changed, 311 insertions(+), 120 deletions(-)
```

20. **Final `git status --short -uall`.** All files remain uncommitted on `Study-plan-customise`.

```text
 M backend/src/services/component.service.ts
 M frontend/e2e/roadmap.spec.ts
 M frontend/src/components/StudyPathSelector.tsx
 M frontend/src/components/StudyPlansSection.tsx
 M frontend/src/components/SubjectChoiceDialog.tsx
 M frontend/src/domain/plannerValidation.ts
 M frontend/src/domain/roadmapAudit.test.ts
 M frontend/src/domain/roadmapSlots.ts
 M frontend/src/domain/studyPathChoiceScope.ts
 M frontend/src/domain/studyPathDependencies.ts
 M frontend/src/domain/subjectChoiceEligibility.ts
 M frontend/src/hooks/usePlannerState.ts
 M frontend/src/styles/global.css
 M frontend/src/types/handbook.ts
 M frontend/src/types/planner.ts
 M frontend/tsconfig.app.tsbuildinfo
?? backend/scripts/audit-manual-placement.mjs
?? backend/src/mappers/subject-reference.test.ts
?? backend/src/mappers/subject-reference.ts
?? docs/ACCOUNTING-SUBJECT-REFERENCE-AUDIT.md
?? docs/ENGINEERING-PATHWAY-MATRIX.md
?? docs/MANUAL-PLACEMENT-SWAP-REPORT.md
?? frontend/src/components/SwapPositionDialog.tsx
?? frontend/src/domain/componentPlacement.ts
?? frontend/src/domain/fixtures/accounting-placement-audit.json
?? frontend/src/domain/manualPlacement.test.ts
?? frontend/src/domain/plannerSwap.ts
?? frontend/src/domain/subjectOfferings.ts
```
