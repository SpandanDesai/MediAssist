import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function MarkdownMessage({ children }: { children: string }) {
  return (
    <div className="message-markdown text-sm leading-6">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code: () => null,
          pre: () => null,
          a: ({ href, children: linkChildren }) => <a href={href} target="_blank" rel="noreferrer" className="font-medium text-sky-600 underline decoration-sky-300 underline-offset-2 hover:text-sky-700 dark:text-sky-300">{linkChildren}</a>,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
