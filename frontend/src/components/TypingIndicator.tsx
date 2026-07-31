export function TypingIndicator() {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-2xl rounded-tl-sm bg-slate-100 px-4 py-3 dark:bg-slate-800" aria-label="Assistant is typing">
      <span className="typing-dot h-1.5 w-1.5 rounded-full bg-slate-400" />
      <span className="typing-dot h-1.5 w-1.5 rounded-full bg-slate-400" />
      <span className="typing-dot h-1.5 w-1.5 rounded-full bg-slate-400" />
    </div>
  );
}
