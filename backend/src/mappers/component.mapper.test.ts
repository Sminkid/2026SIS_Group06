import assert from "node:assert/strict";
import test from "node:test";

import { isGroupCompatibleWithComponentRole } from "./component.mapper.js";

test("role-only groups cannot contaminate major/minor component details", () => {
  assert.equal(isGroupCompatibleWithComponentRole("MAJOR", "Selective units (minor only)"), false);
  assert.equal(isGroupCompatibleWithComponentRole("MINOR", "Core units (major only)"), false);
  assert.equal(isGroupCompatibleWithComponentRole("MAJOR", "Core units (major only)"), true);
  assert.equal(isGroupCompatibleWithComponentRole("MINOR", "Selective units (minor only)"), true);
  assert.equal(isGroupCompatibleWithComponentRole("MAJOR", "Shared core units"), true);
});

