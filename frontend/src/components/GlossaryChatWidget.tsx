import { useEffect, useRef, useState, type FormEvent } from "react";
import { askGlossaryQuestion } from "../api/chat";
import { ApiRequestError } from "../api/client";

type Status = "idle" | "loading" | "ready" | "error";

export const GlossaryChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || status === "loading") return;

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setStatus("loading");
    setErrorMessage("");

    askGlossaryQuestion(trimmed, controller.signal)
      .then((result) => {
        setAnswer(result.answer);
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setErrorMessage(error instanceof ApiRequestError ? error.message : "Something went wrong. Try again.");
        setStatus("error");
      });
  };

  return (
    <div className="glossary-chat">
      {isOpen && (
        <div className="glossary-chat__panel" role="dialog" aria-label="Terminology glossary assistant">
          <div className="glossary-chat__header">
            <h2>Glossary assistant</h2>
            <button type="button" className="glossary-chat__close" onClick={() => setIsOpen(false)} aria-label="Close glossary assistant">
              ×
            </button>
          </div>
          <p className="glossary-chat__hint">
            Ask about general terms like &quot;what is a credit point&quot; or &quot;semester vs trimester&quot;.
          </p>
          <form className="glossary-chat__form" onSubmit={handleSubmit}>
            <input
              type="text"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="e.g. What does WAM mean?"
              aria-label="Ask a terminology question"
            />
            <button type="submit" disabled={status === "loading" || !question.trim()}>
              {status === "loading" ? "Asking…" : "Ask"}
            </button>
          </form>
          {status === "error" && <p className="glossary-chat__error" role="alert">{errorMessage}</p>}
          {status === "ready" && <p className="glossary-chat__answer">{answer}</p>}
        </div>
      )}
      <button
        type="button"
        className="glossary-chat__toggle"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
      >
        {isOpen ? "Close" : "Glossary"}
      </button>
    </div>
  );
};
