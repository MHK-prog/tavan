# Tavan ? GitHub Pages package

This folder contains the static Tavan workout journal prepared for GitHub Pages. The original single-file page has been separated into the page shell, styles, JavaScript modules, and data files.

## Publish

1. Create or open a GitHub repository and upload the contents of this folder to its root.
2. In **Settings ? Pages**, choose **Deploy from a branch**, select the `main` branch and `/(root)`, then save.
3. Open the Pages address GitHub shows after deployment.

The app uses browser storage on each device. It has no server-side account or cloud sync; use the in-app backup button to move data between devices.

## Preview locally

Because the app loads its JSON catalogs as separate files, opening `index.html` directly with `file://` is blocked by browser security. In this folder run:

```powershell
py -m http.server 8000
```

Then open `http://localhost:8000`.

## Files

- `index.html` ? page shell
- `assets/css/tavan.css` ? styles
- `icons/*.svg` ? individually editable app icons and dumbbell artwork
- `assets/js/` ? application modules and loader
- `data/` ? exercise and USDA food catalogs
- `.nojekyll` ? tells GitHub Pages to serve files directly

When updating code or data, change the cache query version in `assets/js/boot.js` if a browser keeps an older copy.
