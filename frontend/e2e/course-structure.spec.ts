import { expect, test, type Page } from "@playwright/test";
import type {
  ComponentDetailResponse,
  DegreeDetailResponse,
  RequirementGroup,
  RequirementItem,
  StudentRequirementSummary,
  University,
} from "../src/types/handbook";

const usyd: University = { id: "usyd", code: "USYD", name: "The University of Sydney" };
const uts: University = { id: "uts", code: "UTS", name: "University of Technology Sydney" };

const emptyGroup = (id: string, title: string, logic: RequirementGroup["logic"]): RequirementGroup => ({
  id,
  title,
  description: null,
  logic,
  requiredCreditPoints: null,
  maximumCreditPoints: null,
  sortOrder: null,
  items: [],
  candidateSources: [],
  children: [],
  pathways: [],
});

const subjectGroup = (
  id: string,
  title: string,
  count: number,
  prefix: string,
  representativeCodes: string[] = [],
): RequirementGroup => {
  const group = emptyGroup(id, title, /Core units/i.test(title) ? "ALL" : "ANY");
  group.items = Array.from({ length: count }, (_, index): RequirementItem => {
    const code = representativeCodes[index] ?? `${prefix}${String(index + 1).padStart(4, "0")}`;
    const name = code === "INFO1113" ? "Object-Oriented Programming"
      : code === "COMP2017" ? "Systems Programming"
        : code === "COMP2123" ? "Data Structures and Algorithms"
          : code === "ELEC5760" ? "Intelligent Networked Control"
            : `${title} subject ${index + 1}`;
    return {
      id: `${id}-${code}`,
      itemType: "SUBJECT",
      subject: { id: `subject-${code}`, code, name, creditPoints: 6 },
      component: null,
      rawCode: code,
      rawName: name,
      creditPoints: 6,
      sortOrder: index,
    };
  });
  return group;
};

const streamNames = [
  "Aeronautical Engineering",
  "Aeronautical Engineering with Space",
  "Biomedical Engineering",
  "Chemical and Biomolecular Engineering",
  "Civil Engineering",
  "Electrical Engineering",
  "Environmental Engineering",
  "Mechanical Engineering",
  "Mechanical Engineering with Space",
  "Mechatronic Engineering",
  "Mechatronic Engineering with Space",
  "Software Engineering",
];

const streamPool = (): RequirementGroup => ({
  ...emptyGroup("engineering-stream-pool", "Engineering Streams stream choice pool", "ONE_OF"),
  items: streamNames.map((name, index): RequirementItem => {
    const slug = name.toUpperCase().replaceAll(/[^A-Z0-9]+/g, "-");
    const code = `USYD:ENGINEERING:STREAM:${slug}`;
    return {
      id: `stream-${index}`,
      itemType: "COMPONENT",
      subject: null,
      component: {
        id: name === "Software Engineering" ? "software-stream" : `stream-component-${index}`,
        code,
        displayCode: null,
        name,
        type: "STREAM",
        creditPoints: null,
        creditPointsAvailability: "UNAVAILABLE",
      },
      rawCode: null,
      rawName: null,
      creditPoints: null,
      sortOrder: index,
    };
  }),
});

const engineeringSource = {
  id: "engineering-source", sourceKey: "engineering", type: "SUBJECT_FILTER" as const,
  title: "Engineering undergraduate units", authoritative: true, tableName: null, candidateCount: 271,
};
const tableSSource = {
  id: "table-s-source", sourceKey: "table-s", type: "TABLE_SUBJECT_POOL" as const,
  title: "Table S units", authoritative: true, tableName: "Table S", candidateCount: 1472,
};
const tableDSource = {
  id: "table-d-source", sourceKey: "table-d", type: "TABLE_SUBJECT_POOL" as const,
  title: "Table D Dalyell units", authoritative: true, tableName: "Table D", candidateCount: 17,
};

