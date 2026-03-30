# Changelog

All notable changes to this project will be documented in this file.

## [1.2.1] - 2026-03-30

### Fixed
- Fixed sorting having no effect: the grid container search now targets `product-results-products` directly instead of stopping at an intermediate wrapper div with too few children

## [1.2.0] - 2026-03-12

### Fixed
- Fixed all DOM selectors broken by AH.nl site redesign: product cards, prices, unit sizes and promotion labels all use new `data-testid` values on search result pages
- Added support for both old and new AH.nl DOM structures (category pages vs search pages use different selectors)
- Fixed price parsing for new aria-label format ("voor X euro en Y cent" instead of "€X.XX")
- Fixed product grid container detection for sorting: cards are now nested in wrapper divs, requiring DOM tree walking to find the real grid container

## [1.1.0] - 2026-03-02

### Fixed
- Fixed the sorting dropdown extension not appearing or functioning correctly due to AH.nl changing the underlying DOM structure of the "Sorteer op" component (switched from a flat button list to a structured `<ul>`/`<li>` implementation)
- Fixed updating the selected label text in the closed dropdown state.  

## [1.0.0] - 2025-11-16

### Added
- Initial release. 
- Core features: automatic calculation of €/kg, €/L, €/stuk, €/meter and €/wasbeurt on ah.nl and ah.be
- Promotions calculation
- Extension options injected natively into the AH.nl sorting dropdown
