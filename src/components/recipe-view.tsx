"use client";

import { useState, type ReactNode } from "react";
import type { Recipe } from "@/lib/recipe";

export function RecipeView({ recipe, actions }: { recipe: Recipe; actions?: ReactNode }) {
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [doneSteps, setDoneSteps] = useState<Set<string>>(new Set());
  const [imageFailed, setImageFailed] = useState(false);

  const toggle = <T,>(set: Set<T>, value: T) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  };

  const stats = [
    ["Prep", recipe.prepTime],
    ["Cook", recipe.cookTime],
    ["Total", recipe.totalTime],
    ["Yield", recipe.yield],
  ].filter((s): s is [string, string] => Boolean(s[1]));

  // Step numbers keep counting across instruction sections.
  const sectionOffsets = recipe.instructions.map((_, si) =>
    recipe.instructions.slice(0, si).reduce((n, s) => n + s.steps.length, 0),
  );

  return (
    <article className="rounded-3xl border border-border bg-surface p-5 shadow-sm sm:p-10 print:border-0 print:p-0 print:shadow-none">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          <a
            href={recipe.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium uppercase tracking-wide text-accent hover:underline"
          >
            {recipe.siteName ?? new URL(recipe.sourceUrl).hostname} ↗
          </a>
          <h1 className="mt-2 font-serif text-3xl font-semibold leading-tight sm:text-4xl">
            {recipe.title}
          </h1>
          {recipe.author && <p className="mt-2 text-muted">By {recipe.author}</p>}
          {recipe.description && (
            <p className="mt-4 max-w-prose leading-relaxed text-muted">{recipe.description}</p>
          )}
          {stats.length > 0 && (
            <dl className="mt-6 flex flex-wrap gap-2">
              {stats.map(([label, value]) => (
                <div key={label} className="rounded-xl bg-accent-soft px-3 py-2">
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted">{label}</dt>
                  <dd className="font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          )}
          {actions && <div className="mt-6 flex flex-wrap items-center gap-3 print:hidden">{actions}</div>}
        </div>
        {recipe.imageUrl && !imageFailed && (
          // Recipe images come from arbitrary hosts, so skip next/image optimization.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={recipe.imageUrl}
            alt=""
            referrerPolicy="no-referrer"
            onError={() => setImageFailed(true)}
            className="aspect-square w-full rounded-2xl object-cover sm:w-64 print:w-40"
          />
        )}
      </div>

      <div className="mt-10 grid gap-10 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <section>
          <h2 className="font-serif text-2xl font-semibold">Ingredients</h2>
          {recipe.ingredients.length === 0 ? (
            <p className="mt-4 text-muted">No ingredients listed.</p>
          ) : (
            <ul className="mt-4 space-y-1">
              {recipe.ingredients.map((item, i) => (
                <li key={i}>
                  <label className="flex cursor-pointer gap-3 rounded-lg px-2 py-1.5 hover:bg-accent-soft/60">
                    <input
                      type="checkbox"
                      checked={checked.has(i)}
                      onChange={() => setChecked((s) => toggle(s, i))}
                      className="mt-1 size-4 shrink-0 accent-accent print:hidden"
                    />
                    <span className={checked.has(i) ? "text-muted line-through" : ""}>{item}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="font-serif text-2xl font-semibold">Instructions</h2>
          {recipe.instructions.length === 0 && <p className="mt-4 text-muted">No instructions listed.</p>}
          {recipe.instructions.map((section, si) => (
            <div key={si} className="mt-4">
              {section.name && <h3 className="mb-2 mt-6 font-semibold">{section.name}</h3>}
              <ol className="space-y-3">
                {section.steps.map((step, i) => {
                  const stepNumber = sectionOffsets[si] + i + 1;
                  const key = `${si}-${i}`;
                  const done = doneSteps.has(key);
                  return (
                    <li key={key}>
                      <button
                        type="button"
                        onClick={() => setDoneSteps((s) => toggle(s, key))}
                        className="flex w-full gap-4 rounded-xl p-2 text-left hover:bg-accent-soft/60"
                        aria-pressed={done}
                      >
                        <span
                          className={`flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                            done ? "bg-border text-muted" : "bg-accent text-white"
                          }`}
                        >
                          {done ? "✓" : stepNumber}
                        </span>
                        <span className={`leading-relaxed ${done ? "text-muted" : ""}`}>{step}</span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
        </section>
      </div>
    </article>
  );
}
