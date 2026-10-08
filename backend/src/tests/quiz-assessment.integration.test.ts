import assert from "node:assert/strict";
import type { Server } from "node:http";
import { once } from "node:events";
import { after, before, describe, test } from "node:test";

import { createApp } from "../app.js";
import { disconnectPrisma } from "../db/prisma.js";

interface QuestionRef {
  id: string;
  categoryId: string;
  subcategoryId: string | null;
  text: string;
}

interface StartSessionResponse {
  sessionId: string;
  questions: QuestionRef[];
}

interface ScreeningResponse {
  rankedCategoryIds: string[];
  closingQuestions: QuestionRef[];
  recommendations: { degreeId: string; code: string; name: string; matchScore: number }[];
}

interface AssessmentResult {
  rankedCategoryIds: string[];
  categoryScores: Record<string, number>;
  subcategoryScores: Record<string, number>;
  recommendation: { name: string; code: string; type: string; matchScore: number; usedSubcategoryData: boolean } | null;
}

describe("database-backed Quiz Assessment API", { skip: !process.env.DATABASE_URL }, () => {
  let server: Server;
  let baseUrl: string;

  const get = async <T>(path: string): Promise<T> => {
    const response = await fetch(`${baseUrl}${path}`);
    const body = await response.text();
    assert.equal(response.status, 200, `${path}: ${body}`);
    return JSON.parse(body) as T;
  };

  const post = async <T>(path: string, data: unknown, expectedStatus = 200): Promise<T> => {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const body = await response.text();
    assert.equal(response.status, expectedStatus, `${path}: ${body}`);
    return body ? (JSON.parse(body) as T) : (undefined as T);
  };

  before(async () => {
    server = createApp().listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    assert.ok(address && typeof address === "object");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
    await disconnectPrisma();
  });

  test("starting a session returns 18 screening questions", async () => {
    const session = await post<StartSessionResponse>("/api/assessment/sessions", {}, 201);
    assert.ok(session.sessionId);
    assert.equal(session.questions.length, 18);
  });

  test("riasec-labels returns 6 categories, each with a short description", async () => {
    const labels = await get<{ categories: { id: string; name: string; description: string | null }[] }>(
      "/api/assessment/riasec-labels",
    );
    assert.equal(labels.categories.length, 6);
    for (const category of labels.categories) {
      assert.ok(category.description && category.description.length > 0, `${category.id} should have a description`);
    }
  });

  test("submitting screening responses for an unknown session returns 404", async () => {
    await post("/api/assessment/sessions/does-not-exist/screening-responses", { responses: [] }, 404);
  });

  test("starting drill-down before screening is completed returns 409", async () => {
    const session = await post<StartSessionResponse>("/api/assessment/sessions", {}, 201);
    await post(`/api/assessment/sessions/${session.sessionId}/drill-down`, {}, 409);
  });

  test("drill-down allocates the 8/6/5/3/2/1 split across ranked categories", async () => {
    const session = await post<StartSessionResponse>("/api/assessment/sessions", {}, 201);
    const responses = session.questions.map((q) => ({ questionId: q.id, value: 3 }));
    const screening = await post<ScreeningResponse>(
      `/api/assessment/sessions/${session.sessionId}/screening-responses`,
      { responses },
    );
    const closingResponses = screening.closingQuestions.map((q) => ({ questionId: q.id, value: 3 }));
    await post(`/api/assessment/sessions/${session.sessionId}/closing-responses`, { responses: closingResponses });
    const drillDown = await post<{ questions: QuestionRef[] }>(
      `/api/assessment/sessions/${session.sessionId}/drill-down`,
      {},
    );
    assert.equal(drillDown.questions.length, 25);

    const countByCategory = new Map<string, number>();
    for (const q of drillDown.questions) countByCategory.set(q.categoryId, (countByCategory.get(q.categoryId) ?? 0) + 1);
    const countsInRankOrder = screening.rankedCategoryIds.map((id) => countByCategory.get(id) ?? 0);
    assert.deepEqual(countsInRankOrder, [8, 6, 5, 3, 2, 1]);
  });

  test("a category's final score shifts when second-tier (drill-down) answers diverge from screening", async () => {
    const runFlow = async (drillDownValue: number) => {
      const session = await post<StartSessionResponse>("/api/assessment/sessions", {}, 201);
      const responses = session.questions.map((q) => ({ questionId: q.id, value: 3 }));
      const screening = await post<ScreeningResponse>(
        `/api/assessment/sessions/${session.sessionId}/screening-responses`,
        { responses },
      );
      const closingResponses = screening.closingQuestions.map((q) => ({ questionId: q.id, value: drillDownValue }));
      await post(`/api/assessment/sessions/${session.sessionId}/closing-responses`, { responses: closingResponses });
      const drillDown = await post<{ questions: QuestionRef[] }>(
        `/api/assessment/sessions/${session.sessionId}/drill-down`,
        {},
      );
      const drillDownResponses = drillDown.questions.map((q) => ({ questionId: q.id, value: drillDownValue }));
      const result = await post<AssessmentResult>(
        `/api/assessment/sessions/${session.sessionId}/drill-down-responses`,
        { responses: drillDownResponses },
      );
      const rank1 = screening.rankedCategoryIds[0]!;
      return result.categoryScores[rank1]!;
    };

    const lowScore = await runFlow(1);
    const highScore = await runFlow(5);
    assert.notEqual(lowScore, highScore, "the rank-1 category's blended score should shift with different drill-down answers");
    assert.ok(highScore > lowScore);
  });

  test("engineering-leaning persona: full flow targeted at a real Engineering degree recommends an Engineering major", async () => {
    const ENGINEERING_SUBCATEGORY = "riasec-realistic-engineering";

    const session = await post<StartSessionResponse>("/api/assessment/sessions", {}, 201);
    const screeningResponses = session.questions.map((q) => ({
      questionId: q.id,
      value: q.categoryId === "riasec-realistic" || q.categoryId === "riasec-investigative" ? 5 : 1,
    }));
    const screening = await post<ScreeningResponse>(
      `/api/assessment/sessions/${session.sessionId}/screening-responses`,
      { responses: screeningResponses },
    );

    const closingResponses = screening.closingQuestions.map((q) => ({
      questionId: q.id,
      value: q.subcategoryId === ENGINEERING_SUBCATEGORY ? 5 : 4,
    }));
    await post(`/api/assessment/sessions/${session.sessionId}/closing-responses`, { responses: closingResponses });

    const drillDown = await post<{ questions: QuestionRef[] }>(
      `/api/assessment/sessions/${session.sessionId}/drill-down`,
      {},
    );
    const drillDownResponses = drillDown.questions.map((q) => {
      if (q.subcategoryId === ENGINEERING_SUBCATEGORY) return { questionId: q.id, value: 5 };
      if (q.categoryId === "riasec-realistic" || q.categoryId === "riasec-investigative") {
        return { questionId: q.id, value: 4 };
      }
      return { questionId: q.id, value: 1 };
    });

    // C09066 (UTS, Bachelor of Engineering (Honours)) - every major/stream in this
    // degree is an engineering discipline, so a confident, subcategory-informed match
    // within it is a meaningful assertion that the quiz correctly steered an
    // engineering-leaning persona toward engineering, not a coincidence of naming.
    const result = await post<AssessmentResult>(
      `/api/assessment/sessions/${session.sessionId}/drill-down-responses?degreeCode=C09066&university=UTS&year=2026`,
      { responses: drillDownResponses },
    );

    assert.ok(
      result.rankedCategoryIds[0] === "riasec-realistic" || result.rankedCategoryIds[0] === "riasec-investigative",
      `expected Realistic or Investigative to rank first, got ${result.rankedCategoryIds[0]}`,
    );
    assert.ok(result.recommendation, "expected a recommendation for a real Engineering degree target");
    assert.match(result.recommendation!.name, /engineering/i);
    assert.equal(
      result.recommendation!.usedSubcategoryData,
      true,
      "expected subcategory-level matching, not the coarse category-only fallback",
    );
    assert.ok(result.recommendation!.matchScore > 0.5, `expected a confident match, got ${result.recommendation!.matchScore}`);
  });

  test("music-leaning persona: full flow targeted at a real Music degree recommends the Music stream", async () => {
    const MUSIC_SUBCATEGORY = "riasec-artistic-music";

    const session = await post<StartSessionResponse>("/api/assessment/sessions", {}, 201);
    const screeningResponses = session.questions.map((q) => ({
      questionId: q.id,
      value: q.categoryId === "riasec-artistic" ? 5 : 1,
    }));
    const screening = await post<ScreeningResponse>(
      `/api/assessment/sessions/${session.sessionId}/screening-responses`,
      { responses: screeningResponses },
    );

    const closingResponses = screening.closingQuestions.map((q) => ({
      questionId: q.id,
      value: q.subcategoryId === MUSIC_SUBCATEGORY ? 5 : 4,
    }));
    await post(`/api/assessment/sessions/${session.sessionId}/closing-responses`, { responses: closingResponses });

    const drillDown = await post<{ questions: QuestionRef[] }>(
      `/api/assessment/sessions/${session.sessionId}/drill-down`,
      {},
    );
    const drillDownResponses = drillDown.questions.map((q) => {
      if (q.subcategoryId === MUSIC_SUBCATEGORY) return { questionId: q.id, value: 5 };
      if (q.categoryId === "riasec-artistic") return { questionId: q.id, value: 4 };
      return { questionId: q.id, value: 1 };
    });

    // C10276 (UTS, Bachelor of Creative Production in Music and Sound Design) - its
    // "Music and Sound Design Stream" literally names the field, same as the Engineering case.
    const result = await post<AssessmentResult>(
      `/api/assessment/sessions/${session.sessionId}/drill-down-responses?degreeCode=C10276&university=UTS&year=2026`,
      { responses: drillDownResponses },
    );

    assert.equal(result.rankedCategoryIds[0], "riasec-artistic", `expected Artistic to rank first, got ${result.rankedCategoryIds[0]}`);
    assert.ok(result.recommendation, "expected a recommendation for a real Music degree target");
    assert.match(result.recommendation!.name, /music/i);
    assert.equal(
      result.recommendation!.usedSubcategoryData,
      true,
      "expected subcategory-level matching, not the coarse category-only fallback",
    );
    assert.ok(result.recommendation!.matchScore > 0.5, `expected a confident match, got ${result.recommendation!.matchScore}`);
  });

  test("nursing-leaning persona: full flow targeted at a real Nursing degree recommends one of its streams", async () => {
    const HEALTH_CARE_SUBCATEGORY = "riasec-social-health-care";

    const session = await post<StartSessionResponse>("/api/assessment/sessions", {}, 201);
    const screeningResponses = session.questions.map((q) => ({
      questionId: q.id,
      value: q.categoryId === "riasec-social" ? 5 : 1,
    }));
    const screening = await post<ScreeningResponse>(
      `/api/assessment/sessions/${session.sessionId}/screening-responses`,
      { responses: screeningResponses },
    );

    const closingResponses = screening.closingQuestions.map((q) => ({
      questionId: q.id,
      value: q.subcategoryId === HEALTH_CARE_SUBCATEGORY ? 5 : 4,
    }));
    await post(`/api/assessment/sessions/${session.sessionId}/closing-responses`, { responses: closingResponses });

    const drillDown = await post<{ questions: QuestionRef[] }>(
      `/api/assessment/sessions/${session.sessionId}/drill-down`,
      {},
    );
    const drillDownResponses = drillDown.questions.map((q) => {
      if (q.subcategoryId === HEALTH_CARE_SUBCATEGORY) return { questionId: q.id, value: 5 };
      if (q.categoryId === "riasec-social") return { questionId: q.id, value: 4 };
      return { questionId: q.id, value: 1 };
    });

    // C10122 (UTS, Bachelor of Nursing) - unlike Engineering/Music, neither of this degree's
    // two streams ("Standard Program", "Enrolled Nurse") literally says "Nursing" in its name,
    // so this asserts structurally (which specific stream, confident subcategory-informed
    // match) rather than on a name regex.
    const result = await post<AssessmentResult>(
      `/api/assessment/sessions/${session.sessionId}/drill-down-responses?degreeCode=C10122&university=UTS&year=2026`,
      { responses: drillDownResponses },
    );

    assert.equal(result.rankedCategoryIds[0], "riasec-social", `expected Social to rank first, got ${result.rankedCategoryIds[0]}`);
    assert.ok(result.recommendation, "expected a recommendation for a real Nursing degree target");
    assert.ok(
      ["STM91997", "STM91472"].includes(result.recommendation!.code),
      `expected one of Bachelor of Nursing's two streams, got ${result.recommendation!.code}`,
    );
    assert.equal(
      result.recommendation!.usedSubcategoryData,
      true,
      "expected subcategory-level matching, not the coarse category-only fallback",
    );
    assert.ok(result.recommendation!.matchScore > 0.5, `expected a confident match, got ${result.recommendation!.matchScore}`);
  });
});
