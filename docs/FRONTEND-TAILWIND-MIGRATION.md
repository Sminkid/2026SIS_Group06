# Complete frontend Tailwind migration

The interrupted planner task was verified before this migration began. Work continued on `Study-plan-customise`, preserving the existing uncommitted changes and commit `f38aa49`. All resulting changes remain uncommitted.

1. **Tailwind integration.** Tailwind CSS and the official Vite plugin remain **4.3.3**, with Vite **7.3.6**. The workspace dependency lock is the repository-root `package-lock.json`; there is no frontend lockfile. The plugin and theme/utilities imports from the completed planner task remain in place. No additional UI framework or unrelated dependency upgrade was introduced.

2. **Complete frontend inventory and checklist.** All **76 files under frontend/src** were inventoried, including all **18 TSX files**. The HTML entry point, Vite/TypeScript/Playwright configuration and existing browser/domain tests were also inspected. The inventory covered stylesheets/imports, literal and conditional classes, imperative classes, inline styles, media queries, pseudo-elements/classes, animations and print rules. All visual entries are complete:

| Source file | Status | Coverage |
| --- | --- | --- |
| `frontend/src/App.tsx` | Complete | Shell, brand, header, skip link and page switching. One main landmark; duplicate main-content ID removed. |
| `frontend/src/components/AsyncState.tsx` | Complete | Shared loading, error, empty and retry states; reduced-motion spinner. |
| `frontend/src/components/Breadcrumbs.tsx` | Complete | Navigation buttons and generated slash separators. |
| `frontend/src/components/DegreeCompletionOverview.tsx` | Complete | Completion totals/cards, obligation variants, optional controls, table help and official wording. |
| `frontend/src/components/GlossaryChatWidget.tsx` | Complete | Toggle, panel, header, message variants, textarea, send/loading controls and mobile keyboard behavior. |
| `frontend/src/components/RequirementAccordion.tsx` | Complete | RequirementAccordion, RequirementRow, SelectedComponentRequirements; nested rows, radios, filtering and selected previews. |
| `frontend/src/components/StatusBadge.tsx` | Complete | Dormant API-health component inventoried and given explicit static variants; it remains unmounted. |
| `frontend/src/components/StudyPathSelector.tsx` | Complete | StudyPathSelector, ComponentSelect, GroupPreview, ComponentPreview, SelectedPathwayComponentPreview and pathway controls. |
| `frontend/src/components/StudyPlansSection.tsx` | Complete | Toolbar, variant selector, session help, roadmap groups and holding area; saved-plan loading guard. |
| `frontend/src/components/SubjectChoiceDialog.tsx` | Complete | SubjectResults, verified pools, broad search, candidate status, compact actions and native dialog. |
| `frontend/src/components/SubjectDetailsDialog.tsx` | Complete | ConditionGroups, full descriptions/rules/offerings, additive warnings; unique title IDs and nested modal behavior. |
| `frontend/src/components/SwapPositionDialog.tsx` | Complete | SwapTargetList and validated confirmation; compact target groups and shared modal behavior. |
| `frontend/src/components/planner/RequirementWarning.tsx` | Complete | Detailed missing/unresolved-data warning; known unmet prerequisites remain separate. |
| `frontend/src/components/planner/RoadmapCard.tsx` | Complete | Shared fixed/choice/selected card sizing, PrerequisiteSummary and compact actions retained. |
| `frontend/src/main.tsx` | Complete | Entry point inspected; retains the single global stylesheet import. No component styling. |
| `frontend/src/pages/DegreePage.tsx` | Complete | Degree hero, facts, description, course structure and roadmap coordinator. |
| `frontend/src/pages/DegreeSelectionPage.tsx` | Complete | Degree search, result rows, counts, breadcrumbs and responsive metadata. |
| `frontend/src/pages/HomePage.tsx` | Complete | University cards, hero, responsive grid, loading/error/empty states. |

The remaining source files were accounted for individually:

