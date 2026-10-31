import assert from "node:assert/strict";
import { test } from "node:test";
import { type IndexEntry, matchQuery, operationMatch, score } from "../src/search.js";

const recipes: IndexEntry = {
  site: "bbcgoodfood",
  displayName: "Good Food",
  description: "Recipe search and recipe details",
  domains: ["bbcgoodfood.com"],
  sha256: "0".repeat(64),
  operations: [
    { op: "search(q) -> title, url", description: "Search recipes", method: "GET", hosts: ["bbcgoodfood.com"] },
    { op: "getRecipe(slug) -> ingredients", method: "GET", hosts: ["bbcgoodfood.com"] },
  ],
};
const menu: IndexEntry = {
  ...recipes,
  site: "mcdonalds",
  displayName: "Menu",
  description: "Product links and descriptions",
  domains: ["mcdonalds.com"],
  operations: [
    {
      op: "getProduct(slug) -> title, description",
      description: "Product identity and standard-recipe description",
      method: "GET",
      hosts: ["mcdonalds.com"],
    },
  ],
};

test("a recipe capability survives extra constraint words and outweighs an incidental recipe description", () => {
  assert.deepEqual(matchQuery(recipes, "vegetarian pasta recipes"), {
    matched: ["recipe"],
    unmatched: ["vegetarian", "pasta"],
    score: score(recipes, "recipes"),
  });
  assert.deepEqual(operationMatch(recipes.operations[0]!, "find a vegetarian pasta recipe"), {
    matched: ["recipe"],
    unmatched: ["vegetarian", "pasta"],
  });
  for (const q of ["recipes", "recipe search", "vegetarian pasta recipes", "find a vegetarian pasta recipe"]) {
    assert.ok(score(recipes, q) > 0, q);
    assert.ok(score(menu, q) * 3 < score(recipes, q), q);
  }
});

test("coverage is per op, normalized and stable under duplicate or unmatched query words", () => {
  assert.deepEqual(operationMatch(recipes.operations[0]!, "recipe ingredients"), {
    matched: ["recipe"],
    unmatched: ["ingredient"],
  });
  assert.deepEqual(operationMatch(recipes.operations[1]!, "recipe ingredients"), {
    matched: ["recipe", "ingredient"],
    unmatched: [],
  });
  assert.equal(score(recipes, "recipe recipe"), score(recipes, "recipe"));
  assert.equal(score(recipes, "recipe vegetarian pasta"), score(recipes, "recipe"));
  assert.ok(score(recipes, "recipe search") > score(recipes, "recipe"));
  assert.equal(score(recipes, "search hotels"), 0, "a generic action alone is not a partial capability");
  assert.equal(score(recipes, "weather in paris"), 0);
});

test("domains stay exact registrable-domain matches; stopword-only queries find nothing", () => {
  assert.deepEqual(matchQuery(recipes, "https://www.bbcgoodfood.com/recipes/pasta"), {
    score: 100,
    matched: ["bbcgoodfood.com"],
    unmatched: [],
  });
  assert.equal(score(menu, "bbcgoodfood.com"), 0);
  assert.equal(score(recipes, "the best"), 0);
});
