# TruLens — Quick Start Guide

Get up and running in about two minutes. No account needed, no sign-up, and the core features are completely free.

---

## What TruLens Does

TruLens reads the reviews on a Google Maps place and tells you, instantly, how genuine they look. Every review gets a color-coded badge:

- **Green — Likely genuine** (score 70–100)
- **Amber — Mixed signals** (score 40–69)
- **Red — Likely fake** (score 0–39)

Each badge also shows a 0–100 score and a 5-star equivalent. An on-page panel and the toolbar icon both show an overall trust summary for the place — a trust gauge, a plain-language verdict, and a count of genuine / mixed / fake reviews.

---

## Step 1 — Install TruLens

### Option A: Load from your computer (available now)

1. Download or build the extension so you have a `dist/` folder on your computer.
2. Open Chrome and go to `chrome://extensions`.
3. Turn on **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked** and select the `dist/` folder.
5. TruLens is now installed. You should see its icon in the Chrome toolbar.

> If you don't see the icon, click the puzzle-piece icon in the Chrome toolbar and pin TruLens.

### Option B: Install from the Chrome Web Store (coming soon)

Once TruLens is published, you'll be able to install it with one click — no developer mode needed.

![Install TruLens from the Chrome Web Store](screenshots/install-webstore.png)

---

## Step 2 — Go to Google Maps

Open [https://maps.google.com](https://maps.google.com) in Chrome.

---

## Step 3 — Search for a Place

Search for any restaurant, hotel, shop, or attraction. Click on its name to open the place detail panel.

![Search for a place on Google Maps](screenshots/maps-search.png)

---

## Step 4 — Open the Reviews Tab

Click the **Reviews** tab in the place panel. TruLens will automatically scroll through and load all the reviews for you — you don't have to do anything.

![Click the Reviews tab](screenshots/maps-reviews-tab.png)

---

## Step 5 — Watch the Badges Appear

Within a few seconds, every review gets a colored badge. Click any badge to see the signals behind the score.

The **on-page panel** (bottom of the screen) shows the overall trust summary for the place. To close it, click the **×** button on the panel. To reopen it, click the **TruLens icon** in the Chrome toolbar.

![Review badges and trust panel](screenshots/badges-and-panel.png)

---

## Optional: Turn On AI Deep Analysis

Local scoring is instant and free — it runs entirely on your device with no API key needed. If you want a sharper, more detailed verdict for individual reviews, you can enable the optional AI deep analysis.

The easiest way to get started is with **MiniMax**, which offers a generous free tier.

### Get a Free MiniMax API Key

1. Go to [https://platform.minimax.io/](https://platform.minimax.io/) and create a free account.
2. In the MiniMax dashboard, navigate to **API Keys** and create a new key.
3. Copy the key (it starts with something like `eyJ...`).

### Paste the Key into TruLens

1. Click the **TruLens icon** in the Chrome toolbar to open the popup.
2. Click **Settings**.
3. Under **AI Provider**, make sure **MiniMax** is selected.
4. Paste your API key into the **API Key** field.
5. Click **Test connection** — you should see a green confirmation message.
6. Toggle **AI Analysis** on.

![TruLens Settings with API key](screenshots/settings-ai-key.png)

### Run Deep Analysis on a Review

With AI enabled, open a place's Reviews tab and click any badge. In the detail card, click **Deep analysis**. MiniMax will take a few seconds to respond (it's a reasoning model), then you'll see a more detailed verdict.

> **Note:** MiniMax is free to try. If you switch to OpenAI or Anthropic, you'll use credits from your own account with those providers.

---

## Frequently Asked Questions

**Is TruLens free?**
Yes. Local heuristic scoring — the badges, scores, and trust panel — is completely free and requires no API key. The optional AI deep analysis uses your own provider's API, so any costs depend on your chosen provider (MiniMax has a free tier).

**Does TruLens send my data anywhere?**
Local scoring runs entirely on your device — nothing is sent anywhere. When AI analysis is enabled, the text of the review you're analyzing is sent directly from your browser to the AI provider you chose (e.g., MiniMax). TruLens itself has no server and never receives your data. See [PRIVACY.md](../PRIVACY.md) for the full policy.

**Why does TruLens only work on Google Maps?**
TruLens v1 is focused on Google Maps. Support for Amazon and Flipkart is planned and coming in a future update.

**How do I turn AI analysis off?**
Open the TruLens popup → **Settings** → toggle **AI Analysis** off. To clear your API key and reset everything, click **Reset to defaults**.

**I closed the on-page panel. How do I get it back?**
Click the **TruLens icon** in the Chrome toolbar. This reopens the panel and also shows the popup summary.
