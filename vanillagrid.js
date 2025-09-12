/*!
 * VanillaGrid — a tiny table library
 * Features: sort, filter (text/RegExp), pagination, group-by (sum/min/max), rich cell types
 * No dependencies. MIT License.
 */
(function (global) {
  class VanillaGrid {
    constructor(container, options) {
      this.container = (typeof container === 'string')
        ? document.querySelector(container)
        : container;

      if (!this.container) throw new Error('VanillaGrid: container not found');

      // Options
      const defaults = {
        data: [],
        columns: [], // [{ key, label, type, sortable, filterable, format, render, aggregations:['sum','min','max'], link:{text,target}, image:{alt,width,height}, button:{text, onClick} }]
        pageSize: 10,
        pageSizes: [10, 25, 50, 100],
        sortable: true,
        filterable: true,
        pagination: true,
        groupable: true,
        groupBy: null, // key or null
        regexFilter: false,
        className: '',
        emptyMessage: 'No rows to display.',
        // i18n strings (override any to localize)
        i18n: {
          tableLabel: 'Data table',
          filterPlaceholder: 'Filter...',
          regexLabel: 'RegExp',
          invalidRegex: 'Invalid RegExp',
          noGroup: 'No group',
          groupByPrefix: 'Group by',
          perPageSuffix: ' / page',
          pager: {
            pageInfo: (p, t) => `Page ${p} of ${t}`,
            prev: 'Previous page',
            next: 'Next page',
            first: 'First page',
            last: 'Last page',
            totalRows: n => `${n} row(s)`,
            totalGroups: n => `${n} group(s)`,
          },
          group: { count: 'Count', min: 'min', max: 'max' },
          aria: { toggleGroup: 'Toggle group', expandRow: 'Expand', collapseRow: 'Collapse' },
          export: { button: 'Export', csv: 'CSV', markdown: 'Markdown', format: 'Format' }
        },
        // Tree options
        tree: {
          enabled: false,
          childrenKey: 'children',
          indent: 16,
          lazy: false,
          initiallyExpanded: false,
          hasChildrenKey: 'hasChildren',
        },
        loadChildren: null, // async (row) => children array
        // Remote/server-side options
        serverPagination: false,
        serverSorting: false,
        serverFiltering: false,
  loadPage: null, // async ({page,pageSize,sortKey,sortDir,filter,regexMode}) => { rows, total }
  // Export options
        exporting: {
          enabled: true,
          formats: ['csv', 'md'], // supported: 'csv', 'md'
          scope: 'page', // 'page' | 'all'
          filename: 'vanillagrid'
        },
        // Selection
        selectable: false, // adds a checkbox column and selection API
        onSelectionChange: null, // (selectedRows) => void
        // Column visibility
        columnsMenu: true, // show a simple Columns menu in toolbar
        // New features
        resizableColumns: true, // allow column resizing by dragging borders
        editableRows: false, // enable inline row editing
        rowDragDrop: false, // enable row reordering via drag and drop
        frozenColumns: 0, // number of columns to freeze on the left
        keyboardNavigation: true, // enable arrow key navigation
        contextMenu: true, // enable right-click context menu
        onRowEdit: null, // (row, field, newValue, oldValue) => void
        onRowDrop: null, // (draggedRow, targetRow, position) => void
        customCellTypes: {}, // custom cell renderers: { typeName: renderFunction }
        // Pivot table options
        pivotMode: false, // enable pivot table mode
        pivotConfig: {
          rows: [], // field names for row grouping
          columns: [], // field names for column grouping  
          values: [], // field names for value aggregation
          aggregations: {}, // field -> aggregation function mapping
        },
        onPivotChange: null, // (pivotData, config) => void
      };
      this.opts = Object.assign({}, defaults, options || {});
      if (options && options.tree) this.opts.tree = Object.assign({}, defaults.tree, options.tree);
      this.columns = this.opts.columns;
      this.data = Array.isArray(this.opts.data) ? this.opts.data.slice() : [];

  // Stable row ids for event delegation (deep for tree)
  this._idCounter = 0;
  this._assignIdsDeep(this.data);
  this.rowById = new Map();
  this._indexRowsDeep(this.data);

      // State
      this.state = {
        sortKey: null,
        sortDir: 'asc',
        filter: '',
        regexMode: !!this.opts.regexFilter,
        page: 1,
        pageSize: this.opts.pageSize,
        groupBy: this.opts.groupBy,
        regexError: '',
  collapsed: new Set(), // group value -> collapsed
  // Tree state
  expanded: new Set(), // row id -> expanded
  loadingChildren: new Set(),
  // Remote total (for serverPagination)
  serverTotalRows: null,
        // Selection state
        selected: new Set(), // row ids
        // Column visibility state
        hiddenCols: new Set(),
        // New feature states
        columnWidths: new Map(), // column key -> width in px
        editingCell: null, // { rowId, columnKey }
        draggedRow: null, // row being dragged
        focusedCell: null, // { rowId, columnKey } for keyboard navigation
        // Pivot state
        pivotData: null, // processed pivot table data
        originalData: null, // backup of original data when in pivot mode
        originalColumns: null, // backup of original columns when in pivot mode
      };

      // Root
      this.root = document.createElement('div');
      this.root.className = `vg-container ${this.opts.className}`.trim();
      this.container.innerHTML = '';
      this.container.appendChild(this.root);

      this._render();
    }

    // ------------- Public API ----------------
    setData(data) {
  this.data = Array.isArray(data) ? data.slice() : [];
  this._idCounter = 0;
  this._assignIdsDeep(this.data);
  this.rowById = new Map();
  this._indexRowsDeep(this.data);
      this.state.page = 1;
      this._renderBody();
      this._renderPager();
    }

    getData() { return this.data.slice(); }

    setGroupBy(key) {
      this.state.groupBy = key || null;
      this.state.page = 1;
      this._renderBody();
      this._renderPager();
    }

    setFilter(text, options = {}) {
      this.state.filter = text ?? '';
      if (options.regexMode != null) this.state.regexMode = !!options.regexMode;
      this.state.page = 1;
  this._updateFilterError();
      if (this._shouldRemoteFetch('filter')) {
        this._remoteLoad(1);
      } else {
        this._renderBody();
        this._renderPager();
      }
    }

    setSort(key, dir = 'asc') {
      this.state.sortKey = key;
      this.state.sortDir = dir === 'desc' ? 'desc' : 'asc';
      this._renderHeader();
  if (this._shouldRemoteFetch('sort')) this._remoteLoad(1);
  else this._renderBody();
    }

    setPageSize(size) {
      this.state.pageSize = +size || 10;
      this.state.page = 1;
      this._renderPager();
  if (this._shouldRemoteFetch('page')) this._remoteLoad(1);
  else this._renderBody();
    }

    // -------- Public: Markdown input --------
    setMarkdown(markdown, options = {}) {
      const tables = this._parseMarkdownTables(String(markdown || ''));
      const idx = Math.max(0, Math.min(options.tableIndex || 0, tables.length - 1));
      const table = tables[idx];
      if (!table) {
        // No table found: clear data
        this.columns = [];
        this.setData([]);
        return;
      }
      const keys = this._uniqueKeys(table.headers.map(h => this._slugify(String(h || 'col'))));
      const cols = keys.map((k, i) => ({ key: k, label: table.headers[i], type: 'html', sortable: true }));
      const data = table.rows.map(row => {
        const obj = {};
        row.forEach((cell, i) => obj[keys[i]] = this._mdInlineToHtml(cell));
        return obj;
      });
      this.columns = cols;
      this._renderHeader();
      this.setData(data);
    }

    async loadMarkdown(url, fetchOptions) {
      const res = await fetch(url, fetchOptions);
      const text = await res.text();
      this.setMarkdown(text);
    }

    // -------- Public: Export --------
    downloadCSV(filename) {
      const name = (filename || this.opts.exporting.filename || 'vanillagrid') + '.csv';
      const { headers, rows } = this._exportMatrix();
      const csv = this._toCSV([headers, ...rows]);
      this._downloadBlob(csv, name, 'text/csv;charset=utf-8;');
    }

    downloadMarkdown(filename) {
      const name = (filename || this.opts.exporting.filename || 'vanillagrid') + '.md';
      const { headers, rows } = this._exportMatrix();
      const md = this._toMarkdown(headers, rows);
      this._downloadBlob(md, name, 'text/markdown;charset=utf-8;');
    }

    // -------- Public: New Features API --------
    
    // Row management
    addRow(rowData, index = -1) {
      const newRow = { ...rowData };
      this._assignIdsDeep([newRow]);
      this._indexRowsDeep([newRow]);
      
      if (index >= 0 && index < this.data.length) {
        this.data.splice(index, 0, newRow);
      } else {
        this.data.push(newRow);
      }
      
      this._renderBody();
      this._renderPager();
      return newRow;
    }

    updateRow(rowId, newData) {
      const row = this.rowById.get(rowId);
      if (row) {
        Object.assign(row, newData);
        this._renderBody();
        return row;
      }
      return null;
    }

    deleteRow(rowId) {
      const index = this.data.findIndex(row => row.__vgid === rowId);
      if (index > -1) {
        const deleted = this.data.splice(index, 1)[0];
        this.rowById.delete(rowId);
        this.state.selected.delete(rowId);
        this._renderBody();
        this._renderPager();
        return deleted;
      }
      return null;
    }

    // Column management
    setColumnWidth(columnKey, width) {
      this.state.columnWidths.set(columnKey, width);
      this._renderHeader();
    }

    getColumnWidth(columnKey) {
      return this.state.columnWidths.get(columnKey);
    }

    resetColumnWidths() {
      this.state.columnWidths.clear();
      this._renderHeader();
    }

    // Cell editing
    startEdit(rowId, columnKey) {
      const row = this.root.querySelector(`tr[data-rowid="${rowId}"]`);
      if (row) {
        const cell = row.querySelector(`td[data-column-key="${columnKey}"]`);
        if (cell) {
          this._startCellEdit(cell);
          return true;
        }
      }
      return false;
    }

    // Navigation and focus
    focusCell(rowId, columnKey) {
      const row = this.root.querySelector(`tr[data-rowid="${rowId}"]`);
      if (row) {
        const cell = row.querySelector(`td[data-column-key="${columnKey}"]`);
        if (cell) {
          cell.focus();
          this.state.focusedCell = { rowId, columnKey };
          return true;
        }
      }
      return false;
    }

    // Custom cell type registration
    registerCellType(typeName, renderFunction) {
      this.opts.customCellTypes[typeName] = renderFunction;
    }

    unregisterCellType(typeName) {
      delete this.opts.customCellTypes[typeName];
    }

    // -------- Public: Pivot Table API --------
    
    // Enable pivot mode with configuration
    enablePivot(config = {}) {
      if (!this.opts.pivotMode) {
        // Backup original data and columns
        this.state.originalData = this.data.slice();
        this.state.originalColumns = this.columns.slice();
      }
      
      this.opts.pivotMode = true;
      this.opts.pivotConfig = {
        rows: config.rows || [],
        columns: config.columns || [],
        values: config.values || [],
        filters: config.filters || [],
        aggregations: config.aggregations || {}
      };
      
      this._generatePivotTable();
      this._renderPivotToolbar();
      this._renderHeader();
      this._renderBody();
      this._renderPager();
      
      if (this.opts.onPivotChange) {
        this.opts.onPivotChange(this.state.pivotData, this.opts.pivotConfig);
      }
    }
    
    // Disable pivot mode and restore original data
    disablePivot() {
      if (this.state.originalData && this.state.originalColumns) {
        this.data = this.state.originalData;
        this.columns = this.state.originalColumns;
        this.state.originalData = null;
        this.state.originalColumns = null;
      }
      
      this.opts.pivotMode = false;
      this.state.pivotData = null;
      
      this._renderToolbar();
      this._renderHeader();
      this._renderBody();
      this._renderPager();
    }
    
    // Update pivot configuration
    updatePivotConfig(config) {
      if (!this.opts.pivotMode) return;
      
      Object.assign(this.opts.pivotConfig, config);
      this._generatePivotTable();
      this._updatePivotFieldLists(); // Update UI to show the fields
      this._renderHeader();
      this._renderBody();
      
      if (this.opts.onPivotChange) {
        this.opts.onPivotChange(this.state.pivotData, this.opts.pivotConfig);
      }
    }
    
    // Get pivot table data
    getPivotData() {
      return this.state.pivotData;
    }
    
    // Get available fields for pivot configuration
    getAvailableFields() {
      const originalData = this.state.originalData || this.data;
      if (!originalData.length) return [];
      
      const sample = originalData[0];
      return Object.keys(sample).filter(key => !key.startsWith('__vg'));
    }

    // ------------- Internal: Rendering ----------------
    _render() {
    this.root.innerHTML = `
        <div class="vg-toolbar"></div>
        <div class="vg-table-wrap">
      <table class="vg-table" role="table" aria-label="${this._escAttr(this.opts.i18n.tableLabel)}">
            <thead></thead>
            <tbody></tbody>
          </table>
        </div>
        <div class="vg-pager"></div>
      `;

      this.toolbarEl = this.root.querySelector('.vg-toolbar');
      this.theadEl = this.root.querySelector('thead');
      this.tbodyEl = this.root.querySelector('tbody');
      this.pagerEl = this.root.querySelector('.vg-pager');
      this.tableEl = this.root.querySelector('.vg-table');

      this._renderToolbar();
      this._renderHeader();
      this._bindTableEvents();
      this._bindKeyboardNavigation();
      this._bindContextMenu();
      if (this._shouldRemoteFetch('init')) {
        this._remoteLoad(1);
      } else {
        this._renderBody();
        this._renderPager();
      }
      this._applyColumnVisibility();
    }

    _renderToolbar() {
      // If in pivot mode, render pivot toolbar instead
      if (this.opts.pivotMode) {
        this._renderPivotToolbar();
        return;
      }
      
      const filterable = this.opts.filterable;
      const groupable = this.opts.groupable;
      const i18n = this.opts.i18n;
      const pageSizes = this.opts.pageSizes;

      const groupOptions = [`<option value="">${this._esc(i18n.noGroup)}</option>`]
        .concat(this.columns.map(c =>
          `<option value="${this._esc(c.key)}" ${this.state.groupBy === c.key ? 'selected' : ''}>${this._esc(i18n.groupByPrefix)} ${this._esc(c.label ?? c.key)}</option>`));

      const sizeOptions = pageSizes.map(n =>
        `<option value="${n}" ${+this.state.pageSize === +n ? 'selected' : ''}>${n}${this._esc(i18n.perPageSuffix)}</option>`);

  const exportBlock = (this.opts.exporting && this.opts.exporting.enabled)
        ? `<div class="vg-export">
            <select class="vg-export-format" aria-label="${this._escAttr(i18n.export.format)}">
              ${this.opts.exporting.formats.map(f => f === 'csv'
                ? `<option value="csv">${this._esc(i18n.export.csv)}</option>`
                : `<option value="md">${this._esc(i18n.export.markdown)}</option>`).join('')}
            </select>
    <button class="vg-export-btn" type="button" aria-label="${this._escAttr(i18n.export.button)}" title="${this._escAttr(i18n.export.button)}">${this._esc(i18n.export.button)}</button>
          </div>`
        : '';
      const columnsBlock = (this.opts.columnsMenu !== false)
        ? `<details class="vg-cols">
             <summary class="vg-btn" aria-haspopup="true">Columns</summary>
             <div class="vg-cols-list" role="menu">
               ${this.columns.map(c => {
                  const hidden = this.state.hiddenCols.has(c.key);
                  return `<label style="display:flex;gap:6px;align-items:center;padding:4px 2px;">
                    <input type="checkbox" data-col-toggle value="${this._escAttr(c.key)}" ${hidden ? '' : 'checked'} />
                    <span>${this._esc(c.label ?? c.key)}</span>
                  </label>`;
                }).join('')}
             </div>
           </details>`
        : '';

      this.toolbarEl.innerHTML = `
        <div class="vg-toolbar-row">
          ${filterable ? `
          <div class="vg-filter">
            <input type="text" class="vg-filter-input" placeholder="${this._escAttr(i18n.filterPlaceholder)}" value="${this._escAttr(this.state.filter)}" aria-label="${this._escAttr(i18n.filterPlaceholder)}" />
            <label class="vg-regex">
              <input type="checkbox" class="vg-filter-regex" ${this.state.regexMode ? 'checked':''} />
              ${this._esc(i18n.regexLabel)}
            </label>
            ${this.state.regexError ? `<span class="vg-error" title="${this._escAttr(this.state.regexError)}">${this._esc(i18n.invalidRegex)}</span>` : ''}
          </div>` : ''}
          ${groupable ? `
          <div class="vg-groupby">
            <select class="vg-group-select" aria-label="${this._escAttr(i18n.groupByPrefix)}">
              ${groupOptions.join('')}
            </select>
          </div>` : ''}
          <div class="vg-pagesize">
            <select class="vg-size-select" aria-label="Page size">
              ${sizeOptions.join('')}
            </select>
          </div>
          ${exportBlock}
          ${columnsBlock}
        </div>
      `;

      // Events
      const input = this.toolbarEl.querySelector('.vg-filter-input');
      const chk = this.toolbarEl.querySelector('.vg-filter-regex');
      const selGroup = this.toolbarEl.querySelector('.vg-group-select');
      const selSize = this.toolbarEl.querySelector('.vg-size-select');
  const btnExport = this.toolbarEl.querySelector('.vg-export-btn');
  const selExportFmt = this.toolbarEl.querySelector('.vg-export-format');
      const toggles = this.toolbarEl.querySelectorAll('input[data-col-toggle]');

      if (input) {
        input.oninput = () => {
          this.setFilter(input.value, { regexMode: this.state.regexMode });
        };
      }
      if (chk) {
        chk.onchange = () => {
          this.setFilter(this.state.filter, { regexMode: chk.checked });
        };
      }
      if (selGroup) {
        selGroup.onchange = () => {
          this.state.groupBy = selGroup.value || null;
          this.state.page = 1;
          this.state.collapsed.clear();
          this._renderBody();
          this._renderPager();
        };
      }
      if (selSize) {
        selSize.onchange = () => {
          this.setPageSize(+selSize.value);
        };
      }
      if (btnExport && selExportFmt) {
        btnExport.onclick = () => {
          const fmt = selExportFmt.value;
          if (fmt === 'csv') this.downloadCSV();
          else this.downloadMarkdown();
        };
      }
      if (toggles && toggles.length) {
        toggles.forEach(chk => {
          chk.onchange = () => {
            const key = chk.value;
            if (chk.checked) this.state.hiddenCols.delete(key);
            else this.state.hiddenCols.add(key);
            this._applyColumnVisibility();
          };
        });
      }
    }

    _renderHeader() {
      const { sortKey, sortDir } = this.state;
      const head = document.createElement('tr');
      // Selection header cell
      if (this.opts.selectable) {
        const thSel = document.createElement('th');
        thSel.className = 'vg-th';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.className = 'vg-select-all';
        // Set state from current page
        const pageIds = this._currentPageRowIds();
        const selectedOnPage = pageIds.filter(id => this.state.selected.has(id));
        cb.checked = pageIds.length > 0 && selectedOnPage.length === pageIds.length;
        cb.indeterminate = selectedOnPage.length > 0 && selectedOnPage.length < pageIds.length;
        cb.onchange = () => {
          const ids = this._currentPageRowIds();
          if (cb.checked) ids.forEach(id => this.state.selected.add(id));
          else ids.forEach(id => this.state.selected.delete(id));
          this._renderBody();
          this._renderHeader();
          this._emitSelection();
        };
        thSel.appendChild(cb);
        head.appendChild(thSel);
      }
      this.columns.forEach((col, idx) => {
        const th = document.createElement('th');
        th.setAttribute('role', 'columnheader');
        th.tabIndex = 0;
        th.dataset.key = col.key;
        th.className = 'vg-th';
        
        // Apply custom width if set
        if (this.state.columnWidths.has(col.key)) {
          th.style.width = this.state.columnWidths.get(col.key) + 'px';
        }
        
        if (this.opts.sortable && (col.sortable !== false)) {
          th.classList.add('vg-sortable');
          if (sortKey === col.key) th.classList.add(sortDir === 'asc' ? 'vg-asc' : 'vg-desc');
        }
        let label = this._esc(col.label ?? col.key);
        if (this.opts.tree.enabled && idx === 0) {
          label = `<span class="vg-tree-th-pad"></span>${label}`;
        }
        th.innerHTML = `<span class="vg-th-text">${label}</span>`;
        
        // Add resize handle for resizable columns
        if (this.opts.resizableColumns && idx < this.columns.length - 1) {
          const resizeHandle = document.createElement('div');
          resizeHandle.className = 'vg-resize-handle';
          resizeHandle.dataset.columnKey = col.key;
          th.appendChild(resizeHandle);
        }
        
        if (this.opts.sortable && (col.sortable !== false)) {
          th.setAttribute('aria-sort', (sortKey === col.key) ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none');
        }
        head.appendChild(th);
      });
      this.theadEl.innerHTML = '';
      this.theadEl.appendChild(head);

      // Header sort events
      this.theadEl.querySelectorAll('.vg-th.vg-sortable').forEach(th => {
        th.onclick = (e) => {
          // Don't sort if clicking on resize handle
          if (e.target.closest('.vg-resize-handle')) return;
          
          const key = th.dataset.key;
          if (this.state.sortKey === key) {
            this.state.sortDir = this.state.sortDir === 'asc' ? 'desc' : 'asc';
          } else {
            this.state.sortKey = key;
            this.state.sortDir = 'asc';
          }
          this._renderHeader();
          if (this._shouldRemoteFetch('sort')) this._remoteLoad(1);
          else this._renderBody();
        };
        th.onkeydown = (e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); th.click(); }
        };
      });
      
      // Column resize events
      if (this.opts.resizableColumns) {
        this._bindColumnResize();
      }
    }

    _bindTableEvents() {
      // Button clicks via delegation
      this.tableEl.addEventListener('click', (e) => {
        const btn = e.target.closest('.vg-btn');
        if (btn) {
          const id = btn.dataset.rowid;
          const colKey = btn.dataset.colkey;
          const row = this.rowById.get(Number(id));
          const col = this.columns.find(c => c.key === colKey);
          if (row && col && col.button && typeof col.button.onClick === 'function') {
            col.button.onClick(row, btn);
          }
        }

        // Toggle group collapse
        const grp = e.target.closest('.vg-group-header');
        if (grp) {
          const gval = grp.dataset.groupValue;
          if (this.state.collapsed.has(gval)) this.state.collapsed.delete(gval);
          else this.state.collapsed.add(gval);
          // just toggle the next sibling rows with data-group
          const rows = this.tbodyEl.querySelectorAll(`tr[data-group="${CSS.escape(gval)}"]`);
          const collapsed = this.state.collapsed.has(gval);
          rows.forEach(r => r.style.display = collapsed ? 'none' : '');
          grp.classList.toggle('is-collapsed', collapsed);
          grp.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
        }

        // Tree expand/collapse
        const tog = e.target.closest('.vg-tree-toggle');
        if (tog) {
          const id = Number(tog.dataset.rowid);
          const row = this.rowById.get(id);
          if (!row) return;
          const isExpanded = this.state.expanded.has(id);
          if (isExpanded) {
            this.state.expanded.delete(id);
            this._renderBody();
          } else {
            const needLazy = this.opts.tree.enabled && this.opts.tree.lazy && !this._rowHasChildren(row) && this._rowPotentialChildren(row) && (typeof this.opts.loadChildren === 'function');
            if (needLazy) {
              this.state.loadingChildren.add(id);
              this._renderBody();
              Promise.resolve()
                .then(() => this.opts.loadChildren(row))
                .then(children => {
                  const key = this.opts.tree.childrenKey;
                  row[key] = Array.isArray(children) ? children : [];
                  this._assignIdsDeep(row[key]);
                  this._indexRowsDeep(row[key]);
                })
                .finally(() => {
                  this.state.loadingChildren.delete(id);
                  this.state.expanded.add(id);
                  this._renderBody();
                });
            } else {
              this.state.expanded.add(id);
              this._renderBody();
            }
          }
        }
      });
    }

    // Column resize functionality
    _bindColumnResize() {
      this.theadEl.querySelectorAll('.vg-resize-handle').forEach(handle => {
        handle.addEventListener('mousedown', (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          const columnKey = handle.dataset.columnKey;
          const th = handle.closest('th');
          const startX = e.clientX;
          const startWidth = th.offsetWidth;
          
          const onMouseMove = (e) => {
            const newWidth = Math.max(50, startWidth + (e.clientX - startX));
            this.state.columnWidths.set(columnKey, newWidth);
            th.style.width = newWidth + 'px';
          };
          
          const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            document.body.classList.remove('vg-resizing');
          };
          
          document.addEventListener('mousemove', onMouseMove);
          document.addEventListener('mouseup', onMouseUp);
          document.body.classList.add('vg-resizing');
        });
      });
    }

    // Keyboard navigation functionality
    _bindKeyboardNavigation() {
      if (!this.opts.keyboardNavigation) return;
      
      this.tableEl.addEventListener('keydown', (e) => {
        const cell = e.target.closest('td, th');
        if (!cell) return;
        
        const row = cell.closest('tr');
        const cells = Array.from(row.children);
        const rows = Array.from(this.tbodyEl.children);
        
        let currentCellIndex = cells.indexOf(cell);
        let currentRowIndex = rows.indexOf(row);
        
        switch (e.key) {
          case 'ArrowRight':
            e.preventDefault();
            if (currentCellIndex < cells.length - 1) {
              cells[currentCellIndex + 1].focus();
            }
            break;
          case 'ArrowLeft':
            e.preventDefault();
            if (currentCellIndex > 0) {
              cells[currentCellIndex - 1].focus();
            }
            break;
          case 'ArrowDown':
            e.preventDefault();
            if (currentRowIndex < rows.length - 1) {
              const nextRowCells = Array.from(rows[currentRowIndex + 1].children);
              if (nextRowCells[currentCellIndex]) {
                nextRowCells[currentCellIndex].focus();
              }
            }
            break;
          case 'ArrowUp':
            e.preventDefault();
            if (currentRowIndex > 0) {
              const prevRowCells = Array.from(rows[currentRowIndex - 1].children);
              if (prevRowCells[currentCellIndex]) {
                prevRowCells[currentCellIndex].focus();
              }
            }
            break;
          case 'Enter':
          case 'F2':
            if (this.opts.editableRows) {
              e.preventDefault();
              this._startCellEdit(cell);
            }
            break;
        }
      });
    }

    // Inline editing functionality
    _startCellEdit(cell) {
      const row = cell.closest('tr');
      const rowId = Number(row.dataset.rowid);
      const columnKey = cell.dataset.columnKey;
      const rowData = this.rowById.get(rowId);
      
      if (!rowData || !columnKey) return;
      
      const column = this.columns.find(c => c.key === columnKey);
      if (!column || column.type === 'button' || column.type === 'image') return;
      
      this.state.editingCell = { rowId, columnKey };
      
      const currentValue = rowData[columnKey] || '';
      const input = document.createElement('input');
      input.type = column.type === 'number' ? 'number' : 'text';
      input.value = currentValue;
      input.className = 'vg-edit-input';
      
      cell.innerHTML = '';
      cell.appendChild(input);
      input.focus();
      input.select();
      
      const finishEdit = (save = false) => {
        const newValue = save ? input.value : currentValue;
        if (save && newValue !== currentValue) {
          const oldValue = rowData[columnKey];
          rowData[columnKey] = column.type === 'number' ? Number(newValue) : newValue;
          if (this.opts.onRowEdit) {
            this.opts.onRowEdit(rowData, columnKey, newValue, oldValue);
          }
        }
        this.state.editingCell = null;
        this._renderBody();
      };
      
      input.addEventListener('blur', () => finishEdit(true));
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          finishEdit(true);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          finishEdit(false);
        }
      });
    }

    // Context menu functionality
    _bindContextMenu() {
      if (!this.opts.contextMenu) return;
      
      this.tableEl.addEventListener('contextmenu', (e) => {
        const row = e.target.closest('tr[data-rowid]');
        if (!row) return;
        
        e.preventDefault();
        const rowId = Number(row.dataset.rowid);
        const rowData = this.rowById.get(rowId);
        
        this._showContextMenu(e.clientX, e.clientY, rowData);
      });
    }

    _showContextMenu(x, y, rowData) {
      // Remove existing context menu
      const existing = document.querySelector('.vg-context-menu');
      if (existing) existing.remove();
      
      const menu = document.createElement('div');
      menu.className = 'vg-context-menu';
      menu.style.position = 'fixed';
      menu.style.left = x + 'px';
      menu.style.top = y + 'px';
      menu.style.zIndex = '10000';
      
      const menuItems = [
        { label: 'Copy Row', action: () => this._copyRowToClipboard(rowData) },
        { label: 'Edit Row', action: () => console.log('Edit:', rowData) },
        { label: 'Delete Row', action: () => this._deleteRow(rowData) }
      ];
      
      menuItems.forEach(item => {
        const menuItem = document.createElement('div');
        menuItem.className = 'vg-context-menu-item';
        menuItem.textContent = item.label;
        menuItem.onclick = () => {
          item.action();
          menu.remove();
        };
        menu.appendChild(menuItem);
      });
      
      document.body.appendChild(menu);
      
      // Close menu when clicking outside
      const closeMenu = (e) => {
        if (!menu.contains(e.target)) {
          menu.remove();
          document.removeEventListener('click', closeMenu);
        }
      };
      setTimeout(() => document.addEventListener('click', closeMenu), 0);
    }

    _copyRowToClipboard(rowData) {
      const text = this.columns.map(col => rowData[col.key] || '').join('\t');
      navigator.clipboard?.writeText(text).catch(() => {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      });
    }

    _deleteRow(rowData) {
      const index = this.data.findIndex(row => row === rowData);
      if (index > -1) {
        this.data.splice(index, 1);
        this._renderBody();
        this._renderPager();
      }
    }

    _renderBody() {
  const result = this._process();
      this.tbodyEl.innerHTML = '';

      if (this.opts.tree.enabled) {
        const rows = result.pageFlatRows || [];
        if (rows.length === 0) {
          const tr = document.createElement('tr');
          const td = document.createElement('td');
          td.colSpan = this._colCount();
          td.className = 'vg-empty';
          td.textContent = this.opts.emptyMessage;
          tr.appendChild(td);
          this.tbodyEl.appendChild(tr);
          return;
        }
        rows.forEach(meta => {
          this.tbodyEl.appendChild(this._renderRow(meta.row, meta.depth, meta));
        });
      } else if (!result.hasGroups) {
        const rows = result.pageRows;
        if (rows.length === 0) {
          const tr = document.createElement('tr');
          const td = document.createElement('td');
          td.colSpan = this._colCount();
          td.className = 'vg-empty';
          td.textContent = this.opts.emptyMessage;
          tr.appendChild(td);
          this.tbodyEl.appendChild(tr);
          return;
        }
        rows.forEach(row => {
          this.tbodyEl.appendChild(this._renderRow(row));
        });
      } else {
        const groups = result.pageGroups;
        if (groups.length === 0) {
          const tr = document.createElement('tr');
          const td = document.createElement('td');
          td.colSpan = this._colCount();
          td.className = 'vg-empty';
          td.textContent = this.opts.emptyMessage;
          tr.appendChild(td);
          this.tbodyEl.appendChild(tr);
          return;
        }
        groups.forEach(g => {
          // Group header
          const trh = document.createElement('tr');
          trh.className = 'vg-group';
          const tdh = document.createElement('td');
          tdh.colSpan = this._colCount();
          const collapsed = this.state.collapsed.has(g.value);
          tdh.innerHTML = `
            <button class="vg-group-header ${collapsed ? 'is-collapsed':''}" data-group-value="${this._escAttr(g.value)}" title="${this._escAttr(this.opts.i18n.aria.toggleGroup)}" aria-expanded="${collapsed ? 'false' : 'true'}">
              <span class="vg-caret" aria-hidden="true"></span>
              <span class="vg-group-title">${this._esc(this._headerLabelForGroup(g))}</span>
            </button>
            ${this._renderAggSummary(g)}
          `;
          trh.appendChild(tdh);
          this.tbodyEl.appendChild(trh);
          g.rows.forEach(row => {
            const tr = this._renderRow(row);
            tr.dataset.group = g.value;
            if (collapsed) tr.style.display = 'none';
            this.tbodyEl.appendChild(tr);
          });
        });
      }

      // After body render, update header select-all state and apply column visibility
      this._updateHeaderSelectionToggle();
      this._applyColumnVisibility();
    }

    // -------- Internal: Markdown helpers --------
    _parseMarkdownTables(md) {
      const lines = md.split(/\r?\n/);
      const tables = [];
      let i = 0;
      const isSep = (s) => /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(s);
      const splitRow = (s) => {
        // Split by pipe, ignoring escaped \| and trim
        const cells = [];
        let cur = '';
        let esc = false;
        // strip leading/trailing pipe
        s = s.replace(/^\s*\|?\s*/, '').replace(/\s*\|?\s*$/, '');
        for (let ch of s) {
          if (esc) { cur += ch; esc = false; continue; }
          if (ch === '\\') { esc = true; continue; }
          if (ch === '|') { cells.push(cur.trim()); cur = ''; continue; }
          cur += ch;
        }
        cells.push(cur.trim());
        return cells;
      };

      while (i < lines.length) {
        // Find header row
        while (i < lines.length && !/\|/.test(lines[i])) i++;
        if (i >= lines.length) break;
        const headerLine = lines[i++];
        if (i >= lines.length) break;
        const sepLine = lines[i];
        if (!isSep(sepLine)) continue;
        i++; // consume sep
        const headers = splitRow(headerLine);
        const rows = [];
        while (i < lines.length && /\|/.test(lines[i]) && !/^\s*$/.test(lines[i])) {
          const row = splitRow(lines[i]);
          if (row.length >= 1) rows.push(row);
          i++;
        }
        // Normalize row lengths
        const width = headers.length;
        const normRows = rows.map(r => {
          const a = r.slice(0, width);
          while (a.length < width) a.push('');
          return a;
        });
        tables.push({ headers, rows: normRows });
      }
      return tables;
    }

    _mdInlineToHtml(src) {
      // safe-escape first
      let s = String(src ?? '');
      s = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      // images ![alt](url)
      s = s.replace(/!\[([^\]]*)\]\(([^\)\s]+)(?:\s+"([^"]+)")?\)/g, (m, alt, url) =>
        `<img src="${this._escAttr(url)}" alt="${this._escAttr(alt)}" loading="lazy" class="vg-img" />`);
      // links [text](url)
      s = s.replace(/\[([^\]]+)\]\(([^\)\s]+)(?:\s+"([^"]+)")?\)/g, (m, text, url) =>
        `<a href="${this._escAttr(url)}" target="_blank" rel="noopener noreferrer" class="vg-link">${text}</a>`);
      // bold/italic/code
      s = s.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
           .replace(/\*([^*]+)\*/g, '<i>$1</i>')
           .replace(/`([^`]+)`/g, '<code>$1</code>');
      return s;
    }

    _slugify(s) {
      return String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'col';
    }

    _uniqueKeys(keys) {
      const out = [];
      const seen = new Map();
      keys.forEach(k => {
        let base = k || 'col';
        let n = seen.get(base) || 0;
        let cur = base;
        if (n > 0) cur = `${base}_${n}`;
        seen.set(base, n + 1);
        out.push(cur);
      });
      return out;
    }

    // -------- Internal: Export helpers --------
    _exportMatrix() {
      // Determine data scope and current pipeline
      const cols = this.columns.filter(c => !this.state.hiddenCols.has(c.key));
      const headers = cols.map(c => String(c.label ?? c.key));
      const scope = (this.opts.exporting && this.opts.exporting.scope) || 'page';

      if (this.opts.tree.enabled) {
        const flat = this._filterSortTreeFlatten();
        const list = scope === 'page'
          ? flat.slice((this.state.page - 1) * this.state.pageSize, (this.state.page - 1) * this.state.pageSize + this.state.pageSize)
          : flat;
        const rows = list.map(meta => cols.map(c => this._cellText(meta.row, c)));
        return { headers, rows };
      }

      const { rows, groups, hasGroups } = this._filterSortGroup();
      if (!hasGroups) {
        const view = scope === 'page'
          ? rows.slice((this.state.page - 1) * this.state.pageSize, (this.state.page - 1) * this.state.pageSize + this.state.pageSize)
          : rows;
        const out = view.map(r => cols.map(c => this._cellText(r, c)));
        return { headers, rows: out };
      } else {
        const viewGroups = scope === 'page'
          ? groups.slice((this.state.page - 1) * this.state.pageSize, (this.state.page - 1) * this.state.pageSize + this.state.pageSize)
          : groups;
        const out = [];
        viewGroups.forEach(g => {
          g.rows.forEach(r => out.push(cols.map(c => this._cellText(r, c))));
        });
        return { headers, rows: out };
      }
    }

    _toCSV(matrix) {
      const esc = (s) => {
        const v = String(s ?? '');
        if (/[",\n]/.test(v)) return '"' + v.replace(/"/g, '""') + '"';
        return v;
      };
      return matrix.map(row => row.map(esc).join(',')).join('\n');
    }

    _toMarkdown(headers, rows) {
      const line = arr => '| ' + arr.map(s => String(s ?? '').replace(/\n/g, ' ')).join(' | ') + ' |';
      const sep = '| ' + headers.map(() => '---').join(' | ') + ' |';
      return [line(headers), sep, ...rows.map(line)].join('\n');
    }

    _downloadBlob(text, filename, mime) {
      const blob = new Blob([text], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 0);
    }

    _renderRow(row, depth = 0, meta = null) {
      const tr = document.createElement('tr');
      tr.className = 'vg-tr';
      tr.dataset.rowid = row.__vgid;
      if (this.opts.selectable) {
        const tdSel = document.createElement('td');
        tdSel.className = 'vg-td vg-td-select';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.className = 'vg-select-row';
        cb.checked = this.state.selected.has(row.__vgid);
        cb.onchange = () => {
          if (cb.checked) this.state.selected.add(row.__vgid);
          else this.state.selected.delete(row.__vgid);
          this._updateHeaderSelectionToggle();
          this._emitSelection();
        };
        tdSel.appendChild(cb);
        tr.appendChild(tdSel);
      }
      this.columns.forEach((col, idx) => {
        const td = document.createElement('td');
        td.className = 'vg-td';
        td.dataset.key = col.key;
        td.dataset.columnKey = col.key; // For editing support
        td.tabIndex = this.opts.keyboardNavigation ? 0 : -1; // For keyboard navigation
        if (this.opts.tree.enabled && idx === 0) {
          td.classList.add('vg-tree-cell');
          const toggle = this._renderTreeToggle(row, meta);
          if (toggle) td.appendChild(toggle);
        }
        this._renderCell(td, row, col);
        tr.appendChild(td);
      });
      return tr;
    }

    _renderCell(td, row, col) {
      if (typeof col.render === 'function') {
        td.innerHTML = '';
        const el = col.render(row[col.key], row, col);
        if (el instanceof Node) td.appendChild(el);
        else td.innerHTML = el ?? '';
        return;
      }

      const type = (col.type || 'text').toLowerCase();
      const value = row[col.key];
      const hasToggle = !!td.querySelector && !!td.querySelector('.vg-tree-toggle');

      switch (type) {
        case 'number': {
          const num = this._toNumber(value);
          const content = (typeof col.format === 'function') ? col.format(num, row) : (num ?? '');
          if (hasToggle) {
            const span = document.createElement('span');
            span.textContent = content;
            td.appendChild(span);
          } else {
            td.textContent = content;
          }
          td.classList.add('vg-num');
          break;
        }
        case 'html': {
          if (hasToggle) {
            const span = document.createElement('span');
            span.innerHTML = value ?? '';
            td.appendChild(span);
          } else {
            td.innerHTML = value ?? '';
          }
          break;
        }
        case 'image': {
          const img = document.createElement('img');
          img.src = String(value || '');
          img.alt = (col.image && col.image.alt) || '';
          if (col.image && col.image.width) img.width = col.image.width;
          if (col.image && col.image.height) img.height = col.image.height;
          img.loading = 'lazy';
          img.className = 'vg-img';
          td.appendChild(img);
          break;
        }
        case 'link': {
          const a = document.createElement('a');
          const url = String(value || '');
          const txt = (col.link && col.link.text) || url;
          a.href = url;
          a.target = (col.link && col.link.target) || '_blank';
          a.rel = 'noopener noreferrer';
          a.textContent = txt;
          a.className = 'vg-link';
          td.appendChild(a);
          break;
        }
        case 'button': {
          const btn = document.createElement('button');
          btn.className = 'vg-btn';
          btn.dataset.rowid = row.__vgid;
          btn.dataset.colkey = col.key;
          btn.type = 'button';
          btn.textContent = (col.button && col.button.text) || 'Action';
          td.appendChild(btn);
          break;
        }
        case 'progress': {
          const percent = Math.max(0, Math.min(100, Number(value) || 0));
          const progressContainer = document.createElement('div');
          progressContainer.className = 'vg-progress';
          
          const progressBar = document.createElement('div');
          progressBar.className = 'vg-progress-bar';
          progressBar.style.width = percent + '%';
          
          const progressText = document.createElement('span');
          progressText.className = 'vg-progress-text';
          progressText.textContent = percent + '%';
          
          progressContainer.appendChild(progressBar);
          progressContainer.appendChild(progressText);
          td.appendChild(progressContainer);
          break;
        }
        case 'rating': {
          const rating = Math.max(0, Math.min(5, Number(value) || 0));
          const ratingSpan = document.createElement('span');
          ratingSpan.className = 'vg-rating';
          ratingSpan.title = rating + '/5';
          ratingSpan.textContent = '★'.repeat(Math.floor(rating)) + '☆'.repeat(5 - Math.floor(rating));
          td.appendChild(ratingSpan);
          break;
        }
        case 'badge': {
          const badgeClass = row[col.key + '_class'] || 'default';
          const badge = document.createElement('span');
          badge.className = `vg-badge vg-badge-${badgeClass}`;
          badge.textContent = value || '';
          td.appendChild(badge);
          break;
        }
        case 'color': {
          const colorDiv = document.createElement('div');
          colorDiv.className = 'vg-color-indicator';
          colorDiv.style.backgroundColor = value || '';
          colorDiv.title = value || '';
          td.appendChild(colorDiv);
          break;
        }
        default: {
          // Check for custom cell types
          if (this.opts.customCellTypes[type]) {
            const customHtml = this.opts.customCellTypes[type](value, col, row);
            if (hasToggle) {
              const span = document.createElement('span');
              span.innerHTML = customHtml;
              td.appendChild(span);
            } else {
              td.innerHTML = customHtml;
            }
          } else {
            // text (safe)
            const txt = (typeof col.format === 'function') ? col.format(value, row) : (value ?? '');
            if (hasToggle) {
              const span = document.createElement('span');
              span.textContent = txt;
              td.appendChild(span);
            } else {
              td.textContent = txt;
            }
          }
        }
      }
    }

    _renderTreeToggle(row, meta) {
      const t = this.opts.tree;
      if (!t.enabled) return null;
      const hasKids = (meta && meta.hasChildren != null)
        ? meta.hasChildren
        : (this._rowHasChildren(row) || this._rowPotentialChildren(row));
      const isLeaf = !hasKids;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'vg-tree-toggle';
      btn.dataset.rowid = row.__vgid;
      const depth = meta?.depth || 0;
      btn.style.marginLeft = `${(Number(t.indent) || 16) * depth}px`;
      if (isLeaf) {
        btn.classList.add('is-leaf');
        btn.innerHTML = '<span class="vg-tree-spacer"></span>';
        btn.disabled = true;
        return btn;
      }
      const loading = this.state.loadingChildren.has(row.__vgid);
      const expanded = this.state.expanded.has(row.__vgid);
  btn.classList.toggle('is-expanded', expanded);
      btn.classList.toggle('is-loading', loading);
  btn.setAttribute('aria-label', expanded ? this.opts.i18n.aria.collapseRow : this.opts.i18n.aria.expandRow);
  btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      btn.innerHTML = loading ? '<span class="vg-spinner"></span>' : '<span class="vg-caret" aria-hidden="true"></span>';
      return btn;
    }

    _renderAggSummary(group) {
      // Build a concise summary pill line: Count + per-column aggregates defined
      const count = group.rows.length;
  const parts = [`<span class="vg-chip">${this._esc(this.opts.i18n.group.count)}: ${count}</span>`];

      const numericCols = this.columns.filter(c => Array.isArray(c.aggregations) && c.aggregations.length);
      numericCols.forEach(col => {
        const ag = group.aggregates[col.key] || {};
        const want = col.aggregations;
        const bits = [];
        if (want.includes('sum') && ag.sum != null) bits.push(`Σ ${this._fmtAgg(col, ag.sum)}`);
        if (want.includes('min') && ag.min != null) bits.push(`min ${this._fmtAgg(col, ag.min)}`);
        if (want.includes('max') && ag.max != null) bits.push(`max ${this._fmtAgg(col, ag.max)}`);
        if (bits.length) {
          parts.push(`<span class="vg-chip">${this._esc(col.label ?? col.key)}: ${this._esc(bits.join(' · '))}</span>`);
        }
      });
      return parts.length ? `<div class="vg-agg">${parts.join('')}</div>` : '';
    }

    _fmtAgg(col, value) {
      if (typeof col.format === 'function') {
        try { return col.format(value); } catch { return String(value); }
      }
      return (typeof value === 'number') ? value : String(value);
    }

    _headerLabelForGroup(g) {
      const col = this.columns.find(c => c.key === this.state.groupBy);
      const label = col ? (col.label ?? col.key) : this.state.groupBy;
      return `${label}: ${g.value}`;
    }

    _renderPager() {
      if (!this.opts.pagination) { this.pagerEl.innerHTML = ''; return; }
  const remote = this.opts.serverPagination;
  const { hasGroups, totalPages, totalCount } = remote ? this._processMetaRemote() : this._processMeta();
      const page = Math.min(this.state.page, totalPages || 1);

      const prevDisabled = page <= 1 ? 'disabled' : '';
      const nextDisabled = page >= totalPages ? 'disabled' : '';
      const firstDisabled = prevDisabled;
      const lastDisabled = nextDisabled;

    this.pagerEl.innerHTML = `
        <div class="vg-pager-row">
      <div class="vg-pager-left">
        <button class="vg-page-btn" data-action="first" ${firstDisabled} aria-label="${this._escAttr(this.opts.i18n.pager.first)}" title="${this._escAttr(this.opts.i18n.pager.first)}">«</button>
        <button class="vg-page-btn" data-action="prev" ${prevDisabled} aria-label="${this._escAttr(this.opts.i18n.pager.prev)}" title="${this._escAttr(this.opts.i18n.pager.prev)}">‹</button>
      </div>
      <span class="vg-page-info" aria-live="polite">${this._esc(this.opts.i18n.pager.pageInfo(page, totalPages || 1))}</span>
      <div class="vg-pager-right">
        <button class="vg-page-btn" data-action="next" ${nextDisabled} aria-label="${this._escAttr(this.opts.i18n.pager.next)}" title="${this._escAttr(this.opts.i18n.pager.next)}">›</button>
        <button class="vg-page-btn" data-action="last" ${lastDisabled} aria-label="${this._escAttr(this.opts.i18n.pager.last)}" title="${this._escAttr(this.opts.i18n.pager.last)}">»</button>
      </div>
      <span class="vg-total">${this._esc(hasGroups ? this.opts.i18n.pager.totalGroups(totalCount) : this.opts.i18n.pager.totalRows(totalCount))}</span>
        </div>
      `;

      this.state.page = page; // clamp

    this.pagerEl.querySelector('[data-action="first"]').onclick = () => {
        if (this.state.page !== 1) {
          this.state.page = 1;
      if (remote) this._remoteLoad(this.state.page);
      else { this._renderBody(); this._renderPager(); }
        }
      };
    this.pagerEl.querySelector('[data-action="prev"]').onclick = () => {
        if (this.state.page > 1) {
          this.state.page--;
      if (remote) this._remoteLoad(this.state.page);
      else { this._renderBody(); this._renderPager(); }
        }
      };
    this.pagerEl.querySelector('[data-action="next"]').onclick = () => {
        if (this.state.page < totalPages) {
          this.state.page++;
      if (remote) this._remoteLoad(this.state.page);
      else { this._renderBody(); this._renderPager(); }
        }
      };
    this.pagerEl.querySelector('[data-action="last"]').onclick = () => {
        if (this.state.page !== totalPages) {
          this.state.page = totalPages;
      if (remote) this._remoteLoad(this.state.page);
      else { this._renderBody(); this._renderPager(); }
        }
      };
    }

    // ------------- Internal: Data pipeline ----------------
    _processMeta() {
      if (this.opts.tree.enabled) {
        const flat = this._filterSortTreeFlatten();
        const totalCount = flat.length;
        const totalPages = Math.max(1, Math.ceil(totalCount / this.state.pageSize));
        return { hasGroups: false, totalPages, totalCount };
      }
      const { rows, groups, hasGroups } = this._filterSortGroup();
      if (!this.opts.pagination) {
        return { hasGroups, totalPages: 1, totalCount: hasGroups ? groups.length : rows.length };
      }
      const totalCount = hasGroups ? groups.length : rows.length;
      const totalPages = Math.max(1, Math.ceil(totalCount / this.state.pageSize));
      return { hasGroups, totalPages, totalCount };
    }

    _process() {
      if (this.opts.tree.enabled) {
        const flat = this._filterSortTreeFlatten();
        if (!this.opts.pagination) return { hasGroups: false, pageFlatRows: flat };
        const { page, pageSize } = this.state;
        const start = (page - 1) * pageSize;
        return { hasGroups: false, pageFlatRows: flat.slice(start, start + pageSize) };
      }
      const { rows, groups, hasGroups } = this._filterSortGroup();
      if (!this.opts.pagination) {
        return hasGroups
          ? { hasGroups, pageGroups: groups }
          : { hasGroups, pageRows: rows };
      }
      const { page, pageSize } = this.state;
      if (!hasGroups) {
        const start = (page - 1) * pageSize;
        const pageRows = rows.slice(start, start + pageSize);
        return { hasGroups, pageRows };
      } else {
        const start = (page - 1) * pageSize;
        const pageGroups = groups.slice(start, start + pageSize);
        return { hasGroups, pageGroups };
      }
    }

    _filterSortTreeFlatten() {
      const t = this.opts.tree;
      const ck = t.childrenKey;
      const roots = this.data.slice();

      // Sort client-side if allowed
      const { sortKey, sortDir } = this.state;
      const col = sortKey ? this.columns.find(c => c.key === sortKey) : null;
      const type = (col?.type || 'text').toLowerCase();
      const doSort = this.opts.sortable && col && !this.opts.serverSorting;
      const cmpVal = (a, b) => this._compare(a, b, type, col || {});
      const sortNodes = (nodes) => {
        if (!Array.isArray(nodes)) return;
        if (doSort) {
          const dir = sortDir === 'desc' ? -1 : 1;
          nodes.sort((ra, rb) => dir * cmpVal(ra[sortKey], rb[sortKey]));
        }
        nodes.forEach(n => sortNodes(n[ck]));
      };
      sortNodes(roots);

      // Filter
      const f = String(this.state.filter || '');
      let matcher = null;
      if (f) {
        if (this.state.regexMode) {
          try { matcher = { type: 'regex', rx: new RegExp(f, 'i') }; this.state.regexError = ''; }
          catch (err) { this.state.regexError = String(err?.message || 'Invalid RegExp'); }
        } else { this.state.regexError = ''; matcher = { type: 'text', needle: f.toLowerCase() }; }
      }
      // Update error feedback without re-rendering toolbar to preserve focus
      this._updateFilterError();
      const matchesRow = (row) => {
        if (!matcher) return true;
        if (matcher.type === 'regex') return this.columns.some(c => matcher.rx.test(this._cellText(row, c)));
        const needle = matcher.needle;
        return this.columns.some(c => this._cellText(row, c).toLowerCase().includes(needle));
      };

      const visible = new Set();
      const mark = (node, parents) => {
        const kids = Array.isArray(node[ck]) ? node[ck] : [];
        let ok = matchesRow(node);
        kids.forEach(ch => { if (mark(ch, parents.concat(node))) ok = true; });
        if (!matcher || ok) {
          visible.add(node);
          parents.forEach(p => visible.add(p));
        }
        return ok;
      };
      roots.forEach(r => mark(r, []));

      const flat = [];
      const trav = (nodes, depth) => {
        if (!Array.isArray(nodes)) return;
        nodes.forEach(n => {
          if (!visible.has(n)) return;
          const id = n.__vgid;
          const hasChildren = this._rowHasChildren(n) || this._rowPotentialChildren(n);
          const expanded = this.state.expanded.has(id) || !!matcher || this.opts.tree.initiallyExpanded;
          flat.push({ row: n, depth, hasChildren, expanded });
          if (expanded && Array.isArray(n[ck])) trav(n[ck], depth + 1);
        });
      };
      trav(roots, 0);
      return flat;
    }

    // Tree/id helpers and remote
    _assignIdsDeep(list) {
      if (!Array.isArray(list)) return;
      const ck = this.opts.tree.childrenKey;
      list.forEach(row => {
        if (row.__vgid == null) row.__vgid = this._idCounter++;
        if (Array.isArray(row[ck])) this._assignIdsDeep(row[ck]);
      });
    }
    _indexRowsDeep(list) {
      if (!Array.isArray(list)) return;
      const ck = this.opts.tree.childrenKey;
      list.forEach(row => {
        this.rowById.set(row.__vgid, row);
        if (Array.isArray(row[ck])) this._indexRowsDeep(row[ck]);
      });
    }
    _rowHasChildren(row) {
      const ck = this.opts.tree.childrenKey;
      return Array.isArray(row?.[ck]) && row[ck].length > 0;
    }
    _rowPotentialChildren(row) {
      const hk = this.opts.tree.hasChildrenKey;
      return !!row && !!row[hk];
    }
    _shouldRemoteFetch(why) {
      if (typeof this.opts.loadPage !== 'function') return false;
      if (this.opts.serverPagination) return true;
      if (this.opts.serverSorting && why === 'sort') return true;
      if (this.opts.serverFiltering && why === 'filter') return true;
      if (why === 'init') return this.opts.serverPagination || this.opts.serverSorting || this.opts.serverFiltering;
      if (why === 'page') return this.opts.serverPagination;
      return false;
    }
    _processMetaRemote() {
      const total = this.state.serverTotalRows ?? this.data.length;
      const totalPages = Math.max(1, Math.ceil(total / this.state.pageSize));
      return { hasGroups: false, totalPages, totalCount: total };
    }
    _remoteLoad(page) {
      if (typeof this.opts.loadPage !== 'function') { this._renderBody(); this._renderPager(); return; }
      const params = {
        page: page || this.state.page || 1,
        pageSize: this.state.pageSize,
        sortKey: this.state.sortKey,
        sortDir: this.state.sortDir,
        filter: this.state.filter,
        regexMode: this.state.regexMode,
      };
      Promise.resolve(this.opts.loadPage(params)).then(res => {
        const rows = Array.isArray(res?.rows) ? res.rows : [];
        const total = Number.isFinite(res?.total) ? res.total : rows.length;
        this._idCounter = 0;
        this._assignIdsDeep(rows);
        this.data = rows;
        this.rowById = new Map();
        this._indexRowsDeep(this.data);
        this.state.serverTotalRows = total;
        this.state.page = params.page;
      }).finally(() => {
        this._renderBody();
        this._renderPager();
      });
    }

    _filterSortGroup() {
      let rows = this.data.slice();

      // Filter
      const f = String(this.state.filter || '');
      if (f) {
        if (this.state.regexMode) {
          try {
            const rx = new RegExp(f, 'i');
            this.state.regexError = '';
            rows = rows.filter(r => this.columns.some(c => rx.test(this._cellText(r, c))));
          } catch (err) {
            this.state.regexError = String(err?.message || 'Invalid RegExp');
          }
        } else {
          this.state.regexError = '';
          const needle = f.toLowerCase();
          rows = rows.filter(r => this.columns.some(c => this._cellText(r, c).toLowerCase().includes(needle)));
        }
  this._updateFilterError(); // show/hide regex error state without full re-render
      }

      // Sort
      const { sortKey, sortDir } = this.state;
      if (sortKey) {
        const col = this.columns.find(c => c.key === sortKey);
        if (col) {
          const dir = sortDir === 'desc' ? -1 : 1;
          const type = (col.type || 'text').toLowerCase();
          const cmp = (a, b) => this._compare(a, b, type, col);
          rows.sort((ra, rb) => dir * cmp(ra[col.key], rb[col.key]));
        }
      }

      // Group
      const key = this.state.groupBy;
      if (!key) return { hasGroups: false, rows };

      const map = new Map();
      rows.forEach(r => {
        const k = r[key] == null ? '(null)' : String(r[key]);
        if (!map.has(k)) map.set(k, []);
        map.get(k).push(r);
      });

      const groupList = [];
      for (const [gval, list] of map.entries()) {
        groupList.push({
          value: gval,
          rows: list,
          aggregates: this._computeAggregates(list),
        });
      }

      // Keep group order stable based on first-row order
      // (already stable because rows are sorted; we iterate map in insertion order)
      return { hasGroups: true, groups: groupList };
    }

    _computeAggregates(rows) {
      const out = {};
      this.columns.forEach(col => {
        if (!Array.isArray(col.aggregations) || col.aggregations.length === 0) return;
        const nums = rows
          .map(r => this._toNumber(r[col.key]))
          .filter(v => typeof v === 'number' && !Number.isNaN(v));
        if (!nums.length) return;
        const agg = {};
        if (col.aggregations.includes('sum')) agg.sum = nums.reduce((a, b) => a + b, 0);
        if (col.aggregations.includes('min')) agg.min = Math.min(...nums);
        if (col.aggregations.includes('max')) agg.max = Math.max(...nums);
        out[col.key] = agg;
      });
      return out;
    }

    // ------------- Internal: helpers ----------------
    _cellText(row, col) {
      if (typeof col.render === 'function') {
        try {
          const el = col.render(row[col.key], row, col);
          if (el instanceof Node) return (el.textContent || '').trim();
          return String(el ?? '');
        } catch { return ''; }
      }
      const type = (col.type || 'text').toLowerCase();
      const val = row[col.key];
      switch (type) {
        case 'number': return String(this._toNumber(val) ?? '');
        case 'html': {
          const tmp = document.createElement('div');
          tmp.innerHTML = String(val ?? '');
          return (tmp.textContent || '').trim();
        }
        case 'image': return String(val ?? '');
        case 'link': {
          const url = String(val ?? '');
          const txt = (col.link && col.link.text) || url;
          return txt + ' ' + url;
        }
        case 'button': return (col.button && col.button.text) || 'Action';
        default: return String(val ?? '');
      }
    }

    _compare(a, b, type, col) {
      if (typeof col.sort === 'function') {
        try { return col.sort(a, b); } catch { /* fallthrough */ }
      }
      if (a == null && b == null) return 0;
      if (a == null) return -1;
      if (b == null) return 1;

      switch (type) {
        case 'number': {
          const na = this._toNumber(a), nb = this._toNumber(b);
          return (na === nb) ? 0 : (na < nb ? -1 : 1);
        }
        case 'html': {
          const ta = this._stripHtml(String(a)), tb = this._stripHtml(String(b));
          return ta.localeCompare(tb, undefined, { sensitivity: 'base', numeric: true });
        }
        default: {
          const sa = String(a), sb = String(b);
          return sa.localeCompare(sb, undefined, { sensitivity: 'base', numeric: true });
        }
      }
    }

    _toNumber(v) {
      if (typeof v === 'number') return v;
      if (typeof v === 'string') {
        const s = v.replace(/[^\d.+-]/g, '');
        const n = parseFloat(s);
        return Number.isNaN(n) ? undefined : n;
      }
      return undefined;
    }

    _stripHtml(s) { return s.replace(/<[^>]*>/g, ''); }
    _esc(s) { return String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
    _escAttr(s) { return this._esc(s).replace(/"/g, '&quot;'); }

    // Lightweight toolbar update to avoid focus loss while typing
    _updateFilterError() {
      if (!this.opts.filterable || !this.toolbarEl) return;
      const wrap = this.toolbarEl.querySelector('.vg-filter');
      if (!wrap) return;
      const existing = wrap.querySelector('.vg-error');
      const need = this.state.regexMode && !!this.state.regexError;
      if (need) {
        if (!existing) {
          const span = document.createElement('span');
          span.className = 'vg-error';
          span.title = this.state.regexError;
          span.textContent = this.opts.i18n.invalidRegex;
          wrap.appendChild(span);
        } else {
          existing.title = this.state.regexError;
          existing.textContent = this.opts.i18n.invalidRegex;
        }
      } else if (existing) {
        existing.remove();
      }
    }

    // ---- Internal: selection and columns helpers ----
    _colCount() { return this.columns.length + (this.opts.selectable ? 1 : 0); }
    _currentPageRowIds() {
      const ids = [];
      if (this.opts.tree.enabled) {
        const res = this._process();
        (res.pageFlatRows || []).forEach(meta => ids.push(meta.row.__vgid));
      } else {
        const { hasGroups, pageRows, pageGroups } = this._process();
        if (!hasGroups) (pageRows || []).forEach(r => ids.push(r.__vgid));
        else (pageGroups || []).forEach(g => g.rows.forEach(r => ids.push(r.__vgid)));
      }
      return ids;
    }
    _updateHeaderSelectionToggle() {
      if (!this.opts.selectable) return;
      const cb = this.theadEl.querySelector('.vg-select-all');
      if (!cb) return;
      const pageIds = this._currentPageRowIds();
      const selectedOnPage = pageIds.filter(id => this.state.selected.has(id));
      cb.checked = pageIds.length > 0 && selectedOnPage.length === pageIds.length;
      cb.indeterminate = selectedOnPage.length > 0 && selectedOnPage.length < pageIds.length;
    }
    _emitSelection() {
      if (typeof this.opts.onSelectionChange === 'function') {
        const rows = Array.from(this.state.selected).map(id => this.rowById.get(id)).filter(Boolean);
        try { this.opts.onSelectionChange(rows); } catch {}
      }
    }
    _applyColumnVisibility() {
      const hidden = this.state.hiddenCols;
      // Header
      this.theadEl.querySelectorAll('.vg-th').forEach(th => {
        const key = th.dataset.key;
        if (!key) return;
        th.style.display = hidden.has(key) ? 'none' : '';
      });
      // Body cells
      this.tbodyEl.querySelectorAll('.vg-td').forEach(td => {
        const key = td.dataset.key;
        if (!key) return;
        td.style.display = hidden.has(key) ? 'none' : '';
      });
    }

    // ---- Pivot Table Internal Methods ----
    
    _generatePivotTable() {
      const sourceData = this.state.originalData || this.data;
      const config = this.opts.pivotConfig;
      
      if (!config.rows.length && !config.columns.length) {
        // No pivot configuration, show summary of values
        this._generatePivotSummary(sourceData, config);
        return;
      }
      
      // Group data by row fields
      const rowGroups = this._groupByFields(sourceData, config.rows);
      
      // Get unique column values
      const columnValues = config.columns.length 
        ? this._getUniqueValues(sourceData, config.columns)
        : [null];
      
      // Generate pivot table structure
      const pivotRows = [];
      
      Object.entries(rowGroups).forEach(([rowKey, rowData]) => {
        const row = {};
        
        // Add row group labels
        const rowKeys = rowKey.split('|');
        config.rows.forEach((field, i) => {
          row[field] = rowKeys[i] || '';
        });
        
        // Calculate values for each column combination
        columnValues.forEach(colKey => {
          const filteredData = colKey 
            ? rowData.filter(item => this._getFieldPath(item, config.columns) === colKey)
            : rowData;
          
          config.values.forEach(valueField => {
            const aggFunc = config.aggregations[valueField] || 'sum';
            const colName = colKey ? `${valueField}_${colKey}` : valueField;
            row[colName] = this._aggregate(filteredData, valueField, aggFunc);
          });
        });
        
        pivotRows.push(row);
      });
      
      // Generate columns for pivot table
      const pivotColumns = [];
      
      // Add row field columns
      config.rows.forEach(field => {
        pivotColumns.push({
          key: field,
          label: this._getFieldLabel(field),
          type: 'text',
          sortable: true
        });
      });
      
      // Add value columns for each column combination
      columnValues.forEach(colKey => {
        config.values.forEach(valueField => {
          const colName = colKey ? `${valueField}_${colKey}` : valueField;
          const label = colKey 
            ? `${this._getFieldLabel(valueField)} (${colKey})`
            : this._getFieldLabel(valueField);
          
          pivotColumns.push({
            key: colName,
            label: label,
            type: 'number',
            sortable: true,
            format: this._getNumberFormatter(valueField)
          });
        });
      });
      
      this.state.pivotData = { rows: pivotRows, columns: pivotColumns };
      this.data = pivotRows;
      this.columns = pivotColumns;
    }
    
    _generatePivotSummary(data, config) {
      if (!config.values.length) {
        this.state.pivotData = { rows: [], columns: [] };
        this.data = [];
        this.columns = [];
        return;
      }
      
      const summaryRow = {};
      config.values.forEach(field => {
        const aggFunc = config.aggregations[field] || 'sum';
        summaryRow[field] = this._aggregate(data, field, aggFunc);
      });
      
      const summaryColumns = config.values.map(field => ({
        key: field,
        label: `${this._getFieldLabel(field)} (${config.aggregations[field] || 'sum'})`,
        type: 'number',
        sortable: false,
        format: this._getNumberFormatter(field)
      }));
      
      this.state.pivotData = { rows: [summaryRow], columns: summaryColumns };
      this.data = [summaryRow];
      this.columns = summaryColumns;
    }
    
    _groupByFields(data, fields) {
      const groups = {};
      
      data.forEach(item => {
        const key = fields.map(field => this._getFieldValue(item, field)).join('|');
        if (!groups[key]) groups[key] = [];
        groups[key].push(item);
      });
      
      return groups;
    }
    
    _getUniqueValues(data, fields) {
      const values = new Set();
      data.forEach(item => {
        const value = this._getFieldPath(item, fields);
        if (value !== null && value !== undefined) {
          values.add(value);
        }
      });
      return Array.from(values).sort();
    }
    
    _getFieldPath(item, fields) {
      return fields.map(field => this._getFieldValue(item, field)).join('|');
    }
    
    _getFieldValue(item, field) {
      return item[field] ?? '';
    }
    
    _getFieldLabel(field) {
      const col = this.state.originalColumns?.find(c => c.key === field);
      return col?.label || field;
    }
    
    _aggregate(data, field, func) {
      const values = data.map(item => Number(item[field])).filter(v => !isNaN(v));
      if (!values.length) return 0;
      
      switch (func) {
        case 'sum': return values.reduce((a, b) => a + b, 0);
        case 'avg': return values.reduce((a, b) => a + b, 0) / values.length;
        case 'min': return Math.min(...values);
        case 'max': return Math.max(...values);
        case 'count': return data.length;
        default: return values.reduce((a, b) => a + b, 0);
      }
    }
    
    _getNumberFormatter(field) {
      const col = this.state.originalColumns?.find(c => c.key === field);
      return col?.format || ((v) => typeof v === 'number' ? v.toLocaleString() : v);
    }
    
    _renderPivotToolbar() {
      const toolbar = this.root.querySelector('.vg-toolbar');
      if (!toolbar) return;
      
      // Clear existing toolbar content
      toolbar.innerHTML = '';
      
      const pivotControls = document.createElement('div');
      pivotControls.className = 'vg-pivot-controls';
      pivotControls.innerHTML = `
        <div class="vg-pivot-header">
          <div class="vg-pivot-title">
            <h3>📊 Pivot Table Builder</h3>
            <p>Drag fields into the areas below to build your pivot table</p>
          </div>
          <button class="vg-btn vg-pivot-exit">✕ Exit Pivot Mode</button>
        </div>
        
        <div class="vg-pivot-workspace">
          <div class="vg-pivot-fields-panel">
            <h4>Available Fields</h4>
            <div class="vg-pivot-available-fields" id="pivot-available-fields"></div>
          </div>
          
          <div class="vg-pivot-config-panel">
            <div class="vg-pivot-drop-zones">
              <div class="vg-pivot-zone vg-pivot-filters">
                <div class="vg-pivot-zone-header">
                  <span class="vg-pivot-zone-icon">🔍</span>
                  <span class="vg-pivot-zone-title">Filters</span>
                  <span class="vg-pivot-zone-hint">Filter your data</span>
                </div>
                <div class="vg-pivot-field-list" data-type="filters"></div>
              </div>
              
              <div class="vg-pivot-zone vg-pivot-rows">
                <div class="vg-pivot-zone-header">
                  <span class="vg-pivot-zone-icon">📋</span>
                  <span class="vg-pivot-zone-title">Rows</span>
                  <span class="vg-pivot-zone-hint">Drag row fields here</span>
                </div>
                <div class="vg-pivot-field-list" data-type="rows"></div>
              </div>
              
              <div class="vg-pivot-zone vg-pivot-columns">
                <div class="vg-pivot-zone-header">
                  <span class="vg-pivot-zone-icon">📊</span>
                  <span class="vg-pivot-zone-title">Columns</span>
                  <span class="vg-pivot-zone-hint">Drag column fields here</span>
                </div>
                <div class="vg-pivot-field-list" data-type="columns"></div>
              </div>
              
              <div class="vg-pivot-zone vg-pivot-values">
                <div class="vg-pivot-zone-header">
                  <span class="vg-pivot-zone-icon">🔢</span>
                  <span class="vg-pivot-zone-title">Values</span>
                  <span class="vg-pivot-zone-hint">Drag numeric fields here</span>
                </div>
                <div class="vg-pivot-field-list" data-type="values"></div>
              </div>
            </div>
            
            <div class="vg-pivot-actions">
              <button class="vg-btn vg-pivot-refresh">🔄 Refresh Pivot</button>
              <button class="vg-btn vg-pivot-clear">🗑️ Clear All</button>
              <button class="vg-btn vg-pivot-export">📊 Export Data</button>
            </div>
          </div>
        </div>
      `;
      
      toolbar.appendChild(pivotControls);
      
      // Populate available fields
      this._renderAvailableFields();
      
      // Render current configuration
      this._updatePivotFieldLists();
      
      // Bind events
      this._bindPivotEvents();
      
      // Initialize drag and drop
      this._initializePivotDragDrop();
    }
    
    _renderAvailableFields() {
      const fieldsContainer = this.root.querySelector('#pivot-available-fields');
      if (!fieldsContainer) return;
      
      fieldsContainer.innerHTML = '';
      const fields = this.getAvailableFields();
      
      fields.forEach(field => {
        const fieldElement = document.createElement('div');
        fieldElement.className = 'vg-pivot-field-chip';
        fieldElement.draggable = true;
        fieldElement.dataset.field = field;
        
        const fieldType = this._getFieldType(field);
        const icon = fieldType === 'number' ? '🔢' : fieldType === 'date' ? '📅' : '📝';
        
        fieldElement.innerHTML = `
          <span class="vg-field-icon">${icon}</span>
          <span class="vg-field-label">${this._getFieldLabel(field)}</span>
          <span class="vg-field-type">${fieldType}</span>
        `;
        
        fieldsContainer.appendChild(fieldElement);
      });
    }
    
    _getFieldType(field) {
      const originalData = this.state.originalData || this.data;
      if (!originalData.length) return 'text';
      
      const sample = originalData[0][field];
      if (typeof sample === 'number') return 'number';
      if (sample instanceof Date || /^\d{4}-\d{2}-\d{2}/.test(sample)) return 'date';
      return 'text';
    }
    
    _initializePivotDragDrop() {
      const fieldsContainer = this.root.querySelector('#pivot-available-fields');
      const dropZones = this.root.querySelectorAll('.vg-pivot-field-list');
      
      // Make field chips draggable
      fieldsContainer.addEventListener('dragstart', (e) => {
        if (e.target.classList.contains('vg-pivot-field-chip')) {
          e.dataTransfer.setData('text/plain', e.target.dataset.field);
          e.target.classList.add('vg-dragging');
        }
      });
      
      fieldsContainer.addEventListener('dragend', (e) => {
        e.target.classList.remove('vg-dragging');
      });
      
      // Setup drop zones
      dropZones.forEach(zone => {
        zone.addEventListener('dragover', (e) => {
          e.preventDefault();
          zone.classList.add('vg-drop-active');
        });
        
        zone.addEventListener('dragleave', (e) => {
          if (!zone.contains(e.relatedTarget)) {
            zone.classList.remove('vg-drop-active');
          }
        });
        
        zone.addEventListener('drop', (e) => {
          e.preventDefault();
          zone.classList.remove('vg-drop-active');
          
          const field = e.dataTransfer.getData('text/plain');
          const sourceType = e.dataTransfer.getData('source-type');
          const type = zone.dataset.type;
          
          if (field && type) {
            // Ensure pivot config is properly initialized
            if (!this.opts.pivotConfig) {
              this.opts.pivotConfig = {
                rows: [],
                columns: [],
                values: [],
                filters: [],
                aggregations: {}
              };
            }
            
            // Ensure the specific type array exists
            if (!this.opts.pivotConfig[type]) {
              this.opts.pivotConfig[type] = [];
            }
            
            // If moving from another zone, remove from source
            if (sourceType && sourceType !== type && this.opts.pivotConfig[sourceType]) {
              const sourceIndex = this.opts.pivotConfig[sourceType].indexOf(field);
              if (sourceIndex > -1) {
                this.opts.pivotConfig[sourceType].splice(sourceIndex, 1);
                if (sourceType === 'values') {
                  delete this.opts.pivotConfig.aggregations[field];
                }
              }
            }
            
            // Add field if not already present in target zone
            if (!this.opts.pivotConfig[type].includes(field)) {
              this.opts.pivotConfig[type].push(field);
              
              if (type === 'values' && !this.opts.pivotConfig.aggregations[field]) {
                this.opts.pivotConfig.aggregations[field] = 'sum';
              }
              
              this._updatePivotFieldLists();
              this.updatePivotConfig(this.opts.pivotConfig);
            }
          }
        });
      });
      
      // Make existing field items draggable within zones
      this._makeFieldItemsDraggable();
    }
    
    _makeFieldItemsDraggable() {
      const fieldItems = this.root.querySelectorAll('.vg-pivot-field-item');
      
      fieldItems.forEach(item => {
        item.draggable = true;
        
        item.addEventListener('dragstart', (e) => {
          e.dataTransfer.setData('text/plain', item.dataset.field);
          e.dataTransfer.setData('source-type', item.closest('.vg-pivot-field-list').dataset.type);
          item.classList.add('vg-dragging');
        });
        
        item.addEventListener('dragend', (e) => {
          item.classList.remove('vg-dragging');
        });
      });
    }
    
    _updatePivotFieldLists() {
      const fieldLists = this.root.querySelectorAll('.vg-pivot-field-list');
      
      fieldLists.forEach(list => {
        const type = list.dataset.type;
        const fields = this.opts.pivotConfig[type] || [];
        
        list.innerHTML = '';
        
        fields.forEach((field, index) => {
          const fieldItem = document.createElement('div');
          fieldItem.className = 'vg-pivot-field-item';
          fieldItem.dataset.field = field;
          fieldItem.draggable = true;
          
          const fieldType = this._getFieldType(field);
          const icon = fieldType === 'number' ? '🔢' : fieldType === 'date' ? '📅' : '📝';
          
          if (type === 'values') {
            const aggregation = this.opts.pivotConfig.aggregations[field] || 'sum';
            fieldItem.innerHTML = `
              <div class="vg-field-item-content">
                <span class="vg-field-icon">${icon}</span>
                <span class="vg-field-label">${this._getFieldLabel(field)}</span>
                <select class="vg-aggregation-select" data-field="${field}">
                  <option value="sum" ${aggregation === 'sum' ? 'selected' : ''}>Sum</option>
                  <option value="count" ${aggregation === 'count' ? 'selected' : ''}>Count</option>
                  <option value="avg" ${aggregation === 'avg' ? 'selected' : ''}>Average</option>
                  <option value="min" ${aggregation === 'min' ? 'selected' : ''}>Min</option>
                  <option value="max" ${aggregation === 'max' ? 'selected' : ''}>Max</option>
                </select>
              </div>
              <div class="vg-field-actions">
                <button class="vg-field-move-up" data-field="${field}" data-type="${type}" ${index === 0 ? 'disabled' : ''}>↑</button>
                <button class="vg-field-move-down" data-field="${field}" data-type="${type}" ${index === fields.length - 1 ? 'disabled' : ''}>↓</button>
                <button class="vg-field-remove" data-field="${field}" data-type="${type}">✕</button>
              </div>
            `;
          } else {
            fieldItem.innerHTML = `
              <div class="vg-field-item-content">
                <span class="vg-field-icon">${icon}</span>
                <span class="vg-field-label">${this._getFieldLabel(field)}</span>
                ${type === 'filters' ? `
                  <select class="vg-filter-operator" data-field="${field}">
                    <option value="equals">Equals</option>
                    <option value="contains">Contains</option>
                    <option value="starts">Starts with</option>
                    <option value="greater">Greater than</option>
                    <option value="less">Less than</option>
                  </select>
                  <input type="text" class="vg-filter-value" data-field="${field}" placeholder="Filter value...">
                ` : ''}
              </div>
              <div class="vg-field-actions">
                <button class="vg-field-move-up" data-field="${field}" data-type="${type}" ${index === 0 ? 'disabled' : ''}>↑</button>
                <button class="vg-field-move-down" data-field="${field}" data-type="${type}" ${index === fields.length - 1 ? 'disabled' : ''}>↓</button>
                <button class="vg-field-remove" data-field="${field}" data-type="${type}">✕</button>
              </div>
            `;
          }
          
          list.appendChild(fieldItem);
        });
        
        if (fields.length === 0) {
          const emptyState = document.createElement('div');
          emptyState.className = 'vg-pivot-empty-state';
          emptyState.innerHTML = `
            <div class="vg-empty-icon">📥</div>
            <div class="vg-empty-text">Drag fields here</div>
          `;
          list.appendChild(emptyState);
        }
      });
      
      // Rebind drag and drop events for new items
      this._makeFieldItemsDraggable();
    }
    
    _bindPivotEvents() {
      const toolbar = this.root.querySelector('.vg-toolbar');
      if (!toolbar) return;
      
      // Exit pivot mode
      toolbar.querySelector('.vg-pivot-exit')?.addEventListener('click', () => {
        this.disablePivot();
      });
      
      // Refresh pivot
      toolbar.querySelector('.vg-pivot-refresh')?.addEventListener('click', () => {
        this.updatePivotConfig(this.opts.pivotConfig);
      });
      
      // Clear all fields
      toolbar.querySelector('.vg-pivot-clear')?.addEventListener('click', () => {
        this.clearPivotConfig();
      });
      
      // Export data
      toolbar.querySelector('.vg-pivot-export')?.addEventListener('click', () => {
        this.exportPivotData();
      });
      
      // Field actions (remove, move up/down)
      toolbar.addEventListener('click', (e) => {
        if (e.target.classList.contains('vg-field-remove')) {
          const field = e.target.dataset.field;
          const type = e.target.dataset.type;
          this.removePivotField(type, field);
        } else if (e.target.classList.contains('vg-field-move-up')) {
          const field = e.target.dataset.field;
          const type = e.target.dataset.type;
          this.movePivotField(type, field, -1);
        } else if (e.target.classList.contains('vg-field-move-down')) {
          const field = e.target.dataset.field;
          const type = e.target.dataset.type;
          this.movePivotField(type, field, 1);
        }
      });
      
      // Aggregation changes
      toolbar.addEventListener('change', (e) => {
        if (e.target.classList.contains('vg-aggregation-select')) {
          const field = e.target.dataset.field;
          this.opts.pivotConfig.aggregations[field] = e.target.value;
          this.updatePivotConfig(this.opts.pivotConfig);
        } else if (e.target.classList.contains('vg-filter-operator') || e.target.classList.contains('vg-filter-value')) {
          this.applyPivotFilters();
        }
      });
      
      // Filter input changes (debounced)
      let filterTimeout;
      toolbar.addEventListener('input', (e) => {
        if (e.target.classList.contains('vg-filter-value')) {
          clearTimeout(filterTimeout);
          filterTimeout = setTimeout(() => {
            this.applyPivotFilters();
          }, 300);
        }
      });
    }
    
    removePivotField(type, field) {
      const index = this.opts.pivotConfig[type].indexOf(field);
      if (index > -1) {
        this.opts.pivotConfig[type].splice(index, 1);
        if (type === 'values') {
          delete this.opts.pivotConfig.aggregations[field];
        }
        this._updatePivotFieldLists();
        this.updatePivotConfig(this.opts.pivotConfig);
      }
    }
    
    movePivotField(type, field, direction) {
      const fields = this.opts.pivotConfig[type];
      const index = fields.indexOf(field);
      
      if (index === -1) return;
      
      const newIndex = index + direction;
      if (newIndex < 0 || newIndex >= fields.length) return;
      
      // Swap fields
      [fields[index], fields[newIndex]] = [fields[newIndex], fields[index]];
      
      this._updatePivotFieldLists();
      this.updatePivotConfig(this.opts.pivotConfig);
    }
    
    clearPivotConfig() {
      this.opts.pivotConfig = {
        rows: [],
        columns: [],
        values: [],
        filters: [],
        aggregations: {}
      };
      this._updatePivotFieldLists();
      this.updatePivotConfig(this.opts.pivotConfig);
    }
    
    applyPivotFilters() {
      const filters = {};
      const filterInputs = this.root.querySelectorAll('.vg-filter-value');
      
      filterInputs.forEach(input => {
        const field = input.dataset.field;
        const value = input.value.trim();
        const operator = this.root.querySelector(`.vg-filter-operator[data-field="${field}"]`)?.value || 'equals';
        
        if (value) {
          filters[field] = { operator, value };
        }
      });
      
      this.opts.pivotConfig.filters = filters;
      this.updatePivotConfig(this.opts.pivotConfig);
    }
    
    exportPivotData() {
      // Use the current data which contains the pivot table rows
      const pivotData = this.opts.pivotMode ? this.data : this.data;
      
      if (!pivotData || !pivotData.length) {
        console.warn('No data available for export');
        alert('No data available for export. Please configure your pivot table first.');
        return;
      }
      
      console.log('Exporting pivot data:', pivotData.length, 'rows');
      const csvContent = this.convertToCSV(pivotData);
      
      if (!csvContent) {
        console.warn('CSV conversion failed');
        alert('Failed to convert data to CSV format.');
        return;
      }
      
      this.downloadCSV(csvContent, 'pivot-table.csv');
    }
    
    convertToCSV(data) {
      if (!data || !data.length) {
        console.warn('ConvertToCSV: No data provided');
        return '';
      }
      
      console.log('Converting to CSV:', data.length, 'rows');
      
      // Get headers from the first row
      const firstRow = data[0];
      if (!firstRow || typeof firstRow !== 'object') {
        console.warn('ConvertToCSV: Invalid data format');
        return '';
      }
      
      const headers = Object.keys(firstRow);
      const csvRows = [headers.join(',')];
      
      data.forEach((row, index) => {
        const values = headers.map(header => {
          const value = row[header];
          if (value === null || value === undefined) {
            return '';
          }
          return typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value;
        });
        csvRows.push(values.join(','));
      });
      
      console.log('CSV generated:', csvRows.length, 'lines');
      return csvRows.join('\n');
    }
    
    downloadCSV(content, filename) {
      const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    }

    // ---- Public selection API ----
    getSelectedRows() { return Array.from(this.state.selected).map(id => this.rowById.get(id)).filter(Boolean); }
    clearSelection() {
      this.state.selected.clear();
      this._updateHeaderSelectionToggle();
      this._renderBody();
      this._emitSelection();
    }
  }

  // UMD-style export
  if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = VanillaGrid;
  } else {
    global.VanillaGrid = VanillaGrid;
  }
})(typeof window !== 'undefined' ? window : globalThis);
