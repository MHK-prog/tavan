# Icon assets

`sprite.svg` is the shared SVG symbol sheet for the app icons and decorative dumbbell artwork. The app references symbols with `<use href="./icons/sprite.svg#symbol-id">`; add new icons there and call them through the `icon()` helper in `assets/js/tavan-app.js`.

The symbols cover navigation, actions, calendar, theme, favorite, reorder, and hero-dumbbell graphics. Charts and the interactive muscle map remain generated in JavaScript because their shapes and contents depend on user data and selection.
