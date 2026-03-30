(() => {
  "use strict";

  const DROPDOWN_OPTION_ATTR = "data-ah-ext-unit-price-option";
  const UNIT_ORDER = ["kg", "l", "wash", "piece", "m"];
  const UNIT_NAMES = {
    kg: "Prijs per kg",
    l: "Prijs per liter",
    wash: "Prijs per wasbeurt",
    piece: "Prijs per stuk",
    m: "Prijs per meter"
  };
  const UNIT_DETECTION_LIMIT = 80;
  const LOG_PREFIX = "[ah-unit-sorter]";

  // AH uses different DOM structures on category pages vs search pages.
  // Support both old and new data-testid variants.
  const SEL_CARD = "[data-testid='product-card-vertical-container'], [data-testid='product-card']";
  const SEL_PRICE = "[data-testid='product-card-current-price'], [data-testid='price-amount']";
  const SEL_UNIT_SIZE = "[data-testid='product-card-price-description'], [data-testid='product-unit-size']";
  const SEL_PROMO = "[data-testid='product-card-promotion-label'], [data-testid='product-shield']";

  function parseLocaleNumber(raw) {
    if (typeof raw !== "string") return null;
    let num = raw.trim();
    if (!num) return null;
    const hasComma = num.includes(",");
    const hasDot = num.includes(".");
    if (hasComma && hasDot) {
      num = num.replace(/\./g, "").replace(",", ".");
    } else if (hasComma) {
      num = num.replace(",", ".");
    }
    const value = Number(num);
    return Number.isFinite(value) ? value : null;
  }

  function attachSortDropdownOptions(unitsForPage) {
    if (document.querySelector("[" + DROPDOWN_OPTION_ATTR + "]")) {
      return;
    }

    const allOptions = document.querySelectorAll("[role='option']");
    let baseOption = null;
    let baseOptionWrapper = null;
    let selectedClass = null;
    for (const opt of allOptions) {
      if (opt.getAttribute("aria-selected") === "true" && opt.classList) {
        for (const cls of opt.classList) {
          if (/selected/i.test(cls)) {
            selectedClass = cls;
            break;
          }
        }
      }
      if (!(opt instanceof HTMLElement)) continue;
      const text = (opt.textContent || "").trim();
      if (/^Relevantie$/i.test(text) || /^Prijs laag\s*-\s*hoog$/i.test(text)) {
        baseOption = opt;
        baseOptionWrapper = opt.closest("li") || opt;
        break;
      }
    }
    if (!baseOption || !baseOptionWrapper) return;

    const listbox =
      baseOptionWrapper.closest("[role='listbox']") ||
      baseOptionWrapper.parentElement;
    if (!listbox || !(listbox instanceof HTMLElement)) return;

    const pageUnits =
      Array.isArray(unitsForPage) && unitsForPage.length
        ? unitsForPage
        : detectUnitsOnPage();
    if (!pageUnits.length) return;

    function getSortLabel(unit, direction) {
      const base = UNIT_NAMES[unit] || "Prijs";
      const suffix = direction === "asc" ? " (laag-hoog)" : " (hoog-laag)";
      return base + suffix;
    }

    function createOption(unit, direction) {
      const label = getSortLabel(unit, direction);
      
      const wrapperOption = baseOptionWrapper.cloneNode(true);
      let optionNode = wrapperOption;
      if (wrapperOption !== baseOption) {
        optionNode = wrapperOption.querySelector("[role='option']");
      }
      if (!optionNode) return null;

      optionNode.id = "ah-ext-option-sorting-unit-price-" + unit + "-" + direction;
      optionNode.setAttribute(DROPDOWN_OPTION_ATTR, "true");
      optionNode.setAttribute("aria-selected", "false");

      if (selectedClass) {
        optionNode.classList.remove(selectedClass);
      }

      const textEl = optionNode.querySelector("p, span");
      if (textEl) {
        textEl.textContent = label;
      } else {
        // Fallback: If no known text container is found, try to only replace text nodes to avoid destroying SVGs
        let foundTextNode = false;
        for (const child of optionNode.childNodes) {
          if (child.nodeType === Node.TEXT_NODE && child.textContent.trim().length > 0) {
            child.textContent = label;
            foundTextNode = true;
            break;
          }
        }
        if (!foundTextNode) {
          // Absolute fallback, might destroy SVGs if they exist
          optionNode.textContent = label;
        }
      }

      const checkmark = optionNode.querySelector("[data-checkmark]");
      if (checkmark && checkmark instanceof HTMLElement) {
        checkmark.style.visibility = "hidden";
      }

      optionNode.addEventListener(
        "click",
        (ev) => {
          ev.preventDefault();
          ev.stopPropagation();

          const ascending = direction === "asc";
          sortProductsByUnit(unit, ascending);

          const buttons = listbox.querySelectorAll("[role='option']");
          buttons.forEach((btn) => {
            const isSelected = btn === optionNode;
            btn.setAttribute("aria-selected", isSelected ? "true" : "false");
            
            if (isSelected) {
              if (selectedClass) btn.classList.add(selectedClass);
            } else {
              if (selectedClass) btn.classList.remove(selectedClass);
            }
            
            const mark = btn.querySelector("[data-checkmark]");
            if (mark && mark instanceof HTMLElement) {
              mark.style.visibility = isSelected ? "visible" : "hidden";
            }
          });

          let trigger = null;
          if (listbox.id) {
            trigger = document.querySelector(`button[aria-controls='${listbox.id}']`);
          }
          if (!trigger) {
            const root =
              baseOptionWrapper.closest("[class*='popover_root']") ||
              baseOptionWrapper.closest("[data-testhook*='sorting']") ||
              baseOptionWrapper.closest("[data-testid*='sorting']") ||
              baseOptionWrapper.closest("[class*='select-input_root']") ||
              listbox.closest("[class*='select-input_root']");

            if (root && root instanceof HTMLElement) {
              trigger =
                root.querySelector("button[aria-haspopup='listbox']") ||
                root.querySelector("button");
            }
          }

          if (trigger) {
            trigger.click();

            const valueSpan = 
              trigger.querySelector("[class*='select-input-button_value']") || 
              trigger.querySelector("[class*='placeholder']");
              
            if (valueSpan) {
              valueSpan.textContent = label;
            } else {
              const span = trigger.querySelector("span");
              if (span) {
                span.textContent = label;
              } else {
                trigger.textContent = label;
              }
            }
          }

          const escEvent = new KeyboardEvent("keydown", {
            key: "Escape",
            code: "Escape",
            keyCode: 27,
            which: 27,
            bubbles: true
          });
          document.dispatchEvent(escEvent);
          window.dispatchEvent(escEvent);
        },
        true
      );

      return wrapperOption;
    }

    for (const unit of pageUnits) {
      const ascOption = createOption(unit, "asc");
      const descOption = createOption(unit, "desc");
      if (ascOption) listbox.appendChild(ascOption);
      if (descOption) listbox.appendChild(descOption);
    }
  }

  function parseEuroPerKg(text) {
    if (!text) return null;
    const normalized = text.replace(/\s+/g, " ").trim();
    const match = normalized.match(/([0-9][0-9.,]*)\s*\/\s*kg/i);
    if (!match) return null;
    return parseLocaleNumber(match[1]);
  }

  function parseEuroPrice(text) {
    if (!text) return null;
    const match = text.replace(/\s+/g, " ").match(/€\s*([0-9][0-9.,]*)/);
    if (!match) return null;
    return parseLocaleNumber(match[1]);
  }

  function parsePriceFromPriceAmountElement(el) {
    if (!el) return null;

    const withAriaLabel =
      el.hasAttribute("aria-label") ? el : el.querySelector("[aria-label*='€']") || el.querySelector("[aria-label*='euro']");
    if (withAriaLabel) {
      const label = withAriaLabel.getAttribute("aria-label") || "";
      const fromAria = parseEuroPrice(label);
      if (fromAria != null) return fromAria;
      // Parse "voor X euro en Y cent" or "van X euro en Y cent" format
      const euroCentMatch = label.match(/(\d+)\s*euro\s*en\s*(\d+)\s*cent/);
      if (euroCentMatch) {
        return parseInt(euroCentMatch[1]) + parseInt(euroCentMatch[2]) / 100;
      }
    }

    const anyAria = el.querySelector("[aria-label]");
    if (anyAria && anyAria !== withAriaLabel) {
      const label = anyAria.getAttribute("aria-label") || "";
      const fromAria = parseEuroPrice(label);
      if (fromAria != null) return fromAria;
      const euroCentMatch = label.match(/(\d+)\s*euro\s*en\s*(\d+)\s*cent/);
      if (euroCentMatch) {
        return parseInt(euroCentMatch[1]) + parseInt(euroCentMatch[2]) / 100;
      }
    }

    const text = (el.textContent || "").replace(/\s+/g, " ").trim();
    if (!text) return null;

    const matches = text.match(/([0-9][0-9.,]*)/g);
    if (!matches) return null;

    let best = null;
    for (const raw of matches) {
      const value = parseLocaleNumber(raw);
      if (!Number.isFinite(value)) continue;
      best = best == null ? value : Math.min(best, value);
    }

    return best;
  }

  function parseWeightToKg(text) {
    if (!text) return null;
    const t = text.replace(/\s+/g, " ").toLowerCase();

    // Pattern like "2 x 250 g" or "2x250g"
    let m = t.match(/(\d+)\s*[x×]\s*(\d+[.,]?\d*)\s*(kg|g)\b/);
    if (m) {
      const count = parseLocaleNumber(m[1]);
      const amount = parseLocaleNumber(m[2]);
      if (!Number.isFinite(count) || !Number.isFinite(amount)) return null;
      const unit = m[3];
      let totalKg = 0;
      if (unit === "g") {
        totalKg = (count * amount) / 1000;
      } else if (unit === "kg") {
        totalKg = count * amount;
      }
      return totalKg > 0 ? totalKg : null;
    }

    // Simple pattern like "500 g" or "0,5 kg"
    m = t.match(/(\d+[.,]?\d*)\s*(kg|g)\b/);
    if (m) {
      const amount = parseLocaleNumber(m[1]);
      if (!Number.isFinite(amount)) return null;
      const unit = m[2];
      if (unit === "g") {
        return amount / 1000;
      }
      if (unit === "kg") {
        return amount;
      }
    }

    return null;
  }

  function parseVolumeToLiters(text) {
    if (!text) return null;
    const t = text.replace(/\s+/g, " ").toLowerCase();

    // Pattern like "6 x 33 cl" or "24 x 0,25 l"
    let m = t.match(/(\d+)\s*[x×]\s*(\d+[.,]?\d*)\s*(ml|dl|cl|l|liter)\b/);
    if (m) {
      const count = parseLocaleNumber(m[1]);
      const amount = parseLocaleNumber(m[2]);
      if (!Number.isFinite(count) || !Number.isFinite(amount)) return null;
      const unit = m[3];
      let totalL = 0;
      if (unit === "ml") {
        totalL = (count * amount) / 1000;
      } else if (unit === "cl") {
        totalL = (count * amount) / 100;
      } else if (unit === "dl") {
        totalL = (count * amount) / 10;
      } else {
        // l or liter
        totalL = count * amount;
      }
      return totalL > 0 ? totalL : null;
    }

    // Simple pattern like "330 ml" or "0,75 l"
    m = t.match(/(\d+[.,]?\d*)\s*(ml|dl|cl|l|liter)\b/);
    if (m) {
      const amount = parseLocaleNumber(m[1]);
      if (!Number.isFinite(amount)) return null;
      const unit = m[2];
      if (unit === "ml") {
        return amount / 1000;
      }
      if (unit === "cl") {
        return amount / 100;
      }
      if (unit === "dl") {
        return amount / 10;
      }
      // l or liter
      if (unit === "l" || unit === "liter") {
        return amount;
      }
    }

    return null;
  }

  function parsePiecesCount(text) {
    if (!text) return null;
    const t = text.replace(/\s+/g, " ").toLowerCase();

    let m = t.match(/(\d+)\s*[x×]\s*(\d+[.,]?\d*)\s*(st|stuk|stuks|st\.)\b/);
    if (m) {
      const count = parseLocaleNumber(m[1]);
      const perPack = parseLocaleNumber(m[2]);
      if (!Number.isFinite(count) || !Number.isFinite(perPack)) return null;
      const total = count * perPack;
      return total > 0 ? total : null;
    }

    m = t.match(/(\d+[.,]?\d*)\s*(st|stuk|stuks|st\.)\b/);
    if (m) {
      const amount = parseLocaleNumber(m[1]);
      if (!Number.isFinite(amount)) return null;
      return amount > 0 ? amount : null;
    }

    return null;
  }

  function parseLengthToMeters(text) {
    if (!text) return null;
    const t = text.replace(/\s+/g, " ").toLowerCase();

    let m = t.match(/(\d+)\s*[x×]\s*(\d+[.,]?\d*)\s*(mm|cm|m|meter|meters)\b/);
    if (m) {
      const count = parseLocaleNumber(m[1]);
      const length = parseLocaleNumber(m[2]);
      if (!Number.isFinite(count) || !Number.isFinite(length)) return null;
      const unit = m[3];
      let totalM = 0;
      if (unit === "mm") {
        totalM = (count * length) / 1000;
      } else if (unit === "cm") {
        totalM = (count * length) / 100;
      } else {
        // m or meter(s)
        totalM = count * length;
      }
      return totalM > 0 ? totalM : null;
    }

    m = t.match(/(\d+[.,]?\d*)\s*(mm|cm|m|meter|meters)\b/);
    if (m) {
      const amount = parseLocaleNumber(m[1]);
      if (!Number.isFinite(amount)) return null;
      const unit = m[2];
      if (unit === "mm") {
        return amount / 1000;
      }
      if (unit === "cm") {
        return amount / 100;
      }
      // m or meter(s)
      return amount;
    }

    return null;
  }

  function parseWashesCount(text) {
    if (!text) return null;
    const t = text.replace(/\s+/g, " ").toLowerCase();

    let m = t.match(/(\d+)\s*[x×]\s*(\d+[.,]?\d*)\s*wasbeurt\w*/);
    if (m) {
      const count = parseLocaleNumber(m[1]);
      const perPack = parseLocaleNumber(m[2]);
      if (!Number.isFinite(count) || !Number.isFinite(perPack)) return null;
      const total = count * perPack;
      return total > 0 ? total : null;
    }

    m = t.match(/(\d+[.,]?\d*)\s*wasbeurt\w*/);
    if (m) {
      const amount = parseLocaleNumber(m[1]);
      if (!Number.isFinite(amount)) return null;
      return amount > 0 ? amount : null;
    }

    return null;
  }

  function applyMultiBuyPromotion(card, basePrice) {
    if (!Number.isFinite(basePrice)) return null;

    const shieldEls = card.querySelectorAll(SEL_PROMO);
    if (!shieldEls.length) return null;

    let best = null;

    for (const el of shieldEls) {
      const raw = (el.getAttribute("aria-label") || el.textContent || "").replace(/\s+/g, " ").trim();
      if (!raw) continue;
      const text = raw.toLowerCase();

      // Pattern like "3 VOOR 14.99"
      let m = text.match(/(\d+)\s*voor\s*([0-9][0-9.,]*)/i);
      if (m) {
        const qty = parseLocaleNumber(m[1]);
        const bundlePrice = parseLocaleNumber(m[2]);
        if (!Number.isFinite(qty) || !Number.isFinite(bundlePrice) || qty <= 0) {
          continue;
        }
        const perItem = bundlePrice / qty;
        if (Number.isFinite(perItem)) {
          best = best == null ? perItem : Math.min(best, perItem);
        }
        continue;
      }

      // Pattern like "1+1 GRATIS", "2 + 1 gratis"
      m = text.match(/(\d+)\s*\+\s*(\d+)\s*gratis/i);
      if (m) {
        const payCount = parseLocaleNumber(m[1]);
        const freeCount = parseLocaleNumber(m[2]);
        if (
          !Number.isFinite(payCount) ||
          !Number.isFinite(freeCount) ||
          payCount <= 0
        ) {
          continue;
        }
        const total = payCount + freeCount;
        const perItem = (basePrice * payCount) / total;
        if (Number.isFinite(perItem)) {
          best = best == null ? perItem : Math.min(best, perItem);
        }
      }

      // Pattern like "2e halve prijs"
      m = text.match(/2e?\s*halve\s*prijs/i);
      if (m) {
        // Buy 2, second at half price -> pay 1.5x for 2 items
        const perItem = (basePrice * 1.5) / 2;
        if (Number.isFinite(perItem)) {
          best = best == null ? perItem : Math.min(best, perItem);
        }
      }
    }

    return best;
  }

  function findBestPriceInCard(card) {
    const currentPriceEl = card.querySelector(SEL_PRICE);
    if (!currentPriceEl) return null;

    const price = parsePriceFromPriceAmountElement(currentPriceEl);
    if (price == null) return null;

    const promoPerItem = applyMultiBuyPromotion(card, price);

    return {
      priceEuro: price,
      promoPriceEuro:
        promoPerItem != null && promoPerItem < price ? promoPerItem : null,
      priceEl: currentPriceEl
    };
  }

  const UNIT_CONFIG = {
    kg:    { parseFn: parseWeightToKg,     fallbackRegex: /kg|g/i,            label: "kg" },
    l:     { parseFn: parseVolumeToLiters,  fallbackRegex: /ml|dl|cl|l|liter/i, label: "L" },
    wash:  { parseFn: parseWashesCount,     fallbackRegex: /wasbeurt/i,        label: "wasbeurt" },
    piece: { parseFn: parsePiecesCount,     fallbackRegex: /st|stuk/i,         label: "st" },
    m:     { parseFn: parseLengthToMeters,  fallbackRegex: /(mm|cm|m|meter)/i, label: "m" }
  };

  function extractPriceAndQuantity(card, parseFn, fallbackRegex) {
    let priceEuro = null;
    let promoPriceEuro = null;
    let priceEl = null;
    let quantity = null;

    const priceInfo = findBestPriceInCard(card);
    if (priceInfo) {
      priceEuro = priceInfo.priceEuro;
      promoPriceEuro = priceInfo.promoPriceEuro || null;
      priceEl = priceInfo.priceEl;
    }

    const ahSizeEl = card.querySelector(SEL_UNIT_SIZE);
    if (ahSizeEl) {
      const q = parseFn(ahSizeEl.textContent || "");
      if (q != null) quantity = q;
    }

    if (priceEuro != null && quantity != null && quantity > 0) {
      return { priceEuro, promoPriceEuro, priceEl, quantity };
    }

    const nodes = card.querySelectorAll("span, div, p");
    for (const el of nodes) {
      const text = el.textContent || "";
      if (priceEuro == null) {
        const p = parseEuroPrice(text);
        if (p != null) {
          priceEuro = p;
          priceEl = el;
        }
      }
      if (!quantity && fallbackRegex.test(text)) {
        const q = parseFn(text);
        if (q != null) quantity = q;
      }
      if (priceEuro != null && quantity != null) break;
    }

    if (priceEuro == null || quantity == null || quantity <= 0) return null;
    return { priceEuro, promoPriceEuro, priceEl, quantity };
  }

  function injectUnitPriceLabel(card, unitPrice, priceEl, unitLabel, promoUnitPrice) {
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) return;
    const labelUnit = unitLabel || "kg";
    const euros = unitPrice.toFixed(2).replace(".", ",");
    const baseText = `€ ${euros} / ${labelUnit}`;

    const parent = (priceEl && priceEl.parentElement) || card;

    let baseLabel = parent.querySelector(".ah-ext-unit-price-base");
    if (!baseLabel) {
      baseLabel = document.createElement("div");
      baseLabel.className = "ah-ext-unit-price ah-ext-unit-price-base";
      Object.assign(baseLabel.style, {
        fontSize: "0.75rem",
        color: "#555",
        marginTop: "2px"
      });
      parent.appendChild(baseLabel);
    }
    if (baseLabel.textContent !== baseText) {
      baseLabel.textContent = baseText;
    }

    let promoLabel = parent.querySelector(".ah-ext-unit-price-promo");
    if (promoUnitPrice != null && Number.isFinite(promoUnitPrice) && promoUnitPrice > 0) {
      const eurosPromo = promoUnitPrice.toFixed(2).replace(".", ",");
      const promoText = `€ ${eurosPromo} / ${labelUnit}`;

      if (!promoLabel) {
        promoLabel = document.createElement("div");
        promoLabel.className = "ah-ext-unit-price ah-ext-unit-price-promo";
        Object.assign(promoLabel.style, {
          fontSize: "0.75rem",
          color: "#f60",
          marginTop: "0",
          fontWeight: "600"
        });
        parent.appendChild(promoLabel);
      }
      if (promoLabel.textContent !== promoText) {
        promoLabel.textContent = promoText;
      }
    } else if (promoLabel && promoLabel.parentElement) {
      promoLabel.parentElement.removeChild(promoLabel);
    }
  }

  function findUnitPriceElement(root) {
    const candidates = root.querySelectorAll("span, div, p");
    for (const el of candidates) {
      const text = el.textContent || "";
      if (text.includes("/kg") && (text.includes("\u20ac") || /[0-9]/.test(text))) {
        const value = parseEuroPerKg(text);
        if (value != null) {
          return { element: el, value };
        }
      }
    }
    return null;
  }

  function getUnitPriceForCard(card, unit) {
    const mode = unit || "kg";

    if (mode === "kg") {
      const direct = findUnitPriceElement(card);
      if (direct && direct.value != null) {
        return direct.value;
      }
    }

    const config = UNIT_CONFIG[mode];
    if (!config) return null;

    const info = extractPriceAndQuantity(card, config.parseFn, config.fallbackRegex);
    if (!info) return null;

    const basePerUnit = info.priceEuro / info.quantity;
    if (!Number.isFinite(basePerUnit) || basePerUnit <= 0) return null;

    let promoPerUnit = null;
    if (info.promoPriceEuro != null && info.promoPriceEuro > 0) {
      promoPerUnit = info.promoPriceEuro / info.quantity;
    }

    const sortPrice =
      promoPerUnit != null && promoPerUnit > 0 && promoPerUnit < basePerUnit
        ? promoPerUnit
        : basePerUnit;

    injectUnitPriceLabel(card, basePerUnit, info.priceEl, config.label, promoPerUnit);
    return sortPrice;
  }

  function detectUnitsOnPage() {
    const found = new Set();
    const sizeEls = document.querySelectorAll(SEL_UNIT_SIZE);

    let checked = 0;
    for (const el of sizeEls) {
      const text = (el.textContent || "").toLowerCase();
      if (/\b(kg|g)\b/.test(text)) {
        found.add("kg");
      }
      if (/\b(ml|dl|cl|l|liter)\b/.test(text)) {
        found.add("l");
      }
      if (/\bwasbeurt/.test(text)) {
        found.add("wash");
      }
      if (/\b(st\.?|stuk|stuks)\b/.test(text)) {
        found.add("piece");
      }
      if (/\d\s*(mm|cm|meter|meters)\b/.test(text) || /\d\s+m\b/.test(text)) {
        found.add("m");
      }

      checked += 1;
      if (checked >= UNIT_DETECTION_LIMIT) break;
    }

    return UNIT_ORDER.filter((u) => found.has(u));
  }

  function ensureUnitPriceLabel(card, unitsForPage) {
    if (!(card instanceof HTMLElement)) return;

    const units =
      Array.isArray(unitsForPage) && unitsForPage.length
        ? unitsForPage
        : UNIT_ORDER;

    for (const unit of units) {
      const price = getUnitPriceForCard(card, unit);
      if (price != null) {
        break;
      }
    }
  }

  function labelUnitPricesForAllCards(unitsForPage) {
    const units =
      Array.isArray(unitsForPage) && unitsForPage.length
        ? unitsForPage
        : detectUnitsOnPage();
    if (!units.length) return;

    const candidates = document.querySelectorAll(SEL_CARD);
    for (const card of candidates) {
      try {
        if (!card.querySelector(SEL_PRICE)) continue;
        ensureUnitPriceLabel(card, units);
      } catch (e) {
        console.warn(LOG_PREFIX, "Error labeling card:", e);
      }
    }
  }

  function findProductCardsForUnit(unit) {
    const cards = new Set();
    const results = [];

    const candidates = document.querySelectorAll(SEL_CARD);

    for (const card of candidates) {
      try {
        if (!(card instanceof HTMLElement)) continue;
        if (!card.querySelector(SEL_PRICE)) continue;
        if (cards.has(card)) continue;

        const pricePerUnit = getUnitPriceForCard(card, unit);
        if (pricePerUnit == null) continue;

        // Walk up from the card to find the product grid container.
        // Prefer a known AH grid testid, otherwise find the highest ancestor
        // with enough children to actually contain multiple products.
        const forbidden = new Set(["HTML", "BODY", "MAIN", "FOOTER", "HEADER"]);
        let container = card.closest("[data-testid='product-results-products']") ||
                        card.closest("[data-testid='search-lane-grid']");
        if (!container) {
          // Fallback: walk up and keep going past small intermediate wrappers
          container = card.parentElement;
          while (container && (container.children.length < 4 || forbidden.has(container.tagName))) {
            container = container.parentElement;
          }
        }
        if (!container) continue;

        // Find the wrapper: the ancestor of card that is a direct child of the grid container
        let wrapper = card;
        while (wrapper && wrapper.parentElement !== container) {
          wrapper = wrapper.parentElement;
        }
        if (!wrapper || wrapper.parentElement !== container) continue;

        cards.add(card);
        results.push({
          card: wrapper,
          container,
          pricePerUnit
        });
      } catch (e) {
        console.warn(LOG_PREFIX, "Error processing card for sorting:", e);
      }
    }

    return results;
  }

  function sortProductsByUnit(unit, ascending = true) {
    const entries = findProductCardsForUnit(unit);
    if (!entries.length) {
      console.info(`${LOG_PREFIX} No products with €/` + unit + ` found on this page.`);
      return false;
    }

    const byContainer = new Map();
    for (const entry of entries) {
      const arr = byContainer.get(entry.container) || [];
      arr.push(entry);
      byContainer.set(entry.container, arr);
    }

    byContainer.forEach((arr, container) => {
      // If container only has a few cards, skip to avoid messing with layout sections
      if (arr.length < 2) return;

      arr.sort((a, b) => {
        if (a.pricePerUnit == null && b.pricePerUnit == null) return 0;
        if (a.pricePerUnit == null) return 1;
        if (b.pricePerUnit == null) return -1;
        return ascending
          ? a.pricePerUnit - b.pricePerUnit
          : b.pricePerUnit - a.pricePerUnit;
      });

      for (const { card } of arr) {
        container.appendChild(card);
      }
    });

    console.info(
      `${LOG_PREFIX} Sorted ${entries.length} products by €/` +
        unit +
        ` (${ascending ? "asc" : "desc"}).`
    );
    return true;
  }

  function init() {
    const units = detectUnitsOnPage();
    attachSortDropdownOptions(units);
    labelUnitPricesForAllCards(units);
  }

  init();

  let mutationScheduled = false;
  const obs = new MutationObserver((mutations) => {
    if (mutationScheduled) return;

    // Skip if every mutation is just our own injected labels
    const isOnlyOurs = mutations.every((mut) => {
      if (mut.type !== "childList") return false;
      for (const node of mut.addedNodes) {
        if (!(node instanceof HTMLElement)) return false;
        if (!node.classList.contains("ah-ext-unit-price")) return false;
      }
      return mut.addedNodes.length > 0;
    });
    if (isOnlyOurs) return;

    mutationScheduled = true;
    setTimeout(() => {
      mutationScheduled = false;
      const units = detectUnitsOnPage();
      attachSortDropdownOptions(units);
      labelUnitPricesForAllCards(units);
    }, 100);
  });
  obs.observe(document.documentElement || document.body, {
    childList: true,
    subtree: true
  });
})();
