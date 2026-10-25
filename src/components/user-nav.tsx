import Link from "next/link";
import { signOut } from "@/app/auth/actions";
import { getCurrentUser } from "@/lib/supabase/server";

export async function UserNav() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <nav className="flex items-center gap-2 text-sm">
        <Link href="/login" className="rounded-full px-3 py-2 hover:bg-accent-soft">
          Sign in
        </Link>
        <Link
          href="/signup"
          className="rounded-full bg-accent px-4 py-2 font-medium text-white hover:bg-accent-hover"
        >
          Create account
        </Link>
      </nav>
    );
  }

  return (
    <nav className="flex items-center gap-1 text-sm sm:gap-2">
      <Link href="/recipes" className="rounded-full px-3 py-2 font-medium hover:bg-accent-soft">
        My recipes
      </Link>
      <span className="hidden max-w-48 truncate text-muted sm:inline" title={user.email}>
        {user.email}
      </span>
      <form action={signOut}>
        <button type="submit" className="rounded-full px-3 py-2 text-muted hover:bg-accent-soft hover:text-foreground">
          Sign out
        </button>
      </form>
    </nav>
  );
}
