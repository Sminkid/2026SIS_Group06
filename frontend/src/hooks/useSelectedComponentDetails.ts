import { useEffect, useMemo, useRef, useState } from "react";
import { fetchComponentDetail } from "../api/components";
import { createLatestRequestGate, type ComponentDetailStatus } from "../domain/componentDetailState";
import type { ComponentDetailResponse } from "../types/handbook";

export const useSelectedComponentDetails = (
  components: Array<{ id: string; code: string }>,
  selectedComponentCodes: string[],
  universityCode: string,
  handbookYear: number,
) => {
  const key = `${components.map((component) => component.id).join("|")}:${selectedComponentCodes.join("|")}`;
  const [details, setDetails] = useState<Record<string, ComponentDetailResponse>>({});
  const [status, setStatus] = useState<ComponentDetailStatus>("idle");
  const gate = useRef<ReturnType<typeof createLatestRequestGate> | null>(null);
  gate.current ??= createLatestRequestGate();

  useEffect(() => {
    if (components.length === 0) {
      setDetails({});
      setStatus("idle");
      return;
    }
    const controller = new AbortController();
    const request = gate.current!.begin();
    setStatus("loading");
    const loadSelected = async () => {
      const references = new Map(components.map((component) => [component.code, component]));
      const responses = new Map<string, ComponentDetailResponse>();
      while (true) {
        const pending = selectedComponentCodes.flatMap((code) => {
          const reference = references.get(code);
          return reference && !responses.has(code) ? [reference] : [];
        });
        if (pending.length === 0) break;
        const loaded = await Promise.all(pending.map((component) =>
          fetchComponentDetail(component.id, universityCode, handbookYear, controller.signal)));
        for (const detail of loaded) {
          responses.set(detail.component.code, detail);
          const visit = (groups: ComponentDetailResponse["requirements"]) => groups.forEach((group) => {
            group.items.forEach((item) => {
              if (item.component) references.set(item.component.code, item.component);
            });
            visit(group.children);
          });
          visit(detail.requirements);
        }
      }
      return Object.fromEntries(responses);
    };
    void loadSelected()
      .then((loadedDetails) => {
        if (!gate.current!.isLatest(request)) return;
        setDetails(loadedDetails);
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (!gate.current!.isLatest(request)) return;
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setDetails({});
          setStatus("error");
        }
      });
    return () => {
      gate.current!.invalidate();
      controller.abort();
    };
  }, [handbookYear, key, universityCode]);

  return useMemo(() => ({ details, status }), [details, status]);
};
