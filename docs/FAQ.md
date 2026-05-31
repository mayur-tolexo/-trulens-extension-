# TruLens — FAQ & Troubleshooting

---

## General

### What does TruLens actually do?

TruLens reads the reviews on a Google Maps place and scores each one for genuineness using on-device heuristics. Every review gets a colored badge (green / amber / red), a 0–100 score, and a 5-star equivalent. An on-page panel and the toolbar popup both show an overall trust summary — a gauge, a plain-language verdict, and counts of genuine / mixed / fake reviews.

### Which sites does TruLens support?

**v1 supports Google Maps only.** Support for Amazon and Flipkart is planned and will be added in a future release.

### Is TruLens free?

Yes. The core local scoring — badges, scores, and trust panel — is completely free and requires no account or API key.

The optional AI deep analysis uses your own API key from a third-party provider. MiniMax offers a generous free tier at [https://platform.minimax.io/](https://platform.minimax.io/). OpenAI and Anthropic charge based on your usage with them.

---

## Badges and Scoring

### How does TruLens score reviews?

Scoring works in two stages:

**1. Instant local heuristics (always on, no key needed)**
TruLens analyzes each review entirely on your device using built-in signal detection. Signals include things like review length and writing style, the reviewer's profile characteristics, rating patterns, language patterns associated with incentivized or template-style writing, and more. The result is a 0–100 score and one of three verdicts: Likely genuine (70–100), Mixed signals (40–69), or Likely fake (0–39).

**2. Optional AI deep analysis (opt-in, bring-your-own-key)**
When you enable AI and click "Deep analysis" on a review, TruLens sends that review's text to your chosen AI provider (MiniMax, OpenAI, or Anthropic). The model reasons about the review in more depth and returns a sharper verdict with an explanation. AI results are cached locally so the same review is never sent twice.

### What do the badge colors mean?

| Badge | Score range | Meaning |
|---|---|---|
| Green — Likely genuine | 70–100 | Signals suggest the review is authentic |
| Amber — Mixed signals | 40–69 | Some red flags present; read with context |
| Red — Likely fake | 0–39 | Multiple signals suggest the review is not genuine |

### The badges haven't appeared. What should I do?

1. Make sure you are on a Google Maps place page and have clicked the **Reviews** tab.
2. Wait a few seconds — TruLens auto-scrolls to load all reviews, which can take a moment.
3. If badges still don't appear, try reloading the tab (Cmd/Ctrl + Shift + R for a hard refresh) and then clicking the Reviews tab again.
4. If the problem persists, go to `chrome://extensions`, find TruLens, click the reload icon (↺), and then hard-refresh the page.

---

## AI Deep Analysis

### How do I enable AI deep analysis?

1. Click the TruLens icon in your toolbar → **Settings**.
2. Choose an AI provider (MiniMax is the default and has a free tier).
3. Paste your API key into the **API Key** field.
4. Click **Test connection** to confirm it works.
5. Toggle **AI Analysis** on.

For a step-by-step guide including how to get a free MiniMax key, see [QUICKSTART.md](QUICKSTART.md).

### AI says "unavailable" or the connection test fails. What should I check?

- Open TruLens → **Settings** and confirm your API key is entered correctly (no extra spaces).
- Click **Test connection** — it should return a green success message.
- Check that the correct provider is selected. A key for MiniMax won't work if OpenAI or Anthropic is selected.
- If you're using MiniMax, note that it is a reasoning model and may take several seconds to respond — this is expected behavior, not a timeout.
- If you recently regenerated your key on the provider's website, paste the new one and try again.

### Why does AI analysis take a few seconds?

MiniMax (the default provider) is a reasoning model — it "thinks through" the review before responding. This is what makes the verdict sharper, but it does mean it takes a few seconds. OpenAI and Anthropic are typically faster.

### Which AI providers are supported?

- **MiniMax** — default, free tier available. Uses model `MiniMax-M2` at `https://api.minimax.io/v1`.
- **OpenAI** — uses your OpenAI account credits.
- **Anthropic** — uses your Anthropic account credits.

---

## Privacy and Data

### Does TruLens send my browsing data anywhere?

No. Local heuristic scoring runs entirely on your device. TruLens has no server and no analytics. Your browsing history, page URLs, and personal information are never collected or transmitted.

### What happens when AI analysis is enabled?

When you click "Deep analysis" on a review, the text of that review is sent directly from your browser to the AI provider you configured (e.g., MiniMax). The request uses your own API key. TruLens is not in the middle — the data goes from your browser to the provider, not through any TruLens server.

AI analysis is disabled by default. No data is sent unless you have entered an API key and enabled the toggle.

### Where is my API key stored?

Your API key is stored only in your browser's local extension storage (on your own device). It is never sent to TruLens or anyone else — it only goes to the AI provider you selected, and only when a deep analysis request is made.

### For the full privacy policy

See [PRIVACY.md](../PRIVACY.md).

---

## Settings and Reset

### How do I turn AI analysis off?

Open the TruLens popup → **Settings** → toggle **AI Analysis** off. No review text will be sent to any provider after that.

### How do I reset TruLens to its defaults?

Open the TruLens popup → **Settings** → click **Reset to defaults**. This clears your API key, turns AI analysis off, and resets all preferences and cached AI results. Your locally scored badges are unaffected — they are computed fresh each time the page loads.

### How do I uninstall TruLens?

Go to `chrome://extensions`, find TruLens, and click **Remove**. Chrome will delete all associated data (settings, API key, cache) automatically.

---

## The On-Page Panel

### I accidentally closed the panel. How do I get it back?

Click the **TruLens icon** in the Chrome toolbar. This reopens the on-page panel and shows the popup trust summary.

### The panel shows no data or is loading forever.

Make sure you are on the **Reviews tab** of a Google Maps place. The panel only populates once TruLens has loaded and scored the reviews. If the Reviews tab is not open, the panel will appear empty.
