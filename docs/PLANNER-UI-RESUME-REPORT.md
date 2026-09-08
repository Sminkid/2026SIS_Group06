# Planner UI follow-up and interrupted-work recovery

This report records the completed planner-only stage. The subsequent [full frontend migration](FRONTEND-TAILWIND-MIGRATION.md) supersedes its stylesheet boundary and final working-tree snapshot.

1. **Saved work recovered.** The branch remained `Study-plan-customise`, based on the user's existing `f38aa49` commit. The original UI follow-up began with a clean tree. At resumption, 14 tracked files were modified and the new planner components, display/filter helpers, swap-facts hook and retained handbook stylesheet were untracked. The diff was inspected before continuing. None of these changes were overwritten or restarted, and the existing commit was not altered.

2. **Incomplete work found.** Tailwind installation and the extracted components had survived. Tests still expected disabled locked swap rows, and prerequisite presentation, responsive dimensions, repeated swaps and focus restoration lacked complete coverage. Verification found two real remaining problems: aggregate horizontal padding reduced mobile card widths by 26 pixels, and modal cleanup could lose the source button's focus. Both were corrected. A screenshot review also caught damaged punctuation in the new swap dialog; its separators were corrected.

3. **Tailwind completed.** `tailwindcss` and `@tailwindcss/vite` are both **4.3.3**, recorded in `frontend/package.json` and the repository's **root `package-lock.json`**. This npm workspace has no separate frontend lockfile. Vite remains **7.3.6**; unrelated packages were not upgraded. The official Vite plugin is configured, and the global entry imports Tailwind theme/utilities. The existing reset was retained rather than applying Preflight across unrelated pages. This uses the [official Tailwind Vite integration](https://tailwindcss.com/docs/installation/using-vite).

4. **Files and migration boundary.** Roadmap/session grids, fixed/empty/selected cards, aggregate groups, compact actions, prerequisite summaries, the swap dialog and the subject requirement dialog now use Tailwind. Repeated variants are named in `components/planner/ui.ts`. Obsolete rules for these views were removed, including their narrow-layout overrides. `styles/global.css` now holds the Tailwind entry and base tokens/reset/focus rules; still-used handbook, selection, overview and glossary styles are retained in `styles/handbook.css`. Those unrelated views were not redesigned. Backend changes only expose the already-imported subject source URL and document existing repository/service functions. Exact changed paths are recorded below.

5. **Card sizing.** The former grid stretched siblings; nested `auto-fit` grids expanded small groups across their container. A growing main action (`flex: 1`), automatic metadata margins, a vertically stacked footer and full validation prose amplified the effect. Moving allocations between differently sized groups changed wrapping and therefore height; the swap model itself did not store dimensions. Cards now share a **15rem width and 15rem minimum height**, use content-driven growth, and sit in grids aligned to the start. Metadata and actions have compact spacing. Long titles wrap and are clamped to three lines with the full title available on hover; provenance is clamped with a full-text title. Aggregate separators preserve grouping without reducing card width. Browser checks require equal card widths within two pixels, heights below 390 pixels, no internal overflow, and unchanged dimensions after completed, reversed and cancelled swaps.

6. **Prerequisite presentation.** `getPrerequisiteDisplayState` distinguishes checking, no listed conditions, satisfied, unmet, scheduled too late, unavailable and manual review. The roadmap shows a short status and `View requirements`; it does not repeat full validation paragraphs. A known unmet prerequisite is amber and is not described as missing data. The existing requirement dialog retains descriptions, original expressions, referenced conditions, exclusions and offerings. The additive red `RequirementWarning` appears only for absent conditions, unresolved references or unparseable prerequisite expressions. It includes available raw text/codes, the handbook year, a readable reason and the imported source URL when available. Other plan warnings remain accessible. Request cancellation prevents an old subject's response replacing newer details.

7. **Swap filtering and preserved meaning.** `getValidSwapTargets` groups only eligible targets into nonempty year/session sections. It excludes the source, fixed degree/major Core, explicit locks, placements/internships, noncustomizable milestones, unresolved choice positions, incompatible CP capacity and proposals rejected by the existing validator. No excluded disabled rows are rendered. Access and offering facts load before the list appears. Unknown facts retain existing verification warnings. The dialog uses compact rows and a scrollable target region with a fixed header/cancel and confirmation footer. Escape restores focus; confirmation also finds the source button after the allocation has moved. The existing swap mutation and validation model remain unchanged: allocations keep their formal component/group IDs and CP, while schedule positions change and persist.

