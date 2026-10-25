export type InstructionSection = {
  name: string | null;
  steps: string[];
};

export type Recipe = {
  title: string;
  description: string | null;
  imageUrl: string | null;
  sourceUrl: string;
  siteName: string | null;
  author: string | null;
  yield: string | null;
  prepTime: string | null;
  cookTime: string | null;
  totalTime: string | null;
  ingredients: string[];
  instructions: InstructionSection[];
};

export type SavedRecipe = Recipe & {
  id: string;
  createdAt: string;
};

/** Shape of a row in the `recipes` table. */
export type RecipeRow = {
  id: string;
  user_id: string;
  source_url: string;
  site_name: string | null;
  title: string;
  description: string | null;
  image_url: string | null;
  author: string | null;
  yield: string | null;
  prep_time: string | null;
  cook_time: string | null;
  total_time: string | null;
  ingredients: string[];
  instructions: InstructionSection[];
  created_at: string;
};

export function rowToRecipe(row: RecipeRow): SavedRecipe {
  return {
    id: row.id,
    createdAt: row.created_at,
    title: row.title,
    description: row.description,
    imageUrl: row.image_url,
    sourceUrl: row.source_url,
    siteName: row.site_name,
    author: row.author,
    yield: row.yield,
    prepTime: row.prep_time,
    cookTime: row.cook_time,
    totalTime: row.total_time,
    ingredients: row.ingredients ?? [],
    instructions: row.instructions ?? [],
  };
}

export function recipeToRow(recipe: Recipe) {
  return {
    source_url: recipe.sourceUrl,
    site_name: recipe.siteName,
    title: recipe.title,
    description: recipe.description,
    image_url: recipe.imageUrl,
    author: recipe.author,
    yield: recipe.yield,
    prep_time: recipe.prepTime,
    cook_time: recipe.cookTime,
    total_time: recipe.totalTime,
    ingredients: recipe.ingredients,
    instructions: recipe.instructions,
  };
}
