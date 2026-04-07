import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const protectedPaths = ["/dashboard", "/profile", "/list"];
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
        setAll(cookiesToSet: any[]) {
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

  // /list and /dashboard/landlord require landlord; /dashboard/contractor requires contractor
  const listPath = "/list";
  const landlordDashboardPath = "/dashboard/landlord";
  const contractorDashboardPath = "/dashboard/contractor";
  const pathname = request.nextUrl.pathname;
  if (
    user &&
    (pathname === listPath ||
      pathname.startsWith(landlordDashboardPath) ||
      pathname.startsWith(contractorDashboardPath))
  ) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_landlord, is_contractor")
      .eq("id", user.id)
      .single();
    if (pathname === listPath && profile && !profile.is_landlord) {
      return NextResponse.redirect(new URL("/profile?upgrade=1", request.url));
    }
    if (pathname.startsWith(landlordDashboardPath) && profile && !profile.is_landlord) {
      return NextResponse.redirect(new URL("/dashboard/renter", request.url));
    }
    if (pathname.startsWith(contractorDashboardPath) && profile && !profile.is_contractor) {
      return NextResponse.redirect(new URL("/dashboard/renter", request.url));
    }
  }

  if (isAuthPath(request.nextUrl.pathname) && user) {
    const explicitRedirect = request.nextUrl.searchParams.get("redirect");
    const redirectUrl = explicitRedirect || "/";
    return NextResponse.redirect(new URL(redirectUrl, request.url));
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/profile", "/list", "/signin", "/signup"],
};