8. **Organization and documentation.** `RoadmapCard`, `PrerequisiteSummary`, `RequirementWarning`, `SwapTargetList`, `getPrerequisiteDisplayState`, `getValidSwapTargets` and `useSwapFacts` separate presentation, data loading and eligibility. Shared utility variants avoid repeated long style strings. JSDoc explains these boundaries, the planner validation hook, the roadmap coordinator, subject-detail rendering and the subject repository/service functions. No selection, requirement, provenance or persistence architecture rewrite was performed. The test command now explicitly uses `tsconfig.app.json` so component tests use the application's JSX transform.

9. **Automated verification.** Frontend domain/component suite: **44 passed**. Backend suite: **5 passed**. Browser suite: **18 passed**, with targeted reruns after final focus/presentation adjustments. Root type checks passed for both workspaces; backend and frontend production builds passed. The final frontend build also passed after the layout/focus changes. No schema changes or database writes were made. The tests include satisfied/unmet/late/unavailable states, red-box exclusivity, preserved full details, target exclusions and inclusions, duplicate/CP checks, allocation immutability, reloads and compact markup. Console checks reject React key/update-depth errors.

10. **Browser verification.** Headless Edge ran against local Vite with captured UTS/USYD handbook responses and controlled prerequisite/offering fixtures. Software Engineering exercised a technical option, compact unmet/late messages, missing-reference and unparsed-expression detail warnings, filtered targets, three repeated swaps, cancellation, focus and reload. Existing tests cover all 14 Engineering majors and 19 mapped variants. Accounting tested manual Core placement, consistent component cards, selected-to-selected and selected-to-empty swaps, reversals and unchanged sizes at **1440, 1280, 768 and 390 pixels**. No fixed Accounting subjects appear as targets. USYD overview, component selection/CP rendering and mobile overflow were checked. Desktop/mobile planner and swap screenshots are generated under `frontend/test-results/` and were visually inspected. These are reproducible fixture-based browser checks, not live university enrolment verification.

11. **Final `git diff --stat`.** Ordinary Git diff statistics exclude untracked new files; the following status lists those files separately.

<!-- FINAL_GIT_EVIDENCE -->

```text
 backend/src/repositories/subject.repository.ts   |   4 +
 backend/src/services/subject.service.ts          |   8 +
 backend/src/types/subject.ts                     |   1 +
 frontend/e2e/roadmap.spec.ts                     | 161 ++++++-
 frontend/package.json                            |   4 +-
 frontend/src/components/StudyPlansSection.tsx    | 117 ++---
 frontend/src/components/SubjectDetailsDialog.tsx |  84 ++--
 frontend/src/components/SwapPositionDialog.tsx   | 115 ++---
 frontend/src/hooks/usePlannerValidation.ts       |   3 +-
 frontend/src/styles/global.css                   | 431 +----------------
 frontend/src/types/subject.ts                    |   1 +
 frontend/tsconfig.app.tsbuildinfo                |   2 +-
 frontend/tsconfig.node.tsbuildinfo               |   2 +-
 frontend/vite.config.ts                          |   4 +-
 package-lock.json                                | 590 +++++++++++++++++++++++
 15 files changed, 921 insertions(+), 606 deletions(-)
```

12. **Final `git status`.** All changes remain uncommitted on `Study-plan-customise`. No commit or push was performed.

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
	modified:   frontend/src/components/StudyPlansSection.tsx
	modified:   frontend/src/components/SubjectDetailsDialog.tsx
	modified:   frontend/src/components/SwapPositionDialog.tsx
	modified:   frontend/src/hooks/usePlannerValidation.ts
	modified:   frontend/src/styles/global.css
	modified:   frontend/src/types/subject.ts
	modified:   frontend/tsconfig.app.tsbuildinfo
	modified:   frontend/tsconfig.node.tsbuildinfo
	modified:   frontend/vite.config.ts
	modified:   package-lock.json

Untracked files:
  (use "git add <file>..." to include in what will be committed)
	docs/PLANNER-UI-RESUME-REPORT.md
	frontend/src/components/planner/RequirementWarning.tsx
	frontend/src/components/planner/RoadmapCard.tsx
	frontend/src/components/planner/ui.ts
	frontend/src/domain/plannerUi.test.ts
	frontend/src/domain/prerequisiteDisplay.ts
	frontend/src/domain/swapTargets.ts
	frontend/src/hooks/useSwapFacts.ts
	frontend/src/styles/handbook.css

no changes added to commit (use "git add" and/or "git commit -a")
```

`git diff --check` passed with no whitespace errors.
