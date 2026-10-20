import { useCallback, useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { fetchRequirementCandidateSubjects } from "../../api/requirementCandidateSources";
import { mergeCandidateSubjectPages } from "../../domain/candidateSubjects";
import type { RequirementCandidateSourceSummary, RequirementCandidateSubjectsResponse } from "../../types/handbook";
import { AsyncState } from "../AsyncState";
import { appUi } from "../ui";

export interface CandidateSubjectBrowserProps {
  candidateSources: RequirementCandidateSourceSummary[];
  onOpenSubject: (subjectCode: string) => void;
  heading: string;
  description: string;
  sourcesLabel: string;
  searchLabel: string;
  searchPlaceholder: string;
  searchButtonLabel: string;
  loadingLabel: string;
  errorLabel: string;
}

type LoadedSource = RequirementCandidateSubjectsResponse & { loadingMore?: boolean };

export const RequirementCandidateSubjectBrowser = ({ candidateSources, onOpenSubject, heading, description,
  sourcesLabel, searchLabel, searchPlaceholder, searchButtonLabel, loadingLabel,
  errorLabel }: CandidateSubjectBrowserProps) => {
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [loaded, setLoaded] = useState<Record<string, LoadedSource>>({});
  const requestRef = useRef<AbortController | null>(null);
  const loadMoreRequestsRef = useRef(new Map<string, AbortController>());
  const requestGenerationRef = useRef(0);
  const headingId = useId();
  const queryId = useId();

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

  return <section className={appUi.candidateBrowser} aria-labelledby={headingId}>
    <div><h4 id={headingId}>{heading}</h4><p>{description}</p></div>
    <ul className={appUi.candidateSources} aria-label={sourcesLabel}>
      {candidateSources.map((source) => <li className={appUi.candidateSource} key={source.id}>
        <span>{source.title}</span><strong>{source.candidateCount.toLocaleString()} subjects</strong>
      </li>)}
    </ul>
    <form className={appUi.candidateSearch} onSubmit={submit}><label htmlFor={queryId}>{searchLabel}</label>
      <div><input id={queryId} type="search" value={query}
        onChange={(event) => setQuery(event.target.value)} placeholder={searchPlaceholder} />
        <button className={appUi.primaryButton} type="submit">{searchButtonLabel}</button></div>
      {message && <p className={appUi.fieldError} role="alert">{message}</p>}
    </form>
    <div aria-live="polite">
      {status === "loading" && <AsyncState kind="loading" label={loadingLabel} />}
      {status === "error" && <AsyncState kind="error" label={errorLabel} onRetry={() => search(activeQuery)} />}
      {status === "ready" && results.length === 0 && <AsyncState kind="empty" label="No eligible subjects match this search." />}
      {status === "ready" && results.length > 0 && <div className={appUi.candidateResults}>
        <p>Showing {results.length} unique eligible subjects from the pages loaded below.</p>
        <div className={appUi.candidateList} tabIndex={0} role="region" aria-label={`${heading} list`}>{results.map((subject) => <button className={appUi.requirementRowInteractive} type="button"
          onClick={() => onOpenSubject(subject.code)} aria-label={`View eligible subject ${subject.code} ${subject.name}`} key={subject.id}>
          <span className={appUi.requirementRowCode}>{subject.code}</span>
          <span className={appUi.requirementRowName}>{subject.name}<small className={appUi.candidateSourceTags}>
            {subject.eligibilitySources.map((source) => <span className={appUi.candidateSourceTag} key={source.id}>{source.title}</span>)}</small></span>
          <span className={appUi.requirementRowCp}>{subject.creditPoints === null ? "CP not listed" : `${subject.creditPoints} CP`}</span>
        </button>)}</div>
      </div>}
    </div>
    {status === "ready" && <div className={appUi.candidateLoadMore}>{candidateSources.map((source) => {
      const current = loaded[source.id];
      if (!current || current.pagination.page >= current.pagination.totalPages) return null;
      return <button className={appUi.secondaryButton} type="button" disabled={current.loadingMore}
        onClick={() => loadMore(source)} key={source.id}>Load more from {source.title} ({current.pagination.page} of {current.pagination.totalPages})</button>;
    })}</div>}
  </section>;
};
