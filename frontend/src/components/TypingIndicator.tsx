export function TypingIndicator() {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-xl rounded-bl-sm bg-surface-alt px-4 py-3" aria-label="Assistant is typing">
      <span className="typing-dot h-1.5 w-1.5 rounded-full bg-ink-2" />
      <span className="typing-dot h-1.5 w-1.5 rounded-full bg-ink-2" />
      <span className="typing-dot h-1.5 w-1.5 rounded-full bg-ink-2" />
    </div>
  );
}
