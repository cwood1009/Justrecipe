# JustRecipe

Paste a link to any recipe and get just the recipe: ingredients and steps, without the life story, ads or pop-ups. Create an account to save recipes and find them again later.

Built with Next.js 16 (App Router) and Supabase (auth + Postgres).

## How it works

- **Extraction** (`src/lib/extract.ts`): the server fetches the page and reads the recipe from its [schema.org/Recipe](https://schema.org/Recipe) JSON-LD, which nearly every recipe site publishes for Google. If that's missing, it falls back to microdata, then to common recipe-card plugins (WP Recipe Maker, Tasty Recipes, Create by Mediavine). As a last resort it reads plain articles, such as Shopify blogs: it finds the "Ingredients" and "Instructions"/"Directions"/"How to Make…" headings and takes the lists or paragraphs under them.
- **Fetching** (`src/lib/safe-fetch.ts`): pages are requested with the same headers Chrome sends. If a site answers 403 or 429, the app waits briefly and retries once. If it's still blocked, the user sees "This site blocked us. Try again in a minute." Only public http(s) addresses are fetched; private and internal IPs are refused on every redirect and again at connect time. Downloads are capped at 15 seconds and 5 MB.
- **Accounts**: Supabase email and password auth, with sessions kept in cookies through `@supabase/ssr`. `src/proxy.ts` refreshes the session on each request and sends signed-out visitors from `/recipes` to the login page.
- **Saved recipes**: one `recipes` table. Row-level security means each user can only read and change their own rows. Saving the same link twice updates the existing row.
- **Groups** (family, friends, a cooking club): anyone can start a group and invite people with a link. Recipes stay private until you share them. You can share them one at a time from the recipe's **Share** menu, or turn on **Share all my recipes** for a group. Members can view shared recipes and save their own copy. Row-level security enforces all of this in the database:
  - you can only see groups you're in;
  - you can only share your own recipes;
  - only the owner of a recipe can change it.

  When someone leaves a group, the recipes they shared go with them.

If someone clicks **Save** while signed out, they're sent to sign in. They then come back to the same recipe, and it saves automatically.

## Setup

1. **Create a Supabase project** at [supabase.com](https://supabase.com).

2. **Create the tables.** Run each file in `supabase/migrations/` in the Supabase SQL editor, oldest first:
   - `20261025000000_create_recipes.sql`
   - `20261025010000_create_groups.sql`
   - `20261025020000_private_group_helpers.sql`

   If you use the Supabase CLI, run `supabase db push` instead.

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

## Failure queue (optional)

When a link fails, the server records it in the `extraction_failures` table. "No recipe found" and "site blocked us" both count. Once a day, Vercel Cron calls `/api/cron/analyze-failures`, which takes up to 3 queued links and, for each:

1. Re-fetches the page. If today's parser now reads it, the link is marked resolved. If the site blocks the job too, it tries again on a later day, up to 3 times. Links are checked whatever their last failure was, because some sites alternate between blocking us and serving a page we can't parse.
2. Sends a trimmed copy of the page to Grok (xAI). Grok says where the recipe is, why each parsing strategy missed it, and how `src/lib/extract.ts` should change.
3. Files a GitHub issue labeled `extraction-failure`. The issue holds Grok's analysis, the recipe it found, and the page HTML to use as a test fixture. Later failures on the same site are added as comments on that issue instead of new issues.

A scheduled Claude session can then pick up open `extraction-failure` issues and open pull requests with fixes.

To turn it on:
1. Run `supabase/migrations/20261025030000_extraction_failures.sql`, then `20261025040000_failure_queue_retries.sql`.
2. Set these in Vercel (see `.env.example`):
   - `SUPABASE_SECRET_KEY`
   - `XAI_API_KEY` (and optionally `XAI_MODEL`, which defaults to `grok-4`)
   - `GITHUB_TOKEN`, a fine-grained token with Issues read/write on this repo
   - `GITHUB_REPO`
   - `CRON_SECRET`

Without them, failures simply aren't recorded and the rest of the app works as usual.

## Scripts

- `npm run dev`: start the dev server
- `npm run build`: production build
- `npm run lint`: ESLint
