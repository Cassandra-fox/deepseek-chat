import { apiRoute, requireChat } from "@/lib/server-api";

export const runtime = "nodejs";
export const POST = apiRoute((_request, userId, body) => Response.json(requireChat(body.chat_id, userId)));
