"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { useQuery } from "@tanstack/react-query";
import type { ChatModel, MessagesModel } from "@/db/schema";
import { post } from "@/lib/api";
import Icon from "@/components/Icon";
import Conversation from "@/components/Conversation";

export default function Page() {
  const params = useParams<{ chat_id: string }>();
  const { user, isLoaded } = useUser();
  const chatId = params.chat_id;
  const chat = useQuery({
    queryKey: ["chat", user?.id, chatId],
    queryFn: () => post<ChatModel>("/api/get-chat", { chat_id: chatId }),
    enabled: !!user?.id,
  });
  const history = useQuery({
    queryKey: ["messages", user?.id, chatId],
    queryFn: () => post<MessagesModel[]>("/api/get-messages", { chat_id: chatId }),
    enabled: !!chat.data && !!user?.id,
    staleTime: 0,
    refetchOnMount: "always",
  });
  if (chat.isError || history.isError) return <div className="page-state"><Icon name="chat" width={32} height={32} /><h1>暂时无法打开对话</h1><p>{chat.error?.message ?? history.error?.message}</p><button className="secondary-button" onClick={() => { void chat.refetch(); void history.refetch(); }}>重新加载</button><Link href="/" className="text-button">开始新对话</Link></div>;
  if (!isLoaded || !user || !chat.data || !history.data) return <div className="page-state" role="status"><span className="loading-ring" /><p>正在打开对话…</p></div>;
  return <Conversation key={user.id + ":" + chatId} chat={chat.data} userId={user.id} initialMessages={history.data.map(message => ({ id: message.clientId, role: message.role, content: message.content }))} />;
}
