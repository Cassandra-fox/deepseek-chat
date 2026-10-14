import assert from "node:assert/strict";
import { test } from "node:test";
import { act, StrictMode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import Composer from "../src/components/Composer";
import MarkdownMessage from "../src/components/MarkdownMessage";
import ThemeProvider, { useTheme } from "../src/components/ThemeProvider";
import Conversation from "../src/components/Conversation";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { formatDataStreamPart } from "ai";

test("Markdown renders GFM and fenced code without executing HTML or unsafe links", () => {
  const html = renderToStaticMarkup(<MarkdownMessage content={'```js\nconst answer = 42;\n```\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\n<script>alert(1)</script>\n\n[bad](javascript:alert(1))'} />);
  assert.match(html, /code-toolbar/);
  assert.match(html, /复制代码/);
  assert.match(html, /hljs-keyword/);
  assert.match(html, /<table>/);
  assert.doesNotMatch(html, /<script>|href="javascript:/);
});

test("composer handles Enter, Shift+Enter, IME composition, stop, and empty input correctly", async () => {
  const dom = new JSDOM("<html><body><div id='root'></div></body></html>", { url: "http://localhost" });
  Object.defineProperty(globalThis, "window", { value: dom.window, configurable: true });
  Object.defineProperty(globalThis, "document", { value: dom.window.document, configurable: true });
  Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import("react-dom/client");
  const root = createRoot(document.getElementById("root")!);
  let sends = 0; let stops = 0;
  const render = async (value = "你好", busy = false) => {
    await act(async () => root.render(<Composer value={value} onChange={() => {}} onSubmit={() => sends++} model="deepseek-flash" onModelChange={() => {}} busy={busy} onStop={() => stops++} />));
  };
  try {
    await render();
    const key = async (options: KeyboardEventInit) => act(async () => {
      document.querySelector("textarea")!.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Enter", bubbles: true, ...options }));
    });
    await key({ shiftKey: true }); assert.equal(sends, 0);
    await key({ isComposing: true }); assert.equal(sends, 0);
    await key({ keyCode: 229 }); assert.equal(sends, 0);
    await key({}); assert.equal(sends, 1);
    await render("   "); await key({}); assert.equal(sends, 1);
    await render("你好", true); await key({}); assert.equal(sends, 1);
    await act(async () => (document.querySelector('[aria-label="停止生成"]') as HTMLButtonElement).click());
    assert.equal(stops, 1);
  } finally { await act(async () => root.unmount()); dom.window.close(); }
});

test("copying highlighted code preserves the raw source instead of copying markup", async () => {
  const dom = new JSDOM("<html><body><div id='root'></div></body></html>", { url: "http://localhost" });
  Object.defineProperty(globalThis, "window", { value: dom.window, configurable: true });
  Object.defineProperty(globalThis, "document", { value: dom.window.document, configurable: true });
  let copied = "";
  Object.defineProperty(globalThis, "navigator", { value: { clipboard: { writeText: async (text: string) => { copied = text; } } }, configurable: true });
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import("react-dom/client");
  const root = createRoot(document.getElementById("root")!);
  try {
    await act(async () => root.render(<MarkdownMessage content={'```js\nconst answer = 42;\nconsole.log(answer);\n```'} />));
    await act(async () => (document.querySelector('[aria-label="复制代码"]') as HTMLButtonElement).click());
    assert.equal(copied, "const answer = 42;\nconsole.log(answer);");
    assert.ok(document.querySelector('[aria-label="已复制"]'));
  } finally { await act(async () => root.unmount()); dom.window.close(); }
});

test("theme preference persists and system mode responds to system theme changes", async () => {
  const dom = new JSDOM("<html><body><div id='root'></div></body></html>", { url: "http://localhost" });
  Object.defineProperty(globalThis, "window", { value: dom.window, configurable: true });
  Object.defineProperty(globalThis, "document", { value: dom.window.document, configurable: true });
  Object.defineProperty(globalThis, "localStorage", { value: dom.window.localStorage, configurable: true });
  let dark = false;
  const listeners = new Set<() => void>();
  dom.window.matchMedia = () => ({ get matches() { return dark; }, addEventListener: (_name: string, fn: () => void) => listeners.add(fn), removeEventListener: (_name: string, fn: () => void) => listeners.delete(fn) }) as unknown as MediaQueryList;
  localStorage.setItem("deepseek-theme", "dark");
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import("react-dom/client");
  const root = createRoot(document.getElementById("root")!);
  function Controls() { const { setTheme } = useTheme(); return <button onClick={() => setTheme("system")}>系统</button>; }
  try {
    await act(async () => root.render(<ThemeProvider><Controls /></ThemeProvider>));
    assert.equal(document.documentElement.dataset.theme, "dark");
    await act(async () => (document.querySelector("button") as HTMLButtonElement).click());
    assert.equal(localStorage.getItem("deepseek-theme"), "system");
    assert.equal(document.documentElement.dataset.theme, "light");
    await act(async () => { dark = true; listeners.forEach(listener => listener()); });
    assert.equal(document.documentElement.dataset.theme, "dark");
  } finally { await act(async () => root.unmount()); dom.window.close(); }
});

async function conversationFixture(failFirst = false) {
  const dom = new JSDOM("<html><body><div id='root'></div></body></html>", { url: "http://localhost" });
  Object.defineProperty(globalThis, "window", { value: dom.window, configurable: true });
  Object.defineProperty(globalThis, "document", { value: dom.window.document, configurable: true });
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const originalFetch = globalThis.fetch;
  const requests: { mode: string; retry_from?: string; messages: { id: string; content: string }[] }[] = [];
  globalThis.fetch = async (_input, init) => {
    requests.push(JSON.parse(String(init?.body)));
    if (failFirst && requests.length === 1) return Response.json({ error: "临时连接故障" }, { status: 503 });
    const stream = formatDataStreamPart("start_step", { messageId: "reply-" + requests.length })
      + formatDataStreamPart("text", "模拟模型回复")
      + formatDataStreamPart("finish_message", { finishReason: "stop", usage: { promptTokens: 1, completionTokens: 1 } });
    return new Response(stream, { headers: { "x-vercel-ai-data-stream": "v1" } });
  };
  const { createRoot } = await import("react-dom/client");
  const root = createRoot(document.getElementById("root")!);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => root.render(<StrictMode><QueryClientProvider client={queryClient}><Conversation
    chat={{ id: 1, userId: "alice", title: "修改后的标题", initialPrompt: "完整的第一条问题", model: "deepseek-flash", isPinned: false, createdAt: 1, updatedAt: 1 }}
    userId="alice" initialMessages={[]} /></QueryClientProvider></StrictMode>));
  const waitFor = async (condition: () => boolean) => {
    for (let i = 0; i < 100; i++) {
      if (condition()) return;
      await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
    }
    assert.fail("Timed out waiting for the conversation UI");
  };
  return { requests, waitFor, cleanup: async () => {
    await act(async () => root.unmount()); queryClient.clear(); globalThis.fetch = originalFetch; dom.window.close();
  } };
}

test("a new conversation streams a reply and sends the initial prompt once in React StrictMode", async () => {
  const fixture = await conversationFixture();
  try {
    await fixture.waitFor(() => !!document.querySelector(".message-assistant .markdown"));
    assert.equal(fixture.requests.length, 1);
    assert.equal(fixture.requests[0].messages[0].content, "完整的第一条问题");
    assert.equal(fixture.requests[0].messages[0].id, "initial-1");
    assert.equal(document.querySelector(".message-assistant .markdown")?.textContent, "模拟模型回复");
  } finally { await fixture.cleanup(); }
});

test("a failed first model request displays an error and can retry the same user message", async () => {
  const fixture = await conversationFixture(true);
  try {
    await fixture.waitFor(() => !!document.querySelector(".chat-error"));
    assert.match(document.querySelector(".chat-error")?.textContent ?? "", /临时连接故障/);
    await act(async () => (document.querySelector(".chat-error button") as HTMLButtonElement).click());
    await fixture.waitFor(() => !!document.querySelector(".message-assistant .markdown"));
    assert.equal(fixture.requests.length, 2);
    assert.equal(fixture.requests[1].mode, "retry");
    assert.equal(fixture.requests[1].retry_from, fixture.requests[0].messages[0].id);
    assert.equal(fixture.requests[1].messages.length, 1);
  } finally { await fixture.cleanup(); }
});
