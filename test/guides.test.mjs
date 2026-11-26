import test from "node:test";
import assert from "node:assert/strict";
import { loadGuides, listCategories } from "../lib/guides.mjs";

test("corpus contains 26 well-formed guides across 6 categories with valid cross-references", () => {
  const guides = loadGuides({ fresh: true });
  const cats = listCategories(guides);

  assert.equal(cats.length, 6, `Expected 6 categories, found ${cats.length}`);
  assert.equal(guides.length, 26, `Expected 26 guides, found ${guides.length}`);

  const ids = new Set();
  for (const g of guides) {
    assert.ok(!ids.has(g.id), `Duplicate guide id: ${g.id}`);
    ids.add(g.id);

    assert.equal(g.id, g.stem, `Guide id "${g.id}" must match filename stem "${g.stem}"`);
    assert.equal(
      g.category,
      g.folderCategory,
      `Guide "${g.id}" category "${g.category}" must match folder "${g.folderCategory}"`
    );
    assert.ok(g.title.length >= 8, `Guide "${g.id}" title too short`);
    assert.ok(g.description.length >= 25, `Guide "${g.id}" description too short`);
    assert.ok(g.keywords.length >= 4, `Guide "${g.id}" needs >= 4 keywords`);
    assert.ok(g.appliesTo.length >= 1, `Guide "${g.id}" needs appliesTo`);

    assert.match(g.body, /## Invariants \(DO \/ DON'T\)/, `Missing Invariants section in ${g.id}`);
    assert.match(g.body, /## Playwright Verification Recipe/, `Missing Playwright section in ${g.id}`);
    assert.match(g.body, /## Related guides/, `Missing Related guides section in ${g.id}`);
  }

  for (const g of guides) {
    assert.ok(g.related.length >= 2, `Guide "${g.id}" should link at least 2 related guides`);
    for (const relId of g.related) {
      assert.ok(ids.has(relId), `Guide "${g.id}" references unknown guide "${relId}"`);
      assert.notEqual(relId, g.id, `Guide "${g.id}" should not self-reference`);
    }
  }
});
