"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { extractRecipeFromUrl, saveRecipe } from "@/app/actions";
import type { Recipe } from "@/lib/recipe";
import { PrintButton } from "./print-button";
import { RecipeView } from "./recipe-view";

export function RecipeExtractor() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialUrl = searchParams.get("url") ?? "";
  const autoSave = searchParams.get("save") === "1";

  const [url, setUrl] = useState(initialUrl);
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [extracting, startExtract] = useTransition();
  const [saving, startSave] = useTransition();

  const save = useCallback(
    (toSave: Recipe, pageUrl: string) => {
      setSaveError(null);
      startSave(async () => {
        const result = await saveRecipe(toSave);
        if (result.ok) {
          setSavedId(result.id);
        } else if (result.needsLogin) {
          const next = `/?url=${encodeURIComponent(pageUrl)}&save=1`;
          router.push(`/login?next=${encodeURIComponent(next)}`);
        } else {
          setSaveError(result.error);
        }
      });
    },
    [router],
  );

  const extract = useCallback(
    (target: string, thenSave = false) => {
      setError(null);
      setSaveError(null);
      setSavedId(null);
      startExtract(async () => {
        const result = await extractRecipeFromUrl(target);
        if (!result.ok) {
          setRecipe(null);
          setError(result.error);
          return;
        }
        setRecipe(result.recipe);
        setSavedId(result.savedId);
        // Keep the link in the address bar so it can be shared or bookmarked.
        window.history.replaceState(null, "", `/?url=${encodeURIComponent(target)}`);
        if (thenSave && !result.savedId) save(result.recipe, target);
      });
    },
    [save],
  );

  // Coming back from sign-in (or a shared link) with ?url=...
  const ranInitial = useRef(false);
  useEffect(() => {
    if (ranInitial.current || !initialUrl) return;
    ranInitial.current = true;
    extract(initialUrl, autoSave);
  }, [initialUrl, autoSave, extract]);

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (url.trim()) extract(url.trim());
        }}
        className="mx-auto mt-8 flex max-w-2xl flex-col gap-3 sm:flex-row print:hidden"
      >
        <label htmlFor="recipe-url" className="sr-only">
          Recipe link
        </label>
        <input
          id="recipe-url"
          type="text"
          inputMode="url"
          autoComplete="off"
          placeholder="https://www.example.com/best-banana-bread"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="min-w-0 flex-1 rounded-full border border-border bg-surface px-5 py-3.5 text-base shadow-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
        />
        <button
          type="submit"
          disabled={extracting || !url.trim()}
          className="rounded-full bg-accent px-6 py-3.5 font-semibold text-white shadow-sm hover:bg-accent-hover disabled:opacity-60"
        >
          {extracting ? "Getting recipe…" : "Get recipe"}
        </button>
      </form>

      {error && (
        <p role="alert" className="mx-auto mt-6 max-w-2xl rounded-2xl bg-accent-soft px-5 py-4 text-center">
          {error}
        </p>
      )}

      {extracting && !recipe && (
        <div className="mt-10 animate-pulse rounded-3xl border border-border bg-surface p-10">
          <div className="h-4 w-32 rounded bg-border" />
          <div className="mt-4 h-8 w-2/3 rounded bg-border" />
          <div className="mt-8 h-4 w-full rounded bg-border" />
          <div className="mt-3 h-4 w-5/6 rounded bg-border" />
        </div>
      )}

      {recipe && (
        <div className={`mt-10 transition-opacity ${extracting ? "opacity-50" : ""}`}>
          <RecipeView
            recipe={recipe}
            actions={
              <>
                {savedId ? (
                  <Link
                    href={`/recipes/${savedId}`}
                    className="rounded-full bg-accent-soft px-5 py-2.5 font-medium text-accent"
                  >
                    ✓ Saved to your recipes
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => save(recipe, url.trim() || recipe.sourceUrl)}
                    disabled={saving}
                    className="rounded-full bg-accent px-5 py-2.5 font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
                  >
                    {saving ? "Saving…" : "Save recipe"}
                  </button>
                )}
                <PrintButton />
                {saveError && <span className="text-sm text-accent">{saveError}</span>}
              </>
            }
          />
        </div>
      )}
    </div>
  );
}
