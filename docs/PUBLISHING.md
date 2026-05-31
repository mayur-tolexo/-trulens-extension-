# Chrome Web Store — Publishing Checklist

This document is a step-by-step guide for submitting TruLens to the Chrome Web Store. Complete every step in order; do not skip the pre-submit checklist at the end.

---

## 1. Register a Chrome Web Store Developer Account

1. Go to [https://chrome.google.com/webstore/devconsole](https://chrome.google.com/webstore/devconsole).
2. Sign in with the Google account that will own the listing (use a permanent account — it cannot be transferred easily later).
3. Pay the one-time **$5 USD** developer registration fee.
4. Accept the Developer Program Policies.

---

## 2. Build the Extension Package

Run the following commands from the repository root:

```sh
npm install          # install dependencies (if not already done)
npm run build        # produces the dist/ directory
npm run package      # zips dist/ into trulens-v<version>.zip (see scripts/package.mjs)
```

The resulting zip file (e.g. `trulens-v1.0.0.zip`) is what you upload to the store. Verify it contains:
- `manifest.json` at the root of the zip
- All bundled JS/CSS/HTML assets
- Icon files (`icon-16.png`, `icon-32.png`, `icon-48.png`, `icon-128.png`)
- No source maps or developer-only files in production (check `vite.config.ts` if unsure)

---

## 3. Host the Privacy Policy

The store requires a publicly accessible privacy policy URL before you can submit.

1. Push the repository to GitHub (if not already done).
2. Enable GitHub Pages for the repo: **Settings → Pages → Source: Deploy from branch → `main` → `/docs`** (or `/` root).
3. Wait for GitHub Pages to publish (usually under 1 minute).
4. The privacy policy will be accessible at:
   ```
   https://<your-github-username>.github.io/<repo-name>/privacy.html
   ```
5. Open that URL in a browser and confirm the page renders correctly.
6. Update the `<!-- Hosted at -->` notice at the top of `docs/privacy.html` with the actual URL.

---

## 4. Create the Store Item

1. In the Developer Dashboard, click **"New item"**.
2. Upload the zip produced in Step 2.
3. The store will parse `manifest.json` and pre-fill the name and version.

---

## 5. Fill in the Store Listing

Open `docs/STORE_LISTING.md` and paste the relevant sections into the dashboard fields:

| Dashboard field | Source |
|---|---|
| Short description (≤ 132 chars) | "Short Summary" section |
| Detailed description | "Detailed Description" block |
| Category | Productivity |
| Language | English |
| Store icon (128 × 128) | Upload `public/icon-128.png` |
| Small promo tile (440 × 280) | Upload `public/promo-440x280.png` |
| Screenshots (≥ 1 required) | Capture from running extension (see STORE_LISTING.md for guidance) |

---

## 6. Set the Privacy Policy URL

In the **"Privacy practices"** section of the listing:

- **Privacy policy URL:** enter the GitHub Pages URL from Step 3, e.g.
  `https://<your-github-username>.github.io/<repo-name>/privacy.html`

This field is mandatory. Submission will be blocked without it.

---

## 7. Complete Data-Use and Permissions Disclosures

In the **"Privacy practices"** tab, answer the data-use questions:

- **Single-purpose statement:** paste from `docs/STORE_LISTING.md` → "Single-Purpose Statement".
- **Does it handle user data?** Yes — API key (stored locally), and review text when AI is opt-in enabled.
- **Does it sell user data?** No.
- **Does it use data for purposes unrelated to the core function?** No.
- **Is user data transmitted to a server run by the developer?** No.
- **Does it use remote code execution?** No.

In the **"Permissions"** section, for each host permission that triggers a justification prompt, paste the relevant row from `docs/STORE_LISTING.md` → "Permission Justifications".

---

## 8. Choose Visibility

- **Public** — listed in search results and the store directory.
- **Unlisted** — accessible only via direct link (useful for beta testing before going public).
- **Private** — restricted to specific users/domains (for internal tools only).

For a public release: select **Public**.

---

## 9. Submit for Review

Click **"Submit for review"**. The extension will enter the review queue.

**Typical review time:** 1–3 business days for new items. Items with broad host permissions (as this one has) may take longer or require additional scrutiny.

---

## 10. After Submission

- Monitor the Developer Dashboard for a status update (Pending → Approved / Rejected).
- If rejected, the dashboard will show specific reasons. Common rejection reasons are covered in the section below.
- Once approved, the listing goes live. Future updates follow the same build → zip → upload → submit cycle; version numbers must be incremented in `manifest.json`.

---

## Common Rejection Reasons and How to Address Them

### Broad host permissions not sufficiently justified
TruLens requests host permissions for retail and mapping sites (to inject badges) and for AI provider APIs (to make direct calls from the service worker). Each permission has a one-line justification in `docs/STORE_LISTING.md`. If the reviewer requests more detail, emphasize:
- The review-site permissions are the extension's core function — it cannot read or badge reviews without access to those pages.
- The AI API permissions are only ever used when the user has explicitly opted in and supplied their own API key; no calls are made otherwise.

### Remote code execution
TruLens uses none. All logic is bundled at build time (Manifest V3, no `eval`, no `Function()` from strings, no dynamically loaded scripts). State this clearly if questioned.

### Missing or inaccessible privacy policy
Ensure the GitHub Pages URL resolves before submitting (Step 3). The reviewer will visit it.

### Description doesn't match functionality
Keep the store description and the actual UI in sync. If you add or remove features before submission, update `docs/STORE_LISTING.md` accordingly.

### Misleading screenshots
Screenshots must show the actual running extension on real pages, not mock-ups. Use a real Amazon, Flipkart, or Google Maps page with actual reviews.

---

## Pre-Submit Checklist

Go through every item before clicking "Submit for review":

- [ ] `npm run build` completes without errors
- [ ] `npm run package` produces a valid zip with `manifest.json` at its root
- [ ] Zip has been loaded locally via `chrome://extensions → Load unpacked` on the **zip** (unpack first) and all features work
- [ ] `manifest.json` version is `1.0.0` (or incremented correctly for updates)
- [ ] All four icon sizes are present: `icon-16.png`, `icon-32.png`, `icon-48.png`, `icon-128.png`
- [ ] Small promo tile `promo-440x280.png` (440 × 280 px) is uploaded
- [ ] At least one screenshot (1280 × 800 or 640 × 400 px) showing badges on a real product page is uploaded
- [ ] Privacy policy page is live at the chosen URL and loads without errors
- [ ] The URL notice in `docs/privacy.html` has been replaced with the actual URL
- [ ] Privacy policy URL is entered in the store listing
- [ ] Single-purpose statement is filled in
- [ ] All permission justifications are filled in
- [ ] No `console.error` or unhandled promise rejections appear in the browser console on a normal page load
- [ ] AI analysis is disabled by default (verified on a fresh extension install)
- [ ] Contact email in `PRIVACY.md` and `docs/privacy.html` has been updated to the real address
- [ ] Data-use disclosure checkboxes match the actual behaviour described above

---

## Useful Links

- Chrome Web Store Developer Dashboard: https://chrome.google.com/webstore/devconsole
- Chrome Web Store Developer Program Policies: https://developer.chrome.com/docs/webstore/program-policies/
- Manifest V3 overview: https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3
- GitHub Pages setup: https://docs.github.com/en/pages/getting-started-with-github-pages