const engineeringRequirements = (): RequirementGroup[] => {
  const foundation = emptyGroup("foundation", "Foundation", "ALL");
  foundation.requiredCreditPoints = 18;
  foundation.children = [
    subjectGroup("computing", "Computing Units", 3, "COMP", ["INFO1110", "INFO1910", "ENGG1810"]),
    subjectGroup("mathematics", "Mathematics Units", 2, "MATH", ["MATH1061", "MATH1062"]),
  ];
  foundation.children[0]!.logic = "ONE_OF";
  foundation.children[0]!.requiredCreditPoints = 6;
  foundation.children[1]!.logic = "ALL";
  foundation.children[1]!.requiredCreditPoints = 12;

  const projects = emptyGroup("projects", "Engineering Projects", "ALL");
  projects.requiredCreditPoints = 30;
  projects.children = [
    subjectGroup("project-1", "Project 1", 9, "PROJ"),
    subjectGroup("project-23", "Project 2 & 3", 2, "ENGG", ["ENGG2112", "ENGG3112"]),
    subjectGroup("thesis", "Thesis Units", 17, "THES"),
  ];
  projects.children[0]!.logic = "ONE_OF";
  projects.children[0]!.requiredCreditPoints = 6;
  projects.children[1]!.logic = "ALL";
  projects.children[1]!.requiredCreditPoints = 12;
  projects.children[2]!.logic = "UNKNOWN";
  projects.children[2]!.requiredCreditPoints = 12;

  const pep = subjectGroup("pep", "Professional Engagement Program", 8, "ENGP");
  pep.items.forEach((item) => { item.creditPoints = 0; if (item.subject) item.subject.creditPoints = 0; });
  const electives = emptyGroup("electives", "Requirement 13", "UNKNOWN");
  electives.maximumCreditPoints = 24;
  electives.candidateSources = [engineeringSource, tableSSource];
  const dalyell = emptyGroup("dalyell", "Requirement 12", "ALL");
  dalyell.description = "for students enrolled in the Dalyell Stream, a minimum of 12 credit points of Dalyell units of study as specified in Table D;";
  dalyell.candidateSources = [tableDSource];
  return [foundation, projects, pep, electives, streamPool(), dalyell];
};

const summary = (
  id: string,
  sourceText: string,
  minimumCreditPoints: number | null,
  obligation: StudentRequirementSummary["obligation"] = "REQUIRED",
): StudentRequirementSummary => ({
  id: `${id}:summary`,
  title: sourceText,
  explanation: null,
  obligation,
  minimumCreditPoints,
  maximumCreditPoints: null,
  conditionLabel: null,
  actionKind: id === "stream" ? "CHOOSE_COMPONENT" : "NONE",
  sourceText,
  sourceUrl: null,
  requirementGroupId: id,
});

const engineeringDetail: DegreeDetailResponse = {
  degree: {
    id: "bhengine",
    code: "BHENGINE-04",
    name: "Bachelor of Engineering Honours",
    creditPoints: 192,
    handbookYear: 2026,
    university: usyd,
    description: null,
  },
  requirements: engineeringRequirements(),
  completionSummary: [
    summary("foundation", "a minimum of 18 credit points from the Engineering Foundations Table", 18),
    summary("projects", "a minimum of 30 credit points from the Engineering Projects Table", 30),
    summary("pep", "successfully complete the requirements of the Professional Engagement Program", null),
    summary("stream", "a minimum of 120 credit points from the Engineering Stream Table", 120),
    summary("electives", "a maximum of 24 credit points from Table S", 24),
    summary("specialisation", "the Engineering Specialisations Tables", null, "OPTIONAL"),
    { ...summary("dalyell", "for students enrolled in the Dalyell Stream, a minimum of 12 credit points of Dalyell units of study as specified in Table D;", 12, "CONDITIONAL"),
      title: "12 CP Dalyell units" },
  ],
};

