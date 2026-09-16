import assert from "node:assert/strict";
import type { Server } from "node:http";
import { once } from "node:events";
import { after, before, describe, test } from "node:test";

import { createApp } from "../app.js";
import { disconnectPrisma } from "../db/prisma.js";
import type { ComponentDetailResponse } from "../types/component.js";
import type { DegreeDetailResponse, DegreeRequirementGroup } from "../types/degree.js";
import type { SubjectDetailResponse } from "../types/subject.js";

const expectedEngineeringStreams = [
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

const flattenGroups = (groups: DegreeRequirementGroup[]): DegreeRequirementGroup[] =>
  groups.flatMap((group) => [group, ...flattenGroups(group.children)]);

const componentItems = (detail: DegreeDetailResponse) =>
  flattenGroups(detail.requirements)
    .flatMap((group) => group.items)
    .flatMap((item) => item.component ? [item.component] : []);

describe("database-backed Course Structure API", { skip: !process.env.DATABASE_URL }, () => {
  let server: Server;
  let baseUrl: string;
  let engineering: DegreeDetailResponse;
  let engineeringStreams: Map<string, ComponentDetailResponse>;
  let software: ComponentDetailResponse;
  let elec5760: SubjectDetailResponse;
  let advancedComputing: DegreeDetailResponse;
  let cybersecurity: ComponentDetailResponse;
  let utsEngineering: DegreeDetailResponse;
  let utsBiomedical: ComponentDetailResponse;

  const get = async <T>(path: string): Promise<T> => {
    const response = await fetch(`${baseUrl}${path}`);
    const body = await response.text();
    assert.equal(response.status, 200, `${path}: ${body}`);
    return JSON.parse(body) as T;
  };

  before(async () => {
    server = createApp().listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    assert.ok(address && typeof address === "object");
    baseUrl = `http://127.0.0.1:${address.port}`;

    engineering = await get<DegreeDetailResponse>(
      "/api/degrees/BHENGINE-04?university=USYD&year=2026",
    );
    const streamComponents = componentItems(engineering).filter((component) => component.type === "STREAM");
    engineeringStreams = new Map(await Promise.all(streamComponents.map(async (component) => [
      component.name,
      await get<ComponentDetailResponse>(
        `/api/components/${encodeURIComponent(component.id)}?university=USYD&year=2026`,
      ),
    ] as const)));
    const softwareComponent = streamComponents.find((component) => component.name === "Software Engineering");
    assert.ok(softwareComponent, "Software Engineering must be discoverable from BHENGINE-04");
    software = engineeringStreams.get("Software Engineering")!;
    elec5760 = await get<SubjectDetailResponse>(
      "/api/subjects/ELEC5760?university=USYD&year=2026",
    );

    advancedComputing = await get<DegreeDetailResponse>(
      "/api/degrees/BPADVCMP-01?university=USYD&year=2026",
    );
    const cybersecurityComponent = componentItems(advancedComputing).find(
      (component) => component.name === "Cybersecurity",
    );
    assert.ok(cybersecurityComponent, "Cybersecurity must remain selectable in Advanced Computing");
    cybersecurity = await get<ComponentDetailResponse>(
      `/api/components/${encodeURIComponent(cybersecurityComponent.id)}?university=USYD&year=2026`,
    );

    utsEngineering = await get<DegreeDetailResponse>(
      "/api/degrees/C09066?university=UTS&year=2026",
    );
    const biomedicalComponent = componentItems(utsEngineering).find(
      (component) => component.code === "MAJ03472",
    );
    assert.ok(biomedicalComponent, "UTS Biomedical Engineering must remain selectable");
    utsBiomedical = await get<ComponentDetailResponse>(
      `/api/components/${encodeURIComponent(biomedicalComponent.id)}?university=UTS&year=2026`,
    );
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await disconnectPrisma();
  });

  test("BHENGINE-04 exposes all Engineering stream candidates", () => {
    const streams = componentItems(engineering)
      .filter((component) => component.type === "STREAM")
      .map((component) => component.name)
      .sort();
    assert.deepEqual(streams, [...expectedEngineeringStreams].sort());
  });

  test("BHENGINE-04 exposes the repaired Engineering Core groups", () => {
    const groups = new Map(flattenGroups(engineering.requirements).map((group) => [group.title, group]));
    const foundation = groups.get("Foundation");
    const projects = groups.get("Engineering Projects");
    const pep = groups.get("Professional Engagement Program");
    assert.ok(foundation && projects && pep);
    assert.equal(foundation.requiredCreditPoints, 18);
    assert.equal(foundation.items.length, 5);
    assert.deepEqual(foundation.items.map((item) => item.subject?.code),
      ["INFO1110", "INFO1910", "ENGG1810", "MATH1061", "MATH1062"]);
    assert.equal(projects.requiredCreditPoints, 30);
    assert.equal(projects.items.length, 28);
    assert.deepEqual(pep.items.map((item) => item.subject?.code), [
      "ENGP1001", "ENGP1002", "ENGP1003", "ENGP2001",
      "ENGP2002", "ENGP2003", "ENGP3001", "ENGP3002",
    ]);
  });

  test("all Engineering streams expose their persisted Specialisation counts", () => {
    const expected = new Map([
      ["Aeronautical Engineering", 2],
      ["Aeronautical Engineering with Space", 2],
      ["Biomedical Engineering", 4],
      ["Chemical and Biomolecular Engineering", 4],
      ["Civil Engineering", 7],
      ["Electrical Engineering", 5],
      ["Environmental Engineering", 3],
      ["Mechanical Engineering", 6],
      ["Mechanical Engineering with Space", 6],
      ["Mechatronic Engineering", 1],
      ["Mechatronic Engineering with Space", 1],
      ["Software Engineering", 4],
    ]);
    assert.equal(engineeringStreams.size, expected.size);
    let total = 0;
    for (const [streamName, count] of expected) {
      const group = engineeringStreams.get(streamName)?.requirements.find((candidate) =>
        candidate.title === "Specialisation");
      assert.ok(group, `${streamName} must expose a Specialisation group`);
      assert.equal(group.logic, "ONE_OF");
      assert.equal(group.items.length, count, streamName);
      assert.ok(group.items.every((item) => item.itemType === "COMPONENT"
        && item.component?.type === "SPECIALISATION"), streamName);
      total += group.items.length;
    }
    assert.equal(total, 45);
  });

  test("Software Engineering preserves its three subject groups alongside Specialisation", () => {
    assert.deepEqual(software.requirements.slice(0, 3).map((group) => group.title), [
      "Stream Core units",
      "1000/2000 Level Stream Elective units",
      "3000+ Level Stream Elective Units",
    ]);
    assert.deepEqual(software.requirements.slice(0, 3).map((group) => group.items.length), [16, 21, 86]);
  });

  test("Software Engineering returns resolved subject rows", () => {
    const subjects = flattenGroups(software.requirements)
      .flatMap((group) => group.items)
      .flatMap((item) => item.subject ? [item.subject] : []);
    assert.equal(subjects.length, 123);
    for (const code of ["INFO1113", "COMP2017", "COMP2123", "ELEC5760"]) {
      assert.ok(subjects.some((subject) => subject.code === code), `${code} should be resolved`);
    }
  });

  test("ELEC5760 resolves through both component and subject APIs", () => {
    const componentSubject = flattenGroups(software.requirements)
      .flatMap((group) => group.items)
      .find((item) => item.subject?.code === "ELEC5760")?.subject;
    assert.ok(componentSubject);
    assert.equal(componentSubject.name, "Intelligent Networked Control");
    assert.equal(elec5760.id, componentSubject.id);
    assert.equal(elec5760.creditPoints, 6);
  });

  test("BHENGINE-04 has no duplicate Engineering stream candidates", () => {
    const streams = componentItems(engineering).filter((component) => component.type === "STREAM");
    assert.equal(new Set(streams.map((component) => component.id)).size, streams.length);
    assert.equal(new Set(streams.map((component) => component.name)).size, streams.length);
  });

  test("USYD Advanced Computing retains generic component requirements", () => {
    assert.equal(cybersecurity.component.name, "Cybersecurity");
    assert.equal(cybersecurity.component.type, "MAJOR");
    assert.ok(cybersecurity.requirements.some((group) =>
      group.title === "Core units (major only)"
      && group.items.every((item) => item.subject !== null)));
  });

  test("UTS degree and component mapping remain unchanged", () => {
    assert.ok(utsEngineering.requirements.some((group) => group.title === "Core - Engineering"));
    assert.ok(componentItems(utsEngineering).some((component) => component.code === "MAJ03472"));
    assert.equal(utsBiomedical.component.name, "Biomedical Engineering");
    assert.ok(utsBiomedical.requirements.some((group) =>
      group.title === "Core" && group.items.some((item) => item.subject !== null)));
  });
});
