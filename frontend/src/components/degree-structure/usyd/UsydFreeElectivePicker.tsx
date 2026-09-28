import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { fetchRequirementCandidateSubjects } from "../../../api/requirementCandidateSources";
import { mergeCandidateSubjectPages } from "../../../domain/candidateSubjects";
import type { RequirementCandidateSourceSummary, RequirementCandidateSubjectsResponse } from "../../../types/handbook";
import { AsyncState } from "../../AsyncState";

interface Props {
  candidateSources: RequirementCandidateSourceSummary[];
  onOpenSubject: (subjectCode: string) => void;
}

type LoadedSource = RequirementCandidateSubjectsResponse & { loadingMore?: boolean };

export const UsydFreeElectivePicker = ({ candidateSources, onOpenSubject }: Props) => {
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [loaded, setLoaded] = useState<Record<string, LoadedSource>>({});
  const requestRef = useRef<AbortController | null>(null);
  const loadMoreRequestsRef = useRef(new Map<string, AbortController>());
  const requestGenerationRef = useRef(0);

  const search = useCallback((searchQuery: string) => {
    requestRef.current?.abort();
    loadMoreRequestsRef.current.forEach((request) => request.abort());
    loadMoreRequestsRef.current.clear();
    const generation = requestGenerationRef.current + 1;
    requestGenerationRef.current = generation;
    const controller = new AbortController();
    requestRef.current = controller;
    setStatus("loading");
    setMessage("");
    setActiveQuery(searchQuery);
    void Promise.all(candidateSources.map((source) => fetchRequirementCandidateSubjects({
      sourceId: source.id, query: searchQuery || undefined, signal: controller.signal,
    }))).then((responses) => {
      if (generation !== requestGenerationRef.current) return;
      setLoaded(Object.fromEntries(responses.map((response) => [response.candidateSource.id, response])));
      setStatus("ready");
    }).catch((error: unknown) => {
      if (generation === requestGenerationRef.current
        && !(error instanceof DOMException && error.name === "AbortError")) setStatus("error");
    });
  }, [candidateSources]);

  useEffect(() => {
    search("");
    return () => {
      requestGenerationRef.current += 1;
      requestRef.current?.abort();
      loadMoreRequestsRef.current.forEach((request) => request.abort());
      loadMoreRequestsRef.current.clear();
    };
  }, [search]);

  const results = useMemo(() => mergeCandidateSubjectPages(Object.values(loaded).map((response) => ({
    source: response.candidateSource,
    subjects: response.subjects,
  }))), [loaded]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const normalized = query.trim();
    if (normalized.length === 1) {
      setMessage("Enter at least two characters, or clear the search to browse eligible subjects.");
      return;
    }
    search(normalized);
  };

  const loadMore = (source: RequirementCandidateSourceSummary) => {
    const current = loaded[source.id];
    if (!current || current.loadingMore || current.pagination.page >= current.pagination.totalPages) return;
    loadMoreRequestsRef.current.get(source.id)?.abort();
    const controller = new AbortController();
    const generation = requestGenerationRef.current;
    loadMoreRequestsRef.current.set(source.id, controller);
    setLoaded((value) => ({ ...value, [source.id]: { ...current, loadingMore: true } }));
    void fetchRequirementCandidateSubjects({
      sourceId: source.id,
      query: activeQuery || undefined,
      page: current.pagination.page + 1,
      signal: controller.signal,
    }).then((response) => {
      if (generation !== requestGenerationRef.current) return;
      setLoaded((value) => ({
        ...value,
        [source.id]: {
          ...response,
          subjects: [...(value[source.id]?.subjects ?? []), ...response.subjects],
          loadingMore: false,
        },
      }));
    }).catch((error: unknown) => {
      if (generation !== requestGenerationRef.current
        || (error instanceof DOMException && error.name === "AbortError")) return;
      setLoaded((value) => ({ ...value, [source.id]: { ...current, loadingMore: false } }));
    }).finally(() => {
      if (loadMoreRequestsRef.current.get(source.id) === controller) loadMoreRequestsRef.current.delete(source.id);
    });
  };

  return <section className="mt-5 grid gap-4 border-t border-solid border-slate-200 pt-5" aria-labelledby="free-elective-picker-heading">
    <div><h4 className="m-0 text-base" id="free-elective-picker-heading">Eligible Free Elective subjects</h4>
      <p className="mb-0 mt-1 text-sm text-slate-600">Eligibility is the union of these sources. Subjects found in both are shown once.</p></div>
    <ul className="m-0 grid list-none gap-2 p-0" aria-label="Free Elective eligibility sources">
      {candidateSources.map((source) => <li className="flex flex-wrap justify-between gap-2 rounded bg-slate-100 px-3 py-2 text-sm" key={source.id}>
        <span>{source.title}</span><strong>{source.candidateCount.toLocaleString()} subjects</strong>
      </li>)}
    </ul>
    <form className="grid gap-2" onSubmit={submit}><label className="text-sm font-bold" htmlFor="free-elective-query">Search eligible subjects by code or name</label>
      <div className="flex flex-wrap gap-2"><input className="min-w-0 flex-1" id="free-elective-query" type="search" value={query}
        onChange={(event) => setQuery(event.target.value)} placeholder="For example, COMP or accounting" />
        <button className="rounded bg-slate-900 px-4 py-2 text-sm font-bold text-white" type="submit">Search eligible subjects</button></div>
      {message && <p className="m-0 text-sm text-red-700" role="alert">{message}</p>}
    </form>
    <div aria-live="polite">
      {status === "loading" && <AsyncState kind="loading" label="Loading eligible Free Elective subjects" />}
      {status === "error" && <AsyncState kind="error" label="We couldn't load eligible Free Elective subjects." onRetry={() => search(activeQuery)} />}
      {status === "ready" && results.length === 0 && <AsyncState kind="empty" label="No eligible subjects match this search." />}
      {status === "ready" && results.length > 0 && <div className="grid gap-2">
        <p className="m-0 text-sm text-slate-600">Showing {results.length} unique eligible subjects from the pages loaded below.</p>
        {results.map((subject) => <button className="grid grid-cols-[auto_1fr_auto] items-center gap-3 border border-solid border-slate-200 bg-white p-3 text-left" type="button"
          onClick={() => onOpenSubject(subject.code)} aria-label={`View eligible subject ${subject.code} ${subject.name}`} key={subject.id}>
          <strong className="text-blue-800">{subject.code}</strong><span>{subject.name}<small className="mt-1 flex flex-wrap gap-1 text-slate-600">
            {subject.eligibilitySources.map((source) => <span className="rounded bg-slate-100 px-2 py-0.5" key={source.id}>{source.title}</span>)}</small></span>
          <span className="text-sm text-slate-600">{subject.creditPoints === null ? "CP not listed" : `${subject.creditPoints} CP`}</span>
        </button>)}
      </div>}
    </div>
    {status === "ready" && <div className="flex flex-wrap gap-2">{candidateSources.map((source) => {
      const current = loaded[source.id];
      if (!current || current.pagination.page >= current.pagination.totalPages) return null;
      return <button className="rounded border border-solid border-slate-400 bg-white px-3 py-2 text-sm font-bold" type="button" disabled={current.loadingMore}
        onClick={() => loadMore(source)} key={source.id}>Load more from {source.title} ({current.pagination.page} of {current.pagination.totalPages})</button>;
    })}</div>}
  </section>;
};
