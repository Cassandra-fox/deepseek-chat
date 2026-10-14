import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

// 定义公开路由，如登录页，无需鉴权即可访问
const isPublicRoute = createRouteMatcher(['/sign-in(.*)'])

// 集成 Clerk 鉴权中间件，用于保护路由
export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    // 除了公开路由外，其他所有请求都必须经过身份验证
    await auth.protect()
  }
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}