| Source file | Audit result |
| --- | --- |
| `frontend/src/api/chat.ts` | API/type/environment source inspected; no component styling. |
| `frontend/src/api/client.ts` | API/type/environment source inspected; no component styling. |
| `frontend/src/api/components.ts` | API/type/environment source inspected; no component styling. |
| `frontend/src/api/degrees.ts` | API/type/environment source inspected; no component styling. |
| `frontend/src/api/health.ts` | API/type/environment source inspected; no component styling. |
| `frontend/src/api/subjects.ts` | API/type/environment source inspected; no component styling. |
| `frontend/src/api/universities.ts` | API/type/environment source inspected; no component styling. |
| `frontend/src/components/planner/ui.ts` | Tailwind recipe or shared accessibility helper; reviewed. |
| `frontend/src/components/ui/cn.ts` | Tailwind recipe or shared accessibility helper; reviewed. |
| `frontend/src/components/ui/common.ts` | Tailwind recipe or shared accessibility helper; reviewed. |
| `frontend/src/components/ui/dialog.ts` | Tailwind recipe or shared accessibility helper; reviewed. |
| `frontend/src/components/ui/glossary.ts` | Tailwind recipe or shared accessibility helper; reviewed. |
| `frontend/src/components/ui/index.ts` | Tailwind recipe or shared accessibility helper; reviewed. |
| `frontend/src/components/ui/navigation.ts` | Tailwind recipe or shared accessibility helper; reviewed. |
| `frontend/src/components/ui/pageScroll.ts` | Tailwind recipe or shared accessibility helper; reviewed. |
| `frontend/src/components/ui/requirements.ts` | Tailwind recipe or shared accessibility helper; reviewed. |
| `frontend/src/components/ui/studyPath.ts` | Tailwind recipe or shared accessibility helper; reviewed. |
| `frontend/src/components/ui/studyPlan.ts` | Tailwind recipe or shared accessibility helper; reviewed. |
| `frontend/src/components/ui/subjectChoice.ts` | Tailwind recipe or shared accessibility helper; reviewed. |
| `frontend/src/domain/componentDetailState.test.ts` | Domain logic or tests inspected; no component CSS. Existing rules retained. |
| `frontend/src/domain/componentDetailState.ts` | Domain logic or tests inspected; no component CSS. Existing rules retained. |
| `frontend/src/domain/componentPlacement.ts` | Domain logic or tests inspected; no component CSS. Existing rules retained. |
| `frontend/src/domain/componentProgress.ts` | Domain logic or tests inspected; no component CSS. Existing rules retained. |
| `frontend/src/domain/fixtures/accounting-placement-audit.json` | Read-only test data; no styling. |
| `frontend/src/domain/fixtures/handbook-2026.json` | Read-only test data; no styling. |
| `frontend/src/domain/manualPlacement.test.ts` | Domain logic or tests inspected; no component CSS. Existing rules retained. |
| `frontend/src/domain/plannerSwap.ts` | Domain logic or tests inspected; no component CSS. Existing rules retained. |
| `frontend/src/domain/plannerUi.test.ts` | Domain logic or tests inspected; no component CSS. Existing rules retained. |
| `frontend/src/domain/plannerValidation.ts` | Domain logic or tests inspected; no component CSS. Existing rules retained. |
| `frontend/src/domain/prerequisiteDisplay.ts` | Domain logic or tests inspected; no component CSS. Existing rules retained. |
| `frontend/src/domain/readableText.ts` | Domain logic or tests inspected; no component CSS. Existing rules retained. |
| `frontend/src/domain/roadmapAudit.test.ts` | Domain logic or tests inspected; no component CSS. Existing rules retained. |
| `frontend/src/domain/roadmapSlots.ts` | Domain logic or tests inspected; no component CSS. Existing rules retained. |
| `frontend/src/domain/selectedComponentPreview.test.ts` | Domain logic or tests inspected; no component CSS. Existing rules retained. |
| `frontend/src/domain/selectedComponentPreview.ts` | Domain logic or tests inspected; no component CSS. Existing rules retained. |
| `frontend/src/domain/studyPathChoiceScope.ts` | Domain logic or tests inspected; no component CSS. Existing rules retained. |
| `frontend/src/domain/studyPathDependencies.ts` | Domain logic or tests inspected; no component CSS. Existing rules retained. |
| `frontend/src/domain/studyPlanSelection.ts` | Domain logic or tests inspected; no component CSS. Existing rules retained. |
| `frontend/src/domain/subjectChoiceEligibility.test.ts` | Domain logic or tests inspected; no component CSS. Existing rules retained. |
| `frontend/src/domain/subjectChoiceEligibility.ts` | Domain logic or tests inspected; no component CSS. Existing rules retained. |
| `frontend/src/domain/subjectOfferings.ts` | Domain logic or tests inspected; no component CSS. Existing rules retained. |
| `frontend/src/domain/swapTargets.ts` | Domain logic or tests inspected; no component CSS. Existing rules retained. |
| `frontend/src/features/.gitkeep` | API/type/environment source inspected; no component styling. |
| `frontend/src/hooks/useApiHealth.ts` | Data/state hook inspected; no component styling. |
| `frontend/src/hooks/useComponentDetail.ts` | Data/state hook inspected; no component styling. |
| `frontend/src/hooks/useComponentSelections.ts` | Data/state hook inspected; no component styling. |
| `frontend/src/hooks/usePlannerState.ts` | Saved-plan readiness guard; no visual styles. |
| `frontend/src/hooks/usePlannerValidation.ts` | Data/state hook inspected; no component styling. |
| `frontend/src/hooks/useSelectedComponentDetails.ts` | Data/state hook inspected; no component styling. |
| `frontend/src/hooks/useSwapFacts.ts` | Data/state hook inspected; no component styling. |
| `frontend/src/styles/global.css` | Only retained global stylesheet; rationale below. |
| `frontend/src/types/handbook.ts` | API/type/environment source inspected; no component styling. |
| `frontend/src/types/health.ts` | API/type/environment source inspected; no component styling. |
| `frontend/src/types/planner.ts` | API/type/environment source inspected; no component styling. |
| `frontend/src/types/subject.ts` | API/type/environment source inspected; no component styling. |
| `frontend/src/types/validation.ts` | API/type/environment source inspected; no component styling. |
| `frontend/src/utils/.gitkeep` | API/type/environment source inspected; no component styling. |
| `frontend/src/vite-env.d.ts` | API/type/environment source inspected; no component styling. |

