import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const protectedPaths = ["/dashboard"];
const authPaths = ["/signin", "/signup"];

function isProtected(pathname: string) {
  return protectedPaths.some((p) => pathname.startsWith(p));
}

function isAuthPath(pathname: string) {
  return authPaths.some((p) => pathname === p);
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Use getUser() - validates JWT; getSession() can be spoofed
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (isProtected(request.nextUrl.pathname) && !user) {
    const signin = new URL("/signin", request.url);
    signin.searchParams.set("redirect", request.nextUrl.pathname);
    return NextResponse.redirect(signin);
  }

  if (isAuthPath(request.nextUrl.pathname) && user) {
    const redirect =
      request.nextUrl.searchParams.get("redirect") || "/dashboard/renter";
    return NextResponse.redirect(new URL(redirect, request.url));
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/signin", "/signup"],
};
