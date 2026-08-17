import assert from "node:assert/strict";
import { test } from "node:test";
import { decodeJwtClaims, extractTokens, secondsUntilExpiry } from "../src/auth.js";

function jwt(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `eyJhbGciOiJub25lIn0.${body}.x`;
}

test("decode exp from jwt", () => {
  const exp = Math.floor(Date.UTC(2026, 7, 12) / 1000);
  const token = jwt({ exp, sub: "user" });
  assert.equal(decodeJwtClaims(token).exp, exp);
  assert.notEqual(secondsUntilExpiry(token), null);
});

test("extractTokens prefers accessToken over generic token", () => {
  const tokens = extractTokens({
    data: { accessToken: "a1", refresh_token: "r1" },
    token: "ignored",
  });
  assert.equal(tokens.access, "a1");
  assert.equal(tokens.refresh, "r1");
});
