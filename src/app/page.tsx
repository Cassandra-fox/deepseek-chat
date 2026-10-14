"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import type { ChatModel } from "@/db/schema";
import { post } from "@/lib/api";
import Composer from "@/components/Composer";
import Icon, { type IconName } from "@/components/Icon";

const suggestions: { icon: IconName; label: string; prompt: string }[] = [
  { icon: "edit", label: "写一段文字", prompt: "帮我把一个想法写成清晰、有吸引力的文字。请先问我想表达的内容和读者是谁。" },
  { icon: "code", label: "解决代码问题", prompt: "我想解决一个代码问题。请先问我使用的语言、遇到的现象和预期结果。" },
  { icon: "book", label: "学习新知识", prompt: "帮我学习一个新知识点，用直观的例子解释，并设计几个练习。请先问我想学什么。" },
  { icon: "spark", label: "找一点灵感", prompt: "我想为一个项目寻找创意。请先问我项目的目标和限制，再一起头脑风暴。" },
];

export default function Home() {
  const [input, setInput] = useState("");
  const [model, setModel] = useState("deepseek-flash");
  const { user } = useUser();
  const queryClient = useQueryClient();
  const router = useRouter();
  const draftKey = "deepseek-draft:" + (user?.id ?? "guest") + ":new";
  useEffect(() => {
    try { setInput(sessionStorage.getItem(draftKey) ?? ""); } catch {}
    const clear = () => { setInput(""); try { sessionStorage.removeItem(draftKey); } catch {} };
    window.addEventListener("deepseek-new-chat", clear);
    return () => window.removeEventListener("deepseek-new-chat", clear);
  }, [draftKey]);
  const changeInput = (text: string) => {
    setInput(text); try { sessionStorage.setItem(draftKey, text); } catch {}
  };
  const create = useMutation({
    mutationFn: (prompt: string) => post<ChatModel>("/api/create-chat", { title: prompt.slice(0, 40), prompt, model }),
    onSuccess: chat => {
      try { sessionStorage.removeItem(draftKey); } catch {}
      void queryClient.invalidateQueries({ queryKey: ["chats", user?.id] });
      router.push("/chat/" + chat.id);
    },
  });
  const submit = () => {
    if (!input.trim() || create.isPending) return;
    if (!user) { router.push("/sign-in"); return; }
    create.mutate(input.trim());
  };
  return <div className="home-page">
    <section className="home-center">
      <div className="welcome-mark"><Icon name="spark" width={28} height={28} /></div>
      <span className="eyebrow">思考 · 创作 · 探索</span>
      <h1>从一个好问题开始。</h1>
      <p className="home-subtitle">把想法说出来，我们一起走得更远。</p>
      <div className="home-composer"><Composer value={input} onChange={changeInput} onSubmit={submit} model={model} onModelChange={setModel} busy={create.isPending} disabled={create.isPending} autoFocus /></div>
      {create.error && <p className="home-error" role="alert">{create.error.message}</p>}
      <div className="suggestion-list">{suggestions.map(suggestion => <button key={suggestion.label} disabled={create.isPending} onClick={() => changeInput(suggestion.prompt)}>
        <Icon name={suggestion.icon} width={17} height={17} /><span>{suggestion.label}</span>
      </button>)}</div>
      <p className="keyboard-hint"><kbd>Enter</kbd> 发送 <span>·</span> <kbd>Shift + Enter</kbd> 换行</p>
    </section>
    <p className="page-disclaimer">AI 也可能出错，请核查重要信息。</p>
  </div>;
}