const softwareDetail: ComponentDetailResponse = {
  component: {
    id: "software-stream",
    code: "USYD:ENGINEERING:STREAM:SOFTWARE-ENGINEERING",
    name: "Software Engineering",
    type: "STREAM",
    originalType: "STREAM",
    creditPoints: null,
    sourceUrl: null,
    handbookYear: 2026,
    university: usyd,
  },
  requirements: [
    subjectGroup("software-core", "Stream Core units", 16, "SOFT", ["INFO1113"]),
    subjectGroup("software-lower-electives", "1000/2000 Level Stream Elective units", 21, "LOWR", ["COMP2017", "COMP2123"]),
    subjectGroup("software-upper-electives", "3000+ Level Stream Elective Units", 86, "UPPR", ["ELEC5760"]),
    {
      ...emptyGroup("software-specialisations", "Specialisation", "ONE_OF"),
      items: ["Computer", "Engineering Data Science", "Intelligent Information Engineering", "Internet Things"]
        .map((name, index): RequirementItem => ({
          id: `software-specialisation-${index}`,
          itemType: "COMPONENT",
          subject: null,
          component: {
            id: `software-specialisation-component-${index}`,
            code: `USYD:ENGINEERING:SPECIALISATION:${index}`,
            displayCode: null,
            name,
            type: "SPECIALISATION",
            creditPoints: null,
            creditPointsAvailability: "UNAVAILABLE",
          },
          rawCode: null,
          rawName: null,
          creditPoints: null,
          sortOrder: index,
        })),
    },
  ],
};

const softwareSpecialisationDetail: ComponentDetailResponse = {
  component: {
    id: "software-specialisation-component-0",
    code: "USYD:ENGINEERING:SPECIALISATION:0",
    name: "Computer",
    type: "SPECIALISATION",
    originalType: "SPECIALISATION",
    creditPoints: null,
    sourceUrl: null,
    handbookYear: 2026,
    university: usyd,
  },
  requirements: [subjectGroup("computer-specialisation-core", "Specialisation units", 1, "COMP", ["COMP3221"])],
};

const candidateSubjects = {
  [engineeringSource.id]: [
    { id: "aero1400", code: "AERO1400", name: "Intro to Aircraft Construction and Design", creditPoints: 6 },
    { id: "shared-comp", code: "COMP1000", name: "Shared Computing Subject", creditPoints: 6 },
    { id: "engg2000", code: "ENGG2000", name: "Engineering Practice", creditPoints: 6 },
  ],
  [tableSSource.id]: [
    { id: "acct1006", code: "ACCT1006", name: "Accounting and Financial Management", creditPoints: 6 },
    { id: "shared-comp", code: "COMP1000", name: "Shared Computing Subject", creditPoints: 6 },
    { id: "arts2000", code: "ARTS2000", name: "Arts and Society", creditPoints: 6 },
  ],
  [tableDSource.id]: [
    { id: "budl2901", code: "BUDL2901", name: "The Craft of Collaboration", creditPoints: 6 },
    { id: "budl2902", code: "BUDL2902", name: "Innovation in Organisations", creditPoints: 6 },
    ...Array.from({ length: 15 }, (_, index) => ({
      id: `dalyell-${index}`,
      code: `SCDL${String(2000 + index)}`,
      name: index === 0 ? "Leadership in STEMM" : `Dalyell unit ${index + 1}`,
      creditPoints: 6,
    })),
  ],
};

const candidateResponse = (url: URL) => {
  const sourceId = decodeURIComponent(url.pathname.split("/").at(-2)!);
  const source = sourceId === engineeringSource.id ? engineeringSource
    : sourceId === tableDSource.id ? tableDSource : tableSSource;
  const query = url.searchParams.get("q")?.toLowerCase() ?? "";
  const page = Number(url.searchParams.get("page") ?? "1");
  const matching = candidateSubjects[source.id].filter((subject) => !query
    || subject.code.toLowerCase().includes(query)
    || subject.name.toLowerCase().includes(query));
  const subjects = query ? matching : page === 1 ? matching.slice(0, 2) : matching.slice(2);
  return {
    candidateSource: source,
    subjects,
    pagination: { page, limit: 20, total: matching.length, totalPages: query ? 1 : 2 },
  };
};

