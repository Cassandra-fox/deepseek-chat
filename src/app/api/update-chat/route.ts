import { updateChat } from "@/db";
import { apiRoute, ApiError, requireChat } from "@/lib/server-api";

export const runtime = "nodejs";
export const POST = apiRoute((_request, userId, body) => {
  const chat = requireChat(body.chat_id, userId);
  const changes: { title?: string; isPinned?: boolean } = {};
  if (body.title !== undefined) {
    if (typeof body.title !== "string" || !body.title.trim() || body.title.trim().length > 100)
      throw new ApiError(400, "会话名称应为 1–100 个字。");
    changes.title = body.title.trim();
  }
  if (body.isPinned !== undefined) {
    if (typeof body.isPinned !== "boolean") throw new ApiError(400, "置顶状态无效。");
    changes.isPinned = body.isPinned;
  }
  return Response.json(updateChat(chat.id, userId, changes));
});
