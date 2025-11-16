# Notes on AH.nl Frontend Structure (for this extension)

This file captures what we learned about how AH.nl structures its product pages, so future changes to the extension are easier.

## Product cards

- Product tiles are rendered as complex React components, often under:
  - Elements with `data-testhook` containing `"product"` or
  - Elements with `data-testid` containing `"product"`, or
  - `article` / `li` elements in product grids.
- The main helpers in the extension therefore look for:
  - `[data-testhook*="product"]`
  - `[data-testid*="product"]`
  - Fallbacks: `article`, `li`

## Prices

- Prices are represented by `div[data-testid="price-amount"]` elements.
- One card can have multiple price elements:
  - Old price (struck-through / grey):
    - Class names include `price-amount_was__…` and/or `price_was__…`.
    - `aria-label` typically starts with `"Oude prijs: €…"` (in Dutch).
    - These are treated as **priority 2** (lowest priority).
  - Current / bonus price:
    - Class names include `price-amount_highlight__…`, `price-amount_bonus__…`, `price_highlight__…`.
    - `aria-label` often starts with `"Prijs: €…"` (in Dutch).
    - Treated as **priority 0** (highest priority).
  - Plain prices:
    - Same `data-testid="price-amount"` but without `_was` / `_bonus` modifiers.
    - Treated as **priority 1**.
- The extension:
  - Inspects **all** `data-testid="price-amount"` elements in a card.
  - Parses price from `aria-label` when present (`"Prijs: €…"` / `"Oude prijs: €…"`) via `parseEuroPrice`.
  - Falls back to the visible text if `aria-label` is missing; when multiple numeric fragments appear, it picks the lowest numeric value.
  - Chooses the element with lowest priority (0 < 1 < 2); ties broken by lower numeric price.
  - Exposes:
    - `priceEuro`: the “normal” single-item price from the chosen element.
    - `promoPriceEuro`: optional effective price when multi-buy promotions apply (see below).

## Unit size and quantities

- Unit size is exposed as `*[data-testid="product-unit-size"]`, with human-readable text, for example:
  - `"ca. 1006 g"`
  - `"24 x 0,33 l"`
  - `"330 ml"`
  - `"6 x 33 cl"`
  - `"30 wasbeurten"`
  - `"24 x 33 wasbeurten"`
  - `"6 x 2 stuks"` (pieces)
  - `"20 m"` or `"2 x 10 m"` (lengths)
- The extension parses these into normalized quantities:
  - **Weight → kg** (`parseWeightToKg`):
    - Multi-pack: `(\d+)\s*[x×]\s*(\d+[.,]?\d*)\s*(kg|g)`.
    - Single: `(\d+[.,]?\d*)\s*(kg|g)`.
  - **Volume → liters** (`parseVolumeToLiters`):
    - Multi-pack: `(\d+)\s*[x×]\s*(\d+[.,]?\d*)\s*(ml|cl|l|liter)`.
    - Single: `(\d+[.,]?\d*)\s*(ml|cl|l|liter)`.
  - **Pieces** (`parsePiecesCount`):
    - Multi-pack: `(\d+)\s*[x×]\s*(\d+[.,]?\d*)\s*(st|stuk|stuks|st\.)`.
    - Single: `(\d+[.,]?\d*)\s*(st|stuk|stuks|st\.)`.
  - **Length → meters** (`parseLengthToMeters`):
    - Multi-pack: `(\d+)\s*[x×]\s*(\d+[.,]?\d*)\s*(mm|cm|m|meter|meters)`.
    - Single: `(\d+[.,]?\d*)\s*(mm|cm|m|meter|meters)`.
  - **Washes** (`parseWashesCount`):
    - Multi-pack: `(\d+)\s*[x×]\s*(\d+[.,]?\d*)\s*wasbeurt\w*`.
    - Single: `(\d+[.,]?\d*)\s*wasbeurt\w*`.

These are then used to compute:

- `€/kg`
- `€/L`
- `€/stuk` (per piece)
- `€/m` (per meter)
- `€/wasbeurt` (per wash)

## Promotions and effective price per item

Some promotions affect the true cost per unit but are not reflected directly in the base price; instead AH shows a shield-like label:

- Markup example:
  - `<span class="shield_text__…">3 VOOR 14.99</span>`
  - `<span class="shield_text__…">1+1 GRATIS</span>`
  - `<span class="shield_text__…">2 + 1 GRATIS</span>`
- The extension looks for any element whose class name includes `shield_text` inside the product card.

Two promo styles are supported:

1. **N VOOR X**:
   - Regex: `(\d+)\s*voor\s*([0-9][0-9.,]*)` (case-insensitive).
   - Effective per-item price = `bundlePrice / qty`.
2. **A+B GRATIS**:
   - Regex: `(\d+)\s*\+\s*(\d+)\s*gratis`.
   - Assume “pay for A, get B free”:
     - Effective per-item price = `(basePrice * A) / (A + B)`.

