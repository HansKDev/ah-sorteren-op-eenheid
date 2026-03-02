# Changelog

All notable changes to this project will be documented in this file.

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
