"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveRecipe } from "@/app/actions";
import type { Recipe } from "@/lib/recipe";

export function SaveCopyButton({ recipe }: { recipe: Recipe }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await saveRecipe(recipe);
            if (result.ok) router.push(`/recipes/${result.id}`);
            else setError(result.error);
          })
        }
        className="rounded-full bg-accent px-5 py-2.5 font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save to my recipes"}
      </button>
      {error && <span className="text-sm text-accent">{error}</span>}
    </>
  );
}
