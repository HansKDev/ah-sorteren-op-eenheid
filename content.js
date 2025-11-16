(() => {
  "use strict";

  const BUTTON_ID = "ah-price-per-kg-sort-button";
  const DROPDOWN_OPTION_ATTR = "data-ah-ext-unit-price-option";
  const UNIT_ORDER = ["kg", "l", "wash", "piece", "m"];
  const UNIT_LABELS = {
    kg: "kg",
    l: "L",
    wash: "wasbeurt",
    piece: "st",
    m: "m"
  };
  const UNIT_NAMES = {
    kg: "Prijs per kg",
    l: "Prijs per liter",
    wash: "Prijs per wasbeurt",
    piece: "Prijs per stuk",
    m: "Prijs per meter"
  };
  const UNIT_DETECTION_LIMIT = 80;
  const LOG_PREFIX = "[ah-unit-sorter]";
  let lastSortAscending = true;

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

  function createSortButton() {
    if (document.getElementById(BUTTON_ID)) return;

    const btn = document.createElement("button");
    btn.id = BUTTON_ID;
    btn.textContent = "Sort by \u20ac/kg";
    Object.assign(btn.style, {
      position: "fixed",
      top: "80px",
      right: "20px",
      zIndex: "2147483647",
      padding: "8px 12px",
      background: "#00a0e2",
      color: "#fff",
      border: "none",
      borderRadius: "4px",
      fontSize: "13px",
      fontFamily: "inherit",
      cursor: "pointer",
      boxShadow: "0 2px 4px rgba(0,0,0,0.2)"
    });

    btn.addEventListener("mouseenter", () => {
      btn.style.background = "#0087bf";
    });
    btn.addEventListener("mouseleave", () => {
      btn.style.background = "#00a0e2";
    });

    btn.addEventListener("click", () => {
      const asc = lastSortAscending;
      const changed = sortProductsByPricePerKg(asc);
      if (changed) {
        lastSortAscending = !lastSortAscending;
        btn.textContent = asc ? "Sort by \u20ac/kg (desc)" : "Sort by \u20ac/kg (asc)";
      }
    });

    document.body.appendChild(btn);
  }

  function attachSortDropdownOptions(unitsForPage) {
    if (document.querySelector("[" + DROPDOWN_OPTION_ATTR + "]")) {
      return;
    }

    const allOptions = document.querySelectorAll("button[role='option']");
    let baseOption = null;
    for (const opt of allOptions) {
      if (!(opt instanceof HTMLElement)) continue;
      const text = (opt.textContent || "").trim();
      if (/^Relevantie$/i.test(text) || /^Prijs laag\s*-\s*hoog$/i.test(text)) {
        baseOption = opt;
        break;
      }
    }
    if (!baseOption) return;

    const listbox =
      baseOption.closest("[role='listbox']") ||
      baseOption.parentElement;
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
      const option = baseOption.cloneNode(true);
      option.id = "ah-ext-option-sorting-unit-price-" + unit + "-" + direction;
      option.setAttribute(DROPDOWN_OPTION_ATTR, "true");
      option.setAttribute("aria-selected", "false");

      const textEl = option.querySelector("p");
      if (textEl) {
        textEl.textContent = label;
      } else {
        option.textContent = label;
      }

      const checkmark = option.querySelector("[data-checkmark]");
      if (checkmark && checkmark instanceof HTMLElement) {
        checkmark.style.visibility = "hidden";
      }

      option.addEventListener(
        "click",
        (ev) => {
          ev.preventDefault();
          ev.stopPropagation();

          const ascending = direction === "asc";
          if (unit === "l") {
            sortProductsByPricePerLitre(ascending);
          } else if (unit === "kg") {
            sortProductsByPricePerKg(ascending);
          } else {
            sortProductsByUnit(unit, ascending);
          }

          const buttons = listbox.querySelectorAll("button[role='option']");
          buttons.forEach((btn) => {
            const isSelected = btn === option;
            btn.setAttribute("aria-selected", isSelected ? "true" : "false");
            const mark = btn.querySelector("[data-checkmark]");
            if (mark && mark instanceof HTMLElement) {
              mark.style.visibility = isSelected ? "visible" : "hidden";
            }
          });

          const root =
            baseOption.closest("[data-testhook*='sorting']") ||
            baseOption.closest("[data-testid*='sorting']") ||
            baseOption.closest("[class*='select-input_root']") ||
            listbox.closest("[class*='select-input_root']");

          if (root && root instanceof HTMLElement) {
            const trigger =
              root.querySelector("button[aria-haspopup='listbox']") ||
              root.querySelector("button");
            if (trigger) {
              trigger.click();
            }

            const placeholder = root.querySelector(
              ".select-input-button_placeholder__ba4cT"
            );
            if (placeholder && placeholder instanceof HTMLElement) {
              placeholder.textContent = label;
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

      return option;
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
      el.hasAttribute("aria-label") ? el : el.querySelector("[aria-label*='€']");
    if (withAriaLabel) {
      const label = withAriaLabel.getAttribute("aria-label") || "";
      const fromAria = parseEuroPrice(label);
      if (fromAria != null) return fromAria;
    }

    const anyAria = el.querySelector("[aria-label]");
    if (anyAria && anyAria !== withAriaLabel) {
      const label = anyAria.getAttribute("aria-label") || "";
      const fromAria = parseEuroPrice(label);
      if (fromAria != null) return fromAria;
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
    let m = t.match(/(\d+)\s*[x×]\s*(\d+[.,]?\d*)\s*(ml|cl|l|liter)\b/);
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
      } else {
        // l or liter
        totalL = count * amount;
      }
      return totalL > 0 ? totalL : null;
    }

    // Simple pattern like "330 ml" or "0,75 l"
    m = t.match(/(\d+[.,]?\d*)\s*(ml|cl|l|liter)\b/);
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

    const shieldEls = card.querySelectorAll("[class*='shield_text']");
    if (!shieldEls.length) return null;

    let best = null;

    for (const el of shieldEls) {
      const raw = (el.textContent || "").replace(/\s+/g, " ").trim();
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
    }

    return best;
  }

  function findBestPriceInCard(card) {
    const priceNodes = card.querySelectorAll("[data-testid='price-amount']");
    if (!priceNodes.length) return null;

    let best = null;

    for (const el of priceNodes) {
      if (!(el instanceof HTMLElement)) continue;

      const price = parsePriceFromPriceAmountElement(el);
      if (price == null) continue;

      let priority = 1;
      const className = (el.className || "").toLowerCase();

      const ariaSource = el.hasAttribute("aria-label")
        ? el
        : el.querySelector("[aria-label]");
      const ariaLabel = ariaSource
        ? (ariaSource.getAttribute("aria-label") || "")
        : "";
      const ariaLower = ariaLabel.toLowerCase();

      if (/\bwas\b/.test(className) || /oude prijs/.test(ariaLower)) {
        priority = 2;
      }
      if (/bonus/.test(className) || /highlight/.test(className)) {
        priority = 0;
      }

      if (
        !best ||
        priority < best.priority ||
        (priority === best.priority && price < best.priceEuro)
      ) {
        best = { priceEuro: price, priceEl: el, priority };
      }
    }

    if (!best) return null;

    const promoPerItem = applyMultiBuyPromotion(card, best.priceEuro);

    return {
      priceEuro: best.priceEuro,
      promoPriceEuro:
        promoPerItem != null && promoPerItem < best.priceEuro ? promoPerItem : null,
      priceEl: best.priceEl
    };
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

  function extractPriceAndVolume(card) {
    let priceEuro = null;
    let promoPriceEuro = null;
    let priceEl = null;
    let volumeL = null;

    const priceInfo = findBestPriceInCard(card);
    if (priceInfo) {
      priceEuro = priceInfo.priceEuro;
      promoPriceEuro = priceInfo.promoPriceEuro || null;
      priceEl = priceInfo.priceEl;
    }

    const ahSizeEl = card.querySelector("[data-testid='product-unit-size']");
    if (ahSizeEl) {
      const v = parseVolumeToLiters(ahSizeEl.textContent || "");
      if (v != null) {
        volumeL = v;
      }
    }

    if (priceEuro != null && volumeL != null && volumeL > 0) {
      return { priceEuro, promoPriceEuro, priceEl, volumeL };
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
      if (!volumeL && /ml|cl|l|liter/i.test(text)) {
        const v = parseVolumeToLiters(text);
        if (v != null) {
          volumeL = v;
        }
      }
      if (priceEuro != null && volumeL != null) break;
    }

    if (priceEuro == null || volumeL == null || volumeL <= 0) return null;
    return { priceEuro, promoPriceEuro, priceEl, volumeL };
  }

  function extractPriceAndPieces(card) {
    let priceEuro = null;
    let promoPriceEuro = null;
    let priceEl = null;
    let pieces = null;

    const priceInfo = findBestPriceInCard(card);
    if (priceInfo) {
      priceEuro = priceInfo.priceEuro;
      promoPriceEuro = priceInfo.promoPriceEuro || null;
      priceEl = priceInfo.priceEl;
    }

    const ahSizeEl = card.querySelector("[data-testid='product-unit-size']");
    if (ahSizeEl) {
      const c = parsePiecesCount(ahSizeEl.textContent || "");
      if (c != null) {
        pieces = c;
      }
    }

    if (priceEuro != null && pieces != null && pieces > 0) {
      return { priceEuro, promoPriceEuro, priceEl, pieces };
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
      if (!pieces && /st|stuk/i.test(text)) {
        const c = parsePiecesCount(text);
        if (c != null) {
          pieces = c;
        }
      }
      if (priceEuro != null && pieces != null) break;
    }

    if (priceEuro == null || pieces == null || pieces <= 0) return null;
    return { priceEuro, promoPriceEuro, priceEl, pieces };
  }

  function extractPriceAndLength(card) {
    let priceEuro = null;
    let promoPriceEuro = null;
    let priceEl = null;
    let meters = null;

    const priceInfo = findBestPriceInCard(card);
    if (priceInfo) {
      priceEuro = priceInfo.priceEuro;
      promoPriceEuro = priceInfo.promoPriceEuro || null;
      priceEl = priceInfo.priceEl;
    }

    const ahSizeEl = card.querySelector("[data-testid='product-unit-size']");
    if (ahSizeEl) {
      const m = parseLengthToMeters(ahSizeEl.textContent || "");
      if (m != null) {
        meters = m;
      }
    }

    if (priceEuro != null && meters != null && meters > 0) {
      return { priceEuro, promoPriceEuro, priceEl, meters };
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
      if (!meters && /(mm|cm|m|meter)/i.test(text)) {
        const mVal = parseLengthToMeters(text);
        if (mVal != null) {
          meters = mVal;
        }
      }
      if (priceEuro != null && meters != null) break;
    }

    if (priceEuro == null || meters == null || meters <= 0) return null;
    return { priceEuro, promoPriceEuro, priceEl, meters };
  }

  function extractPriceAndWashes(card) {
    let priceEuro = null;
    let promoPriceEuro = null;
    let priceEl = null;
    let washes = null;

    const priceInfo = findBestPriceInCard(card);
    if (priceInfo) {
      priceEuro = priceInfo.priceEuro;
      promoPriceEuro = priceInfo.promoPriceEuro || null;
      priceEl = priceInfo.priceEl;
    }

    const ahSizeEl = card.querySelector("[data-testid='product-unit-size']");
    if (ahSizeEl) {
      const w = parseWashesCount(ahSizeEl.textContent || "");
      if (w != null) {
        washes = w;
      }
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
      if (!washes && /wasbeurt/i.test(text)) {
        const w = parseWashesCount(text);
        if (w != null) {
          washes = w;
        }
      }
      if (priceEuro != null && washes != null) break;
    }

    if (priceEuro == null || washes == null || washes <= 0) return null;
    return { priceEuro, promoPriceEuro, priceEl, washes };
  }

  function extractPriceAndWeight(card) {
    let priceEuro = null;
    let promoPriceEuro = null;
    let priceEl = null;
    let weightKg = null;

    const priceInfo = findBestPriceInCard(card);
    if (priceInfo) {
      priceEuro = priceInfo.priceEuro;
      promoPriceEuro = priceInfo.promoPriceEuro || null;
      priceEl = priceInfo.priceEl;
    }

    const ahWeightEl = card.querySelector("[data-testid='product-unit-size']");
    if (ahWeightEl) {
      const w = parseWeightToKg(ahWeightEl.textContent || "");
      if (w != null) {
        weightKg = w;
      }
    }

    if (priceEuro != null && weightKg != null && weightKg > 0) {
      return { priceEuro, promoPriceEuro, priceEl, weightKg };
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
      if (!weightKg && /kg|g/i.test(text)) {
        const w = parseWeightToKg(text);
        if (w != null) {
          weightKg = w;
        }
      }
      if (priceEuro != null && weightKg != null) break;
    }

    if (priceEuro == null || weightKg == null || weightKg <= 0) return null;
    return { priceEuro, promoPriceEuro, priceEl, weightKg };
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

  function getUnitPriceForCard(card, unit) {
    const mode = unit || "kg";

    if (mode === "kg") {
      // 1) Prefer an already visible €/kg label (from site or another extension)
      const direct = findUnitPriceElement(card);
      if (direct && direct.value != null) {
        return direct.value;
      }

      // 2) Derive €/kg from price and weight info inside the card
      const info = extractPriceAndWeight(card);
      if (!info) return null;
      const basePerKg = info.priceEuro / info.weightKg;
      if (!Number.isFinite(basePerKg) || basePerKg <= 0) return null;

      let promoPerKg = null;
      if (info.promoPriceEuro != null && info.promoPriceEuro > 0) {
        promoPerKg = info.promoPriceEuro / info.weightKg;
      }

      const sortPrice =
        promoPerKg != null && promoPerKg > 0 && promoPerKg < basePerKg
          ? promoPerKg
          : basePerKg;

      injectUnitPriceLabel(card, basePerKg, info.priceEl, "kg", promoPerKg);
      return sortPrice;
    }

    if (mode === "l") {
      const info = extractPriceAndVolume(card);
      if (!info) return null;
      const basePerL = info.priceEuro / info.volumeL;
      if (!Number.isFinite(basePerL) || basePerL <= 0) return null;

      let promoPerL = null;
      if (info.promoPriceEuro != null && info.promoPriceEuro > 0) {
        promoPerL = info.promoPriceEuro / info.volumeL;
      }

      const sortPrice =
        promoPerL != null && promoPerL > 0 && promoPerL < basePerL
          ? promoPerL
          : basePerL;

      injectUnitPriceLabel(card, basePerL, info.priceEl, "L", promoPerL);
      return sortPrice;
    }

    if (mode === "piece") {
      const info = extractPriceAndPieces(card);
      if (!info) return null;
      const basePerPiece = info.priceEuro / info.pieces;
      if (!Number.isFinite(basePerPiece) || basePerPiece <= 0) return null;

      let promoPerPiece = null;
      if (info.promoPriceEuro != null && info.promoPriceEuro > 0) {
        promoPerPiece = info.promoPriceEuro / info.pieces;
      }

      const sortPrice =
        promoPerPiece != null && promoPerPiece > 0 && promoPerPiece < basePerPiece
          ? promoPerPiece
          : basePerPiece;

      injectUnitPriceLabel(card, basePerPiece, info.priceEl, "st", promoPerPiece);
      return sortPrice;
    }

    if (mode === "m") {
      const info = extractPriceAndLength(card);
      if (!info) return null;
      const basePerM = info.priceEuro / info.meters;
      if (!Number.isFinite(basePerM) || basePerM <= 0) return null;

      let promoPerM = null;
      if (info.promoPriceEuro != null && info.promoPriceEuro > 0) {
        promoPerM = info.promoPriceEuro / info.meters;
      }

      const sortPrice =
        promoPerM != null && promoPerM > 0 && promoPerM < basePerM
          ? promoPerM
          : basePerM;

      injectUnitPriceLabel(card, basePerM, info.priceEl, "m", promoPerM);
      return sortPrice;
    }

    if (mode === "wash") {
      const info = extractPriceAndWashes(card);
      if (!info) return null;
      const basePerWash = info.priceEuro / info.washes;
      if (!Number.isFinite(basePerWash) || basePerWash <= 0) return null;

      let promoPerWash = null;
      if (info.promoPriceEuro != null && info.promoPriceEuro > 0) {
        promoPerWash = info.promoPriceEuro / info.washes;
      }

      const sortPrice =
        promoPerWash != null && promoPerWash > 0 && promoPerWash < basePerWash
          ? promoPerWash
          : basePerWash;

      injectUnitPriceLabel(
        card,
        basePerWash,
        info.priceEl,
        "wasbeurt",
        promoPerWash
      );
      return sortPrice;
    }

    return null;
  }

  function detectUnitsOnPage() {
    const found = new Set();
    const sizeEls = document.querySelectorAll("[data-testid='product-unit-size']");

    let checked = 0;
    for (const el of sizeEls) {
      const text = (el.textContent || "").toLowerCase();
      if (/\b(kg|g)\b/.test(text)) {
        found.add("kg");
      }
      if (/\b(ml|cl|l|liter)\b/.test(text)) {
        found.add("l");
      }
      if (/\bwasbeurt/.test(text)) {
        found.add("wash");
      }
      if (/\b(st\.?|stuk|stuks)\b/.test(text)) {
        found.add("piece");
      }
      if (/\b(mm|cm|m|meter|meters)\b/.test(text)) {
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

    const candidates = document.querySelectorAll(
      "[data-testhook*='product'], [data-testhook*='Product'], [data-testid*='product'], article, li"
    );
    for (const card of candidates) {
      ensureUnitPriceLabel(card, units);
    }
  }

  function findProductCardsForUnit(unit) {
    const cards = new Set();
    const results = [];

    const candidates = document.querySelectorAll(
      "[data-testhook*='product'], [data-testhook*='Product'], [data-testid*='product'], article, li"
    );

    for (const card of candidates) {
      if (!(card instanceof HTMLElement)) continue;
      if (cards.has(card)) continue;

      const pricePerUnit = getUnitPriceForCard(card, unit);
      if (pricePerUnit == null) continue;

      let container = card.parentElement;
      if (!container) continue;

      // Avoid reordering top-level layout sections like main/body/footer
      const forbidden = new Set(["HTML", "BODY", "MAIN", "FOOTER", "HEADER"]);
      if (forbidden.has(container.tagName)) {
        if (container.parentElement && !forbidden.has(container.parentElement.tagName)) {
          container = container.parentElement;
        } else {
          continue;
        }
      }

      // Only consider containers that actually hold multiple product cards
      if (!container.children || container.children.length < 2) continue;

      cards.add(card);
      results.push({
        card,
        container,
        pricePerUnit
      });
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

  function sortProductsByPricePerKg(ascending = true) {
    return sortProductsByUnit("kg", ascending);
  }

  function sortProductsByPricePerLitre(ascending = true) {
    return sortProductsByUnit("l", ascending);
  }

  function init() {
    const existingButton = document.getElementById(BUTTON_ID);
    if (existingButton && existingButton.parentElement) {
      existingButton.parentElement.removeChild(existingButton);
    }
    const units = detectUnitsOnPage();
    attachSortDropdownOptions(units);
    labelUnitPricesForAllCards(units);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }

  let mutationScheduled = false;
  const obs = new MutationObserver(() => {
    if (mutationScheduled) return;
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
