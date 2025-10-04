# VanillaGrid

A tiny dependency‑free data grid with:
- Sort, filter (text/RegExp), pagination, group‑by (sum/min/max)
- Tree (hierarchical) rows with lazy loading
- Remote/server‑side paging, sorting, filtering
- Export to CSV/Markdown and Markdown table ingestion
- Column visibility menu and checkbox row selection
- Built-in settings panel to switch themes (light, dark-blue, dark-grey, midnight, forest, ocean, sand), toggle compact density, and enable striped rows on the fly

## Quick start

Serve locally, then open in a browser:

```
npm install
npm start
# then visit http://127.0.0.1:8000/
```

Tip: Opening `demo.html` directly works for most features, but the Markdown loader uses `fetch()`, which requires serving via HTTP.

## Build

Requires Node.js and npm.

```
npm install
npm run build
```

Outputs minified assets to `dist/`:
- `dist/vanillagrid.min.js`
- `dist/vanillagrid.min.css`
- `dist/vg-pivot-d3.min.js`
- `dist/vg-pivot-d3.min.css`

## Use

Include the minified assets in your page:

```html
<link rel="stylesheet" href="dist/vanillagrid.min.css" />
<script src="dist/vanillagrid.min.js"></script>

<!-- Optional: pivot chart plugin (lazy-loads d3.js on demand) -->
<link rel="stylesheet" href="dist/vg-pivot-d3.min.css" />
<script src="dist/vg-pivot-d3.min.js"></script>
```

Then instantiate:

```js
const grid = new VanillaGrid('#el', { data, columns });
```

Examples:
- Selection + Columns menu
```js
const grid = new VanillaGrid('#el', {
  data,
  selectable: true,
  columnsMenu: true,
  columns: [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'price', label: 'Price', type: 'number', sortable: true },
  ],
  onSelectionChange: rows => console.log('Selected', rows.length)
});
```

## Options (high‑level)
- `columns`: Array of column defs `{ key, label, type, sortable, filterable, format, render, aggregations, link, image, button }`.
- `selectable`: Adds a checkbox column and exposes `getSelectedRows()` / `clearSelection()`.
- `columnsMenu`: Shows a simple Columns menu in the toolbar to toggle visibility.
- `tree`: `{ enabled, childrenKey, indent, lazy, initiallyExpanded, hasChildrenKey }`.
- `serverPagination|serverSorting|serverFiltering`: Enable with `loadPage(params)`.
- `exporting`: `{ enabled, formats:['csv','md'], scope:'page'|'all', filename }`.

See `demo.html` for basic, tree, remote, Markdown, and selection examples.
## Run Locally

Serve the repo root (auto-routes to `demo.html`):

```
npm start
# custom: npm start -- --port 8080 --host 0.0.0.0
```
