import { Suspense } from "react";
import { RecipeExtractor } from "@/components/recipe-extractor";

export default function Home() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-16">
      <section className="mx-auto max-w-2xl text-center print:hidden">
        <h1 className="font-serif text-4xl font-semibold tracking-tight sm:text-5xl">
          Just the recipe.
        </h1>
        <p className="mt-4 text-lg text-muted">
          Paste a link to any recipe. We&apos;ll skip the life story, the ads and the pop-ups, and
          give you the ingredients and steps.
        </p>
      </section>
      <Suspense>
        <RecipeExtractor />
      </Suspense>
    </div>
  );
}
