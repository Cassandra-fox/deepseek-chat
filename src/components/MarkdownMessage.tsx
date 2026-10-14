"use client";

import { isValidElement, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import CopyButton from "./CopyButton";

function plainText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(plainText).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) return plainText(node.props.children);
  return "";
}

function CodeBlock({ children }: { children?: ReactNode }) {
  const code = Array.isArray(children) ? children[0] : children;
  const className = isValidElement<{ className?: string }>(code) ? code.props.className ?? "" : "";
  const language = /language-([\w+-]+)/.exec(className)?.[1] ?? "代码";
  return <div className="code-block"><div className="code-toolbar"><span>{language}</span><CopyButton text={plainText(children).replace(/\n$/, "")} label="复制代码" /></div><pre>{children}</pre></div>;
}

export default function MarkdownMessage({ content }: { content: string }) {
  return <div className="markdown"><ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[[rehypeHighlight, { detect: false }]]}
    components={{
      pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
      a: ({ children, href }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>,
      table: ({ children }) => <div className="table-scroll"><table>{children}</table></div>,
    }}>{content}</ReactMarkdown></div>;
}
