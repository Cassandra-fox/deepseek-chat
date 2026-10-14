"use client";

import { useChat, type Message } from "@ai-sdk/react";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { ChatModel } from "@/db/schema";
import { streamFetch } from "@/lib/api";
import { normalizeModel } from "@/lib/models";
import Composer from "./Composer";
import MarkdownMessage from "./MarkdownMessage";
import CopyButton from "./CopyButton";
import Icon from "./Icon";
import Modal from "./Modal";

export default function Conversation({ chat, userId, initialMessages }: { chat: ChatModel; userId: string; initialMessages: Message[] }) {
  const instanceId = useId();
  const [model, setModel] = useState<string>(normalizeModel(chat.model));
  const [retryIndex, setRetryIndex] = useState<number | null>(null);
  const [showLatest, setShowLatest] = useState(false);
  const [stopped, setStopped] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const started = useRef(false);
  const initialState = useRef({ chat, initialMessages });
  const retrySnapshot = useRef<Message[] | null>(null);
  const queryClient = useQueryClient();
  const draftKey = "deepseek-draft:" + userId + ":" + chat.id;
  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["chats", userId] });
    void queryClient.invalidateQueries({ queryKey: ["messages", userId, String(chat.id)] });
  }, [queryClient, userId, chat.id]);
  const { messages, input, setInput, append, reload, setMessages, status, error, stop } = useChat({
    id: userId + ":" + chat.id + ":" + instanceId,
    initialMessages,
    body: { chat_id: chat.id, model, mode: "send" },
    generateId: () => crypto.randomUUID(),
    sendExtraMessageFields: true,
    fetch: streamFetch,
    experimental_throttle: 40,
    onFinish: () => { retrySnapshot.current = null; refresh(); },
    onError: () => {
      if (retrySnapshot.current) { setMessages(retrySnapshot.current); retrySnapshot.current = null; }
      refresh();
    },
  });
  const busy = status === "submitted" || status === "streaming";
  const appendRef = useRef(append);
  appendRef.current = append;
  useEffect(() => {
    try { setInput(sessionStorage.getItem(draftKey) ?? ""); } catch {}
  }, [draftKey, setInput]);
  useEffect(() => {
    const timer = setTimeout(() => {
      if (started.current) return;
      started.current = true;
      const initial = initialState.current;
      if (!initial.initialMessages.length && initial.chat.initialPrompt) {
        void appendRef.current({ id: "initial-" + initial.chat.id, role: "user", content: initial.chat.initialPrompt }, { body: { model: normalizeModel(initial.chat.model) } });
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => () => stop(), [stop]);
  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (viewport && stickToBottom.current) viewport.scrollTop = viewport.scrollHeight;
  }, [messages, busy, error]);
  const changeInput = (value: string) => {
    setInput(value); try { sessionStorage.setItem(draftKey, value); } catch {}
  };
  const submit = () => {
    if (!input.trim() || busy) return;
    const content = input.trim();
    changeInput(""); setStopped(false); stickToBottom.current = true;
    void append({ role: "user", content });
  };
  const regenerate = (index: number) => {
    if (busy || !messages[index] || messages[index].role !== "user") return;
    retrySnapshot.current = [...messages];
    setMessages(messages.slice(0, index + 1));
    stickToBottom.current = true; setStopped(false); setRetryIndex(null);
    void reload({ body: { mode: "retry", retry_from: messages[index].id, model } });
  };
  const requestRetry = (assistantIndex: number) => {
    let index = assistantIndex - 1;
    while (index >= 0 && messages[index].role !== "user") index--;
    if (index < 0) return;
    if (assistantIndex < messages.length - 1) setRetryIndex(index);
    else regenerate(index);
  };
  const retryLast = () => {
    const index = messages.map(message => message.role).lastIndexOf("user");
    if (index >= 0) regenerate(index);
  };
  const stopGeneration = () => {
    retrySnapshot.current = null; setStopped(true); stop();
    // The server saves any received text when its request is aborted.
    setTimeout(refresh, 400);
  };
  const closeRetry = useCallback(() => setRetryIndex(null), []);
  const waiting = busy && (messages.at(-1)?.role !== "assistant" || !messages.at(-1)?.content);
  return <div className="conversation">
    <div className="conversation-title"><span>{chat.title}</span><span>{model === "deepseek-v4-pro" ? "V4 Pro" : "Flash"}</span></div>
    <div className="conversation-scroll" ref={viewportRef} onScroll={() => {
      const viewport = viewportRef.current;
      if (!viewport) return;
      const near = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 120;
      stickToBottom.current = near; setShowLatest(!near);
    }}>
      <div className="messages-column" aria-busy={busy}>
        {messages.map((message, index) => message.role === "user" ? <article key={message.id} className="message message-user message-enter">
          <div className="user-bubble">{message.content}</div><div className="user-message-actions"><CopyButton text={message.content} label="复制消息" compact /></div>
        </article> : <article key={message.id} className="message message-assistant message-enter">
          {message.content && <><div className="assistant-label"><span className="assistant-symbol"><Icon name="spark" width={16} height={16} /></span><span>DeepSeek</span></div>
            <MarkdownMessage content={message.content} />
            <div className="message-actions"><CopyButton text={message.content} compact /><button className="icon-button" title="重新生成回复" aria-label="重新生成回复" disabled={busy} onClick={() => requestRetry(index)}><Icon name="retry" width={17} height={17} /></button></div></>}
        </article>)}
        {waiting && <div className="thinking-indicator" role="status" aria-label="正在等待模型回复"><span className="assistant-symbol"><Icon name="spark" width={16} height={16} /></span><div className="thinking-dots"><span /><span /><span /></div><span>正在思考</span></div>}
        {error && <div className="chat-error" role="alert"><p>{error.message}</p><button className="text-button" onClick={retryLast} disabled={busy}><Icon name="retry" width={16} height={16} />重新尝试</button></div>}
        {stopped && !busy && !error && <p className="stopped-note">已停止生成，你可以继续提问或重新生成。</p>}
      </div>
    </div>
    <div className="composer-dock">
      {showLatest && <button className="jump-latest icon-button" title="回到最新消息" aria-label="回到最新消息" onClick={() => {
        stickToBottom.current = true; setShowLatest(false); viewportRef.current?.scrollTo({ top: viewportRef.current.scrollHeight, behavior: "smooth" });
      }}><Icon name="down" /></button>}
      <Composer value={input} onChange={changeInput} onSubmit={submit} model={model} onModelChange={setModel} busy={busy} onStop={stopGeneration} autoFocus />
      <p className="page-disclaimer">AI 也可能出错，请核查重要信息。<span>Enter 发送 · Shift + Enter 换行</span></p>
    </div>
    {retryIndex !== null && <Modal title="重新生成这条回复？" onClose={closeRetry}><p className="modal-description">新的回复生成成功后，会替换这条回复及其后续消息。</p><div className="modal-actions"><button className="secondary-button" onClick={closeRetry}>取消</button><button className="primary-button" onClick={() => regenerate(retryIndex)}>重新生成</button></div></Modal>}
  </div>;
}