const routeDegree = async (
  page: Page,
  detail: DegreeDetailResponse,
  componentDetails: ComponentDetailResponse[],
  onComponentRequest?: (identifier: string) => void,
  onCandidateRequest?: (request: string) => void,
) => {
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (!path.startsWith("/api/")) {
      await route.continue();
      return;
    }
    let body: unknown = {};
    if (path === "/api/universities") body = [detail.degree.university];
    else if (path.endsWith("/handbooks/latest")) body = { year: 2026 };
    else if (/\/universities\/.*\/degrees$/.test(path)) body = [detail.degree];
    else if (path.includes("/study-plans")) body = [];
    else if (path.includes("/degrees/")) body = detail;
    else if (path.includes("/requirement-candidate-sources/")) {
      onCandidateRequest?.(`${path}?${url.searchParams}`);
      body = candidateResponse(url);
    }
    else if (path.includes("/components/")) {
      const identifier = decodeURIComponent(path.split("/").at(-1)!);
      onComponentRequest?.(identifier);
      body = componentDetails.find((candidate) =>
        candidate.component.id === identifier || candidate.component.code === identifier) ?? { error: "Component not captured" };
    }
    await route.fulfill({ json: body });
  });
};

const openDegree = async (page: Page, detail: DegreeDetailResponse) => {
  await page.goto("/");
  await page.locator(".university-card").filter({ hasText: detail.degree.university.code }).click();
  await page.locator(".degree-row").filter({ hasText: detail.degree.code }).click();
  await expect(page.getByRole("heading", { name: "Course structure" })).toBeVisible();
};

test("USYD Engineering renders nested Core and lazily pages a deduplicated Free Elective union", async ({ page }) => {
  const candidateRequests: string[] = [];
  await routeDegree(page, engineeringDetail, [softwareDetail, softwareSpecialisationDetail], undefined,
    (request) => candidateRequests.push(request));
  await openDegree(page, engineeringDetail);

  expect(candidateRequests).toEqual([]);
  const coreButton = page.getByRole("button", { name: /Engineering Core.*48 credit points/i });
  await coreButton.click();
  const core = coreButton.locator("..");
  const foundationButton = core.getByRole("button", { name: /Foundation.*18 credit points/i });
  await foundationButton.click();
  const foundation = foundationButton.locator("..");
  await expect(foundation.getByRole("button", { name: /Computing Units.*6 credit points.*Choose one/i })).toBeVisible();
  await expect(foundation.getByRole("button", { name: /Mathematics Units.*12 credit points.*ALL/i })).toBeVisible();

  const projectsButton = core.getByRole("button", { name: /Engineering Projects.*30 credit points/i });
  await projectsButton.click();
  const projects = projectsButton.locator("..");
  await expect(projects.getByRole("button", { name: /Project 1.*6 credit points.*Choose one/i })).toBeVisible();
  await expect(projects.getByRole("button", { name: /Project 2 & 3.*12 credit points.*ALL/i })).toBeVisible();
  await expect(projects.getByRole("button", { name: /Thesis Units.*12 credit points/i })).toBeVisible();
  const pepButton = core.getByRole("button", { name: /Professional Engagement Program/i });
  await pepButton.click();
  await expect(pepButton.locator("..").getByRole("button", { name: /^View / })).toHaveCount(8);

  const electivesButton = page.getByRole("button", { name: /Open Electives.*Maximum 24 credit points/i });
  await electivesButton.click();
  const electives = electivesButton.locator("..");
  await expect(electives.getByRole("heading", { name: "Eligible Free Elective subjects" })).toBeVisible();
  await expect.poll(() => new Set(candidateRequests
    .filter((request) => request.includes("page=1"))
    .map((request) => request.split("/requirement-candidate-sources/")[1]?.split("/")[0])).size).toBe(2);
  await expect(electives.getByText("271 subjects")).toBeVisible();
  await expect(electives.getByText("1,472 subjects")).toBeVisible();
  await expect(electives.getByRole("button", { name: /View eligible subject COMP1000/ })).toHaveCount(1);
  const shared = electives.getByRole("button", { name: /View eligible subject COMP1000/ });
  await expect(shared).toContainText("Engineering undergraduate units");
  await expect(shared).toContainText("Table S units");

  await electives.getByRole("button", { name: /Load more from Engineering undergraduate units/ }).click();
  await electives.getByRole("button", { name: /Load more from Table S units/ }).click();
  await expect.poll(() => candidateRequests.filter((request) => request.includes("page=2")).length).toBe(2);
  await expect(electives.getByRole("button", { name: /View eligible subject ENGG2000/ })).toBeVisible();
  await expect(electives.getByRole("button", { name: /View eligible subject ARTS2000/ })).toBeVisible();

  await electives.getByRole("searchbox", { name: "Search eligible subjects by code or name" }).fill("Accounting");
  await electives.getByRole("button", { name: "Search eligible subjects" }).click();
  await expect(electives.getByRole("button", { name: /View eligible subject ACCT1006/ })).toBeVisible();
  await expect(electives.getByRole("button", { name: /View eligible subject COMP1000/ })).toHaveCount(0);
});

