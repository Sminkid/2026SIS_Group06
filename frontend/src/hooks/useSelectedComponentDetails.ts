import { useEffect, useMemo, useState } from "react";
import { fetchComponentDetail } from "../api/components";
import type { ComponentDetailResponse } from "../types/handbook";

export const useSelectedComponentDetails = (
  componentCodes: string[],
  universityCode: string,
  handbookYear: number,
) => {
  const key = componentCodes.join("|");
  const [details, setDetails] = useState<Record<string, ComponentDetailResponse>>({});
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");

  useEffect(() => {
    if (componentCodes.length === 0) {
      setDetails({});
      setStatus("idle");
      return;
    }
    const controller = new AbortController();
    setStatus("loading");
    void Promise.all(componentCodes.map((code) =>
      fetchComponentDetail(code, universityCode, handbookYear, controller.signal)))
      .then((responses) => {
        setDetails(Object.fromEntries(responses.map((detail) => [detail.component.code, detail])));
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) setStatus("error");
      });
    return () => controller.abort();
  }, [handbookYear, key, universityCode]);

  return useMemo(() => ({ details, status }), [details, status]);
};
