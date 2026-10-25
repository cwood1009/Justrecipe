import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Landing page for the link in Supabase's confirmation email.
// Handles both the PKCE `code` flow and the `token_hash` email template.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const nextParam = searchParams.get("next") ?? "/recipes";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/recipes";

  const supabase = await createClient();
  let error: unknown = null;

  if (tokenHash && type) {
    ({ error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash }));
  } else if (code) {
    ({ error } = await supabase.auth.exchangeCodeForSession(code));
  } else {
    error = new Error("Missing confirmation token");
  }

  if (error) {
    return NextResponse.redirect(new URL("/login?error=confirm", origin));
  }
  return NextResponse.redirect(new URL(next, origin));
}