test("USYD Engineering lazily displays the conditional Table D pool with search", async ({ page }) => {
  const candidateRequests: string[] = [];
  await routeDegree(page, engineeringDetail, [], undefined, (request) => candidateRequests.push(request));
  await openDegree(page, engineeringDetail);

  const dalyellButton = page.getByRole("button", { name: /12 CP Dalyell units.*12 credit points.*CONDITIONAL/i });
  await expect(dalyellButton).toBeVisible();
  await expect(page.getByText("Dalyell students only.")).toHaveCount(0);
  expect(candidateRequests.filter((request) => request.includes(tableDSource.id))).toEqual([]);

  await dalyellButton.click();
  const dalyell = dalyellButton.locator("..");
  await expect(dalyell.getByRole("heading", { name: "Eligible Table D units" })).toBeVisible();
  await expect(dalyell.getByText("17 subjects")).toBeVisible();
  await expect(dalyell.getByText(/Dalyell students only/)).toBeVisible();
  await expect.poll(() => candidateRequests.some((request) => request.includes(tableDSource.id))).toBe(true);
  await expect(dalyell.getByRole("button", { name: /View eligible subject BUDL2901/ })).toBeVisible();
  await dalyell.getByRole("button", { name: /View eligible subject BUDL2901/ }).click();
  await expect(page.getByRole("dialog").getByRole("heading", { name: "BUDL2901" })).toBeVisible();
  await page.getByRole("button", { name: "Close subject details" }).click();

  await dalyell.getByRole("searchbox", { name: "Search Table D subjects by code or name" }).fill("Leadership");
  await dalyell.getByRole("button", { name: "Search Table D subjects" }).click();
  await expect(dalyell.getByRole("button", { name: /View eligible subject SCDL2000/ })).toBeVisible();
  await expect(dalyell.getByRole("button", { name: /View eligible subject BUDL2901/ })).toHaveCount(0);
});

test("another USYD degree displays its Dalyell candidate pool without Engineering hardcoding", async ({ page }) => {
  const dalyell = emptyGroup("advanced-computing-dalyell", "Requirement 5", "ALL");
  dalyell.description = "For students enrolled in the Dalyell Stream, a minimum of 12 credit points from Table D;";
  dalyell.candidateSources = [tableDSource];
  const otherDegree: DegreeDetailResponse = {
    degree: { id: "advanced-computing", code: "BPADVCMP-01", name: "Bachelor of Advanced Computing",
      creditPoints: 192, handbookYear: 2026, university: usyd, description: null },
    requirements: [dalyell],
    completionSummary: [{ ...summary("advanced-computing-dalyell",
      "For students enrolled in the Dalyell Stream, a minimum of 12 credit points from Table D;",
      12, "CONDITIONAL"), title: "12 CP Dalyell units" }],
  };
  const candidateRequests: string[] = [];
  await routeDegree(page, otherDegree, [], undefined, (request) => candidateRequests.push(request));
  await openDegree(page, otherDegree);

  expect(candidateRequests).toEqual([]);
  await page.getByLabel("Are you enrolled in the Dalyell Stream?").selectOption("YES");
  const dalyellButton = page.getByRole("button", { name: /12 CP Dalyell units.*12 credit points.*CONDITIONAL/i });
  await expect(dalyellButton).toBeVisible();
  expect(candidateRequests).toEqual([]);
  await dalyellButton.click();
  await expect(dalyellButton.locator("..").getByRole("heading", { name: "Eligible Table D units" })).toBeVisible();
  await expect.poll(() => candidateRequests.some((request) => request.includes(tableDSource.id))).toBe(true);
});