The lowest valid effective per-item price from those shields is stored as `promoPriceEuro`. If present and lower than `priceEuro`, the extension:

- Uses **promo price per unit** as the value for sorting.
- Shows **two** unit-price labels on the card:
  - Grey: unit price from `priceEuro` (single purchase).
  - Orange: unit price from `promoPriceEuro` (multi-buy deal).

## Unit price labels

- Unit-price labels are injected as additional `div`s next to the existing price container.
- Class names:
  - Base unit price: `.ah-ext-unit-price.ah-ext-unit-price-base`
  - Promo unit price: `.ah-ext-unit-price.ah-ext-unit-price-promo`
- Styling (inline, kept minimal):
  - Base:
    - `font-size: 0.75rem`
    - `color: #555`
    - `margin-top: 2px`
  - Promo:
    - `font-size: 0.75rem`
    - `color: #f60` (orange)
    - `font-weight: 600`
    - `margin-top: 0`
- Labels are written in the format:
  - `€ 1,23 / kg`
  - `€ 0,87 / L`
  - `€ 0,20 / stuk`
  - `€ 0,15 / wasbeurt`
  - `€ 0,50 / m`

The code avoids excessive DOM thrashing by:

- Reusing existing labels if the text didn’t change.
- Debouncing reactions to `MutationObserver` events.

## Sorting dropdown (“Sorteer op”)

- The sort control is a custom select built roughly as:
  - A trigger button (with `aria-haspopup="listbox"`) showing current label.
  - A listbox containing `button[role="option"]` elements for:
    - `Relevantie`
    - `Prijs laag - hoog`
    - `Prijs hoog - laag`
    - `Nutri-Score A - E`
- The extension:
  - Finds a base option by matching an existing option whose text is `Relevantie` or `Prijs laag - hoog`.
  - Clones that option to create new ones, with ids like:
    - `ah-ext-option-sorting-unit-price-kg-asc`
    - `ah-ext-option-sorting-unit-price-l-asc`
    - `ah-ext-option-sorting-unit-price-wash-asc`
  - Injects them into the same listbox.
  - Updates `aria-selected` and the checkmark visibility on click.
  - Attempts to close the dropdown by:
    - Clicking the trigger again.
    - Dispatching an `Escape` keydown event.

Labels for extension sort options:

- `Prijs per kg (laag-hoog)` / `(hoog-laag)`
- `Prijs per liter (laag-hoog)` / `(hoog-laag)`
- `Prijs per wasbeurt (laag-hoog)` / `(hoog-laag)`
- `Prijs per stuk (laag-hoog)` / `(hoog-laag)`
- `Prijs per meter (laag-hoog)` / `(hoog-laag)`

Which units appear depends on what is detected on the page (see below).

## Choosing which units apply on a page

To avoid cluttering the dropdown with irrelevant options, the extension:

1. Looks at up to ~80 `data-testid="product-unit-size"` elements on the current page.
2. For each unit-size string, it marks units as “present” if:
   - `kg` or `g` → weight (`kg`).
   - `ml`, `cl`, `l`, `liter` → volume (`l`).
   - `wasbeurt` substring → wash (`wash`).
   - `st`, `stuk`, `stuks`, `st.` → piece (`piece`).
   - `mm`, `cm`, `m`, `meter`, `meters` → length (`m`).
3. Builds a list in the fixed order: `["kg", "l", "wash", "piece", "m"]`, filtered to only units found on the page.
4. Uses that list to:
   - Decide which sort options to add.
   - Decide which units to attempt when generating labels per card (first successful unit for that card “wins”).

Examples:

- Cheese category:
  - Only weight detected → `Prijs per kg` options + `€/kg` labels.
- Beer category:
  - Only volume (and sometimes pieces) detected → `Prijs per liter` (and possibly `Prijs per stuk`) options.
- Wasverzachters:
  - Volume + washes detected → `Prijs per liter` and `Prijs per wasbeurt` options; no `per kg`.

## SPA / dynamic behavior

- AH.nl is a SPA; products can load incrementally as you scroll or filters change.
- The extension uses a `MutationObserver` on `document.documentElement || document.body`:
  - Debounced (100ms) to avoid loops.
  - On each tick:
    - Re-detects units present on the page.
    - Re-attaches missing sort options if not already there.
    - Re-runs labeling on visible product cards.

## Things to watch out for

- AH can rename CSS classes without changing `data-testid` attributes; logic should prefer `data-testid` and `aria-label` over specific class names where possible.
- Some promotions (e.g. “2e halve prijs”) are not yet parsed; they would need additional logic in `applyMultiBuyPromotion`.
- Always avoid tight mutation loops:
  - Do not rewrite label text if it hasn’t changed.
  - Throttle reactions to DOM changes.

