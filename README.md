# VanillaGrid

![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Dependencies](https://img.shields.io/badge/dependencies-none-brightgreen.svg)
![Size](https://img.shields.io/badge/size-~118KB-orange.svg)

A tiny, dependency-free data grid for the web that brings powerful spreadsheet-like functionality to your applications. VanillaGrid is designed to be lightweight, fast, and feature-rich without requiring any external libraries.

## ✨ Features

### Core Grid Features
- **🔄 Sorting** - Multi-column sorting with intuitive click controls
- **🔍 Advanced Filtering** - Text, case-sensitive, RegExp, and tree-aware filtering modes
- **📄 Pagination** - Client-side and server-side pagination with customizable page sizes
- **📊 Grouping** - Group rows by columns with aggregations (sum, min, max, count)
- **🌳 Tree/Hierarchical Data** - Expandable/collapsible rows with lazy loading support
- **☑️ Row Selection** - Multi-select with checkboxes and programmatic selection API
- **👁️ Column Management** - Show/hide columns with built-in visibility menu

### Advanced Features
- **🌐 Server-side Operations** - Remote pagination, sorting, and filtering
- **📤 Export/Import** - Export to CSV/Markdown, import from Markdown tables
- **🖱️ Interactive** - Column resizing, inline editing, drag & drop row reordering
- **⌨️ Keyboard Navigation** - Full keyboard accessibility with arrow key navigation
- **🎯 Context Menu** - Right-click context menus for enhanced usability
- **🧊 Frozen Columns** - Pin columns to the left side of the grid
- **🎨 Custom Cell Types** - Rich cell rendering with images, links, buttons, and custom components
- **📐 Pivot Tables** - Pivot-like data transformation and visualization
- **🌍 Internationalization** - Built-in i18n support for multiple languages

## 🚀 Quick Start

### Running the Demo

```bash
npm install
npm start
# Open http://127.0.0.1:8000/ in your browser
```

### Building from Source

```bash
npm install
npm run build
```

This creates minified assets in the `dist/` directory:
- `dist/vanillagrid.min.js` (~50KB minified)
- `dist/vanillagrid.min.css` (~15KB minified)

## 📦 Installation

### Via CDN (Recommended for quick testing)

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/SimonWaldherr/vanillagrid.js@latest/dist/vanillagrid.min.css" />
<script src="https://cdn.jsdelivr.net/gh/SimonWaldherr/vanillagrid.js@latest/dist/vanillagrid.min.js"></script>
```

### Manual Installation

1. Download the latest release
2. Include the CSS and JS files in your HTML:

```html
<link rel="stylesheet" href="path/to/vanillagrid.min.css" />
<script src="path/to/vanillagrid.min.js"></script>
```

### Module Usage

```javascript
// If using ES modules or bundlers
import { VanillaGrid } from './vanillagrid.js';
```

## 📋 Basic Usage

### Simple Grid

```javascript
const data = [
  { id: 1, name: 'John Doe', email: 'john@example.com', age: 30 },
  { id: 2, name: 'Jane Smith', email: 'jane@example.com', age: 25 },
  { id: 3, name: 'Bob Johnson', email: 'bob@example.com', age: 35 }
];

const columns = [
  { key: 'id', label: 'ID', type: 'number', sortable: true },
  { key: 'name', label: 'Name', sortable: true },
  { key: 'email', label: 'Email', sortable: true },
  { key: 'age', label: 'Age', type: 'number', sortable: true }
];

const grid = new VanillaGrid('#grid-container', {
  data: data,
  columns: columns,
  pagination: true,
  pageSize: 10,
  sortable: true,
  filterable: true
});
```

## ⚙️ Configuration

### Column Configuration

```javascript
const columns = [
  {
    key: 'name',                    // Data field name
    label: 'Full Name',             // Display header
    type: 'text',                   // 'text', 'number', 'date', 'button', 'image'
    sortable: true,                 // Enable sorting
    filterable: true,               // Include in filtering
    format: (value) => value.toUpperCase(), // Custom formatter
    render: (value, row) => `<strong>${value}</strong>`, // Custom renderer
    aggregations: ['count', 'min', 'max'], // For grouping
    link: { text: 'View', target: '_blank' }, // Link configuration
    image: { alt: 'Photo', width: 50, height: 50 }, // Image configuration
    button: { 
      text: 'Edit',
      onClick: (row, btn) => console.log('Edit:', row)
    }
  }
];
```

### Grid Options

```javascript
const options = {
  // Data and structure
  data: [],                       // Array of row objects
  columns: [],                    // Column definitions
  
  // Pagination
  pagination: true,               // Enable pagination
  pageSize: 25,                   // Rows per page
  pageSizes: [10, 25, 50, 100],   // Page size options
  
  // Sorting and filtering
  sortable: true,                 // Enable sorting
  filterable: true,               // Enable filtering
  regexFilter: false,             // Enable RegExp filtering
  
  // Grouping
  groupable: true,                // Enable grouping
  groupBy: null,                  // Initial group column
  
  // Selection
  selectable: true,               // Enable row selection
  onSelectionChange: (rows) => {  // Selection callback
    console.log('Selected:', rows.length);
  },
  
  // Column management
  columnsMenu: true,              // Show column visibility menu
  onColumnsVisibilityChange: (hidden) => {
    console.log('Hidden columns:', Array.from(hidden));
  },
  
  // Advanced features
  resizableColumns: true,         // Allow column resizing
  editableRows: true,             // Enable inline editing
  rowDragDrop: true,              // Enable row reordering
  frozenColumns: 1,               // Number of frozen columns
  keyboardNavigation: true,       // Enable keyboard nav
  contextMenu: true,              // Enable context menu
  
  // Tree/hierarchical data
  tree: {
    enabled: true,
    childrenKey: 'children',      // Property containing child rows
    indent: 20,                   // Indentation per level
    lazy: false,                  // Enable lazy loading
    initiallyExpanded: false,     // Initial expansion state
    hasChildrenKey: 'hasChildren' // Property indicating children exist
  },
  
  // Server-side operations
  serverPagination: false,        // Enable server-side pagination
  serverSorting: false,           // Enable server-side sorting
  serverFiltering: false,         // Enable server-side filtering
  loadPage: async (params) => {   // Server-side data loader
    const response = await fetch(`/api/data?${new URLSearchParams(params)}`);
    return response.json(); // Should return { rows: [], total: number }
  },
  
  // Export/import
  exporting: {
    enabled: true,
    formats: ['csv', 'md'],       // Available formats
    scope: 'all',                 // 'page' or 'all'
    filename: 'data-export'       // Base filename
  },
  
  // Styling and behavior
  className: 'my-custom-grid',    // Additional CSS class
  emptyMessage: 'No data found', // Empty state message
  
  // Event handlers
  onRowEdit: (row, field, newValue, oldValue) => {
    console.log('Field edited:', field, newValue);
  },
  onRowDrop: (draggedRow, targetRow, position) => {
    console.log('Row moved:', draggedRow, position);
  }
};
```

## 📚 Examples

### Tree Grid with Lazy Loading

```javascript
const treeData = [
  {
    id: 1,
    name: 'Parent 1',
    hasChildren: true,
    children: [
      { id: 11, name: 'Child 1.1' },
      { id: 12, name: 'Child 1.2' }
    ]
  }
];

const treeGrid = new VanillaGrid('#tree-grid', {
  data: treeData,
  columns: [
    { key: 'name', label: 'Name', sortable: true }
  ],
  tree: {
    enabled: true,
    childrenKey: 'children',
    lazy: true,
    initiallyExpanded: false
  },
  loadChildren: async (row) => {
    // Load children dynamically
    const response = await fetch(`/api/children/${row.id}`);
    return response.json();
  }
});
```

### Server-side Grid

```javascript
const serverGrid = new VanillaGrid('#server-grid', {
  data: [], // Initial data loaded via loadPage
  columns: [
    { key: 'id', label: 'ID', type: 'number', sortable: true },
    { key: 'name', label: 'Name', sortable: true },
    { key: 'email', label: 'Email', sortable: true }
  ],
  serverPagination: true,
  serverSorting: true,
  serverFiltering: true,
  loadPage: async ({ page, pageSize, sortKey, sortDir, filter }) => {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
      ...(sortKey && { sortKey, sortDir }),
      ...(filter && { filter })
    });
    
    const response = await fetch(`/api/data?${params}`);
    const result = await response.json();
    
    return {
      rows: result.data,
      total: result.total
    };
  }
});
```

### Custom Cell Renderers

```javascript
const customGrid = new VanillaGrid('#custom-grid', {
  data: [
    { name: 'John', avatar: 'john.jpg', status: 'active', score: 85 }
  ],
  columns: [
    {
      key: 'avatar',
      label: 'Photo',
      type: 'image',
      image: { width: 40, height: 40, alt: 'Avatar' }
    },
    {
      key: 'status',
      label: 'Status',
      render: (value) => {
        const color = value === 'active' ? 'green' : 'red';
        return `<span style="color: ${color}; font-weight: bold;">${value}</span>`;
      }
    },
    {
      key: 'score',
      label: 'Score',
      render: (value) => {
        const width = (value / 100) * 100;
        return `
          <div style="background: #f0f0f0; border-radius: 4px; overflow: hidden;">
            <div style="background: #4CAF50; height: 20px; width: ${width}%; transition: width 0.3s;"></div>
          </div>
          <span style="font-size: 12px;">${value}%</span>
        `;
      }
    },
    {
      key: 'actions',
      label: 'Actions',
      type: 'button',
      button: {
        text: 'Edit',
        onClick: (row, button) => {
          alert(`Editing ${row.name}`);
        }
      }
    }
  ]
});
```

## 🔧 API Reference

### Grid Methods

```javascript
// Data management
grid.setData(newData);              // Update grid data
grid.getData();                     // Get current data
grid.addRow(rowData);               // Add single row
grid.removeRow(rowId);              // Remove row by ID
grid.updateRow(rowId, newData);     // Update specific row

