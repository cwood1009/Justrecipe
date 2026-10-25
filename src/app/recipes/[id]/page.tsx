import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DeleteRecipeButton } from "@/components/delete-recipe-button";
import { PrintButton } from "@/components/print-button";
import { RecipeView } from "@/components/recipe-view";
import { SaveCopyButton } from "@/components/save-copy-button";
import { ShareMenu } from "@/components/share-menu";
import { getMemberEmail, getRecipeSharing } from "@/lib/groups-data";
import { getRecipe } from "@/lib/recipes-data";

export default function RecipePage({ params }: PageProps<"/recipes/[id]">) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Suspense fallback={<p className="text-muted">Loading recipe…</p>}>
        <SavedRecipe params={params} />
      </Suspense>
    </div>
  );
}

async function SavedRecipe({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const found = await getRecipe(id);
  if (!found) notFound();
  const { recipe, ownerId, isOwner } = found;

  if (isOwner) {
    const sharing = await getRecipeSharing(recipe.id);
    return (
      <>
        <BackLink href="/recipes" label="My recipes" />
        <RecipeView
          recipe={recipe}
          actions={
            <>
              <ShareMenu recipeId={recipe.id} groups={sharing} />
              <PrintButton />
              <DeleteRecipeButton id={recipe.id} />
            </>
          }
        />
      </>
    );
  }

  const sharedBy = await getMemberEmail(ownerId);
  return (
    <>
      <BackLink href="/groups" label="Groups" />
      <RecipeView
        recipe={recipe}
        actions={
          <>
            {sharedBy && <span className="text-sm text-muted">Shared by {sharedBy}</span>}
            <SaveCopyButton recipe={recipe} />
            <PrintButton />
          </>
        }
      />
    </>
  );
}

function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="mb-4 inline-block text-sm text-muted hover:text-foreground print:hidden">
      ← {label}
    </Link>
  );
}
