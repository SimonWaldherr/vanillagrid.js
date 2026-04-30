/*
 * VanillaGrid Pivot d3 Plugin v2
 * Advanced charts for Pivot mode with lazy-loaded d3.
 * See demo/pivot.html for usage examples.
 */
(function (global) {
  const win = (typeof window !== 'undefined') ? window : global;
  const VG = win.VanillaGrid;
  if (!VG) {
    console.warn('[VG Pivot d3] VanillaGrid not found. Load this plugin after vanillagrid.js');
    return;
  }
  if (VG.prototype.__vgPivotD3Patched) return;
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

  VG.prototype._populateChartValueSelect = function () {
    const sel = this.root.querySelector('.vg-chart-value');
    if (!sel || !this.state?.pivotData?.columns) return;

    const numericCols = this.state.pivotData.columns.filter(c => c.type === 'number');
    const measures = Array.from(new Set(numericCols.map(c => String(c.key).split('_')[0])));
    if (measures.length === 0) { sel.innerHTML = '<option value="">(none)</option>'; return; }
    const wanted = this.opts?.pivotConfig?.chart?.value;
    sel.innerHTML = measures.map(m => `<option value="${escapeHtmlAttr(m)}"${wanted===m?' selected':''}>${escapeHtml(m)}</option>`).join('');
  };

  // ---------- Insert chart panel into pivot toolbar ----------
  const _origRenderPivotToolbar = VG.prototype._renderPivotToolbar;
  VG.prototype._renderPivotToolbar = function () {
    _origRenderPivotToolbar.call(this);
    const toolbar = this.root.querySelector('.vg-toolbar');
    if (!toolbar) return;
    if (toolbar.querySelector('.vg-pivot-chart-panel')) return;

    const panel = document.createElement('div');
    panel.className = 'vg-pivot-chart-panel';
    panel.innerHTML = `
      <div class="vg-chart-header">
        <div class="vg-chart-title">📈 <strong>Data Visualization</strong></div>
        <button class="vg-chart-collapse-btn" aria-expanded="true">▼</button>
      </div>
      <div class="vg-chart-body">
        <div class="vg-chart-controls">
          <div class="vg-chart-control"><label>Chart Type</label><select class="vg-chart-type"><option value="grouped">Grouped Bars</option><option value="stacked">Stacked Bars</option><option value="line">Line</option><option value="pie">Pie</option></select></div>
          <div class="vg-chart-control"><label>Measure</label><select class="vg-chart-value"></select></div>
          <div class="vg-chart-control vg-chart-flags"><label><input type="checkbox" class="vg-chart-normalize" /> Normalize (%)</label><label><input type="checkbox" class="vg-chart-legend" checked /> Show legend</label><label><input type="checkbox" class="vg-chart-autorender" /> Auto-render</label></div>
          <div class="vg-chart-actions"><button class="vg-btn vg-chart-render">🔄 Render</button><button class="vg-btn vg-chart-export">📷 Export PNG</button></div>
        </div>
        <div class="vg-chart-container"><div class="vg-chart-wrapper"><div id="vg-pivot-chart" role="img"></div></div><div class="vg-chart-empty">Configure pivot and click Render</div></div>
      </div>
    `;
    toolbar.appendChild(panel);

    try {
      const cfg = this.opts?.pivotConfig?.chart || {};
      const type = panel.querySelector('.vg-chart-type'); if (type && cfg.type) type.value = cfg.type;
      const norm = panel.querySelector('.vg-chart-normalize'); if (norm && typeof cfg.normalize === 'boolean') norm.checked = cfg.normalize;
      const legend = panel.querySelector('.vg-chart-legend'); if (legend && typeof cfg.showLegend === 'boolean') legend.checked = cfg.showLegend;
      const autor = panel.querySelector('.vg-chart-autorender'); if (autor && typeof cfg.autorender === 'boolean') autor.checked = cfg.autorender;
    } catch (e) {}

    this._populateChartValueSelect();

    panel.querySelector('.vg-chart-collapse-btn')?.addEventListener('click', (e) => { panel.classList.toggle('collapsed'); e.currentTarget.setAttribute('aria-expanded', String(!panel.classList.contains('collapsed'))); });
    panel.querySelector('.vg-chart-render')?.addEventListener('click', async () => { await this._renderPivotChart(); });
    panel.querySelector('.vg-chart-export')?.addEventListener('click', () => { this._exportChartAsPng(); });

    const chartCfg = this.opts?.pivotConfig?.chart;
    if (chartCfg?.autorender) this._renderPivotChart().catch(()=>{});
  };

  // keep value select in sync after pivot updates
  const _origUpdatePivotConfig = VG.prototype.updatePivotConfig;
  VG.prototype.updatePivotConfig = function (cfg) {
    _origUpdatePivotConfig.call(this, cfg);
    try { this._populateChartValueSelect(); } catch {}
    const chartCfg = this.opts?.pivotConfig?.chart;
    if (chartCfg?.autorender) this._renderPivotChart().catch(()=>{});
  };

  VG.prototype._exportChartAsPng = function () {
    const svg = this.root.querySelector('#vg-pivot-chart svg'); if (!svg) return;
    const serializer = new XMLSerializer(); const svgString = serializer.serializeToString(svg);
    const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d'); const img = new Image();
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' }); const url = URL.createObjectURL(blob);
    img.onload = () => { canvas.width = img.width * 2; canvas.height = img.height * 2; ctx.scale(2,2); ctx.fillStyle = '#fff'; ctx.fillRect(0,0,img.width,img.height); ctx.drawImage(img,0,0); const pngUrl = canvas.toDataURL('image/png'); const a = document.createElement('a'); a.href = pngUrl; a.download = 'pivot-chart.png'; a.click(); URL.revokeObjectURL(url); };
    img.src = url;
  };

  VG.prototype._renderPivotChart = async function () {
    const chartEl = this.root.querySelector('#vg-pivot-chart'); const emptyEl = this.root.querySelector('.vg-chart-empty'); const wrapperEl = this.root.querySelector('.vg-chart-wrapper');
    if (!chartEl) return; const pivot = this.state?.pivotData; if (!pivot || !pivot.rows || !pivot.columns || pivot.rows.length === 0) { chartEl.innerHTML = ''; if (emptyEl) emptyEl.style.display = 'flex'; if (wrapperEl) wrapperEl.style.display = 'none'; return; }
    let d3; try { d3 = await this._ensureD3(this.opts?.d3Url); } catch (err) { chartEl.innerHTML = '<div class="vg-chart-error">Failed to load d3</div>'; return; }

    const panel = this.root.querySelector('.vg-pivot-chart-panel');
    const typeSel = panel?.querySelector('.vg-chart-type'); const valueSel = panel?.querySelector('.vg-chart-value');
    const normalize = !!panel?.querySelector('.vg-chart-normalize')?.checked; const showLegend = !!panel?.querySelector('.vg-chart-legend')?.checked;
    const chartType = typeSel?.value || this.opts?.pivotConfig?.chart?.type || 'grouped';
    const valueField = valueSel?.value || this.opts?.pivotConfig?.chart?.value || (pivot.columns.find(c => c.type === 'number')?.key.split('_')[0] || null);
    if (!valueField) { chartEl.innerHTML = '<div class="vg-chart-error">No numeric measure</div>'; return; }

    if (emptyEl) emptyEl.style.display = 'none'; if (wrapperEl) wrapperEl.style.display = 'block';

    const numericCols = pivot.columns.filter(c => c.type === 'number');
    const measureCols = numericCols.filter(c => String(c.key).startsWith(valueField));
    let seriesKeys = measureCols.map(c => c.key.includes('_') ? c.key.slice(valueField.length + 1) : '').filter((v,i,a)=>a.indexOf(v)===i);
    if (seriesKeys.length === 0) seriesKeys = [''];

    const rowFields = this.opts?.pivotConfig?.rows || [];
    const labelOfRow = (r) => { const label = rowFields.map(f => r[f]).filter(Boolean).join(' / '); return label || '(total)'; };
    const rows = pivot.rows; const xCats = rows.map(labelOfRow);
    const valueKey = (series) => (series ? `${valueField}_${series}` : valueField);
    const dataByCat = rows.map(r => { const vals = seriesKeys.map(s => +r[valueKey(s)] || 0); const sum = vals.reduce((a,b)=>a+b,0)||1; return { label: labelOfRow(r), values: seriesKeys.map((s,i)=> normalize ? (vals[i]/sum) : vals[i]) }; });

    chartEl.innerHTML = '';
    // reuse existing renderer functions if available (keeps compatibility with previous plugin versions)
    if (chartType === 'pie' && this._renderPieChart) this._renderPieChart(d3, chartEl, dataByCat, seriesKeys, valueField, showLegend);
    else if (chartType === 'line' && this._renderLineChart) this._renderLineChart(d3, chartEl, dataByCat, xCats, seriesKeys, valueField, normalize, showLegend);
    else if (this._renderBarChart) this._renderBarChart(d3, chartEl, dataByCat, xCats, seriesKeys, valueField, chartType, normalize, showLegend);
    else chartEl.innerHTML = '<div class="vg-chart-error">No renderer available</div>';
  };

  // Minimal render helpers (grouped/stacked/line/pie implementations are intentionally compact)
  VG.prototype._renderBarChart = function (d3, container, dataByCat, xCats, seriesKeys, valueField, chartType, normalize, showLegend) {
    const margin = { top: showLegend ? 40 : 20, right: 24, bottom: Math.min(100, 40 + (xCats.length * 4)), left: 70 };
    const width = Math.max(400, container.clientWidth || 640); const height = Math.max(300, container.clientHeight || 360);
    const innerW = width - margin.left - margin.right; const innerH = height - margin.top - margin.bottom;
    const svg = d3.select(container).append('svg').attr('width', width).attr('height', height).attr('role','img');
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
    const x0 = d3.scaleBand().domain(xCats).range([0, innerW]).paddingInner(0.2);
    const color = d3.scaleOrdinal().domain(seriesKeys).range(d3.schemeTableau10);
    let y;
    if (chartType === 'stacked') {
      const maxY = normalize ? 1 : (d3.max(dataByCat, d => d.values.reduce((a,b)=>a+b,0)) || 0);
      y = d3.scaleLinear().domain([0, maxY]).nice().range([innerH, 0]);
      const keys = seriesKeys.map((s,i)=>String(i));
      const stackedInput = dataByCat.map(d => { const obj = {}; d.values.forEach((v,i)=> obj[String(i)] = v); return obj; });
      const stack = d3.stack().keys(keys)(stackedInput);
      const layer = g.selectAll('.layer').data(stack).join('g').attr('fill',(d,i)=>color(seriesKeys[i]));
      layer.selectAll('rect').data(d=>d.map((seg,idx)=>({seg,idx}))).join('rect').attr('x',d=>x0(xCats[d.idx])).attr('y',d=>y(d.seg[1])).attr('height',d=>Math.max(0,y(d.seg[0])-y(d.seg[1]))).attr('width',x0.bandwidth()).attr('rx',2).append('title').text(d=>formatTooltip(seriesKeys[+d.seg.key]||valueField,d.seg[1]-d.seg[0],normalize));
    } else {
      const x1 = d3.scaleBand().domain(seriesKeys).range([0, x0.bandwidth()]).padding(0.08);
      const maxY = d3.max(dataByCat, d => d3.max(d.values)) || 0;
      y = d3.scaleLinear().domain([0, normalize ? 1 : maxY]).nice().range([innerH, 0]);
      const cat = g.selectAll('.cat').data(dataByCat).join('g').attr('transform', d => `translate(${x0(d.label)},0)`);
      cat.selectAll('rect').data(d=>d.values.map((v,i)=>({series: seriesKeys[i], value: v}))).join('rect').attr('x',d=>x1(d.series)).attr('y',d=>y(d.value)).attr('width',x1.bandwidth()).attr('height',d=>innerH-y(d.value)).attr('fill',d=>color(d.series)).attr('rx',2).append('title').text(d=>formatTooltip(d.series||valueField,d.value,normalize));
    }
    g.append('g').attr('transform',`translate(0,${innerH})`).call(d3.axisBottom(x0)).selectAll('text').attr('transform', xCats.length>6?'rotate(-35)':null).style('text-anchor', xCats.length>6?'end':'middle');
    g.append('g').call(d3.axisLeft(y).ticks(6));
    if (showLegend && (seriesKeys.length>1 || seriesKeys[0] !== '')) this._renderLegend(d3, svg, seriesKeys, valueField, color, margin.left, 12, innerW);
  };

  VG.prototype._renderLineChart = function (d3, container, dataByCat, xCats, seriesKeys, valueField, normalize, showLegend) {
    const margin = { top: showLegend ? 40 : 20, right: 24, bottom: Math.min(100, 40 + (xCats.length * 4)), left: 70 };
    const width = Math.max(400, container.clientWidth || 640); const height = Math.max(300, container.clientHeight || 360);
    const innerW = width - margin.left - margin.right; const innerH = height - margin.top - margin.bottom;
    const svg = d3.select(container).append('svg').attr('width',width).attr('height',height).attr('role','img'); const g = svg.append('g').attr('transform',`translate(${margin.left},${margin.top})`);
    const x = d3.scalePoint().domain(xCats).range([0, innerW]).padding(0.5); const color = d3.scaleOrdinal().domain(seriesKeys).range(d3.schemeTableau10);
    const maxY = d3.max(dataByCat, d=>d3.max(d.values))||0; const y = d3.scaleLinear().domain([0, normalize?1:maxY]).nice().range([innerH,0]);
    g.append('g').call(d3.axisLeft(y).tickSize(-innerW).tickFormat('').ticks(6)).selectAll('line').style('stroke','#e5e7eb').style('stroke-dasharray','3,3');
    seriesKeys.forEach((series,si)=>{ const lineData = dataByCat.map((d,i)=>({x:xCats[i],y:d.values[si]})); const line = d3.line().x(d=>x(d.x)).y(d=>y(d.y)).curve(d3.curveMonotoneX); g.append('path').datum(lineData).attr('fill','none').attr('stroke',color(series)).attr('stroke-width',2.5).attr('d',line); g.selectAll(`.vg-point-${si}`).data(lineData).join('circle').attr('cx',d=>x(d.x)).attr('cy',d=>y(d.y)).attr('r',5).attr('fill',color(series)).attr('stroke','#fff').attr('stroke-width',2).append('title').text(d=>formatTooltip(series||valueField,d.y,normalize)); });
    g.append('g').attr('transform',`translate(0,${innerH})`).call(d3.axisBottom(x)).selectAll('text').attr('transform', xCats.length>6?'rotate(-35)':null).style('text-anchor', xCats.length>6?'end':'middle');
    g.append('g').call(d3.axisLeft(y).ticks(6));
    if (showLegend && (seriesKeys.length>1 || seriesKeys[0] !== '')) this._renderLegend(d3, svg, seriesKeys, valueField, color, margin.left, 12, innerW);
  };

  VG.prototype._renderPieChart = function (d3, container, dataByCat, seriesKeys, valueField, showLegend) {
    const width = Math.max(400, container.clientWidth || 500); const height = Math.max(300, container.clientHeight || 360); const radius = Math.min(width,height)/2 - 40;
    const svg = d3.select(container).append('svg').attr('width',width).attr('height',height).attr('role','img'); const g = svg.append('g').attr('transform',`translate(${width/2},${height/2})`);
    const pieData = dataByCat.map(d=>({label:d.label,value:d.values[0]||0})).filter(d=>d.value>0); const color = d3.scaleOrdinal().domain(pieData.map(d=>d.label)).range(d3.schemeTableau10);
    const pie = d3.pie().value(d=>d.value).sort(null); const arc = d3.arc().innerRadius(radius*0.4).outerRadius(radius);
    const arcs = g.selectAll('.arc').data(pie(pieData)).join('g').attr('class','arc');
    arcs.append('path').attr('d',arc).attr('fill',d=>color(d.data.label)).attr('stroke','#fff').attr('stroke-width',2).append('title').text(d=>{ const total = pieData.reduce((a,b)=>a+b.value,0); const pct = ((d.data.value/total)*100).toFixed(1); return `${d.data.label}: ${formatNumber(d.data.value)} (${pct}%)`; });
    if (showLegend) { const legend = svg.append('g').attr('transform',`translate(${width-120},20)`); pieData.slice(0,8).forEach((d,i)=>{ const item = legend.append('g').attr('transform',`translate(0,${i*20})`); item.append('rect').attr('width',12).attr('height',12).attr('rx',2).attr('fill',color(d.label)); item.append('text').attr('x',18).attr('y',10).attr('font-size',11).attr('fill','#374151').text(d.label.length>12?d.label.slice(0,12)+'…':d.label); }); }
  };

  VG.prototype._renderLegend = function (d3, svg, seriesKeys, valueField, color, x, y, maxWidth) {
    const legend = svg.append('g').attr('transform', `translate(${x},${y})`); let currentX = 0; const items = legend.selectAll('.lg').data(seriesKeys).join('g').attr('transform',(d,i)=>{const pos=currentX; currentX += Math.min(120, maxWidth/seriesKeys.length); return `translate(${pos},0)`;}); items.append('rect').attr('width',12).attr('height',12).attr('rx',2).attr('fill',d=>color(d)); items.append('text').attr('x',18).attr('y',10).attr('font-size',11).attr('fill','#374151').text(d=> (d||valueField).length>15?(d||valueField).slice(0,15)+'…':(d||valueField));
  };

  function formatTooltip(series, value, norm) { if (norm) return (series?series+': ':'') + (Math.round(value*1000)/10) + '%'; return (series?series+': ':'') + formatNumber(value); }
  function formatNumber(value) { try { return new Intl.NumberFormat().format(value); } catch { return String(value); } }
  function escapeHtml(s) { return String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
  function escapeHtmlAttr(s) { return escapeHtml(s).replace(/"/g, '&quot;'); }
})(typeof window !== 'undefined' ? window : globalThis);