// Sorting and filtering
grid.setSort(column, direction);    // Set sort ('asc' or 'desc')
grid.setFilter(text, options);      // Set filter with options
grid.clearFilter();                 // Clear current filter
grid.setGroupBy(column);            // Group by column
grid.clearGroupBy();                // Clear grouping

// Pagination
grid.goToPage(pageNumber);          // Navigate to page
grid.setPageSize(size);             // Change page size
grid.getPageInfo();                 // Get pagination info

// Selection
grid.getSelectedRows();             // Get selected rows
grid.selectRow(rowId);              // Select specific row
grid.selectAll();                   // Select all rows
grid.clearSelection();              // Clear selection

// Column management
grid.showColumn(columnKey);         // Show hidden column
grid.hideColumn(columnKey);         // Hide column
grid.getVisibleColumns();           // Get visible columns
grid.setColumnWidth(columnKey, width); // Set column width

// Tree operations (if tree enabled)
grid.expandAll();                   // Expand all tree nodes
grid.collapseAll();                 // Collapse all tree nodes
grid.expandRow(rowId);              // Expand specific row
grid.collapseRow(rowId);            // Collapse specific row

// Export/import
grid.exportToCsv(filename);         // Export as CSV
grid.exportToMarkdown(filename);    // Export as Markdown
grid.importFromMarkdown(markdown);  // Import from Markdown

