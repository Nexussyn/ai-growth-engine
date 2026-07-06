import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(
  new URL("../src/landing/mobile.html", import.meta.url),
  "utf8",
);

const walletLinks = [
  ["metamask", "metamask://", "MetaMask"],
  ["coinbase", "cbwallet://", "Coinbase Wallet"],
  ["rainbow", "rainbow://", "Rainbow"],
];

for (const [wallet, href, label] of walletLinks) {
  assert.ok(
    html.includes(`href="${href}"`),
    `expected ${label} deep link ${href}`,
  );
  assert.ok(
    html.includes(`data-wallet="${wallet}"`),
    `expected CTA metadata for ${wallet}`,
  );
  assert.match(
    html,
    new RegExp(`aria-label="[^"]*${label.replace(" ", "\\s+")}`),
    `expected accessible label for ${label}`,
  );
}

assert.match(html, /iPhone\|iPad\|iPod\|Android/, "mobile UA detection");
assert.ok(
  html.includes("matchMedia('(max-width: 767px)')"),
  "small viewport detection",
);
assert.ok(
  html.includes("document.body.dataset.mobileContext"),
  "observable mobile context flag",
);
assert.ok(
  html.includes("mobile_landing_cta_click"),
  "conversion event name",
);
assert.ok(
  html.includes("AI_GROWTH_EVENT_ENDPOINT"),
  "configurable analytics endpoint",
);
assert.match(html, /fetch\(EVENT_ENDPOINT/, "event endpoint POST");

for (const field of [
  "wallet",
  "mobile",
  "mobile_user_agent",
  "small_viewport",
  "viewport_width",
  "viewport_height",
  "path",
  "ts",
]) {
  assert.match(html, new RegExp(`\\b${field}\\b`), `payload field ${field}`);
}

console.log("mobile landing smoke check passed");
