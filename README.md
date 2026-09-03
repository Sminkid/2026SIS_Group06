# Group 6

## Overview

This app is designed to be a NSW prospective student's onboarding companion.
It helps students figure out what to study based on their career goals,
lifestyle, and personal finances, and helps them pick a course, major, and
minor accordingly. Once a course and subjects are selected, the app helps
plan out a full study plan, not just at the course level but at the
individual subject level too.

**Longer-term vision** (post-SIS, not yet built): a student can import a
subject's outline into an AI chatbot assistant, which suggests a
recommended study plan or study approach for that specific subject.

```
Uni student → course → subject → study plan
```

## Project brief (for SIS)

This project is a lightweight, single-purpose web application, an "app
made to be deleted", designed to help prospective undergraduate and
postgraduate students visually model their daily life, course roadmaps,
and finances before choosing a university in NSW.

Instead of forcing students to decipher dense handbooks and confusing
calendars, the platform interactively compares the real-world impact of
different academic structures, like UTS's 2-semester pace versus UNSW's
3-trimester schedule.

*(Note: flagging this line since earlier drafts of this brief said "USyd"
instead of "UTS" — the team's locked MVP scope is UTS + UNSW. Update this
if that's changed, otherwise worth keeping consistent across all docs.)*

Powered by a single core engine, it maps single degrees, complex double
degrees, and postgraduate pathways (including credit exemptions and
part-time study loads). It highlights prerequisite chains and financial
milestones, explicitly predicting which terms will be the most costly or
demanding, so students can plan their life, budget, and study balance
before exporting a shareable 1-page master decision plan and enrolling.

## Choosing a university course and visualising the study journey

### Example planning flow

```text
Choose University
      ↓
Choose Degree
      ↓
View Degree Requirements
      ↓
Choose Major / Minor / Stream
      ↓
View Recommended Study Plan
      ↓
Customise Subjects and Electives
      ↓
Check Prerequisites + Credit Points
      ↓
Compare Workload + Cost
      ↓
Export Final Plan
```

## Running the app

Install dependencies from the repo root:

```bash
npm i
```

Create env.file from the place holder example:
```bash
cp backend/.env.example backend/.env
```

Generate the Prisma client:

```bash
cd backend
npx prisma generate
```

> **Note:** `npx prisma migrate deploy` is intentionally not run yet, the
> database schema isn't ready to be migrated. Don't run this until told
> otherwise.

Run frontend and backend simultaneously
```bash
cd ..
npm run dev
```

## Connecting Database + LLM 

Database credentials in Quangs tab

LLM credentials in Jonos tab 
