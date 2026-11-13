<div align="center">

![Banner](./assets/project/banner.png)

# Galacta's Guide

Track your Marvel Rivals proficiency in seconds.

[![License](https://img.shields.io/github/license/johnarp/galactas-guide?style=for-the-badge&color=ac4ef9)](./LICENSE)
[![Version](https://img.shields.io/github/v/release/johnarp/galactas-guide?style=for-the-badge&color=ac4ef9)](https://github.com/johnarp/galactas-guide/releases/latest)

[**Go to Galacta's Guide**](https://johnarp.github.io/galactas-guide/)

</div>

## ✨ Features

- Quick proficiency tracking
- Add your own Heroes and cosutmes
- View your statistics
- Make it yours with tons of customization
- Everything is saved in your browser. Export, import, or clear anytime

<!-- ## 🖼️ Preview

| Mobile | Desktop |
| :---: | :---: |
| ![Mobile Preview](./assets/project/preview-mobile.png) | ![Desktop Preview](./assets/project/preview-mobile.png) | -->

## 🚀 Installation

### 🌐 Website

Open [**johnarp.github.io/galactas-guide**](https://johnarp.github.io/galactas-guide/) in any modern browser, on your phone or computer. There is no install or account to create.

### 💽 Local

Galacta's Guide is a plain HTML, CSS, and JS project with no building. It loads data with `fetch`, so it has to be served over HTTP/localserver. Simply opening `index.html` will not work.

```bash
git clone https://github.com/johnarp/galactas-guide.git
cd galactas-guide
python -m http.server 3000
```

Then, open `http://localhost:3000` in your browser.

## ⚠️ Known Issues 

- Agent icons for alternate forms (e.g., Darkchylde) come from a different source and are square, so they look zoomed in on the icon tiles.

## 🗺️ Roadmap

- In-app changelog
- Rank icon on the bottom left corner of the card
- List view; row per Hero, uses story images
- Option to separate multi-role Heroes and sync or separate proficiency
- Announcement system
- Alias search
- Improve look of control bar

## 🔏 Privacy

Galacta's Guide has no accounts, analytics, or server. All of your data never leave your browser/device. The only outside requests are for fonts and icons from Google Fonts, custom hero and costume images you provide, and the latest version number from GitHub in the settings.

## 🤝 Contributing

Contributions are welcome. Please [open an issue](https://github.com/johnarp/galactas-guide/issues) for any bugs, ideas, or other contributions. Pull requests are also welcome.

Project is organized like this:

```
assets/     images
css/        stylesheets
data/       data
js/         scripts
views/      pages other than the home page
```

## 🙏 Credits

Hero art, icons, and theme backgrounds come from [PSYLOCKE.GG](https://psylocke.gg). Silhouettes and rarity icons come from [Marvel Rivals Skins](https://rivalskins.com). Agent icons for alternate forms come from [Marvel Rivals Fandom](https://marvelrivals.fandom.com/)

## 📄 License

This project is licensed under the [MIT License](./LICENSE).

## ⚖️ Legal

Galacta’s Guide is an unofficial fan project. It is not affiliated with or endorsed by Marvel or NetEase Games. Marvel Rivals and all related names and artwork belong to their respective owners. See [NOTICE](.//NOTICE.md) for details.