# Backend API examples

Start the backend with `npm run dev` from this directory. The examples below
assume the default port, `3000`.

## List universities

```bash
curl "http://localhost:3000/api/universities"
```

## Get the latest handbook for a university

URL-encode a university code before inserting it into the path.

```bash
curl "http://localhost:3000/api/universities/UTS/handbooks/latest"
```

## List degrees from the latest handbook

```bash
curl "http://localhost:3000/api/universities/UTS/degrees"
```

## List degrees from a particular handbook year

```bash
curl "http://localhost:3000/api/universities/UTS/degrees?year=2026"
```

Invalid university codes or years return `400`. Unknown universities and
missing handbook years return `404`.

## Get degree details and formal requirements

Both `university` and `year` are required. The response contains nested formal
requirement groups and does not derive requirements from the recommended study
plan.

```bash
curl "http://localhost:3000/api/degrees/C09066?university=UTS&year=2026"
```

## Get a component and its formal requirements

```bash
curl "http://localhost:3000/api/components/MAJ03472?university=UTS&year=2026"
```

## Get official recommended study plans

```bash
curl "http://localhost:3000/api/degrees/C09066/study-plans?university=UTS&year=2026"
```
