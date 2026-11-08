import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { compile, score, classify, nutrientTable, colorize, describe, lngLatToTilePixel, isInSeason } from "../js/habitat.js";

const cfg = JSON.parse(readFileSync(new URL("../data/species.json", import.meta.url)));
const vec = JSON.parse(readFileSync(new URL("./vectors.json", import.meta.url)));

test("JS scores match the Python pipeline exactly", () => {
  for (const sp of cfg.species) {
    const c = compile(sp);
    const ref = vec.scores[sp.id];
    vec.codes.forEach(([t, s, w], i) => {
      const v = score(c, t, s, w);
      assert.ok(Math.abs(v - ref.score[i]) < 1e-6, `${sp.id} #${i}: ${v} vs ${ref.score[i]}`);
      assert.equal(classify(v, cfg.classes), ref.class[i], `${sp.id} class #${i}`);
    });
  }
});

test("species tables are complete", () => {
  for (const sp of cfg.species) {
    assert.equal(sp.host.length, 11, sp.id);
    assert.equal(sp.water.length, 8, sp.id);
    for (const l of "AZMKR") assert.ok(sp.nutrient[l] >= 0 && sp.nutrient[l] <= 1, sp.id + l);
    assert.equal(sp.season.length, 2, sp.id);
  }
});

test("nutrient half steps interpolate", () => {
  const t = nutrientTable({ nutrient: { A: 0, Z: 1, M: 0.5, K: 0, R: 0 } });
  assert.equal(t[2], 0); assert.equal(t[3], 0.5); assert.equal(t[4], 1); assert.equal(t[5], 0.75);
});

test("ectomycorrhizal species score zero outside forest", () => {
  for (const sp of cfg.species.filter((s) => !s.edge)) {
    assert.equal(score(compile(sp), 255, 0x06, 0x02), 0, sp.id);
  }
});

test("Steinpilz: pine on Z2 beats alder on wet peat", () => {
  const c = compile(cfg.species.find((s) => s.id === "edulis"));
  assert.ok(score(c, 0, 4, 2) > 0.6);
  assert.equal(score(c, 8, 4 | 0x20, 7), 0);
});

test("colorize hatches protected areas and leaves outside transparent", () => {
  const c = compile(cfg.species[0]);
  const codes = new Uint8ClampedArray(256 * 256 * 4);
  codes.set([0, 4, 2 | 0x10, 255], 0); // pixel (0,0): NSG, hatch row
  const out = colorize(codes, new Uint8ClampedArray(codes.length), c, cfg.classes);
  assert.deepEqual([...out.slice(0, 4)], [29, 78, 216, 235]);
  assert.equal(out[7], 0);
});

test("describe and tile maths", () => {
  const d = describe(0, 4 | 0x80, 2 | 0x10);
  assert.equal(d.tree, 0); assert.equal(describe(255, 0, 0).tree, null); assert.ok(d.edge && d.nsg && d.siteKnown);
  const p = lngLatToTilePixel(13.4, 52.5, 12);
  assert.deepEqual([p.tx, p.ty], [2200, 1343]);
});

test("season wraps", () => {
  assert.ok(isInSeason({ season: [7, 10] }, 9));
  assert.ok(!isInSeason({ season: [7, 10] }, 3));
  assert.ok(isInSeason({ season: [11, 2] }, 1));
});
