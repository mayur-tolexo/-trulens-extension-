# Chrome Web Store — Listing Copy

## Short Summary (≤ 132 characters)

```
Instantly score every Amazon, Flipkart & Google Maps review for genuineness — on-device, private, no server.
```

*(107 characters — within the 132-character limit)*

---

## Detailed Description

Paste the block below into the "Detailed description" field in the Chrome Web Store Developer Dashboard.

---

**TruLens — Review Genuineness** shows you, at a glance, how trustworthy the reviews on a product or place actually are.

**Instant on-device badges on every review**
As soon as you load a product page on Amazon (amazon.com, amazon.in), Flipkart, or Google Maps, TruLens scores every visible review and attaches a colored shield badge directly beside it:

- 🟢 **Likely genuine** (score 70–100)
- 🟡 **Mixed signals** (score 40–69)
- 🔴 **Likely fake** (score 0–39)

Each badge also shows a 0–100 score and a 5-star equivalent. Tap any badge to see the full signal breakdown that drove the verdict.

**Trust summary panel & popup**
An on-page panel and the toolbar popup both display an overall trust gauge, a plain-language verdict ("Mostly genuine", "Treat with caution", etc.), and a breakdown of how many reviews fall into each category.

**Optional AI deep analysis**
Want a sharper verdict? Enable the optional AI deep-analysis feature — bring your own API key for MiniMax, OpenAI, Anthropic, or any OpenAI-compatible endpoint — and get a more detailed per-review reasoning. The feature is off by default; you're in full control.

**Completely private by design**
The heuristic scoring engine runs 100 % inside your browser. No data, review text, page content, or browsing history is ever sent anywhere for the local scoring. When AI analysis is enabled, the review text goes directly from your browser to your chosen AI provider — TruLens has no server, no analytics, and never sees your data.

**Feature list**
- Genuine / Mixed / Fake shield badge on every review, rendered instantly
- 0–100 genuineness score + 5-star equivalent per review
- Clickable detail card: signals list, confidence breakdown
- On-page overlay panel with overall trust gauge and verdict
- Toolbar popup with trust summary and per-category counts
- Opt-in AI deep analysis (bring-your-own-key: MiniMax, OpenAI, Anthropic, OpenRouter)
- AI results cached locally — no repeat API calls for the same review
- All settings and API key stored locally in the browser — never transmitted to TruLens
- Supports Amazon.com, Amazon.in, Flipkart.com, Google Maps
- Manifest V3, no remote code, fully bundled

**Supported sites**
Amazon (US & India) · Flipkart · Google Maps

---

## Category

**Productivity**

*(Alternative: "Tools" or "Shopping" — "Productivity" fits best as a research/decision-making aid.)*

---

## Search Keywords

```
fake review detector, review authenticity, review checker, Amazon reviews, Flipkart reviews,
Google Maps reviews, review score, genuine reviews, review trust, review analysis,
review badge, product review, shopping assistant, review quality
```

*(Pick up to 5 in the store form — recommended: "fake review detector", "review authenticity", "review checker", "Amazon reviews", "Google Maps reviews")*

---

## Required Image Assets

| Asset | Size | Source / Notes |
|---|---|---|
| Store icon | 128 × 128 px PNG | `public/icon-128.png` — already present |
| Small promotional tile | 440 × 280 px PNG | `public/promo-440x280.png` — already present |
| Screenshot 1 | 1280 × 800 px (or 640 × 400 px) | **Must be captured from the running extension.** Suggested: Amazon product page with badges visible on several reviews. |
| Screenshot 2 | 1280 × 800 px (or 640 × 400 px) | Suggested: Badge detail card open showing signal breakdown. |
| Screenshot 3 | 1280 × 800 px (or 640 × 400 px) | Suggested: Toolbar popup showing trust gauge and verdict. |
| Screenshot 4 (optional) | 1280 × 800 px (or 640 × 400 px) | Suggested: Google Maps or Flipkart page showing badges. |
| Large promotional tile (optional) | 920 × 680 px PNG | Not required but improves store visibility. |
| Marquee promo tile (optional) | 1400 × 560 px PNG | Required only if featured. |

> Screenshots must be taken from the actual running extension on a real product page — the store does not accept mock-ups that don't reflect real behaviour.

---

## Single-Purpose Statement

> TruLens scores how genuine product and place reviews are on Amazon, Flipkart, and Google Maps, by running on-device heuristic analysis and optional user-initiated AI deep analysis using the user's own API key.

---

## Permission Justifications

Paste each line into the corresponding "Permission justification" field when prompted during item creation.

| Permission | Justification |
|---|---|
| `storage` | Used to save the user's settings (provider choice, AI on/off toggle, UI preferences) and to cache LLM verdicts locally so the same review is not sent to the AI provider more than once. No data is sent to any server. |
| Host: `*.amazon.com`, `*.amazon.in` | The extension's content script must read review text and metadata from Amazon product pages in order to compute genuineness scores and inject shield badges beside each review. |
| Host: `*.flipkart.com` | The extension's content script must read review text and metadata from Flipkart product pages in order to compute genuineness scores and inject shield badges beside each review. |
| Host: `www.google.com/maps` | The extension's content script must read review text and metadata from Google Maps place pages in order to compute genuineness scores and inject shield badges beside each review. |
| Host: `api.minimax.io`, `api.minimaxi.com` | The extension's service worker calls the MiniMax API directly when the user has opted into AI deep analysis and supplied a MiniMax API key. No calls are made without the key and without the user's explicit action. |
| Host: `api.anthropic.com` | The extension's service worker calls the Anthropic API directly when the user has opted into AI deep analysis and supplied an Anthropic API key. No calls are made without the key and without the user's explicit action. |
| Host: `api.openai.com` | The extension's service worker calls the OpenAI API directly when the user has opted into AI deep analysis and supplied an OpenAI API key. No calls are made without the key and without the user's explicit action. |
| Host: `openrouter.ai` | The extension's service worker calls OpenRouter directly when the user has opted into AI deep analysis and supplied an OpenRouter API key. No calls are made without the key and without the user's explicit action. |

---

## Data Use Disclosures (store form checkboxes / declarations)

- **Single purpose:** Yes — the extension's single purpose is scoring the genuineness of reviews on the supported sites.
- **Handles user data:** The extension handles user-supplied API keys (stored locally, never transmitted to TruLens). When AI analysis is enabled by the user, review text is sent to the user's chosen third-party provider.
- **Sells user data:** No.
- **Uses data for purposes other than the extension's core function:** No.
- **Transmits personal data to a server:** No (the user's API key goes to the third-party provider they chose; nothing goes to TruLens).
- **Uses remote code:** No. All logic is bundled in the extension package (Manifest V3).
