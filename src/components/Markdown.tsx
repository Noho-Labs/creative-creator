import ReactMarkdown from "react-markdown";

export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose prose-zinc max-w-none text-sm dark:prose-invert prose-headings:font-semibold">
      <ReactMarkdown>{children}</ReactMarkdown>
    </div>
  );
}
