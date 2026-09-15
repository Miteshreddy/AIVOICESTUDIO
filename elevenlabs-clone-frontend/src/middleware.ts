import { type NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  // If anyone tries to access sign-in or sign-up, send them straight to the studio
  if (path === "/app/sign-in" || path === "/app/sign-up") {
    return NextResponse.redirect(
      new URL("/app/speech-synthesis/text-to-speech", request.url),
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*"],
};

