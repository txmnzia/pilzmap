import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LANGS, T, pickLang } from "../js/i18n.js";

const cfg = JSON.parse(readFileSync(new URL("../data/species.json", import.meta.url)));

function shape(o) {
  if (typeof o === "function") return "fn";
  if (Array.isArray(o)) return `arr${o.length}`;
  if (o && typeof o === "object") return Object.fromEntries(Object.keys(o).sort().map((k) => [k, shape(o[k])]));
  return typeof o;
}

test("every language has the same keys and array lengths", () => {
  for (const l of LANGS) assert.deepEqual(shape(T[l]), shape(T.en), l);
});

test("species and exclusions have names and notes in every language", () => {
  for (const s of cfg.species) for (const l of LANGS) {
    assert.ok(s.name[l], `${s.id} name ${l}`);
    assert.ok(s.notes[l], `${s.id} notes ${l}`);
  }
  for (const x of cfg.excluded) for (const l of LANGS) assert.ok(x.name[l] && x.why[l], x.sci + l);
});

test("no em dashes in user-facing text", () => {
  const all = JSON.stringify(cfg) + JSON.stringify(T, (k, v) => (typeof v === "function" ? v("a", "b", "c") : v));
  assert.ok(!all.includes("—"));
});

test("pickLang: explicit, then browser, then English", () => {
  assert.equal(pickLang("fr", ["de-DE"]), "fr");
  assert.equal(pickLang(null, ["de-DE", "en"]), "de");
  assert.equal(pickLang("xx", ["fr-CH"]), "fr");
  assert.equal(pickLang(null, ["es"]), "en");
});
