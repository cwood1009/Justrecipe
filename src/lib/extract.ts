import "server-only";
import * as cheerio from "cheerio";
import type { Cheerio, CheerioAPI } from "cheerio";
import type { AnyNode, Element } from "domhandler";
import type { InstructionSection, Recipe } from "./recipe";

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };
type JsonObject = { [key: string]: Json };

export class NoRecipeError extends Error {}

/** Pulls the recipe out of a page's HTML, ignoring everything else. */
export function extractRecipe(html: string, pageUrl: string): Recipe {
  const $ = cheerio.load(html);
  const siteName =
    $('meta[property="og:site_name"]').attr("content")?.trim() ||
    new URL(pageUrl).hostname.replace(/^www\./, "");

  const fromJsonLd = findJsonLdRecipe($);
  const recipe = fromJsonLd
    ? fromSchema(fromJsonLd, pageUrl, siteName)
    : (fromMicrodata($, pageUrl, siteName) ??
      fromKnownPlugins($, pageUrl, siteName) ??
      fromHeadings($, pageUrl, siteName));

  if (!recipe || (recipe.ingredients.length === 0 && recipe.instructions.length === 0)) {
    throw new NoRecipeError(
      "We couldn't find a recipe on that page. Make sure the link goes to a single recipe.",
    );
  }

  // Some sites put the recipe in JSON-LD but leave the image off it.
  recipe.imageUrl ??= absolutize($('meta[property="og:image"]').attr("content"), pageUrl);
  return recipe;
}

// ---------- JSON-LD (schema.org/Recipe) ----------

function findJsonLdRecipe($: CheerioAPI): JsonObject | null {
  const scripts = $('script[type="application/ld+json"]').toArray();
  for (const el of scripts) {
    const raw = $(el).text().trim();
    if (!raw) continue;
    let data: Json;
    try {
      data = JSON.parse(raw);
    } catch {
      try {
        // Stray control characters inside strings are a common breakage.
        data = JSON.parse(raw.replace(/[\u0000-\u001f]+/g, " "));
      } catch {
        continue;
      }
    }
    const found = findRecipeNode(data);
    if (found) return found;
  }
  return null;
}

function findRecipeNode(node: Json, depth = 0): JsonObject | null {
  if (depth > 8 || node === null || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findRecipeNode(child, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (isType(node, "Recipe")) return node;
  for (const key of ["@graph", "mainEntity", "mainEntityOfPage", "itemListElement", "item"]) {
    if (key in node) {
      const found = findRecipeNode(node[key], depth + 1);
      if (found) return found;
    }
  }
  return null;
}

function isType(node: JsonObject, type: string): boolean {
  const t = node["@type"];
  const types = Array.isArray(t) ? t : [t];
  return types.some((x) => typeof x === "string" && x.replace(/^.*[/:]/, "") === type);
}

function fromSchema(node: JsonObject, pageUrl: string, siteName: string): Recipe {
  return {
    title: cleanText(asString(node.name)) || "Untitled recipe",
    description: cleanText(asString(node.description)) || null,
    imageUrl: absolutize(pickImage(node.image), pageUrl),
    sourceUrl: pageUrl,
    siteName,
    author: pickName(node.author),
    yield: pickYield(node.recipeYield ?? node.yield),
    prepTime: formatDuration(asString(node.prepTime)),
    cookTime: formatDuration(asString(node.cookTime)),
    totalTime: formatDuration(asString(node.totalTime)),
    ingredients: toList(node.recipeIngredient ?? node.ingredients),
    instructions: parseInstructions(node.recipeInstructions),
  };
}

function toList(value: Json | undefined): string[] {
  if (value == null) return [];
  const items = Array.isArray(value) ? value : [value];
  return items
    .flatMap((item) => {
      if (typeof item === "string") return item.split(/\n+/);
      if (item && typeof item === "object" && !Array.isArray(item)) {
        return [asString(item.text) ?? asString(item.name) ?? ""];
      }
      return [];
    })
    .map(cleanText)
    .filter(Boolean);
}

function parseInstructions(value: Json | undefined): InstructionSection[] {
  if (value == null) return [];
  const sections: InstructionSection[] = [];
  let loose: string[] = [];

  const flushLoose = () => {
    if (loose.length) sections.push({ name: null, steps: loose });
    loose = [];
  };

  const visit = (item: Json) => {
    if (item == null) return;
    if (typeof item === "string") {
      loose.push(...splitSteps(item));
      return;
    }
    if (Array.isArray(item)) {
      item.forEach(visit);
      return;
    }
    if (typeof item !== "object") return;

    if (isType(item, "HowToSection")) {
      flushLoose();
      const steps: string[] = [];
      collectSteps(item.itemListElement ?? item.steps ?? null, steps);
      if (steps.length) sections.push({ name: cleanText(asString(item.name)) || null, steps });
      return;
    }
    const steps: string[] = [];
    collectSteps(item, steps);
    loose.push(...steps);
  };

  visit(value);
  flushLoose();
  return sections;
}

function collectSteps(item: Json, out: string[]) {
  if (item == null) return;
  if (typeof item === "string") {
    out.push(...splitSteps(item));
  } else if (Array.isArray(item)) {
    item.forEach((child) => collectSteps(child, out));
  } else if (typeof item === "object") {
    if (item.itemListElement && !item.text) {
      collectSteps(item.itemListElement, out);
      return;
    }
    const text = cleanText(asString(item.text)) || cleanText(asString(item.name));
    if (text) out.push(text);
  }
}

function splitSteps(text: string): string[] {
  // A single string may hold every step, separated by newlines or HTML.
  const withBreaks = text.replace(/<\/(p|li|div)>|<br\s*\/?>/gi, "\n");
  return withBreaks.split(/\n+/).map(cleanText).filter(Boolean);
}

function pickImage(value: Json | undefined): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    for (const v of value) {
      const found = pickImage(v);
      if (found) return found;
    }
    return null;
  }
  if (typeof value === "object") return asString(value.url) ?? asString(value["@id"]);
  return null;
}

