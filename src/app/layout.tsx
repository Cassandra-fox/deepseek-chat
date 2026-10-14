import type { Metadata } from "next";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import QueryClientProvider from "@/components/QueryClientProvider";
import ThemeProvider from "@/components/ThemeProvider";
import AppShell from "@/components/AppShell";

export const metadata: Metadata = {
  title: "DeepSeek · 让想法发生",
  description: "一个安静、专注的 AI 对话空间，帮助你思考、创作与解决问题。",
};
const themeScript = `try{var t=localStorage.getItem('deepseek-theme');document.documentElement.dataset.theme=t==='dark'||t==='light'?t:matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}catch(e){}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN" suppressHydrationWarning>
    <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
    <body><ClerkProvider><QueryClientProvider><ThemeProvider>
      <AppShell>{children}</AppShell>
    </ThemeProvider></QueryClientProvider></ClerkProvider></body>
  </html>;
}