test("selecting a Software Engineering STREAM loads and renders all component subject groups", async ({ page }) => {
  const componentRequests: string[] = [];
  await routeDegree(page, engineeringDetail, [softwareDetail, softwareSpecialisationDetail],
    (identifier) => componentRequests.push(identifier));
  await openDegree(page, engineeringDetail);

  const streamButton = page.getByRole("button", { name: /Engineering Stream.*120 credit points.*Choose one/i });
  const streamSection = streamButton.locator("..");
  await expect(streamSection.getByRole("radio")).toHaveCount(12);
  await streamSection.getByRole("radio", { name: /Software Engineering/ }).check();

  await expect.poll(() => componentRequests).toContain("software-stream");
  await expect(streamSection.getByText("Selected stream", { exact: true })).toBeVisible();
  await expect(streamSection.getByRole("heading", { name: "Software Engineering", exact: true })).toBeVisible();
  await expect(streamSection.getByRole("heading", { name: "Component structure", exact: true })).toBeVisible();

  const expectedGroups = [
    { title: "Stream Core units", count: 16, subject: "INFO1113" },
    { title: "1000/2000 Level Stream Elective units", count: 21, subject: "COMP2017" },
    { title: "3000+ Level Stream Elective Units", count: 86, subject: "ELEC5760" },
  ];
  for (const expected of expectedGroups) {
    const escapedTitle = expected.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const button = streamSection.getByRole("button", { name: new RegExp(`^${escapedTitle} `, "i") });
    await button.click();
    const section = button.locator("..");
    await expect(section.getByRole("button", { name: /^View / })).toHaveCount(expected.count);
    await expect(section.getByRole("button", { name: new RegExp(`View ${expected.subject}`) })).toBeVisible();
  }

  const specialisation = streamSection.getByRole("button", { name: /Specialisation.*Choose one/i });
  await specialisation.click();
  const specialisationSection = specialisation.locator("..");
  await expect(specialisationSection.getByRole("radio")).toHaveCount(5);
  await expect(specialisationSection.getByRole("radio", { name: /No optional component/ })).toBeChecked();
  await specialisationSection.getByRole("radio", { name: /Computer/ }).check();
  await expect.poll(() => componentRequests).toContain("software-specialisation-component-0");
  await expect(specialisationSection.getByText("Selected specialisation", { exact: true })).toBeVisible();
  const specialisationUnits = specialisationSection.getByRole("button", { name: /Specialisation units/i });
  await specialisationUnits.click();
  await expect(specialisationSection.getByRole("button", { name: /View COMP3221/i })).toBeVisible();

  await expect(streamSection.getByRole("button", { name: /Year 1/i })).toHaveCount(0);
  await expect(streamSection).not.toContainText("relationship unavailable");
  await expect(streamSection).not.toContainText("DegreeComponent");
  await expect(streamSection).not.toContainText("CUSP");
});

