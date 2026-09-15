import { useEffect, useState } from "react";
import { fetchUniversities, fetchLatestHandbook, fetchDegrees } from "../api/universities";
import { matchCourses, type CourseRecommendation } from "../domain/courseAggregation";
import type { QuizResult } from "../domain/quizRecommendation";

export const useCourseRecommendations = (result: QuizResult) => {
  const [courses, setCourses] = useState<CourseRecommendation[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    void (async () => {
      const universities = await fetchUniversities(controller.signal);
      const degreesByUniversity: Record<string, ReturnType<typeof fetchDegrees> extends Promise<infer T> ? T : never> = {};
      for (const university of universities) {
        const handbook = await fetchLatestHandbook(university.code, controller.signal);
        degreesByUniversity[university.code] = await fetchDegrees(university.code, handbook.year, controller.signal);
      }
      setCourses(matchCourses(result.recommendedCourseKeywords, universities, degreesByUniversity));
      setStatus("ready");
    })().catch((error: unknown) => {
      if (!(error instanceof DOMException && error.name === "AbortError")) setStatus("error");
    });
    return () => controller.abort();
  }, [result]);

  return { courses, status };
};