import { auth } from "@clerk/nextjs/server";
import { getChat } from "@/db";

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function requireChat(value: unknown, userId: string) {
  const id = typeof value === "string" || typeof value === "number" ? Number(value) : NaN;
  if (!Number.isSafeInteger(id) || id <= 0) throw new ApiError(400, "会话 ID 无效。");
  const chat = getChat(id, userId);
  if (!chat) throw new ApiError(404, "会话不存在或已被删除。");
  return chat;
}

export function apiRoute(handler: (request: Request, userId: string, body: Record<string, unknown>) => Response | Promise<Response>) {
  return async (request: Request) => {
    try {
      const { userId } = await auth();
      if (!userId) throw new ApiError(401, "请先登录。");
      let body;
      try { body = await request.json(); } catch { throw new ApiError(400, "请求格式无效。"); }
      if (!body || Array.isArray(body) || typeof body !== "object") throw new ApiError(400, "请求格式无效。");
      return await handler(request, userId, body);
    } catch (error) {
      if (error instanceof ApiError) return Response.json({ error: error.message }, { status: error.status });
      console.error("API error:", error instanceof Error ? error.message : "Unknown error");
      return Response.json({ error: "请求失败，请稍后重试。" }, { status: 500 });
    }
  };
}
