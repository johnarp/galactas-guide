<div align="center">

![Banner](./assets/github/banner.png)

# Galacta's Guide

A Marvel Rivals proficiency tracker and hero creator.

</div>

## Preview

![Preview](./assets/github/preview.png)

## Features

- Track hero proficiency using rank, level, and points
- Create hero concepts and integrate into the tracker
- Customize with themes and card backgrounds
- localStorage persistence with export, import, and clear

## Usage

The easiest way is the live site: **[https://johnarp.github.io/galactas-guide](https://johnarp.github.io/galactas-guide)**

Alternatively, run it locally with any static server (eg. Python):

```bash
git clone https://github.com/johnarp/galactas-guide.git
cd galactas-guide
python -m http.server 3000
```

Then open in your browser: **[http://localhost:3000](http://localhost:3000)**

## Known Issues

- Multi-role Heroes (eg. Deadpool) show only their first role's color in Role card background mode
- Name in profile and role filter images in tracker are hard to see in Rivals theme
- Clearing data on a non-default theme requires a page reload to revert to default
- Switching to a non-Galacta/Rivals theme requires a page reload to take effect
- Created heroes don't have icons
- Hela's hover image is cut off
- Icons are of varying quality

## To Do

### General

- Champion icons
- Rename hero images with generic names
- Site theme color changes depending on applied theme

### Home

- Dynamic version number in footer
    - Click to open pop-up changelog
- Display newest hero on home screen
- Source Code and Report Issue links

### Tracker

- Heroes pop-out when hovering
- Customize heroes with skins
    - Skin rarity card background
    - Option to disable hover image
- Change size of hero cards
- Exclude-favorites and exclude-created filters
- Choose which icon for hero with multiple appearances (eg. Bruce Banner, Cloak & Dagger)

### Creator

- Upload custom images
- Allow adding hero abilities and season released

### Settings

- "None" option for Card Background
- More options for Show Proficiency
- Show/Hide hero role icon

### Profile

- Hero nameplate
- Display a hero and its info on your profile

## License

Source code is licensed under the [MIT License](./LICENSE)

## Legal

Marvel Rivals assets, images, and related media included in this project are the property of NetEase Games and/or Marvel and are not covered by the [MIT License](./LICENSE). This project is not affiliated with or endorsed by NetEase or Marvel.