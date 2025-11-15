/*!
 * VanillaGrid — a tiny table library
 * Features: sorting, multiple filtering modes (simple/CS/RegExp/tree),
 * pagination, grouping (sum/min/max), selection, resizing, basic editing,
 * context menu, export, tree data, and optional pivot-like view.
 * No dependencies. MIT License.
 */
export type VGCellType = 'text' | 'number' | 'date' | 'button' | 'image' | 'html' | 'progress' | 'rating' | 'badge' | 'color' | string;
export type VGSortDirection = 'asc' | 'desc';
export type VGFilterMode = 'simple' | 'case-sensitive' | 'regex' | 'tree';
export type VGExportFormat = 'csv' | 'md';
export type VGExportScope = 'page' | 'all';
export type VGThemeValue = 'light' | 'dark-blue' | 'dark-grey' | 'midnight' | 'forest' | 'ocean' | 'sand' | string;
export type VGDensityValue = 'comfortable' | 'compact';
export type VGAggregation = 'sum' | 'avg' | 'min' | 'max' | 'count';
export type VGFilterOperator = 'equals' | 'contains' | 'starts' | 'greater' | 'less';
export type VGDropPosition = 'before' | 'after';
/** Column definition for VanillaGrid */
export interface VGColumn {
    key: string;
    label?: string;
    type?: VGCellType;
    sortable?: boolean;
    filterable?: boolean;
    format?: (val: any, row?: any) => string;
    render?: (val: any, row?: any) => string | HTMLElement;
    aggregations?: VGAggregation[];
    link?: {
        text?: string;
        target?: string;
    };
    image?: {
        alt?: string;
        width?: number;
        height?: number;
    };
    button?: {
        text?: string;
        onClick?: (row: any, btn: HTMLElement) => void;
    };
}
/** Export configuration */
export interface VGExporting {
    enabled: boolean;
    formats: VGExportFormat[];
    scope: VGExportScope;
    filename: string;
}
/** Tree/hierarchical grid options */
export interface VGTreeOptions {
    enabled: boolean;
    childrenKey: string;
    indent: number;
    lazy: boolean;
    initiallyExpanded: boolean;
    hasChildrenKey: string;
}
/** Pivot table configuration */
export interface VGPivotConfig {
    rows: string[];
    columns: string[];
    values: string[];
    aggregations: Record<string, VGAggregation>;
    filters?: Record<string, {
        operator: VGFilterOperator;
        value: string;
    }> | any[];
}
/** Style controls configuration */
export interface VGStyleControls {
    enabled: boolean;
    persistKey?: string | false;
    scope?: 'global' | 'instance';
}
/** Columns menu configuration */
export interface VGColumnsMenu {
    location?: 'pager' | 'toolbar';
    label?: string;
    showSearch?: boolean;
    showSelectAll?: boolean;
    include?: string[];
    exclude?: string[];
    persistKey?: string;
    initialHidden?: string[];
}
/** i18n strings */
export interface VGI18n {
    tableLabel: string;
    filterPlaceholder: string;
    regexLabel: string;
    invalidRegex: string;
    noGroup: string;
    groupByPrefix: string;
    perPageSuffix: string;
    search: {
        simple: string;
        caseSensitive: string;
        regex: string;
        treeFilter: string;
    };
    pager: {
        pageInfo: (page: number, total: number) => string;
        prev: string;
        next: string;
        first: string;
        last: string;
        totalRows: (n: number) => string;
        totalGroups: (n: number) => string;
    };
    group: {
        count: string;
        min: string;
        max: string;
    };
    aria: {
        toggleGroup: string;
        expandRow: string;
        collapseRow: string;
    };
    export: {
        button: string;
        csv: string;
        markdown: string;
        format: string;
    };
}
/** Options for VanillaGrid constructor */
export interface VanillaGridOptions<T extends Record<string, any> = Record<string, any>> {
    data: T[];
    columns: VGColumn[];
    pageSize?: number;
    pageSizes?: number[];
    sortable?: boolean;
    filterable?: boolean;
    pagination?: boolean;
    groupable?: boolean;
    groupBy?: string | null;
    regexFilter?: boolean;
    className?: string;
    emptyMessage?: string;
    theme?: VGThemeValue;
    density?: VGDensityValue;
    striped?: boolean;
    styleControls?: VGStyleControls | boolean;
    i18n?: Partial<VGI18n>;
    tree?: Partial<VGTreeOptions>;
    loadChildren?: (row: T) => Promise<T[]>;
    serverPagination?: boolean;
    serverSorting?: boolean;
    serverFiltering?: boolean;
    loadPage?: (args: {
        page: number;
        pageSize: number;
        sortKey?: string;
        sortDir?: VGSortDirection;
        filter?: string;
        regexMode?: boolean;
        caseSensitive?: boolean;
    }) => Promise<{
        rows: T[];
        total: number;
    }>;
    exporting?: Partial<VGExporting>;
    selectable?: boolean;
    onSelectionChange?: (rows: T[]) => void;
    columnsMenu?: boolean | Partial<VGColumnsMenu>;
    onColumnsVisibilityChange?: (hidden: Set<string>) => void;
    resizableColumns?: boolean;
    editableRows?: boolean;
    rowDragDrop?: boolean;
    frozenColumns?: number;
    keyboardNavigation?: boolean;
    contextMenu?: boolean;
    onRowEdit?: (row: T, field: string, newValue: any, oldValue: any) => void;
    onRowDrop?: (draggedRow: T, targetRow: T, position: VGDropPosition) => void;
    customCellTypes?: Record<string, (value: any, column: VGColumn, row: T) => string | HTMLElement>;
    pivotMode?: boolean;
    pivotConfig?: Partial<VGPivotConfig>;
    onPivotChange?: (pivotData: any, config: VGPivotConfig) => void;
}
/** Internal row with assigned ID */
interface VGRow extends Record<string, any> {
    __vgid?: number;
    children?: VGRow[];
}
/** Internal state */
interface VGState {
    sortKey: string | null;
    sortDir: VGSortDirection;
    filter: string;
    filterMode: VGFilterMode;
    regexMode: boolean;
    caseSensitive: boolean;
    treeFilterExpanded: Set<string>;
    page: number;
    pageSize: number;
    groupBy: string | null;
    regexError: string;
    collapsed: Set<string>;
    expanded: Set<number>;
    loadingChildren: Set<number>;
    serverTotalRows: number | null;
    selected: Set<number>;
    hiddenCols: Set<string>;
    columnWidths: Map<string, number>;
    editingCell: {
        rowId: number;
        columnKey: string;
    } | null;
    draggedRow: any | null;
    focusedCell: {
        rowId: number;
        columnKey: string;
    } | null;
    pivotData: any | null;
    originalData: any[] | null;
    originalColumns: VGColumn[] | null;
    pivotControlsCollapsed: boolean;
}
/** Style state */
interface VGStyleState {
    theme: VGThemeValue;
    density: VGDensityValue;
    striped: boolean;
}
/**
 * VanillaGrid - A tiny, dependency-free data grid
 *
 * @template T - The type of data rows in the grid
 */