function pickName(value: Json | undefined): string | null {
  if (value == null) return null;
  if (typeof value === "string") return cleanText(value) || null;
  if (Array.isArray(value)) {
    const names = value.map((v) => pickName(v)).filter(Boolean);
    return names.length ? names.join(", ") : null;
  }
  if (typeof value === "object") return cleanText(asString(value.name)) || null;
  return null;
}

function pickYield(value: Json | undefined): string | null {
  if (value == null) return null;
  const items = (Array.isArray(value) ? value : [value])
    .map((v) => (typeof v === "number" ? String(v) : cleanText(asString(v))))
    .filter(Boolean);
  if (items.length === 0) return null;
  // Prefer the most descriptive form, e.g. "4 servings" over "4".
  return items.reduce((a, b) => (b.length > a.length ? b : a));
}

/** Turns an ISO 8601 duration like "PT1H30M" into "1 hr 30 min". */
export function formatDuration(value: string | null): string | null {
  if (!value) return null;
  const m = value.trim().match(/^P(?:(\d+)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i);
  if (!m) return cleanText(value) || null;
  let minutes =
    Number(m[1] ?? 0) * 1440 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0) + Number(m[4] ?? 0) / 60;
  minutes = Math.round(minutes);
  if (minutes <= 0) return null;
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  return [
    days && `${days} day${days > 1 ? "s" : ""}`,
    hours && `${hours} hr`,
    mins && `${mins} min`,
  ]
    .filter(Boolean)
    .join(" ");
}

// ---------- Microdata fallback ----------

function fromMicrodata($: CheerioAPI, pageUrl: string, siteName: string): Recipe | null {
  const scope = $('[itemtype*="schema.org/Recipe"]').first();
  if (!scope.length) return null;

  const prop = (name: string) => scope.find(`[itemprop="${name}"]`);
  const propText = (name: string) => {
    const el = prop(name).first();
    if (!el.length) return null;
    return cleanText(el.attr("content") ?? el.text()) || null;
  };

  const ingredients = [
    ...prop("recipeIngredient").toArray(),
    ...prop("ingredients").toArray(),
  ]
    .map((el) => cleanText($(el).text()))
    .filter(Boolean);

  const steps = prop("recipeInstructions")
    .toArray()
    .flatMap((el) => {
      const items = $(el).find("li");
      return items.length
        ? items.toArray().map((li) => cleanText($(li).text()))
        : splitSteps($(el).html() ?? "");
    })
    .filter(Boolean);

  const imageEl = prop("image").first();
  return {
    title: propText("name") ?? (cleanText($("h1").first().text()) || "Untitled recipe"),
    description: propText("description"),
    imageUrl: absolutize(imageEl.attr("src") ?? imageEl.attr("content") ?? imageEl.attr("href"), pageUrl),
    sourceUrl: pageUrl,
    siteName,
    author: propText("author"),
    yield: propText("recipeYield"),
    prepTime: formatDuration(prop("prepTime").attr("content") ?? prop("prepTime").attr("datetime") ?? null),
    cookTime: formatDuration(prop("cookTime").attr("content") ?? prop("cookTime").attr("datetime") ?? null),
    totalTime: formatDuration(prop("totalTime").attr("content") ?? prop("totalTime").attr("datetime") ?? null),
    ingredients,
    instructions: steps.length ? [{ name: null, steps }] : [],
  };
}

