# Icon files

Each icon is stored as an editable, standalone SVG named after its original symbol ID. Open the matching file to change its paths, colors, or shape.

The application loads the 24x24 icons through the `icon()` helper in `assets/js/tavan-app.js`. Most use `currentColor` and inherit the surrounding text color. The decorative home-page dumbbell is `hero-dumbbell.svg`.

The app adds `?v=2` to icon URLs to refresh cached art. If you change an icon after publishing, increase that number in the icon helper, `index.html`, and the hero reference in `assets/js/tavan-app.js`.

Available files: `dashboard`, `workout`, `program`, `library`, `progress`, `body`, `settings`, `plus`, `arrow`, `check`, `clock`, `download`, `edit`, `trash`, `close`, `copy`, `chevron`, `info`, `nutrition`, `reminders`, `calendar`, `sun`, `moon`, `star`, `star-outline`, `up`, `down`, and `hero-dumbbell`.
