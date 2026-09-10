import { useEffect, useRef, useState } from "react";
import { fetchComponentDetail } from "../api/components";
import { createLatestRequestGate, type ComponentDetailStatus } from "../domain/componentDetailState";
import type { ComponentDetailResponse } from "../types/handbook";

const isAbortError = (error: unknown) => error instanceof DOMException && error.name === "AbortError";

export const useComponentDetail = (
  componentId: string,
  universityCode: string,
  handbookYear: number,
) => {
  const [detail, setDetail] = useState<ComponentDetailResponse | null>(null);
  const [status, setStatus] = useState<ComponentDetailStatus>("loading");
  const [reloadKey, setReloadKey] = useState(0);
  const gate = useRef<ReturnType<typeof createLatestRequestGate> | null>(null);
  gate.current ??= createLatestRequestGate();

  useEffect(() => {
    const controller = new AbortController();
    const request = gate.current!.begin();
    setStatus("loading");
    setDetail(null);
    void fetchComponentDetail(componentId, universityCode, handbookYear, controller.signal)
      .then((result) => {
        if (!gate.current!.isLatest(request)) return;
        setDetail(result);
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (!gate.current!.isLatest(request) || isAbortError(error)) return;
        setDetail(null);
        setStatus("error");
      });
    return () => {
      gate.current!.invalidate();
      controller.abort();
    };
  }, [componentId, handbookYear, reloadKey, universityCode]);

  return { detail, status, retry: () => setReloadKey((key) => key + 1) };
};