// ---------- Common recipe-card plugins without structured data ----------

const PLUGIN_SELECTORS = [
  {
    ingredients: ".wprm-recipe-ingredient",
    steps: ".wprm-recipe-instruction-text",
    title: ".wprm-recipe-name",
  },
  {
    ingredients: ".tasty-recipes-ingredients li",
    steps: ".tasty-recipes-instructions li",
    title: ".tasty-recipes-title",
  },
  {
    ingredients: ".mv-create-ingredients li",
    steps: ".mv-create-instructions li",
    title: ".mv-create-title",
  },
];

function fromKnownPlugins($: CheerioAPI, pageUrl: string, siteName: string): Recipe | null {
  for (const sel of PLUGIN_SELECTORS) {
    const ingredients = $(sel.ingredients).toArray().map((el) => cleanText($(el).text())).filter(Boolean);
    const steps = $(sel.steps).toArray().map((el) => cleanText($(el).text())).filter(Boolean);
    if (!ingredients.length && !steps.length) continue;
    return {
      title:
        cleanText($(sel.title).first().text()) ||
        cleanText($("h1").first().text()) ||
        "Untitled recipe",
      description: cleanText($('meta[name="description"]').attr("content")) || null,
      imageUrl: null,
      sourceUrl: pageUrl,
      siteName,
      author: null,
      yield: null,
      prepTime: null,
      cookTime: null,
      totalTime: null,
      ingredients,
      instructions: steps.length ? [{ name: null, steps }] : [],
    };
  }
  return null;
}

// ---------- Plain articles: "Ingredients" / "Instructions" headings ----------
// Many blogs (Shopify, Squarespace, hand-written WordPress posts) have no
// structured data, just a heading followed by a list.

const INGREDIENTS_HEADING = /^(the\s+)?ingredients?\b/i;
const STEPS_HEADING =
  /^(the\s+)?(instructions?|directions?|method|steps|preparation|how to (make|prepare|cook)\b)/i;
const END_HEADING =
  /^(notes?|tips?|nutrition|faqs?|frequently asked|storage|storing|variations?|substitutions?|serving|equipment|related|you may also|conclusion|final thoughts|enjoy)\b/i;
const HEADING_TAGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6"]);
const MAX_ITEMS = 100;

function fromHeadings($: CheerioAPI, pageUrl: string, siteName: string): Recipe | null {
  $("script, style, noscript, nav, header, footer, aside, form, iframe").remove();
  const scope = [".rte", ".article__content", ".entry-content", ".post-content", "article", "main", "body"]
    .map((sel) => $(sel).first())
    .find((el) => el.length && /ingredients?/i.test(el.text()));
  if (!scope) return null;

  const markers = scope
    .find("h1, h2, h3, h4, h5, h6, p, div")
    .toArray()
    .filter((el) => isMarker($, el));
  const ingredientsAt = markers.find((el) => INGREDIENTS_HEADING.test(markerText($, el)));
  const isSteps = (el: Element) => STEPS_HEADING.test(markerText($, el));
  const stepsAt =
    markers.slice(markers.indexOf(ingredientsAt as Element) + 1).find(isSteps) ?? markers.find(isSteps);
  if (!ingredientsAt || !stepsAt) return null;

  const ingredients = collectSection($, ingredientsAt).flatMap((s) => s.steps).map(stripBullet).filter(Boolean);
  const instructions = collectSection($, stepsAt)
    .map((s) => ({ name: s.name, steps: s.steps.map(stripStepNumber).filter(Boolean) }))
    .filter((s) => s.steps.length);
  if (!ingredients.length || !instructions.length) return null;

  return {
    title:
      cleanText($('meta[property="og:title"]').attr("content")) ||
      cleanText(scope.find("h1").first().text() || $("h1").first().text()) ||
      cleanText($("title").text()) ||
      "Untitled recipe",
    description: cleanText($('meta[name="description"]').attr("content")) || null,
    imageUrl: null,
    sourceUrl: pageUrl,
    siteName,
    author: null,
    yield: null,
    prepTime: null,
    cookTime: null,
    totalTime: null,
    ingredients: ingredients.slice(0, MAX_ITEMS),
    instructions,
  };
}

/** The text of a heading-like element, e.g. "Ingredients:" → "Ingredients". */
function markerText($: CheerioAPI, el: Element): string {
  return cleanText(firstLine($, el)).replace(/[:\s]+$/, "");
}

