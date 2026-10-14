import { createChat } from "@/db";
import { apiRoute, ApiError } from "@/lib/server-api";
import { normalizeModel } from "@/lib/models";

export const runtime = "nodejs";
export const POST = apiRoute((_request, userId, body) => {
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : typeof body.title === "string" ? body.title.trim() : "";
  if (!prompt || prompt.length > 100000) throw new ApiError(400, "请输入有效的消息（最多 100,000 字）。");
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 100) : prompt.slice(0, 40);
  const chat = createChat(title || prompt.slice(0, 40), userId, normalizeModel(body.model), prompt);
  return Response.json(chat, { status: 201 });
});
