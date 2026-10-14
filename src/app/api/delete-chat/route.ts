import { deleteChat } from "@/db";
import { apiRoute, requireChat } from "@/lib/server-api";

export const runtime = "nodejs";
export const POST = apiRoute((_request, userId, body) => {
  const chat = requireChat(body.chat_id, userId);
  deleteChat(chat.id, userId);
  return Response.json({ success: true });
});