3. **Components migrated.** Application navigation, all three pages, degree overview, requirement accordions/rows, selected component previews, study-path controls, planner toolbar/session help, subject choice/search, glossary and all async states now use Tailwind. The previously migrated roadmap cards, swap dialog and requirement detail/warning components retain their utility styling. No legacy component rule remains. Only class names consumed by existing tests remain as semantic hooks, such as `university-card`, `degree-row`, `selected-component`, `study-path`, `plan-item`, `subject-result` and `swap-target`; they have no custom CSS definitions.

4. **Reusable styling and organization.** `components/ui` contains typed, static recipes grouped into common, navigation, requirements, studyPath, studyPlan, subjectChoice and glossary modules. Shared bases cover buttons, async panels, component-choice variants, obligation badges, planner toolbars, candidate status, subject pools and chat messages. `cn()` joins complete utility strings; it does not construct Tailwind class names. Existing `planner/ui.ts` retains card/dialog variants. `trapDialogFocus` provides keyboard wrapping and `lockPageScroll` handles nested modal scroll locks. Useful JSDoc documents changed view components and non-obvious helper rules. Exact handbook values use Tailwind arbitrary utilities where standard spacing or colour scales would alter the design.

5. **Stylesheets removed.** `frontend/src/styles/handbook.css` and its import were removed after mapping its consumers. It was an untracked file from the interrupted task, so its removal does not appear as a tracked Git deletion. Obsolete/unconsumed selectors included app-main, the old eligible-dialog ordering, unused candidate-status variants, old prerequisite-status badges, glossary eyebrow and direct plan-period heading rules. Depth-one/two accordion styling is now a shared nested variant. No CSS modules, Sass, Less or additional application stylesheet was present.

6. **Global styles retained.** `styles/global.css` is the sole application stylesheet. It contains Tailwind layer/import declarations; root palette/font tokens; box sizing; body minimum size/background/typography; form font inheritance; default focus outlines; and shared document heading/paragraph typography. These are document-wide concerns. Preflight is not added because its additional resets would alter existing native controls. No component-specific selector, bespoke animation or print section remains. The original app had no print rules or third-party overrides to preserve. Spinners use Tailwind's animation and reduced-motion utilities; skip-link behavior is entirely utilities.

7. **Inline and dynamic styles.** No JSX inline style or imperative `.style` assignment remains. Modal scroll locking now toggles the complete static `overflow-hidden` utility, retaining pre-existing state and using a counter for nested dialogs. Conditional visual states select complete static strings/recipes. Runtime IDs and user content remain dynamic; no utility names are interpolated from colours or statuses.

8. **Responsive/visual verification.** Headless Edge checked **1440, 1280, 768 and 390 pixels**. Before removal, screenshots and computed dimensions/paint were captured for the university page, degree list, Engineering and USYD. The migration compared **392 visible element samples across 16 page/viewport combinations** for width, height, colour, background, font size, padding and borders. They match, with one documented correction: the Engineering variant select previously overflowed at 390px and now fits the 358px content area. Baseline comparisons are session-local in the system temporary `uni-planner-tailwind-baseline` directory; the browser tests always retain responsive assertions and produce current screenshots. Current screenshots are generated under `frontend/test-results`. Desktop home and mobile degree-list screenshots were visually compared; the latter review caught a missing breadcrumb pseudo-element, which was corrected and explicitly tested in the production build.

