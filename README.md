# VanillaGrid

A tiny dependency‑free data grid with:
- Sort, filter (text/RegExp), pagination, group‑by (sum/min/max)
- Tree (hierarchical) rows with lazy loading
- Remote/server‑side paging, sorting, filtering
- Export to CSV/Markdown and Markdown table ingestion
- Column visibility menu and checkbox row selection
- Built-in settings panel to switch themes (light, dark-blue, dark-grey, midnight, forest, ocean, sand), toggle compact density, and enable striped rows on the fly
- **TypeScript support** with full type definitions

## Quick start

Serve locally, then open in a browser:

```bash
npm install
npm start
# then visit http://127.0.0.1:8000/
```

Tip: Opening `demo.html` directly works for most features, but the Markdown loader uses `fetch()`, which requires serving via HTTP.

## Build

Requires Node.js and npm.

```bash
npm install
npm run build
```

Outputs to `dist/`:
- `dist/vanillagrid.esm.js` - ES Module bundle
- `dist/vanillagrid.umd.js` - UMD bundle (browser global)
- `dist/vanillagrid.min.js` - Minified UMD bundle
- `dist/vanillagrid.d.ts` - TypeScript type definitions
- `dist/vanillagrid.min.css` - Minified styles
- `dist/vg-pivot-d3.min.js` - Pivot chart plugin
- `dist/vg-pivot-d3.min.css` - Pivot chart styles

## Installation

### Browser (UMD)

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

### ES Module

```js
import VanillaGrid from './dist/vanillagrid.esm.js';

const grid = new VanillaGrid('#el', { data, columns });
```

### TypeScript

```typescript
import VanillaGrid, { VanillaGridOptions, VGColumn } from './dist/vanillagrid.esm.js';

interface MyRow {
  id: number;
  name: string;
  price: number;
}

const options: VanillaGridOptions<MyRow> = {
  data: [
    { id: 1, name: 'Item 1', price: 10.50 },
    { id: 2, name: 'Item 2', price: 20.00 }
  ],
  columns: [
    { key: 'id', label: 'ID', type: 'number' },
    { key: 'name', label: 'Name', sortable: true },
    { key: 'price', label: 'Price', type: 'number', sortable: true }
  ]
};

const grid = new VanillaGrid<MyRow>('#el', options);
```

## Usage Examples

### Selection + Columns menu
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

### Tree/Hierarchical Data
```js
const grid = new VanillaGrid('#el', {
  data: hierarchicalData,
  columns: [
    { key: 'name', label: 'Name' },
    { key: 'value', label: 'Value' }
  ],
  tree: {
    enabled: true,
    childrenKey: 'children',
    indent: 20,
    initiallyExpanded: false
  }
});
```

### Server-side Pagination
```js
const grid = new VanillaGrid('#el', {
  data: [],
  columns,
  serverPagination: true,
  serverSorting: true,
  serverFiltering: true,
  loadPage: async ({ page, pageSize, sortKey, sortDir, filter }) => {
    const response = await fetch(`/api/data?page=${page}&size=${pageSize}`);
    const { rows, total } = await response.json();
    return { rows, total };
  }
});
```

## Options Reference

- `columns`: Array of column definitions `{ key, label, type, sortable, filterable, format, render, aggregations, link, image, button }`
- `selectable`: Adds a checkbox column and exposes `getSelectedRows()` / `clearSelection()`
- `columnsMenu`: Shows a Columns menu in the toolbar to toggle visibility
- `tree`: `{ enabled, childrenKey, indent, lazy, initiallyExpanded, hasChildrenKey }`
- `serverPagination|serverSorting|serverFiltering`: Enable with `loadPage(params)`
- `exporting`: `{ enabled, formats:['csv','md'], scope:'page'|'all', filename }`
- `resizableColumns`: Enable column resizing by dragging borders
- `editableRows`: Enable inline row editing
- `keyboardNavigation`: Enable arrow key navigation
- `contextMenu`: Enable right-click context menu
- `pivotMode`: Enable pivot table builder

See `demo.html` for comprehensive examples including basic grids, tree data, remote data, Markdown ingestion, pivot tables, and all advanced features.

## API

See [TypeScript definitions](dist/vanillagrid.d.ts) for complete API documentation.

Key methods:
- `setData(data)` - Replace grid data
- `getData()` - Get current data
- `setFilter(text, options)` - Apply filter
- `setSort(key, direction)` - Apply sorting
- `setGroupBy(key)` - Group by column
- `downloadCSV(filename)` - Export to CSV
- `downloadMarkdown(filename)` - Export to Markdown
- `getSelectedRows()` - Get selected rows (when selectable: true)
- `clearSelection()` - Clear row selection

## Run Locally

Serve the repo root (auto-routes to `demo.html`):

```bash
npm start
# custom: npm start -- --port 8080 --host 0.0.0.0
```

## Development

The library is written in TypeScript and compiled to JavaScript:

- Source: `src/vanillagrid.ts`
- Build system: Rollup with TypeScript plugin
- Output formats: ESM, UMD, minified UMD, and TypeScript definitions

To modify the library:
1. Edit `src/vanillagrid.ts`
2. Run `npm run build` to compile
3. Test with `npm start` and open `demo.html`

## License

MIT
