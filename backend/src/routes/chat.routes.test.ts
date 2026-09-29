import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { AddressInfo } from "node:net";
import { createApp } from "../app.js";

let baseUrl: string;
let server: ReturnType<ReturnType<typeof createApp>["listen"]>;

before(() => {
  const app = createApp();
  server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;
});

after(() => {
  server.close();
});

test("POST /api/chat/glossary is wired up (rejects an invalid body before any Gemini call)", async () => {
  const response = await fetch(`${baseUrl}/api/chat/glossary`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });

  assert.equal(response.status, 400);
});

test("unknown chat routes 404", async () => {
  const response = await fetch(`${baseUrl}/api/chat/unknown`, { method: "POST" });
  assert.equal(response.status, 404);
});
