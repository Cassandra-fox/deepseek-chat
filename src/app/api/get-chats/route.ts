import { getChats } from "@/db";
import { apiRoute } from "@/lib/server-api";

export const runtime = "nodejs";
export const POST = apiRoute((_request, userId, body) => {
  const search = typeof body.search === "string" ? body.search.trim().slice(0, 200) : "";
  return Response.json(getChats(userId, search));
});
