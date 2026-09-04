import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { askGlossaryQuestion } from "../api/chat";
import { ApiRequestError } from "../api/client";

type MessageRole = "user" | "assistant" | "error";

interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
}

export const GlossaryChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isLoading]);

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
    if (!trimmed || isLoading) return;
    submitQuestion(trimmed);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      const trimmed = question.trim();
      if (!trimmed || isLoading) return;
      submitQuestion(trimmed);
    }
  };

  return (
    <>
      {!isOpen && (
        <button
          type="button"
          className="glossary-chat__toggle"
          onClick={() => setIsOpen(true)}
          aria-label="Open assistant"
        >
          Assistant
        </button>
      )}

      {isOpen && (
        <aside className="glossary-chat" aria-label="Assistant">
          <div className="glossary-chat__header">
            <h2>Assistant</h2>
            <button type="button" className="glossary-chat__close" onClick={() => setIsOpen(false)} aria-label="Close assistant">
              ×
            </button>
          </div>

          <div className="glossary-chat__messages">
            {messages.length === 0 && (
              <p className="glossary-chat__empty">
                Ask about general terms like &quot;what is a credit point&quot; or &quot;semester vs trimester&quot;.
              </p>
            )}
            {messages.map((message) => (
              <div key={message.id} className={`glossary-chat__message glossary-chat__message--${message.role}`}>
                <span className="glossary-chat__message-role">
                  {message.role === "user" ? "You" : message.role === "assistant" ? "Assistant" : "Error"}
                </span>
                <p>{message.content}</p>
              </div>
            ))}
            {isLoading && (
              <div className="glossary-chat__message glossary-chat__message--assistant glossary-chat__message--pending">
                <span className="glossary-chat__message-role">Assistant</span>
                <p className="glossary-chat__typing" aria-live="polite">Thinking…</p>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <form className="glossary-chat__form" onSubmit={handleSubmit}>
            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a terminology question…"
              aria-label="Ask a terminology question"
              rows={2}
            />
            <button
              type="submit"
              className="glossary-chat__send"
              disabled={isLoading || !question.trim()}
              aria-label={isLoading ? "Sending question" : "Send question"}
            >
              {isLoading ? (
                <span className="glossary-chat__spinner" aria-hidden="true" />
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