// Refresh and update
grid.refresh();                     // Refresh grid display
grid.destroy();                     // Clean up and destroy grid
```

### Events

```javascript
// Listen to grid events
grid.on('rowClick', (row, event) => {
  console.log('Row clicked:', row);
});

grid.on('rowDoubleClick', (row, event) => {
  console.log('Row double-clicked:', row);
});

grid.on('cellEdit', (row, field, oldValue, newValue) => {
  console.log('Cell edited:', field, oldValue, '->', newValue);
});

grid.on('sortChange', (column, direction) => {
  console.log('Sort changed:', column, direction);
});

grid.on('filterChange', (filterText, options) => {
  console.log('Filter changed:', filterText, options);
});

grid.on('pageChange', (page, pageSize) => {
  console.log('Page changed:', page, pageSize);
});

grid.on('selectionChange', (selectedRows) => {
  console.log('Selection changed:', selectedRows.length);
});
```

## 🛠️ Development

### Prerequisites

- Node.js (v14 or higher)
- npm

### Setup

```bash
# Clone the repository
git clone https://github.com/SimonWaldherr/vanillagrid.js.git
cd vanillagrid.js

# Install dependencies
npm install

# Start development server
npm start

# Build for production
npm run build
```

### Project Structure

```
vanillagrid.js/
├── vanillagrid.js          # Main source file
├── vanillagrid.css         # Stylesheet
├── demo.html               # Main demo page
├── demo/                   # Individual demo pages
│   ├── basic.html          # Basic grid examples
│   ├── tree.html           # Tree grid demo
│   ├── remote.html         # Server-side demo
│   ├── selection-columns.html # Selection & columns demo
│   └── ...                 # More demos
├── dist/                   # Built files (generated)
├── package.json            # Dependencies and scripts
└── README.md               # This file
```

### Build Scripts

- `npm start` - Start development server on http://localhost:8000
- `npm run build` - Build minified production files
- `npm run clean` - Clean build directory

### Testing

The project includes comprehensive demo pages that serve as integration tests. Run `npm start` and navigate through the demo pages to test functionality:

- **Basic Demo** (`demo.html`) - Core features
- **Tree Demo** (`demo/tree.html`) - Hierarchical data
- **Remote Demo** (`demo/remote.html`) - Server-side operations
- **Selection Demo** (`demo/selection-columns.html`) - Selection and column management

## 🤝 Contributing

We welcome contributions! Here's how you can help:

### Reporting Issues

1. Check existing issues first
2. Provide a clear description of the problem
3. Include steps to reproduce
4. Add browser and version information
5. Include any error messages

### Submitting Pull Requests

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Test thoroughly using the demo pages
5. Commit with clear messages: `git commit -m "Add feature: description"`
6. Push to your fork: `git push origin feature/my-feature`
7. Open a pull request

### Development Guidelines

- **Code Style**: Follow existing code patterns and formatting
- **Comments**: Add JSDoc comments for public APIs
- **Testing**: Test changes using the demo pages
- **Documentation**: Update README if adding new features
- **Backwards Compatibility**: Avoid breaking changes when possible

### Areas for Contribution

- 🌍 Internationalization (new language translations)
- 🎨 Themes and styling improvements
- 📱 Mobile/responsive enhancements
- 🔌 New cell types and renderers
- 📊 Additional export formats
- 🚀 Performance optimizations
- 🧪 Unit tests and testing framework
- 📚 Documentation improvements

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

```
MIT License

