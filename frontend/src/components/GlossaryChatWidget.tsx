import { appUi } from "./ui";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { askGlossaryQuestion } from "../api/chat";
import { ApiRequestError } from "../api/client";
import chatButton from "./ui/icons/chat-button.png";
import chatHover from "./ui/icons/chat-hover.png";

type MessageRole = "user" | "assistant" | "error";

interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
}

/** Caps assistant replies per browser session (sessionStorage survives reloads, not new tabs). */
export const MAX_RESPONSES_PER_SESSION = 5;
const RESPONSE_COUNT_KEY = "glossaryChat.responseCount";

const readResponseCount = (): number => {
  try {
    return Number(sessionStorage.getItem(RESPONSE_COUNT_KEY)) || 0;
  } catch {
    return 0;
  }
};

const writeResponseCount = (count: number) => {
  try {
    sessionStorage.setItem(RESPONSE_COUNT_KEY, String(count));
  } catch {
    // Storage unavailable (e.g. private mode); the in-memory count still applies.
  }
};

/** Provides terminology help with explicit user, assistant, pending and error styles. */
export const GlossaryChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [responseCount, setResponseCount] = useState(readResponseCount);
  const limitReached = responseCount >= MAX_RESPONSES_PER_SESSION;
  const controllerRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    bottomRef.current?.scrollIntoView({ behavior: reducedMotion ? "instant" : "smooth", block: "end" });
  }, [messages, isLoading]);

  useEffect(() => {
    if (!isOpen) return;
    inputRef.current?.focus();
    return () => toggleRef.current?.focus();
  }, [isOpen]);

  /** Keeps keyboard focus within the full-screen mobile assistant and supports Escape. */
  const handlePanelKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") { event.preventDefault(); setIsOpen(false); return; }
    if (event.key !== "Tab" || !window.matchMedia("(max-width: 720px)").matches) return;
    const controls = event.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled), textarea");
    const first = controls[0], last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  };

  const submitQuestion = (trimmed: string) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setMessages((current) => [...current, { id: crypto.randomUUID(), role: "user", content: trimmed }]);
    setQuestion("");
    setIsLoading(true);

    askGlossaryQuestion(trimmed, controller.signal)
      .then((result) => {
        setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", content: result.answer }]);
        setResponseCount((current) => {
          const next = current + 1;
          writeResponseCount(next);
          return next;
        });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        const message = error instanceof ApiRequestError ? error.message : "Something went wrong. Try again.";
        setMessages((current) => [...current, { id: crypto.randomUUID(), role: "error", content: message }]);
      })
      .finally(() => setIsLoading(false));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || isLoading || limitReached) return;
    submitQuestion(trimmed);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      const trimmed = question.trim();
      if (!trimmed || isLoading || limitReached) return;
      submitQuestion(trimmed);
    }
  };

  return (
    <>
      {!isOpen && (
        <button
          type="button"
          ref={toggleRef}
          className={appUi.glossaryChatToggle}
          onClick={() => setIsOpen(true)}
          aria-label="Open assistant"
        >
          <img src={chatButton} className={appUi.glossaryChatToggleIcon}/>
          <img src={chatHover} className={appUi.glossaryChatToggleIconHover}/>
        </button>
      )}

      {isOpen && (
        <aside className={appUi.glossaryChat} aria-label="Assistant" onKeyDown={handlePanelKeyDown}>
          <div className={appUi.glossaryChatHeader}>
            <h2>Assistant</h2>
            <button type="button" className={appUi.glossaryChatClose} onClick={() => setIsOpen(false)} aria-label="Close assistant">
              ×
            </button>
          </div>

          <div className={appUi.glossaryChatMessages}>
            {messages.length === 0 && (
              <p className={appUi.glossaryChatEmpty}>
                Ask about general terms like &quot;what is a credit point&quot; or &quot;semester vs trimester&quot;.
              </p>
            )}
            {messages.map((message) => (
              <div key={message.id} className={message.role === "user" ? appUi.glossaryMessageUser : message.role === "error" ? appUi.glossaryMessageError : appUi.glossaryMessageAssistant}>
                <span className={appUi.glossaryChatMessageRole}>
                  {message.role === "user" ? "You" : message.role === "assistant" ? "Assistant" : "Error"}
                </span>
                <p>{message.content}</p>
              </div>
            ))}
            {isLoading && (
              <div className={appUi.glossaryMessagePending}>
                <span className={appUi.glossaryChatMessageRole}>Assistant</span>
                <p aria-live="polite">Thinking…</p>
              </div>
            )}
            {limitReached && !isLoading && (
              <p className={appUi.glossaryChatEmpty} role="status">
                You&apos;ve reached the limit of {MAX_RESPONSES_PER_SESSION} assistant responses for this session.
              </p>
            )}
            <div ref={bottomRef} />
          </div>

          <form className={appUi.glossaryChatForm} onSubmit={handleSubmit}>
            <textarea
              ref={inputRef}
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={limitReached ? "Response limit reached" : "Ask a terminology question…"}
              aria-label="Ask a terminology question"
              disabled={limitReached}
              rows={2}
            />
            <button
              type="submit"
              className={appUi.glossaryChatSend}
              disabled={isLoading || limitReached || !question.trim()}
              aria-label={isLoading ? "Sending question" : "Send question"}
            >
              {isLoading ? (
                <span className={appUi.glossaryChatSpinner} aria-hidden="true" />
              ) : (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="12" y1="19" x2="12" y2="5" />
                  <polyline points="5 12 12 5 19 12" />
                </svg>
              )}
            </button>

          </form>
        </aside>
      )}
    </>
  );
};
