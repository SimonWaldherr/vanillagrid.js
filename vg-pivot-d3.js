/*
 * VanillaGrid Pivot d3 Plugin
 * Optional charts for Pivot mode (grouped/stacked columns) with lazy-loaded d3.
 * Usage:
 *   1) Load after vanillagrid.js
 *      <link rel="stylesheet" href="vg-pivot-d3.css">
 *      <script src="vg-pivot-d3.js"></script>
 *   2) Enable pivot as usual. A chart panel appears inside the Pivot toolbar.
 *   3) Click "Render" to draw the chart (d3 loads on demand).
 *
 * Options (optional):
 *   - grid.opts.d3Url           : custom URL for d3 (default: jsDelivr d3@7)
 *   - grid.opts.pivotConfig.chart: { type:'grouped'|'stacked', value:'revenue', normalize:true, autorender:true }
 */
(function (global) {
  const win = (typeof window !== 'undefined') ? window : global;
  const VG = win.VanillaGrid;
  if (!VG) {
    console.warn('[VG Pivot d3] VanillaGrid not found. Load this plugin after vanillagrid.js');
    return;
  }
  if (VG.prototype.__vgPivotD3Patched) return; // avoid double patch
  VG.prototype.__vgPivotD3Patched = true;

  // ---------- Helpers ----------
  VG.prototype._vgD3Promise = null;
  VG.prototype._ensureD3 = function (url) {
    if (win.d3) return Promise.resolve(win.d3);
    if (this._vgD3Promise) return this._vgD3Promise;
    const src = url || this.opts?.d3Url || 'https://cdn.jsdelivr.net/npm/d3@7';
    this._vgD3Promise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = () => resolve(win.d3);
      s.onerror = (e) => reject(new Error('Failed to load d3.js: ' + src));
      document.head.appendChild(s);
    });
    return this._vgD3Promise;
  };

  // Build/refresh the value select (measures) from current pivot data
  VG.prototype._populateChartValueSelect = function () {
    const sel = this.root.querySelector('.vg-chart-value');
    if (!sel || !this.state?.pivotData?.columns) return;

    const numericCols = this.state.pivotData.columns.filter(c => c.type === 'number');
    const measures = Array.from(new Set(numericCols.map(c => String(c.key).split('_')[0])));

    if (measures.length === 0) {
      sel.innerHTML = '<option value="">(keine)</option>';
      return;
    }

    const wanted = this.opts?.pivotConfig?.chart?.value;
    sel.innerHTML = measures.map(m => `<option value="${escapeHtmlAttr(m)}"${wanted===m?' selected':''}>${escapeHtml(m)}</option>`).join('');
  };

  // ---------- Patch: Pivot toolbar to append chart controls ----------
  const _origRenderPivotToolbar = VG.prototype._renderPivotToolbar;
  VG.prototype._renderPivotToolbar = function () {
    _origRenderPivotToolbar.call(this);

    const toolbar = this.root.querySelector('.vg-toolbar');
    if (!toolbar) return;

    // Avoid duplicate panel
    if (toolbar.querySelector('#vg-pivot-chart')) return;

    const panel = document.createElement('div');
    panel.className = 'vg-pivot-chart-panel';
    panel.innerHTML = `
      <div class="vg-pivot-chart-controls">
        <label class="vg-pivot-chart-label">Diagramm</label>
        <select class="vg-chart-type" aria-label="Diagrammtyp">
          <option value="grouped">Säulen (gruppiert)</option>
          <option value="stacked">Säulen (gestapelt)</option>
        </select>
        <label class="vg-pivot-chart-label">Wert</label>
        <select class="vg-chart-value" aria-label="Kennzahl"></select>
        <label class="vg-pivot-chart-check">
          <input type="checkbox" class="vg-chart-normalize" /> % normalisieren
        </label>
        <button class="vg-btn vg-chart-render" type="button">📈 Render</button>
      </div>
      <div id="vg-pivot-chart" role="img" aria-label="Pivot Diagramm" class="vg-pivot-chart"></div>
    `;
    toolbar.appendChild(panel);

    // Initialize controls from config if present
    try {
      const chartCfg = this.opts?.pivotConfig?.chart || {};
      const typeSel = toolbar.querySelector('.vg-chart-type');
      const normChk = toolbar.querySelector('.vg-chart-normalize');
      if (typeSel && chartCfg.type) typeSel.value = chartCfg.type;
      if (normChk && typeof chartCfg.normalize === 'boolean') normChk.checked = chartCfg.normalize;
    } catch {}

    // Fill measures
    this._populateChartValueSelect();

    // Bind render
    toolbar.querySelector('.vg-chart-render')?.addEventListener('click', async () => {
      await this._renderPivotChart();
    });

    // Optional autorender
    const chartCfg = this.opts?.pivotConfig?.chart;
    if (chartCfg?.autorender) {
      this._renderPivotChart().catch(()=>{});
    }
  };

  // ---------- Patch: keep value select in sync after pivot updates ----------
  const _origUpdatePivotConfig = VG.prototype.updatePivotConfig;
  VG.prototype.updatePivotConfig = function (cfg) {
    _origUpdatePivotConfig.call(this, cfg);
    try { this._populateChartValueSelect(); } catch {}
    const chartCfg = this.opts?.pivotConfig?.chart;
    if (chartCfg?.autorender) this._renderPivotChart().catch(()=>{});
  };

  // ---------- Chart renderer (grouped/stacked columns) ----------
  VG.prototype._renderPivotChart = async function () {
    const container = this.root.querySelector('#vg-pivot-chart');
    if (!container) return;

    const pivot = this.state?.pivotData;
    if (!pivot || !pivot.rows || !pivot.columns) {
      container.innerHTML = '<div class="vg-pivot-chart-msg">Keine Pivot-Daten vorhanden.</div>';
      return;
    }

    // Load d3 on demand
    let d3;
    try {
      d3 = await this._ensureD3(this.opts?.d3Url);
    } catch (err) {
      container.innerHTML = '<div class="vg-pivot-chart-msg vg-error-msg">d3.js konnte nicht geladen werden.</div>';
      return;
    }

    // Read UI
    const toolbar = this.root.querySelector('.vg-toolbar');
    const typeSel = toolbar?.querySelector('.vg-chart-type');
    const valueSel = toolbar?.querySelector('.vg-chart-value');
    const normalize = !!toolbar?.querySelector('.vg-chart-normalize')?.checked;

    const chartType = typeSel?.value || this.opts?.pivotConfig?.chart?.type || 'grouped';
    const valueField = valueSel?.value || this.opts?.pivotConfig?.chart?.value || (pivot.columns.find(c => c.type === 'number')?.key.split('_')[0] || null);
    if (!valueField) {
      container.innerHTML = '<div class="vg-pivot-chart-msg">Keine numerische Kennzahl gefunden.</div>';
      return;
    }

    // Measures/series
    const numericCols = pivot.columns.filter(c => c.type === 'number');
    const measureCols = numericCols.filter(c => String(c.key).startsWith(valueField));
    let seriesKeys = measureCols
      .map(c => c.key.includes('_') ? c.key.slice(valueField.length + 1) : '')
      .filter((v, i, a) => a.indexOf(v) === i);
    if (seriesKeys.length === 0) seriesKeys = ['']; // single series

    // X-categories from row fields
    const rowFields = this.opts?.pivotConfig?.rows || [];
    const labelOfRow = (r) => {
      const label = rowFields.map(f => r[f]).filter(Boolean).join(' / ');
      return label || '(gesamt)';
    };
    const rows = pivot.rows;
    const xCats = rows.map(labelOfRow);

    const valueKey = (series) => (series ? `${valueField}_${series}` : valueField);

    // Normalize per category if requested
    const dataByCat = rows.map(r => {
      const vals = seriesKeys.map(s => +r[valueKey(s)] || 0);
      const sum = vals.reduce((a, b) => a + b, 0) || 1;
      return {
        label: labelOfRow(r),
        values: seriesKeys.map((s, i) => normalize ? (vals[i] / sum) : vals[i])
      };
    });

    // Clear container
    container.innerHTML = '';

    // Dimensions
    const margin = { top: 28, right: 16, bottom: Math.min(80, 16 + (xCats.length * 6)), left: 64 };
    const width = Math.max(320, container.clientWidth || 640);
    const height = Math.max(240, container.clientHeight || 320);
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const svg = d3.select(container)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('role', 'img')
      .attr('aria-label', 'Pivot Diagramm');

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // Scales
    const x0 = d3.scaleBand().domain(xCats).range([0, innerW]).paddingInner(0.2);
    const color = d3.scaleOrdinal().domain(seriesKeys).range(d3.schemeTableau10);

    let y, yAxisFormat;
    if (chartType === 'stacked') {
      const maxY = normalize ? 1 : (d3.max(dataByCat, d => d.values.reduce((a,b)=>a+b,0)) || 0);
      y = d3.scaleLinear().domain([0, maxY]).nice().range([innerH, 0]);
      yAxisFormat = normalize ? d3.format('.0%') : d3.format('~s');

      const keys = seriesKeys.map((s, i) => String(i));
      const stackedInput = dataByCat.map(d => {
        const obj = {};
        d.values.forEach((v, i) => obj[String(i)] = v);
        obj.__label = d.label;
        return obj;
      });
      const stack = d3.stack().keys(keys)(stackedInput);

      const layer = g.selectAll('.layer')
        .data(stack)
        .join('g')
        .attr('class', 'layer')
        .attr('fill', (d, i) => color(seriesKeys[i]));

      layer.selectAll('rect')
        .data(d => d.map((seg, idx) => ({ seg, idx })))
        .join('rect')
        .attr('x', d => x0(xCats[d.idx]))
        .attr('y', d => y(d.seg[1]))
        .attr('height', d => Math.max(0, y(d.seg[0]) - y(d.seg[1])))
        .attr('width', x0.bandwidth())
        .append('title')
        .text(d => formatTooltip(seriesKeys[+d.seg.key] || valueField, d.seg[1] - d.seg[0], normalize));

    } else {
      // grouped
      const x1 = d3.scaleBand().domain(seriesKeys).range([0, x0.bandwidth()]).padding(0.08);
      const maxY = d3.max(dataByCat, d => d3.max(d.values)) || 0;
      y = d3.scaleLinear().domain([0, normalize ? 1 : maxY]).nice().range([innerH, 0]);
      yAxisFormat = normalize ? d3.format('.0%') : d3.format('~s');

      const cat = g.selectAll('.cat')
        .data(dataByCat)
        .join('g')
        .attr('class', 'cat')
        .attr('transform', d => `translate(${x0(d.label)},0)`);

      cat.selectAll('rect')
        .data(d => d.values.map((v, i) => ({ series: seriesKeys[i], value: v })))
        .join('rect')
        .attr('x', d => x1(d.series))
        .attr('y', d => y(d.value))
        .attr('width', x1.bandwidth())
        .attr('height', d => innerH - y(d.value))
        .attr('fill', d => color(d.series))
        .append('title')
        .text(d => formatTooltip(d.series || valueField, d.value, normalize));
    }

    // Axes
    const xAxis = d3.axisBottom(x0).tickSizeOuter(0);
    const yAxis = d3.axisLeft(y).tickFormat(yAxisFormat).ticks(6);

    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(xAxis)
      .selectAll('text')
      .attr('dy', '0.9em')
      .attr('transform', xCats.length > 6 ? 'rotate(20)' : null)
      .style('text-anchor', xCats.length > 6 ? 'start' : 'middle');

    g.append('g').call(yAxis);

    // Legend (if multiple series)
    if (seriesKeys.length > 1 || seriesKeys[0] !== '') {
      const legend = svg.append('g').attr('transform', `translate(${margin.left},${12})`);
      const items = legend.selectAll('.lg')
        .data(seriesKeys)
        .join('g')
        .attr('class', 'lg')
        .attr('transform', (d, i) => `translate(${i * 120},0)`);

      items.append('rect')
        .attr('width', 12)
        .attr('height', 12)
        .attr('rx', 2).attr('ry', 2)
        .attr('fill', d => color(d));

      items.append('text')
        .attr('x', 18).attr('y', 10)
        .attr('font-size', 12)
        .text(d => d || valueField);
    }

    function formatTooltip(series, value, norm) {
      if (norm) {
        return (series ? series + ': ' : '') + (Math.round(value * 1000) / 10) + '%';
      }
      // thousand-sep
      try {
        return (series ? series + ': ' : '') + new Intl.NumberFormat().format(value);
      } catch {
        return (series ? series + ': ' : '') + String(value);
      }
    }
  };

  // ---------- Small utils ----------
  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }
  function escapeHtmlAttr(s) { return escapeHtml(s).replace(/"/g, '&quot;'); }
})(typeof window !== 'undefined' ? window : globalThis);
