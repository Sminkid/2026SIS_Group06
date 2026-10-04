import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchRequirementCandidateSubjects } from "../api/requirementCandidateSources";
import { mergeCandidateSubjectPages } from "../domain/candidateSubjects";
import type { RequirementCandidateSourceSummary, RequirementCandidateSubjectsResponse } from "../types/handbook";

type Page = RequirementCandidateSubjectsResponse & { loadingMore?: boolean };

/** Pages authoritative sources lazily; generation checks prevent an old search replacing a new one. */
export function useRequirementCandidateSubjects(sources: RequirementCandidateSourceSummary[], active: boolean, query: string) {
  const [pages, setPages] = useState<Record<string, Page>>({});
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [retryKey, setRetryKey] = useState(0);
  const [pageError, setPageError] = useState("");
  const generation = useRef(0);
  const moreRequests = useRef(new Map<string, AbortController>());
  const sourceKey = sources.map(source => source.id).sort().join("|");
  useEffect(() => {
    const current = ++generation.current;
    const controller = new AbortController();
    moreRequests.current.forEach(request => request.abort()); moreRequests.current.clear();
    setPages({}); setPageError("");
    if (!active || !sources.length) { setStatus("idle"); return () => controller.abort(); }
    setStatus("loading");
    void Promise.all(sources.map(source => fetchRequirementCandidateSubjects({ sourceId: source.id, query: query || undefined, signal: controller.signal })))
      .then(responses => { if (current === generation.current && !controller.signal.aborted) {
        setPages(Object.fromEntries(responses.map(page => [page.candidateSource.id, page]))); setStatus("ready");
      } }).catch(() => { if (current === generation.current && !controller.signal.aborted) setStatus("error"); });
    return () => { controller.abort(); ++generation.current; moreRequests.current.forEach(request => request.abort()); moreRequests.current.clear(); };
  }, [active, sourceKey, query, retryKey]);
  const loadMore = useCallback((id: string) => {
    const page = pages[id];
    if (!page || page.loadingMore || page.pagination.page >= page.pagination.totalPages || moreRequests.current.has(id)) return;
    const controller = new AbortController(); const current = generation.current;
    moreRequests.current.set(id, controller); setPageError("");
    setPages(value => ({ ...value, [id]: { ...page, loadingMore: true } }));
    void fetchRequirementCandidateSubjects({ sourceId: id, query: query || undefined, page: page.pagination.page + 1, signal: controller.signal })
      .then(next => { if (current === generation.current && !controller.signal.aborted) setPages(value => ({ ...value, [id]: {
        ...next, subjects: [...(value[id]?.subjects ?? []), ...next.subjects], loadingMore: false,
      } })); }).catch(() => { if (current === generation.current && !controller.signal.aborted) {
        setPages(value => ({ ...value, [id]: { ...page, loadingMore: false } })); setPageError("Couldn't load the next page. Try again.");
      } }).finally(() => { if (moreRequests.current.get(id) === controller) moreRequests.current.delete(id); });
  }, [pages, query]);
  const results = useMemo(() => mergeCandidateSubjectPages(Object.values(pages).map(page => ({ source: page.candidateSource, subjects: page.subjects }))), [pages]);
  return { pages, results, status, pageError, loadMore, retry: () => setRetryKey(key => key + 1) };
}
