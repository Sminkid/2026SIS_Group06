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
  requirements: [streamPool()],
  completionSummary: [
    summary("foundation", "a minimum of 18 credit points from the Engineering Foundations Table", 18),
    summary("projects", "a minimum of 30 credit points from the Engineering Projects Table", 30),
    summary("pep", "successfully complete the requirements of the Professional Engagement Program", null),
    summary("stream", "a minimum of 120 credit points from the Engineering Stream Table", 120),
    summary("electives", "a maximum of 24 credit points from Table S", 24),
    summary("specialisation", "the Engineering Specialisations Tables", null, "OPTIONAL"),
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
  ],
};

const routeDegree = async (
  page: Page,
  detail: DegreeDetailResponse,
  componentDetails: ComponentDetailResponse[],
  onComponentRequest?: (identifier: string) => void,
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

test("selecting a Software Engineering STREAM loads and renders all component subject groups", async ({ page }) => {
  const componentRequests: string[] = [];
  await routeDegree(page, engineeringDetail, [softwareDetail], (identifier) => componentRequests.push(identifier));
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
  const core = section.getByRole("button", { name: /Core units.*ALL/i });
  await core.click();
  await expect(section.getByRole("button", { name: /View 41082/i })).toBeVisible();
});
