import { appendUserMessage, getMessagesByChatId, saveReply } from "@/db";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { APICallError, streamText } from "ai";
import { apiRoute, ApiError, requireChat } from "@/lib/server-api";
import { normalizeModel } from "@/lib/models";

export const runtime = "nodejs";
export const maxDuration = 120;

const deepseek = createDeepSeek({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: process.env.BASE_URL,
});
const generationGlobal = globalThis as typeof globalThis & { chatGenerations?: Map<number, string> };
const generations = generationGlobal.chatGenerations ?? new Map<number, string>();
generationGlobal.chatGenerations = generations;

function modelError(error: unknown): string {
  if (APICallError.isInstance(error)) {
    if (error.statusCode === 401) return "模型服务认证失败，请检查 API Key。";
    if (error.statusCode === 402) return "模型账户余额不足，请充值后重试。";
    if (error.statusCode === 429) return "请求过于频繁，请稍后重试。";
    if (error.statusCode === 400 || error.statusCode === 404) return "模型服务拒绝了请求，请检查模型与接口配置。";
  }
  return "暂时无法连接模型服务，请检查网络并重试。";
}

export const POST = apiRoute((request, userId, body) => {
  const chat = requireChat(body.chat_id, userId);
  if (!process.env.DEEPSEEK_API_KEY) throw new ApiError(503, "请先配置模型服务的 API Key。");
  if (generations.has(chat.id)) throw new ApiError(409, "此会话仍在生成回复，请稍后重试。");

  let parentId: string;
  if (body.mode === "retry") {
    if (typeof body.retry_from !== "string") throw new ApiError(400, "缺少需要重试的消息。");
    parentId = body.retry_from;
    // A failed network request may never have persisted the user's message.
    const existing = getMessagesByChatId(chat.id, userId).some(message => message.clientId === parentId && message.role === "user");
    if (!existing) {
      const incoming = Array.isArray(body.messages) ? body.messages.at(-1) : null;
      if (!incoming || incoming.id !== parentId || parentId.length > 256 || !parentId || incoming.role !== "user" ||
          typeof incoming.content !== "string" || !incoming.content.trim() || incoming.content.length > 100000)
        throw new ApiError(400, "找不到需要重试的消息。");
      appendUserMessage(chat.id, userId, incoming.content, parentId);
    }
  } else {
    const incoming = Array.isArray(body.messages) ? body.messages.at(-1) : null;
    if (!incoming || incoming.role !== "user" || typeof incoming.content !== "string" ||
        !incoming.content.trim() || incoming.content.length > 100000 || typeof incoming.id !== "string" ||
        !incoming.id || incoming.id.length > 256) throw new ApiError(400, "消息内容无效。");
    parentId = incoming.id;
    appendUserMessage(chat.id, userId, incoming.content, parentId);
  }
  const history = getMessagesByChatId(chat.id, userId);
  const parentIndex = history.findIndex(message => message.clientId === parentId && message.role === "user");
  if (parentIndex < 0) throw new ApiError(400, "找不到需要回复的消息。");
  if (body.mode !== "retry" && history.slice(parentIndex + 1).some(message => message.role === "user")) {
    throw new ApiError(409, "会话已更新，请刷新后再发送。");
  }

  const replyId = crypto.randomUUID();
  generations.set(chat.id, replyId);
  let partial = "";
  let saved = false;
  const release = () => {
    if (generations.get(chat.id) === replyId) generations.delete(chat.id);
    request.signal.removeEventListener("abort", onAbort);
  };
  const persist = (text: string) => {
    if (saved || !text.trim() || generations.get(chat.id) !== replyId) return;
    saved = true;
    saveReply(chat.id, userId, parentId, text, replyId);
  };
  const onAbort = () => {
    try { persist(partial); } catch (error) { console.error("Saving stopped reply:", error instanceof Error ? error.message : error); }
    finally { release(); }
  };
  request.signal.addEventListener("abort", onAbort, { once: true });

  try {
    const result = streamText({
      model: deepseek(normalizeModel(body.model ?? chat.model)),
      system: "你是一个乐于助人、清晰且严谨的 AI 助手。请使用 Markdown 格式组织回复，代码块请标明语言。",
      messages: history.slice(0, parentIndex + 1).map(({ role, content }) => ({ role, content })),
      abortSignal: request.signal,
      maxRetries: 1,
      experimental_generateMessageId: () => replyId,
      onChunk: ({ chunk }) => { if (chunk.type === "text-delta") partial += chunk.textDelta; },
      onFinish: ({ text }) => { try { persist(text); } finally { release(); } },
      onError: ({ error }) => {
        try { if (body.mode !== "retry") persist(partial); }
        finally { console.error("Model stream:", error instanceof Error ? error.message : "Unknown error"); release(); }
      },
    });
    return result.toDataStreamResponse({ getErrorMessage: modelError });
  } catch (error) {
    release();
    throw error;
  }
});
