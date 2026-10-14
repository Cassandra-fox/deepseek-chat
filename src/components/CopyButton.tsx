"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "./Icon";

export default function CopyButton({ text, label = "复制回复", compact = false }: { text: string; label?: string; compact?: boolean }) {
  const [state, setState] = useState<"idle" | "copied" | "error">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setState("copied"); }
    catch { setState("error"); }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 2000);
  };
  const message = state === "copied" ? "已复制" : state === "error" ? "复制失败" : label;
  return <button type="button" className={compact ? "icon-button" : "copy-button"} onClick={copy} aria-label={message} title={message}>
    <Icon name={state === "copied" ? "check" : "copy"} width={16} height={16} />
    {!compact && <span>{message}</span>}
    <span className="sr-only" aria-live="polite">{state === "idle" ? "" : message}</span>
  </button>;
}
