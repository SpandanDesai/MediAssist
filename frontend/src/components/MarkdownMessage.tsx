import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function MarkdownMessage({ children }: { children: string }) {
  return (
    <div className="message-markdown text-[15px] leading-6 text-ink">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code: () => null,
          pre: () => null,
          a: ({ href, children: linkChildren }) => <a href={href} target="_blank" rel="noreferrer" className="font-medium text-brand underline decoration-brand/40 underline-offset-2 hover:text-brand-strong">{linkChildren}</a>,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
