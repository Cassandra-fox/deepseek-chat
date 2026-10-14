"use client";

import type { ChatModel } from "@/db/schema";
import { post } from "@/lib/api";
import { UserButton, useUser } from "@clerk/nextjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import Icon from "./Icon";
import Modal from "./Modal";
import { useTheme } from "./ThemeProvider";

type Props = { onClose: () => void; onNavigate: () => void; onNewChat: () => void; searchRef: RefObject<HTMLInputElement | null> };
type DialogState = { kind: "rename" | "delete"; chat: ChatModel } | null;

export default function Navibar({ onClose, onNavigate, onNewChat, searchRef }: Props) {
  const { user } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { theme, setTheme } = useTheme();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [menu, setMenu] = useState<{ chat: ChatModel; left: number; top: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [title, setTitle] = useState("");
  const [actionError, setActionError] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 200);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    if (!menu) return;
    const close = (event: MouseEvent) => { if (!menuRef.current?.contains(event.target as Node)) setMenu(null); };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setMenu(null); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", onKey); };
  }, [menu]);

  const chats = useQuery({
    queryKey: ["chats", user?.id, debouncedSearch],
    queryFn: () => post<ChatModel[]>("/api/get-chats", { search: debouncedSearch }),
    enabled: !!user?.id,
  });
  const refresh = (id: number) => {
    void queryClient.invalidateQueries({ queryKey: ["chats", user?.id] });
    void queryClient.invalidateQueries({ queryKey: ["chat", user?.id, String(id)] });
  };
  const update = useMutation({
    mutationFn: (changes: { chat_id: number; title?: string; isPinned?: boolean }) => post<ChatModel>("/api/update-chat", changes),
    onSuccess: chat => { refresh(chat.id); setDialog(null); setActionError(""); },
    onError: error => setActionError(error.message),
  });
  const remove = useMutation({
    mutationFn: (id: number) => post<{ success: boolean }>("/api/delete-chat", { chat_id: id }),
    onSuccess: (_data, id) => {
      setDialog(null); setActionError(""); refresh(id);
      queryClient.removeQueries({ queryKey: ["messages", user?.id, String(id)] });
      if (pathname === "/chat/" + id) { router.replace("/"); onNavigate(); }
    },
    onError: error => setActionError(error.message),
  });
  const closeDialog = useCallback(() => {
    if (!update.isPending && !remove.isPending) { setDialog(null); setActionError(""); }
  }, [update.isPending, remove.isPending]);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const groups = [
    { label: "置顶", items: chats.data?.filter(chat => chat.isPinned) ?? [] },
    { label: "今天", items: chats.data?.filter(chat => !chat.isPinned && chat.updatedAt >= today.getTime()) ?? [] },
    { label: "最近 7 天", items: chats.data?.filter(chat => !chat.isPinned && chat.updatedAt < today.getTime() && chat.updatedAt >= today.getTime() - 7 * 86400000) ?? [] },
    { label: "更早", items: chats.data?.filter(chat => !chat.isPinned && chat.updatedAt < today.getTime() - 7 * 86400000) ?? [] },
  ];
  const openDialog = (kind: "rename" | "delete", chat: ChatModel) => {
    setMenu(null); setActionError(""); setTitle(chat.title); setDialog({ kind, chat });
  };
  return <>
    <div className="sidebar-top">
      <Link href="/" onClick={event => { event.preventDefault(); onNewChat(); }} className="brand" aria-label="DeepSeek 首页"><span className="brand-symbol"><Icon name="spark" /></span><span>DeepSeek</span></Link>
      <button className="icon-button" onClick={onClose} aria-label="隐藏导航栏" title="隐藏导航栏"><Icon name="sidebar" /></button>
    </div>
    <div className="sidebar-tools">
      <button className="new-chat-button" onClick={onNewChat}><Icon name="edit" /><span>新对话</span><kbd>Ctrl ⇧ O</kbd></button>
      <label className="search-box"><Icon name="search" width={17} height={17} /><input ref={searchRef} placeholder="搜索对话" aria-label="搜索对话标题或内容" value={search} onChange={event => setSearch(event.target.value)} />
        {search && <button className="icon-button small" aria-label="清除搜索" onClick={() => setSearch("")}><Icon name="close" width={14} height={14} /></button>}
      </label>
    </div>
    <nav className="chat-list" aria-label="历史会话">
      {chats.isLoading && <div className="sidebar-skeleton">{[1, 2, 3, 4].map(i => <span key={i} />)}</div>}
      {chats.isError && <div className="sidebar-empty"><p>无法加载会话</p><button className="text-button" onClick={() => void chats.refetch()}>重试</button></div>}
      {!chats.isLoading && !chats.isError && !chats.data?.length && <div className="sidebar-empty"><Icon name="chat" /><p>{search ? "没有找到相关对话" : "你的对话，会留在这里"}</p><span>{search ? "试试其他关键词" : "开始一个问题，延续新的想法"}</span></div>}
      {groups.filter(group => group.items.length).map(group => <section key={group.label} className="chat-group"><h2>{group.label}</h2>{group.items.map(chat => <div key={chat.id} className={"chat-row " + (pathname === "/chat/" + chat.id ? "active" : "")}>
        <Link href={"/chat/" + chat.id} onClick={() => { setMenu(null); onNavigate(); }} title={chat.title} aria-current={pathname === "/chat/" + chat.id ? "page" : undefined}>
          {chat.isPinned && <Icon name="pin" width={13} height={13} />}<span>{chat.title}</span>
        </Link>
        <button className="icon-button chat-menu-trigger" aria-label={"管理对话：" + chat.title} aria-haspopup="menu" aria-expanded={menu?.chat.id === chat.id} onClick={event => {
          const bounds = event.currentTarget.getBoundingClientRect();
          setMenu(menu?.chat.id === chat.id ? null : { chat, left: Math.max(8, Math.min(bounds.right - 184, window.innerWidth - 192)), top: Math.min(bounds.bottom + 4, window.innerHeight - 160) });
        }}><Icon name="more" width={18} height={18} /></button>
      </div>)}</section>)}
    </nav>
    {actionError && !dialog && <p className="sidebar-error" role="alert">{actionError}</p>}
    <div className="sidebar-footer">
      <button className="theme-button" onClick={() => setTheme(theme === "system" ? "light" : theme === "light" ? "dark" : "system")} title="点击切换：跟随系统 → 浅色 → 深色">
        <Icon name={theme === "system" ? "monitor" : theme === "light" ? "sun" : "moon"} width={18} height={18} /><span>{theme === "system" ? "跟随系统" : theme === "light" ? "浅色模式" : "深色模式"}</span>
      </button>
      <div className="user-profile"><UserButton /><div><strong>{user?.firstName || user?.username || "我的账户"}</strong><span>随时开始，随时继续</span></div></div>
    </div>
    {menu && createPortal(<div ref={menuRef} role="menu" className="context-menu" style={{ left: menu.left, top: menu.top }}>
      <button role="menuitem" disabled={update.isPending} onClick={() => { update.mutate({ chat_id: menu.chat.id, isPinned: !menu.chat.isPinned }); setMenu(null); }}><Icon name="pin" width={17} height={17} />{menu.chat.isPinned ? "取消置顶" : "置顶对话"}</button>
      <button role="menuitem" onClick={() => openDialog("rename", menu.chat)}><Icon name="edit" width={17} height={17} />重命名</button>
      <button role="menuitem" className="danger" onClick={() => openDialog("delete", menu.chat)}><Icon name="trash" width={17} height={17} />删除对话</button>
    </div>, document.body)}
    {dialog && <Modal title={dialog.kind === "rename" ? "重命名对话" : "删除对话？"} onClose={closeDialog}>
      {dialog.kind === "rename" ? <form onSubmit={event => { event.preventDefault(); if (title.trim() && !update.isPending) update.mutate({ chat_id: dialog.chat.id, title: title.trim() }); }}>
        <label className="field-label" htmlFor="chat-title">对话名称</label><input id="chat-title" className="dialog-input" value={title} onChange={event => setTitle(event.target.value)} maxLength={100} data-autofocus />
        {actionError && <p className="form-error" role="alert">{actionError}</p>}
        <div className="modal-actions"><button type="button" className="secondary-button" onClick={closeDialog} disabled={update.isPending}>取消</button><button className="primary-button" disabled={!title.trim() || update.isPending}>{update.isPending ? "保存中…" : "保存"}</button></div>
      </form> : <>
        <p className="modal-description">将删除「{dialog.chat.title}」及其中的全部消息。此操作无法撤销。</p>
        {actionError && <p className="form-error" role="alert">{actionError}</p>}
        <div className="modal-actions"><button className="secondary-button" onClick={closeDialog} disabled={remove.isPending}>取消</button><button className="danger-button" onClick={() => remove.mutate(dialog.chat.id)} disabled={remove.isPending}>{remove.isPending ? "删除中…" : "删除"}</button></div>
      </>}
    </Modal>}
  </>;
}