/** A short heading, or a paragraph that starts with bold heading text. */
function isMarker($: CheerioAPI, el: Element): boolean {
  const text = markerText($, el);
  if (!text || text.length > 60) return false;
  if (!INGREDIENTS_HEADING.test(text) && !STEPS_HEADING.test(text)) return false;
  if (HEADING_TAGS.has(el.tagName)) return true;
  if (el.tagName === "p") {
    const first = $(el).children().first();
    return /^(strong|b)$/.test(first.prop("tagName")?.toLowerCase() ?? "") || cleanText($(el).text()).length <= 60;
  }
  // A div counts only when it has no block children (some editors use bare divs).
  return el.tagName === "div" && $(el).children("p, div, ul, ol, h1, h2, h3, h4, h5, h6").length === 0 &&
    cleanText($(el).text()).length <= 60;
}

function firstLine($: CheerioAPI, el: Element): string {
  return ($(el).html() ?? "").split(/<br\s*\/?>/i)[0];
}

function headingLevel(el: Element): number {
  return HEADING_TAGS.has(el.tagName) ? Number(el.tagName[1]) : 7;
}

/**
 * Reads the lists and paragraphs that follow a marker, up to the next section.
 * Smaller sub-headings ("For the sauce") start a new named group.
 */
function collectSection($: CheerioAPI, marker: Element): InstructionSection[] {
  const groups: InstructionSection[] = [{ name: null, steps: [] }];
  const add = (text: string) => {
    const t = cleanText(text);
    if (t) groups[groups.length - 1].steps.push(t);
  };
  const startGroup = (name: string) => groups.push({ name: cleanText(name).replace(/:$/, ""), steps: [] });
  const level = headingLevel(marker);

  // "<p><strong>Ingredients:</strong><br>1 cup rice<br>…</p>" keeps the list inline.
  const inline = ($(marker).html() ?? "").split(/<br\s*\/?>/i).slice(1);
  inline.forEach(add);

  let count = 0;
  let node: Cheerio<AnyNode> = $(marker).next();
  // If the marker is the only thing in its wrapper, keep walking from the wrapper.
  if (!node.length && !inline.length) node = $(marker).parent().next();

  while (node.length && count < MAX_ITEMS) {
    const el = node.get(0) as Element;
    const text = cleanText(node.text());
    if (el.type === "tag") {
      const isBoundary = (e: Element) =>
        isMarker($, e) || (HEADING_TAGS.has(e.tagName) && END_HEADING.test(cleanText($(e).text())));
      if (isBoundary(el) || node.find("h1, h2, h3, h4, h5, h6, p").toArray().some(isBoundary)) break;
      if (text.length <= 60 && END_HEADING.test(text)) break;
      if (HEADING_TAGS.has(el.tagName)) {
        if (headingLevel(el) <= level) break;
        startGroup(text);
      } else if (el.tagName === "ul" || el.tagName === "ol") {
        node.children("li").each((_, li) => {
          add($(li).text());
          count++;
        });
      } else if (el.tagName === "p" || el.tagName === "div") {
        const lists = node.find("li");
        if (lists.length) {
          lists.each((_, li) => add($(li).text()));
        } else if (text.length <= 60 && (/:$/.test(text) || /^for the\b/i.test(text))) {
          startGroup(text);
        } else if (text) {
          (node.html() ?? "").split(/<br\s*\/?>/i).forEach(add);
        }
        count++;
      } else if (el.tagName === "hr" || el.tagName === "figure" || el.tagName === "img") {
        if (groups.some((g) => g.steps.length)) break;
      }
    }
    node = node.next();
  }

  return groups.filter((g) => g.steps.length);
}

function stripBullet(text: string): string {
  return text.replace(/^[•●▪︎◦\-–—*]\s*/, "").trim();
}

function stripStepNumber(text: string): string {
  return text.replace(/^(step\s*)?\d+[.):]\s*/i, "").trim();
}

// ---------- helpers ----------

function asString(value: Json | undefined): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return asString(value[0]);
  return null;
}

/** Strips HTML tags, decodes entities, and collapses whitespace. */
function cleanText(value: string | null | undefined): string {
  if (!value) return "";
  let text = value;
  if (/[<&]/.test(text)) {
    text = cheerio.load(`<div>${text}</div>`)("div").first().text();
    // Entities are sometimes double-encoded (e.g. "&amp;amp;").
    if (/&[#a-z0-9]+;/i.test(text)) {
      text = cheerio.load(`<div>${text}</div>`)("div").first().text();
    }
  }
  return text.replace(/\s+/g, " ").trim();
}

function absolutize(url: string | null | undefined, base: string): string | null {
  if (!url) return null;
  try {
    const abs = new URL(url, base);
    return abs.protocol === "http:" || abs.protocol === "https:" ? abs.toString() : null;
  } catch {
    return null;
  }
}
