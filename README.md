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
- Rivals theme needs improving (currently disabled)

## To Do

- Dynamic version number in footer
    - Changelog pop-up modal (click version number)
- The newest hero displayed on the home screen
- Heroes pop-out of their card when hovering
- Skins
    - Skin rarity card background mode
- Change the size of hero cards
- Select a hero nameplate for your profile
- Select a hero to display on your profile
- Lord and Champion icons
- HTML meta tags
- Improve README banner

## License

Source code is licensed under the [MIT License](./LICENSE)

## Legal

Marvel Rivals assets, images, and related media included in this project are the property of NetEase Games and/or Marvel and are not covered by the [MIT License](./LICENSE). This project is not affiliated with or endorsed by NetEase or Marvel.