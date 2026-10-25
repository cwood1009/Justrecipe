# JustRecipe

Paste a link to any recipe and get just the recipe: ingredients and steps, without the life story, ads or pop-ups. Create an account to save recipes and find them again later.

Built with Next.js 16 (App Router) and Supabase (auth + Postgres).

## How it works

- **Extraction** (`src/lib/extract.ts`): the server fetches the page and reads the recipe from its [schema.org/Recipe](https://schema.org/Recipe) JSON-LD, which nearly every recipe site publishes for Google. If that's missing, it falls back to microdata, then to common recipe-card plugins (WP Recipe Maker, Tasty Recipes, Create by Mediavine).
- **Safe fetching** (`src/lib/safe-fetch.ts`): only public http(s) addresses are fetched. Private and internal IPs are blocked on every redirect hop, and downloads are capped at 12 seconds and 5 MB.
- **Accounts**: Supabase email and password auth, with sessions kept in cookies through `@supabase/ssr`. `src/proxy.ts` refreshes the session on each request and sends signed-out visitors from `/recipes` to the login page.
- **Saved recipes**: one `recipes` table. Row-level security means each user can only read and change their own rows. Saving the same link twice updates the existing row.

If someone clicks **Save** while signed out, they're sent to sign in. They then come back to the same recipe, and it saves automatically.

## Setup

1. **Create a Supabase project** at [supabase.com](https://supabase.com).

2. **Create the table.** Paste `supabase/migrations/20261025000000_create_recipes.sql` into the Supabase SQL editor and run it. If you use the Supabase CLI, run `supabase db push` instead.

3. **Add environment variables.** Copy `.env.example` to `.env.local` and fill in your project URL and publishable key. Both are under **Project Settings → API**. The legacy anon key also works as `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

4. **Set up auth URLs.** In **Authentication → URL Configuration**:
   - Set **Site URL** to your deployed URL, or `http://localhost:3000` for local development.
   - Add `http://localhost:3000/**` and your production URL followed by `/**` to **Redirect URLs**.

5. **Optional: make confirmation links work across devices.** In **Authentication → Email Templates → Confirm signup**, change the link to:

   ```html
   <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Confirm your email</a>
   ```

   With the default template, the link only works in the browser where the person signed up. To skip email confirmation entirely, turn off **Confirm email** under **Authentication → Providers → Email**. Sign-up then logs people in straight away.

6. **Run it.**

   ```bash
   npm install
   npm run dev
   ```

   Then open http://localhost:3000.

## Deploying

The app deploys to Vercel or any Node host that runs Next.js. Set the same environment variables there. Also set `NEXT_PUBLIC_SITE_URL` to the public URL, so confirmation emails link to the right place.

## Scripts

- `npm run dev`: start the dev server
- `npm run build`: production build
- `npm run lint`: ESLint
