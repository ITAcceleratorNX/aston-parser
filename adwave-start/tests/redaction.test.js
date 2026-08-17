import assert from "node:assert/strict";
import { test } from "node:test";
import { redactObj, redactText } from "../src/logging.js";

test("redacts jwt and phone", () => {
  const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0In0.abc";
  const redacted = redactText(`Authorization: Bearer ${token}; phone=+77470000000`);
  assert.equal(redacted.includes("eyJ"), false);
  assert.equal(redacted.includes("+7747"), false);
  assert.equal(redacted.includes("[REDACTED_JWT]"), true);
  assert.equal(redacted.includes("[REDACTED_PHONE]"), true);
});

test("redacts secret keys", () => {
  const redacted = redactObj({ accessToken: "secret", refreshToken: "secret2", leads: 12 });
  assert.equal(redacted.accessToken, "[REDACTED]");
  assert.equal(redacted.refreshToken, "[REDACTED]");
  assert.equal(redacted.leads, 12);
});
