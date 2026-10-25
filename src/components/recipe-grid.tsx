"use client";

import Link from "next/link";
import { useState } from "react";

type RecipeCard = {
  id: string;
  title: string;
  siteName: string | null;
  imageUrl: string | null;
  totalTime: string | null;
};

export function RecipeGrid({ recipes }: { recipes: RecipeCard[] }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = q
    ? recipes.filter((r) => `${r.title} ${r.siteName ?? ""}`.toLowerCase().includes(q))
    : recipes;

  return (
    <div className="mt-8">
      {recipes.length > 6 && (
        <input
          type="search"
          placeholder="Search your recipes"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="mb-6 w-full max-w-sm rounded-full border border-border bg-surface px-5 py-2.5 outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
        />
      )}
      {shown.length === 0 && <p className="text-muted">No recipes match &ldquo;{query}&rdquo;.</p>}
      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((r) => (
          <li key={r.id}>
            <Link
              href={`/recipes/${r.id}`}
              className="group block overflow-hidden rounded-2xl border border-border bg-surface shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              {r.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={r.imageUrl}
                  alt=""
                  referrerPolicy="no-referrer"
                  loading="lazy"
                  className="aspect-[4/3] w-full object-cover"
                />
              ) : (
                <div className="flex aspect-[4/3] items-center justify-center bg-accent-soft font-serif text-4xl text-accent">
                  {r.title.charAt(0)}
                </div>
              )}
              <div className="p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted">{r.siteName}</p>
                <h2 className="mt-1 font-serif text-lg font-semibold leading-snug group-hover:text-accent">
                  {r.title}
                </h2>
                {r.totalTime && <p className="mt-1 text-sm text-muted">{r.totalTime}</p>}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