9. **Accessibility verification.** Keyboard skip-link navigation, visible focus, native dialog Escape/inertness, Tab wrapping, nested-dialog focus restoration and scroll locking passed. Subject-detail instances now have unique accessible title IDs. The shell no longer nests main landmarks or duplicates main-content. The mobile glossary now appears above the header so its close button is reachable; it focuses the input, wraps mobile keyboard navigation, closes with Escape and restores focus. Its pending/error/retry states and reduced-motion spinner were verified. Smooth message scrolling respects reduced-motion preferences. Existing palette and label contrast were retained; this was browser/keyboard verification, not a formal screen-reader or WCAG certification audit.

10. **UTS Engineering.** All imported 14 majors and 19 mapped variants remain functional. Tests cover exact option pools, prerequisite summaries, known unmet/late versus red unavailable data, complete requirement details, filtered targets, successful/repeated swaps, cancellation, allocation ownership, reloads and stable card dimensions. Fixed cards and customizable cards continue using the same 15rem width/minimum-height system.

11. **UTS Accounting and another UTS degree.** Accounting manual Core placement, pathway choices, component previews, CP quotas, selected/empty swaps, reversed swaps, cancellation and dimensions pass at all four widths. Production verification exposed a load-order race in the existing planner: generated slots could be rebased before component details arrived, erasing saved allocations. A narrow readiness guard defers only rebasing until all selected component details are available. The regression test deliberately delays those responses during reload and checks that allocations survive both during and after loading. Swap rules and formal ownership calculations are unchanged. **Bachelor of Nursing (C10122)** was also verified at desktop/tablet/mobile widths: its structurally different Program choice accordion, Standard/Enrolled Nurse rows, official variants and fixed roadmap render and customize correctly. Its fixture was captured through read-only existing backend services; no database writes occurred.

12. **USYD.** Degree overview, obligation cards, table guidance, component/minor selection, component requirements and CP rendering remain functional. The mobile layout has no horizontal overflow. No UTS-specific expansion or selection behavior was introduced into USYD.

13. **Tests and build results.**

| Check | Result |
| --- | --- |
| `npm.cmd run typecheck --workspace frontend` | Passed |
| `npm.cmd run test --workspace frontend` | 44 passed |
| `npm.cmd run build --workspace frontend` | Passed; TypeScript and Vite production output |
| `PLAYWRIGHT_PREVIEW=1` with `npm.cmd run test:e2e --workspace frontend` | 26 passed against the production build |
| Final page/pseudo-element targeted production rerun | 7 passed |
| `git diff --check` | Passed |

Production browser execution is selected with `$env:PLAYWRIGHT_PREVIEW='1'` in PowerShell after building. The default E2E command still supports local Vite development. The final bundle is approximately **48.07 kB CSS / 343.87 kB JS** before gzip. The preceding planner task's backend tests/type-check/build had already passed; this migration introduced no further backend production changes. Browser checks use captured handbook/API fixtures, not live university enrolment services.

14. **Files changed.** The complete working-tree list below includes the preserved planner task and this migration. New migration files are the grouped UI recipes/helpers, full-frontend browser tests and Nursing fixture, and this report. The only state-model change is the tested loading-readiness guard. Temporary migration and database-capture scripts were removed. Existing tracked TypeScript build-info files reflect successful compilation.

15. **Final Git diff statistics.** Standard `git diff --stat` excludes untracked new files; item 16 lists those too.

<!-- FINAL_GIT_EVIDENCE -->

