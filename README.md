# AH.nl sorteren op eenheid

Chrome/Chromium content-script extension that enhances product/search pages on [ah.nl](https://www.ah.nl/) and [ah.be](https://www.ah.be/) by:

- showing unit prices (€/kg, €/L, €/stuk, €/meter, €/wasbeurt) directly inside every product tile, including multi‑buy promotions such as `3 VOOR 14.99` or `1+1 GRATIS`;
- injecting sorting options (laag‑hoog / hoog‑laag) for every relevant unit inside the native “Sorteer op” dropdown;
- falling back to the old floating “Sort by €/kg” button only when the native dropdown is not available.

The logic lives in a single content script (`content.js`) and is documented further in `ah-site-notes.md`.

## Load the extension during development

1. Open `chrome://extensions/`.
2. Enable **Developer mode** (top-right).
3. Click **Load unpacked**.
4. Select this folder (`ah-sorteren-op-eenheid`).
5. Browse to any `ah.nl` or `ah.be` category/search page and use the “Sorteer op” menu to sort by the desired unit price.

## Preparing a release build

1. Update `manifest.json`:
   - increase the `version`;
   - adjust `description` if feature set changed.
2. Verify that the extension loads cleanly (no console errors on `ah.nl`) and that unit-price labels render only once per product.
3. From the project root, create the upload archive (Chrome Web Store requires a flat `.zip`):

   ```bash
   zip -r ah-sorteren-op-eenheid.zip . -x '*.DS_Store'
   ```

4. Upload the generated `.zip` via the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole/), fill in the listing details (screenshots, description, privacy statement), and submit for review.

## Folder structure

```
ah-sorteren-op-eenheid/
├── content.js          # content script with parsing, labeling, sorting logic
├── manifest.json       # Manifest V3 definition (matches https://www.ah.nl/*)
├── icons/              # simple blue PNG icons referenced by the manifest
├── ah-site-notes.md    # reverse-engineering notes on AH.nl markup
└── README.md
```

Feel free to expand the notes file whenever AH.nl updates their markup; it keeps future maintenance straightforward.
