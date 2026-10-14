"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import Navibar from "./Navibar";
import Icon from "./Icon";

export default function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { user } = useUser();
  const pathname = usePathname();
  const isAuth = pathname.startsWith("/sign-in");
  useEffect(() => {
    const media = window.matchMedia("(min-width: 900px)");
    const sync = () => {
      if (!media.matches) { setOpen(false); return; }
      try { setOpen(localStorage.getItem("deepseek-sidebar") !== "closed"); } catch { setOpen(true); }
    };
    sync(); media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  const toggle = useCallback((next: boolean) => {
    setOpen(next);
    if (window.innerWidth >= 900) { try { localStorage.setItem("deepseek-sidebar", next ? "open" : "closed"); } catch {} }
  }, []);
  const closeMobile = useCallback(() => { if (window.innerWidth < 900) setOpen(false); }, []);
  const newChat = useCallback(() => {
    try { sessionStorage.removeItem("deepseek-draft:" + (user?.id ?? "guest") + ":new"); } catch {}
    window.dispatchEvent(new Event("deepseek-new-chat"));
    router.push("/"); closeMobile();
  }, [router, closeMobile, user?.id]);
  useEffect(() => {
    if (isAuth) return;
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault(); toggle(true); setTimeout(() => searchRef.current?.focus(), 30);
      }
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "o") { event.preventDefault(); newChat(); }
      if (event.key === "Escape" && window.innerWidth < 900) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isAuth, newChat, toggle]);
  useEffect(() => {
    if (!open || window.innerWidth >= 900) return;
    const sidebar = document.querySelector<HTMLElement>(".sidebar");
    const previous = document.activeElement as HTMLElement | null;
    sidebar?.querySelector<HTMLElement>("a, button")?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const elements = Array.from(sidebar?.querySelectorAll<HTMLElement>('a, button:not(:disabled), input') ?? []);
      const first = elements[0]; const last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", trap);
    return () => { document.removeEventListener("keydown", trap); previous?.focus(); };
  }, [open]);
  if (isAuth) return <main className="auth-page">{children}</main>;
  return <div className={"app-shell " + (open ? "sidebar-open" : "sidebar-closed")}>
    {open && <button className="sidebar-backdrop" aria-label="关闭导航栏" onClick={() => toggle(false)} tabIndex={-1} />}
    <aside className="sidebar" aria-label="导航栏" {...(!open ? { inert: true } : {})}>
      <Navibar onClose={() => toggle(false)} onNavigate={closeMobile} onNewChat={newChat} searchRef={searchRef} />
    </aside>
    <div className="main-panel">
      <header className="app-header"><div className="header-left">
        <button className="icon-button header-sidebar-toggle" onClick={() => toggle(!open)} aria-label={open ? "隐藏导航栏" : "显示导航栏"} aria-expanded={open} title="显示/隐藏导航栏"><Icon name="sidebar" /></button>
        <Link className="header-brand" href="/" onClick={event => { event.preventDefault(); newChat(); }}>DeepSeek <span>AI</span></Link>
      </div><span className="header-note"><span className="status-dot" />留一点空间给想象</span>
      <button className="icon-button" onClick={newChat} aria-label="新建对话" title="新建对话"><Icon name="edit" /></button></header>
      <main className="page-content" id="main-content">{children}</main>
    </div>
  </div>;
}