```text
 backend/src/repositories/subject.repository.ts     |   4 +
 backend/src/services/subject.service.ts            |   8 +
 backend/src/types/subject.ts                       |   1 +
 frontend/e2e/roadmap.spec.ts                       | 193 ++++++-
 frontend/package.json                              |   6 +-
 frontend/playwright.config.ts                      |   4 +-
 frontend/src/App.tsx                               |  20 +-
 frontend/src/components/AsyncState.tsx             |   8 +-
 frontend/src/components/Breadcrumbs.tsx            |   4 +-
 .../src/components/DegreeCompletionOverview.tsx    |  24 +-
 frontend/src/components/GlossaryChatWidget.tsx     |  53 +-
 frontend/src/components/RequirementAccordion.tsx   |  76 +--
 frontend/src/components/StatusBadge.tsx            |  12 +-
 frontend/src/components/StudyPathSelector.tsx      |  57 +-
 frontend/src/components/StudyPlansSection.tsx      | 163 ++----
 frontend/src/components/SubjectChoiceDialog.tsx    |  56 +-
 frontend/src/components/SubjectDetailsDialog.tsx   |  93 ++--
 frontend/src/components/SwapPositionDialog.tsx     | 121 +++--
 frontend/src/hooks/usePlannerState.ts              |   9 +-
 frontend/src/hooks/usePlannerValidation.ts         |   3 +-
 frontend/src/pages/DegreePage.tsx                  |  24 +-
 frontend/src/pages/DegreeSelectionPage.tsx         |  30 +-
 frontend/src/pages/HomePage.tsx                    |  28 +-
 frontend/src/styles/global.css                     | 437 +--------------
 frontend/src/types/subject.ts                      |   1 +
 frontend/tsconfig.app.tsbuildinfo                  |   2 +-
 frontend/tsconfig.node.tsbuildinfo                 |   2 +-
 frontend/vite.config.ts                            |   4 +-
 package-lock.json                                  | 592 ++++++++++++++++++++-
 29 files changed, 1228 insertions(+), 807 deletions(-)
```

16. **Final Git status.** All changes are uncommitted; no branch change or commit/push occurred.

```text
On branch Study-plan-customise
Your branch is up to date with 'origin/Study-plan-customise'.

Changes not staged for commit:
  (use "git add <file>..." to update what will be committed)
  (use "git restore <file>..." to discard changes in working directory)
	modified:   backend/src/repositories/subject.repository.ts
	modified:   backend/src/services/subject.service.ts
	modified:   backend/src/types/subject.ts
	modified:   frontend/e2e/roadmap.spec.ts
	modified:   frontend/package.json
	modified:   frontend/playwright.config.ts
	modified:   frontend/src/App.tsx
	modified:   frontend/src/components/AsyncState.tsx
	modified:   frontend/src/components/Breadcrumbs.tsx
	modified:   frontend/src/components/DegreeCompletionOverview.tsx
	modified:   frontend/src/components/GlossaryChatWidget.tsx
	modified:   frontend/src/components/RequirementAccordion.tsx
	modified:   frontend/src/components/StatusBadge.tsx
	modified:   frontend/src/components/StudyPathSelector.tsx
	modified:   frontend/src/components/StudyPlansSection.tsx
	modified:   frontend/src/components/SubjectChoiceDialog.tsx
	modified:   frontend/src/components/SubjectDetailsDialog.tsx
	modified:   frontend/src/components/SwapPositionDialog.tsx
	modified:   frontend/src/hooks/usePlannerState.ts
	modified:   frontend/src/hooks/usePlannerValidation.ts
	modified:   frontend/src/pages/DegreePage.tsx
	modified:   frontend/src/pages/DegreeSelectionPage.tsx
	modified:   frontend/src/pages/HomePage.tsx
	modified:   frontend/src/styles/global.css
	modified:   frontend/src/types/subject.ts
	modified:   frontend/tsconfig.app.tsbuildinfo
	modified:   frontend/tsconfig.node.tsbuildinfo
	modified:   frontend/vite.config.ts
	modified:   package-lock.json

Untracked files:
  (use "git add <file>..." to include in what will be committed)
	docs/FRONTEND-TAILWIND-MIGRATION.md
	docs/PLANNER-UI-RESUME-REPORT.md
	frontend/e2e/fixtures/nursing-2026.json
	frontend/e2e/frontend-migration.spec.ts
	frontend/src/components/planner/RequirementWarning.tsx
	frontend/src/components/planner/RoadmapCard.tsx
	frontend/src/components/planner/ui.ts
	frontend/src/components/ui/cn.ts
	frontend/src/components/ui/common.ts
	frontend/src/components/ui/dialog.ts
	frontend/src/components/ui/glossary.ts
	frontend/src/components/ui/index.ts
	frontend/src/components/ui/navigation.ts
	frontend/src/components/ui/pageScroll.ts
	frontend/src/components/ui/requirements.ts
	frontend/src/components/ui/studyPath.ts
	frontend/src/components/ui/studyPlan.ts
	frontend/src/components/ui/subjectChoice.ts
	frontend/src/domain/plannerUi.test.ts
	frontend/src/domain/prerequisiteDisplay.ts
	frontend/src/domain/swapTargets.ts
	frontend/src/hooks/useSwapFacts.ts

no changes added to commit (use "git add" and/or "git commit -a")
```
