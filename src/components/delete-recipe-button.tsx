"use client";

import { useTransition } from "react";
import { deleteRecipe } from "@/app/actions";

export function DeleteRecipeButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (confirm("Delete this recipe from your collection?")) {
          startTransition(() => deleteRecipe(id));
        }
      }}
      className="rounded-full px-5 py-2.5 font-medium text-muted hover:bg-accent-soft hover:text-accent disabled:opacity-60"
    >
      {pending ? "Deleting…" : "Delete"}
    </button>
  );
}