Copyright (c) 2025 Simon Waldherr

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
```

## 📞 Support and Contact

### Getting Help

- **Documentation**: Check this README and the demo pages
- **Issues**: [GitHub Issues](https://github.com/SimonWaldherr/vanillagrid.js/issues)
- **Discussions**: [GitHub Discussions](https://github.com/SimonWaldherr/vanillagrid.js/discussions)

### Reporting Bugs

Please use [GitHub Issues](https://github.com/SimonWaldherr/vanillagrid.js/issues) to report bugs. Include:

- Browser and version
- Steps to reproduce
- Expected vs actual behavior
- Code examples (if applicable)

### Feature Requests

We welcome feature requests! Please:

1. Check existing issues for similar requests
2. Describe the use case and expected behavior
3. Consider contributing the feature yourself

## 🔄 Changelog & Versioning

### Current Version: 0.1.0

This project follows [Semantic Versioning](https://semver.org/):

- **MAJOR**: Breaking changes
- **MINOR**: New features (backwards compatible)
- **PATCH**: Bug fixes (backwards compatible)

### Recent Changes

See [GitHub Releases](https://github.com/SimonWaldherr/vanillagrid.js/releases) for detailed changelog.

---

**Made with ❤️ by [Simon Waldherr](https://github.com/SimonWaldherr)**

*VanillaGrid.js - Because sometimes you just need a powerful, dependency-free data grid that works everywhere.*