const genericComponentContract = (
  university: University,
  degreeCode: string,
  degreeName: string,
  componentCode: string,
  componentName: string,
  subjectCode: string,
): { detail: DegreeDetailResponse; component: ComponentDetailResponse } => {
  const pool = emptyGroup(`${degreeCode}-components`, "Required major", "ONE_OF");
  pool.requiredCreditPoints = 48;
  pool.items = [componentName, "Alternative major"].map((name, index) => ({
    id: `${componentCode}-${index}`,
    itemType: "COMPONENT",
    subject: null,
    component: {
      id: index === 0 ? `${componentCode}-id` : `${componentCode}-alternative-id`,
      code: index === 0 ? componentCode : `${componentCode}-ALT`,
      displayCode: index === 0 ? componentCode : `${componentCode}-ALT`,
      name,
      type: "MAJOR",
      creditPoints: 48,
      creditPointsAvailability: "EXPLICIT_COMPONENT",
    },
    rawCode: null,
    rawName: null,
    creditPoints: 48,
    sortOrder: index,
  }));
  return {
    detail: {
      degree: { id: degreeCode, code: degreeCode, name: degreeName, creditPoints: 192,
        handbookYear: 2026, university, description: null },
      requirements: [pool],
      completionSummary: [],
    },
    component: {
      component: { id: `${componentCode}-id`, code: componentCode, name: componentName, type: "MAJOR",
        originalType: "MAJOR", creditPoints: 48, sourceUrl: null, handbookYear: 2026, university },
      requirements: [subjectGroup(`${componentCode}-core`, "Core units", 1, "CORE", [subjectCode])],
    },
  };
};

test("USYD Advanced Computing selected majors keep the shared component renderer", async ({ page }) => {
  const contract = genericComponentContract(usyd, "BPADVCMP-01", "Bachelor of Advanced Computing",
    "USYD:ENGINEERING:MAJOR:CYBERSECURITY", "Cybersecurity", "CSEC3616");
  await routeDegree(page, contract.detail, [contract.component]);
  await openDegree(page, contract.detail);
  const section = page.getByRole("button", { name: /Required major.*Choose one/i }).locator("..");
  await section.getByRole("radio", { name: /Cybersecurity/ }).check();
  await expect(section.getByText("Selected major", { exact: true })).toBeVisible();
  const core = section.getByRole("button", { name: /Core units.*ALL/i });
  await core.click();
  await expect(section.getByRole("button", { name: /View CSEC3616/i })).toBeVisible();
});

test("UTS selected majors keep the shared component renderer", async ({ page }) => {
  const contract = genericComponentContract(uts, "C09066", "Bachelor of Engineering (Honours)",
    "MAJ03472", "Biomedical Engineering", "41082");
  await routeDegree(page, contract.detail, [contract.component]);
  await openDegree(page, contract.detail);
  const section = page.getByRole("button", { name: /Required major.*Choose one/i }).locator("..");
  await section.getByRole("radio", { name: /Biomedical Engineering/ }).check();
  await expect(section.getByText("Selected major", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Eligible Table D units" })).toHaveCount(0);
  const core = section.getByRole("button", { name: /Core units.*ALL/i });
  await core.click();
  await expect(section.getByRole("button", { name: /View 41082/i })).toBeVisible();
});

test("a one-option ONE_OF component group selects and loads its sole component automatically", async ({ page }) => {
  const contract = genericComponentContract(usyd, "ONEOPTION-01", "One-option test degree",
    "USYD:SPECIALISATION:SOLE", "Sole Specialisation", "SOLE1001");
  contract.detail.requirements[0]!.items = contract.detail.requirements[0]!.items.slice(0, 1);
  contract.detail.requirements[0]!.items[0]!.component!.type = "SPECIALISATION";
  contract.component.component.type = "SPECIALISATION";
  contract.component.component.originalType = "SPECIALISATION";
  const requests: string[] = [];
  await routeDegree(page, contract.detail, [contract.component], (identifier) => requests.push(identifier));
  await openDegree(page, contract.detail);

  const section = page.getByRole("button", { name: /Required major.*Choose one/i }).locator("..");
  await expect(section.getByRole("radio")).toHaveCount(0);
  await expect.poll(() => requests).toContain("USYD:SPECIALISATION:SOLE-id");
  await expect(section.getByText("Selected specialisation", { exact: true })).toBeVisible();
  const core = section.getByRole("button", { name: /Core units.*ALL/i });
  await core.click();
  await expect(section.getByRole("button", { name: /View SOLE1001/i })).toBeVisible();
});