declare class VanillaGrid<T extends Record<string, any> = Record<string, any>> {
    container: HTMLElement;
    root: HTMLElement;
    opts: any;
    columns: VGColumn[];
    data: VGRow[];
    state: VGState;
    styleState: VGStyleState;
    rowById: Map<number, VGRow>;
    toolbarEl: HTMLElement | null;
    headerEl: HTMLElement | null;
    bodyEl: HTMLElement | null;
    pagerEl: HTMLElement | null;
    tableEl: HTMLTableElement | null;
    theadEl: HTMLTableSectionElement | null;
    tbodyEl: HTMLTableSectionElement | null;
    private _idCounter;
    private _totalPages;
    private _onDocClickFilterMode;
    private _onDocClickTreeFilter;
    private _onToolbarTreeClick;
    private _onBodyClick;
    private _onBodyDblClick;
    private _onBodyContextMenu;
    private _onBodyKeyDown;
    private _onHeaderClick;
    private _onHeaderMouseDown;
    private _onToolbarClick;
    private _onToolbarChange;
    private _onPagerClick;
    private _resizeState;
    /**
     * Create a VanillaGrid instance.
     * @param {string|HTMLElement} container - CSS selector or DOM node to mount into
     * @param {VanillaGridOptions} options - Configuration and data
     */
    constructor(container: string | HTMLElement, options: VanillaGridOptions<T>);
    /** Replace all data rows and reset page. */
    setData(data: any): void;
    /** Get a shallow copy of current data. */
    getData(): VGRow[];
    /**
     * Set grouping by a column key (or null to disable).
     * Re-renders body and pager.
     */
    setGroupBy(key: any): void;
    /**
     * Update filter text and options.
     * For server mode, triggers remote load; otherwise re-renders body and pager.
     * @param {string} text
     * @param {{regexMode?:boolean, caseSensitive?:boolean}} [options]
     */
    setFilter(text: any, options?: {}): void;
    /**
     * Apply sorting by column key and direction.
     * @param {string} key
     * @param {'asc'|'desc'} [dir='asc']
     */
    setSort(key: any, dir?: string): void;
    setPageSize(size: any): void;
    setMarkdown(markdown: any, options?: {}): void;
    loadMarkdown(url: any, fetchOptions: any): Promise<void>;
    downloadMarkdown(filename: any): void;
    addRow(rowData: any, index?: number): any;
    updateRow(rowId: any, newData: any): VGRow;
    deleteRow(rowId: any): VGRow;
    setColumnWidth(columnKey: any, width: any): void;
    getColumnWidth(columnKey: any): number;
    resetColumnWidths(): void;
    startEdit(rowId: any, columnKey: any): boolean;
    focusCell(rowId: any, columnKey: any): boolean;
    registerCellType(typeName: any, renderFunction: any): void;
    unregisterCellType(typeName: any): void;
    enablePivot(config?: {}): void;
    disablePivot(): void;
    updatePivotConfig(config: any): void;
    getPivotData(): any;
    getAvailableFields(): string[];
    _render(): void;
    /**
     * Render the toolbar row (search, group-by, export, optional columns menu).
     * This method is called frequently; keep it fast and avoid stacking listeners.
     */
    _renderToolbar(): void;
    /**
     * Setup filter mode dropdown interactions without stacking global listeners.
     * @param {HTMLElement} modeBtn
     * @param {HTMLElement} modeDropdown
     */
    /**
     * Wire up filter mode dropdown interactions and a single outside-click handler.
     * Re-entrant safe: replaces previous document handler via instance property.
     * @param {HTMLElement} modeBtn
     * @param {HTMLElement} modeDropdown
     */
    _setupFilterModeDropdown(modeBtn: any, modeDropdown: any): void;
    _styleControlsEnabled(): any;
    _normalizeThemeValue(theme: any): string;
    _humanizeTheme(value: any): string;
    _getThemeDefs(): any[];
    _stylePersistKey(): any;
    _loadPersistedStyleState(): any;
    _persistStyleState(): void;
    _extractThemeFromClassName(): string;
    _initStyleState(): void;
    _applyStyleState(): void;
    _updateStyleState(partial: any): void;
    _styleControlsMarkup(): string;
    _bindStyleControls(container: any): void;
    _closeAllSettingsPanels(except: any): void;
    _ensureSettingsDocHandler(): void;
    _detachSettingsDocHandler(): void;
    _syncStyleControlsUI(): void;
    _applyFilter(): void;
    /**
     * Render the Tree/Filter panel. Shows columns where values have repetitions
     * (unique-only columns are hidden), and for each column lists top values by
     * frequency. Clicking a value writes `column:"value"` into the search box.
     */
    _renderTreeFilter(): string;
    /**
     * Compute value counts for each configured column across the current dataset.
     * Empty/undefined values are grouped under the literal "(empty)" key.
     * @returns {Record<string, Record<string, number>>}
     */
    _getColumnValueStats(): {};
    /**
     * Bind delegated click handlers for the Tree/Filter UI.
     * Ensures only one listener is attached per toolbar render.
     */
    _bindTreeFilterEvents(): void;
    _columnsMenuConfig(): any;
    _columnsMenuMarkup(cfg: any): string;
    _allVisible(cols: any): any;
    _bindColumnsMenuEvents(scopeEl: any): void;
    _persistColumnsMenuState(): void;
    _restoreColumnsMenuState(): void;
    _renderHeader(): void;
    _bindTableEvents(): void;
    _bindColumnResize(): void;
    _bindMobileTouch(): void;
    _bindMobileDropdowns(): void;
    _nextPage(): void;
    _prevPage(): void;
    _bindKeyboardNavigation(): void;
    _startCellEdit(cell: any): void;
    _bindContextMenu(): void;
    _showContextMenu(x: any, y: any, rowData: any): void;
    _copyRowToClipboard(rowData: any): void;
    _deleteRow(rowData: any): void;
    _renderBody(): void;
    _parseMarkdownTables(md: any): any[];
    _mdInlineToHtml(src: any): string;
    _slugify(s: any): string;
    _uniqueKeys(keys: any): any[];
    _exportMatrix(): {
        headers: string[];
        rows: any[];
    };
    _toCSV(matrix: any): any;
    _toMarkdown(headers: any, rows: any): string;
    _downloadBlob(text: any, filename: any, mime: any): void;
    _renderRow(row: any, depth?: number, meta?: any): HTMLTableRowElement;
    _renderCell(td: any, row: any, col: any): void;
    _renderTreeToggle(row: any, meta: any): HTMLButtonElement;
    _renderAggSummary(group: any): string;
    _fmtAgg(col: any, value: any): any;
    _headerLabelForGroup(g: any): string;
    _renderPager(): void;
    _processMeta(): {
        hasGroups: boolean;
        totalPages: number;
        totalCount: number;
    };
    _process(): {
        hasGroups: boolean;
        pageFlatRows: any[];
        pageGroups?: undefined;
        pageRows?: undefined;
    } | {
        hasGroups: true;
        pageGroups: any[];
        pageFlatRows?: undefined;
        pageRows?: undefined;
    } | {
        hasGroups: boolean;
        pageRows: VGRow[];
        pageFlatRows?: undefined;
        pageGroups?: undefined;
    };
    _filterSortTreeFlatten(): any[];
    _assignIdsDeep(list: any): void;
    _indexRowsDeep(list: any): void;
    _rowHasChildren(row: any): boolean;
    _rowPotentialChildren(row: any): boolean;
    _shouldRemoteFetch(why: any): any;
    _processMetaRemote(): {
        hasGroups: boolean;
        totalPages: number;
        totalCount: number;
    };
    _remoteLoad(page: any): void;
    _filterSortGroup(): {
        hasGroups: boolean;
        rows: VGRow[];
        groups?: undefined;
    } | {
        hasGroups: boolean;
        groups: any[];
        rows?: undefined;
    };
    _computeAggregates(rows: any): {};
    _cellText(row: any, col: any): any;
    _compare(a: any, b: any, type: any, col: any): any;
    _toNumber(v: any): number;
    _stripHtml(s: any): any;
    _esc(s: any): string;
    _escAttr(s: any): string;
    _updateFilterError(): void;
    _colCount(): number;
    _currentPageRowIds(): any[];
    _updateHeaderSelectionToggle(): void;
    _emitSelection(): void;
    _applyColumnVisibility(): void;
    _generatePivotTable(): void;
    _generatePivotSummary(data: any, config: any): void;
    _groupByFields(data: any, fields: any): {};
    _getUniqueValues(data: any, fields: any): unknown[];
    _getFieldPath(item: any, fields: any): any;
    _getFieldValue(item: any, field: any): any;
    _getFieldLabel(field: any): any;
    _aggregate(data: any, field: any, func: any): any;
    _getNumberFormatter(field: any): ((val: any, row?: any) => string) | ((v: any) => any);
    _renderPivotToolbar(): void;
    _renderAvailableFields(): void;
    _getFieldType(field: any): "text" | "number" | "date";
    _initializePivotDragDrop(): void;
    _makeFieldItemsDraggable(): void;
    _updatePivotFieldLists(): void;
    _bindPivotEvents(): void;
    removePivotField(type: any, field: any): void;
    movePivotField(type: any, field: any, direction: any): void;
    clearPivotConfig(): void;
    applyPivotFilters(): void;
    exportPivotData(): void;
    convertToCSV(data: any): string;
    getSelectedRows(): VGRow[];
    clearSelection(): void;
}
export default VanillaGrid;
export type { VGColumn, VGExporting, VGTreeOptions, VGPivotConfig, VGStyleControls, VGColumnsMenu, VGI18n, VanillaGridOptions, VGCellType, VGSortDirection, VGFilterMode, VGExportFormat, VGExportScope, VGThemeValue, VGDensityValue, VGAggregation, VGFilterOperator, VGDropPosition };
//# sourceMappingURL=vanillagrid.d.ts.map