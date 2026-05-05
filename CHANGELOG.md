# Changelog

[1.3.1]: https://github.com/johnarp/galactas-guide/releases/tag/v1.3.1
[1.3.0]: https://github.com/johnarp/galactas-guide/releases/tag/v1.3.0
[1.2.0]: https://github.com/johnarp/galactas-guide/releases/tag/v1.2.0
[1.1.1]: https://github.com/johnarp/galactas-guide/releases/tag/v1.1.1
[1.1.0]: https://github.com/johnarp/galactas-guide/releases/tag/v1.1.0
[1.0.1]: https://github.com/johnarp/galactas-guide/releases/tag/v1.0.1
[1.0.0]: https://github.com/johnarp/galactas-guide/releases/tag/v1.0.0

## [1.3.1] - 2026-05-05

### Changed

- Overhauled README

### Fixed

- Creator season prompt now accepts decimal values, eg. 5.5

## [1.3.0] - 2026-04-30

### Added

- Abilities editor and season field in Creator
- New, read-only modal when clicking the card body in Creator
- Role filters, size controls, search bar, and sort options in Creator
- Proficiency rank filter in Tracker
- More placeholder Hero images

### Changed

- Mobile browser navigation bar colors to the themes primary color
- Profile name, profile icon, and Tracker pop-up modal text color in Rivals theme

## [1.2.0] - 2026-04-27

### Added

- Card and icon size controls
- Icon picker for heroes with multiple icon variants (eg. Hulk, Cloak & Dagger, White Fox, etc.) in the proficiency modal
- Exclude state for Favorites and Created filter buttons. Each cycles through All → Only → Exclude
- None option for the Card Background setting

### Changed

- Improved mobile layout; hamburger menu and scaled down cards
- Mobile browser navigation bar color reflects the active theme
- Adjusted colors for Duelist and Strategist

### Fixed

- Switching to a non-Galacta or non-Rivals theme no longer requires a page reload to take effect
- Clearing data on a non-default theme no longer requires a page reload to revert to default

## [1.1.1] - 2026-04-26

### Added

- Site icon
- HTML meta tags
- GitHub Social Preview image
- New README banner

### Fixed

- Broken default hero icon path in tracker.js

## [1.1.0] - 2026-04-25

### Added

- Icon view mode for tracker
- Options to show/hide hero name and proficiency information

### Changed

- Icons in the proficiency modal

## [1.0.1] - 2026-04-25

### Added

- Symbiote and Rivals theme

### Changed

- Theme loading logic to add new themes more easily

## [1.0.0] - 2026-04-23

### Added

- Hero tracker with rank, level, and points
- Role, favorites, and custom hero filters with multi-select
- Sort by name, rank, season, and level-up distance
- Hero creator with placeholder appearances and tracker integration
- Settings with themes and card backgrounds
- localStorage persistence with export, import, and clear