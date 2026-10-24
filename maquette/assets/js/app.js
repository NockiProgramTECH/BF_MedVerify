/* ==========================================================================
   BF-MedVerify — app.js
   Interactions du pilotage : tiroirs, onglets, filtres de tableaux, graphiques
   SVG sans dépendance, formulaires de démonstration, copie de secrets.
   ========================================================================== */
(function () {
  'use strict';

  const fmt = function (n) { return Number(n).toLocaleString('fr-FR'); };

  /* ----------------------------------------------------------------------
     1. Tiroirs
     ---------------------------------------------------------------------- */
  let backdrop = document.querySelector('.drawer-backdrop');
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.className = 'drawer-backdrop';
    document.body.appendChild(backdrop);
  }

  function closeDrawers() {
    document.querySelectorAll('.drawer.is-open').forEach(function (d) {
      d.classList.remove('is-open');
      d.setAttribute('inert', '');
    });
    document.body.classList.remove('drawer-open');
  }

  function openDrawer(id) {
    const drawer = document.getElementById(id);
    if (!drawer) return;
    closeDrawers();
    drawer.classList.add('is-open');
    drawer.removeAttribute('inert');
    document.body.classList.add('drawer-open');
    const focusable = drawer.querySelector('[data-drawer-close], button, a, input, select');
    if (focusable) setTimeout(function () { focusable.focus(); }, 80);
  }

  document.querySelectorAll('[data-drawer]').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      if (btn.tagName === 'A') e.preventDefault();
      openDrawer(btn.getAttribute('data-drawer'));
    });
  });
  document.querySelectorAll('[data-drawer-close]').forEach(function (btn) {
    btn.addEventListener('click', closeDrawers);
  });
  backdrop.addEventListener('click', closeDrawers);

  document.querySelectorAll('.row-click').forEach(function (row) {
    row.addEventListener('click', function (e) {
      if (e.target.closest('a, button, input, select')) return;
      const id = row.getAttribute('data-drawer-target');
      if (id) openDrawer(id);
    });
    row.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const id = row.getAttribute('data-drawer-target');
        if (id) openDrawer(id);
      }
    });
  });

  /* ----------------------------------------------------------------------
     2. Onglets
     ---------------------------------------------------------------------- */
  document.querySelectorAll('[data-tabs]').forEach(function (group) {
    const buttons = group.querySelectorAll('[data-tab]');
    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        const target = btn.getAttribute('data-tab');
        buttons.forEach(function (b) {
          const on = b === btn;
          b.classList.toggle('is-active', on);
          b.setAttribute('aria-selected', String(on));
        });
        document.querySelectorAll('[data-tab-panel]').forEach(function (panel) {
          panel.hidden = panel.getAttribute('data-tab-panel') !== target;
        });
      });
    });
  });

  /* ----------------------------------------------------------------------
     3. Contrôles segmentés (visuel)
     ---------------------------------------------------------------------- */
  document.querySelectorAll('.segmented[data-segmented]').forEach(function (group) {
    group.addEventListener('click', function (e) {
      const btn = e.target.closest('button');
      if (!btn || !group.contains(btn)) return;
      group.querySelectorAll('button').forEach(function (b) { b.classList.remove('is-active'); });
      btn.classList.add('is-active');
      const label = btn.textContent.trim();
      if (window.BFMV) window.BFMV.toast('Période de démonstration : ' + label + '.', 'info');
    });
  });

  /* ----------------------------------------------------------------------
     4. Filtres de tableaux et recherche
     ---------------------------------------------------------------------- */
  function refreshTable(table) {
    if (!table) return;
    const filterGroup = document.querySelector('[data-filter-target="#' + table.id + '"]');
    const activeChip = filterGroup ? filterGroup.querySelector('.filter-chip.is-active') : null;
    const activeValue = activeChip ? activeChip.getAttribute('data-filter') : 'all';
    const searchInput = document.querySelector('[data-search-target="#' + table.id + '"]');
    const term = searchInput ? searchInput.value.trim().toLowerCase() : '';

    let visible = 0;
    table.querySelectorAll('tbody tr').forEach(function (row) {
      const tags = (row.getAttribute('data-tags') || '').toLowerCase();
      const matchesFilter = activeValue === 'all' || tags.split(/\s+/).indexOf(activeValue) !== -1;
      const matchesSearch = !term || row.textContent.toLowerCase().indexOf(term) !== -1;
      const show = matchesFilter && matchesSearch;
      row.hidden = !show;
      if (show) visible++;
    });

    document.querySelectorAll('[data-visible-count="' + table.id + '"]').forEach(function (el) {
      el.textContent = visible;
    });
    const empty = (table.parentElement || table).querySelector('[data-table-empty]');
    if (empty) empty.hidden = visible !== 0;
  }

  document.querySelectorAll('.data-table[id]').forEach(refreshTable);

  document.querySelectorAll('[data-filter-group]').forEach(function (group) {
    group.querySelectorAll('.filter-chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        group.querySelectorAll('.filter-chip').forEach(function (c) { c.classList.remove('is-active'); });
        chip.classList.add('is-active');
        const target = group.getAttribute('data-filter-target') || '';
        const table = document.querySelector(target);
        refreshTable(table);
      });
    });
  });

  document.querySelectorAll('[data-search-target]').forEach(function (input) {
    input.addEventListener('input', function () {
      refreshTable(document.querySelector(input.getAttribute('data-search-target')));
    });
  });

  document.querySelectorAll('[data-filter-reset]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const selector = btn.getAttribute('data-filter-group');
      let group = null;
      if (selector) {
        try { group = document.querySelector(selector); } catch (err) { group = null; }
      }
      if (!group) group = btn.closest('.toolbar') ? btn.closest('.toolbar').querySelector('[data-filter-group]') : null;
      if (!group) group = document.querySelector('[data-filter-group]');
      if (group) {
        group.querySelectorAll('.filter-chip').forEach(function (c, i) {
          c.classList.toggle('is-active', i === 0);
        });
      }
      document.querySelectorAll('[data-table-search]').forEach(function (input) { input.value = ''; });
      document.querySelectorAll('.data-table[id]').forEach(refreshTable);
    });
  });

  /* ----------------------------------------------------------------------
     5. Graphiques SVG
     ---------------------------------------------------------------------- */
  function smoothPath(points) {
    if (points.length < 2) return '';
    let d = 'M' + points[0].x.toFixed(1) + ',' + points[0].y.toFixed(1);
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i - 1] || points[i];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2] || p2;
      const c1x = p1.x + (p2.x - p0.x) / 6;
      const c1y = p1.y + (p2.y - p0.y) / 6;
      const c2x = p2.x - (p3.x - p1.x) / 6;
      const c2y = p2.y - (p3.y - p1.y) / 6;
      d += ' C' + c1x.toFixed(1) + ',' + c1y.toFixed(1) + ' ' + c2x.toFixed(1) + ',' + c2y.toFixed(1) + ' ' + p2.x.toFixed(1) + ',' + p2.y.toFixed(1);
    }
    return d;
  }

  function niceMax(max) {
    if (max <= 0) return 10;
    const pow = Math.pow(10, Math.floor(Math.log10(max)));
    const n = max / pow;
    const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
    return step * pow;
  }

  function renderLineChart(container) {
    const values = (container.getAttribute('data-values') || '').split(',').map(Number).filter(function (v) { return !isNaN(v); });
    if (!values.length) return;
    const values2 = (container.getAttribute('data-values-2') || '').split(',').map(Number).filter(function (v) { return !isNaN(v); });
    const labels = (container.getAttribute('data-labels') || '').split(',');
    const w = 620;
    const h = Number(container.getAttribute('data-height') || 220);
    const pad = { l: 38, r: 12, t: 14, b: 26 };
    const max = niceMax(Math.max.apply(null, values.concat(values2.length ? values2 : [0])) * 1.12);
    const min = 0;
    const innerW = w - pad.l - pad.r;
    const innerH = h - pad.t - pad.b;

    const xAt = function (i, n) { return pad.l + (i * innerW) / Math.max(1, n - 1); };
    const yAt = function (v) { return pad.t + (1 - (v - min) / (max - min)) * innerH; };

    const pts = values.map(function (v, i) { return { x: xAt(i, values.length), y: yAt(v), v: v }; });
    const line = smoothPath(pts);
    const area = line + ' L' + pts[pts.length - 1].x.toFixed(1) + ',' + (pad.t + innerH) + ' L' + pts[0].x.toFixed(1) + ',' + (pad.t + innerH) + ' Z';

    let svg = '<svg viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="' + (container.getAttribute('data-label') || 'Graphique de vérifications') + '">';

    for (let g = 0; g <= 4; g++) {
      const y = pad.t + (g * innerH) / 4;
      const val = max - (g * max) / 4;
      svg += '<line class="chart-grid-line" x1="' + pad.l + '" y1="' + y.toFixed(1) + '" x2="' + (w - pad.r) + '" y2="' + y.toFixed(1) + '"/>';
      svg += '<text class="chart-axis" x="' + (pad.l - 7) + '" y="' + (y + 3).toFixed(1) + '" text-anchor="end">' + fmt(Math.round(val)) + '</text>';
    }

    if (labels.length) {
      const step = Math.ceil(labels.length / 8);
      labels.forEach(function (lb, i) {
        if (i % step !== 0 && i !== labels.length - 1) return;
        svg += '<text class="chart-axis" x="' + xAt(i, labels.length).toFixed(1) + '" y="' + (h - 7) + '" text-anchor="middle">' + lb.trim() + '</text>';
      });
    }

    svg += '<path class="chart-area" d="' + area + '"/>';
    svg += '<path class="chart-line line-anim" pathLength="1" d="' + line + '"/>';

    if (values2.length) {
      const pts2 = values2.map(function (v, i) { return { x: xAt(i, values2.length), y: yAt(v), v: v }; });
      svg += '<path class="chart-line chart-line--gold" d="' + smoothPath(pts2) + '"/>';
    }

    pts.forEach(function (p, i) {
      const lbl = labels[i] || ('point ' + (i + 1));
      svg += '<circle class="chart-point" cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="3.4"><title>' + lbl.trim() + ' : ' + fmt(p.v) + '</title></circle>';
    });

    svg += '</svg>';
    container.innerHTML = svg;
  }

  function renderBarChart(container) {
    const values = (container.getAttribute('data-values') || '').split(',').map(Number).filter(function (v) { return !isNaN(v); });
    if (!values.length) return;
    const labels = (container.getAttribute('data-labels') || '').split(',');
    const w = 620;
    const h = Number(container.getAttribute('data-height') || 200);
    const pad = { l: 34, r: 8, t: 12, b: 24 };
    const max = niceMax(Math.max.apply(null, values) * 1.1);
    const innerW = w - pad.l - pad.r;
    const innerH = h - pad.t - pad.b;
    const slot = innerW / values.length;
    const bw = Math.min(22, slot * 0.55);

    let svg = '<svg viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="' + (container.getAttribute('data-label') || 'Graphique en barres') + '">';
    for (let g = 0; g <= 3; g++) {
      const y = pad.t + (g * innerH) / 3;
      const val = max - (g * max) / 3;
      svg += '<line class="chart-grid-line" x1="' + pad.l + '" y1="' + y.toFixed(1) + '" x2="' + (w - pad.r) + '" y2="' + y.toFixed(1) + '"/>';
      svg += '<text class="chart-axis" x="' + (pad.l - 6) + '" y="' + (y + 3).toFixed(1) + '" text-anchor="end">' + fmt(Math.round(val)) + '</text>';
    }
    values.forEach(function (v, i) {
      const bh = (v / max) * innerH;
      const x = pad.l + i * slot + (slot - bw) / 2;
      const y = pad.t + innerH - bh;
      const colorAttr = container.getAttribute('data-bar-color');
      const cls = colorAttr === 'gold' ? 'chart-bar chart-bar--gold' : colorAttr === 'red' ? 'chart-bar chart-bar--red' : 'chart-bar';
      svg += '<rect class="' + cls + '" x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + Math.max(1, bh).toFixed(1) + '" rx="2"><title>' + (labels[i] || '') + ' : ' + fmt(v) + '</title></rect>';
      if (labels.length) {
        const step = Math.ceil(labels.length / 9);
        if (i % step === 0) {
          svg += '<text class="chart-axis" x="' + (x + bw / 2).toFixed(1) + '" y="' + (h - 6) + '" text-anchor="middle">' + labels[i].trim() + '</text>';
        }
      }
    });
    svg += '</svg>';
    container.innerHTML = svg;
  }

  function renderDonut(container) {
    const values = (container.getAttribute('data-values') || '').split(',').map(Number).filter(function (v) { return !isNaN(v); });
    if (!values.length) return;
    const colors = (container.getAttribute('data-colors') || '#0e5535,#e6b41c,#bf2b32,#c9bfac').split(',');
    const total = values.reduce(function (a, b) { return a + b; }, 0);
    const r = 42;
    const circ = 2 * Math.PI * r;
    const center = container.getAttribute('data-center') || fmt(total);
    const label = container.getAttribute('data-center-label') || 'total';
    let offset = 0;
    let svg = '<svg viewBox="0 0 120 120" role="img" aria-label="' + (container.getAttribute('data-label') || 'Répartition') + '">';
    svg += '<circle cx="60" cy="60" r="' + r + '" fill="none" stroke="#eae3d5" stroke-width="12"/>';
    values.forEach(function (v, i) {
      const len = (v / total) * circ;
      const gap = 1.6;
      svg += '<circle cx="60" cy="60" r="' + r + '" fill="none" stroke="' + colors[i % colors.length] + '" stroke-width="12" stroke-linecap="butt" stroke-dasharray="' + Math.max(0, len - gap).toFixed(2) + ' ' + (circ - Math.max(0, len - gap)).toFixed(2) + '" stroke-dashoffset="' + (-offset).toFixed(2) + '" transform="rotate(-90 60 60)"/>';
      offset += len;
    });
    svg += '<text x="60" y="58" text-anchor="middle" font-family="ui-sans-serif, system-ui, sans-serif" font-size="17" font-weight="650" fill="#14241b">' + center + '</text>';
    svg += '<text x="60" y="72" text-anchor="middle" font-family="ui-sans-serif, system-ui, sans-serif" font-size="7.5" fill="#5b6a5f">' + label + '</text>';
    svg += '</svg>';
    container.innerHTML = svg;
  }

  function renderSpark(container) {
    const values = (container.getAttribute('data-spark') || '').split(',').map(Number).filter(function (v) { return !isNaN(v); });
    if (values.length < 2) return;
    const w = 120, h = 30, pad = 2;
    const max = Math.max.apply(null, values);
    const min = Math.min.apply(null, values);
    const span = Math.max(1, max - min);
    const pts = values.map(function (v, i) {
      return {
        x: (i * (w - pad * 2)) / (values.length - 1) + pad,
        y: h - pad - ((v - min) / span) * (h - pad * 2)
      };
    });
    const line = smoothPath(pts);
    const area = line + ' L' + pts[pts.length - 1].x + ',' + h + ' L' + pts[0].x + ',' + h + ' Z';
    const color = container.getAttribute('data-spark-color') || '#146b44';
    container.innerHTML = '<svg class="spark-svg" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none"><path class="spark-fill" d="' + area + '" fill="rgba(20,107,68,.08)"/><path d="' + line + '" fill="none" stroke="' + color + '" stroke-width="1.8" stroke-linecap="round"/></svg>';
  }

  document.querySelectorAll('[data-line-chart]').forEach(renderLineChart);
  document.querySelectorAll('[data-bar-chart]').forEach(renderBarChart);
  document.querySelectorAll('[data-donut-chart]').forEach(renderDonut);
  document.querySelectorAll('[data-spark]').forEach(renderSpark);

  /* ----------------------------------------------------------------------
     6. Copie, secrets, actions de démonstration
     ---------------------------------------------------------------------- */
  document.querySelectorAll('[data-copy]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const el = document.querySelector(btn.getAttribute('data-copy'));
      if (!el) return;
      const text = el.textContent.trim();
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).catch(function () {});
      }
      if (window.BFMV) window.BFMV.toast('Copié dans le presse-papiers (démonstration).', 'info');
    });
  });

  document.querySelectorAll('[data-reveal-secret]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const target = document.getElementById(btn.getAttribute('data-reveal-secret'));
      if (!target) return;
      const revealed = btn.getAttribute('data-revealed') === 'true';
      if (revealed) {
        target.textContent = '••••••••••••••••••••';
        btn.setAttribute('data-revealed', 'false');
        btn.textContent = 'Révéler';
      } else {
        target.textContent = btn.getAttribute('data-secret-value') || 'secret-demo';
        btn.setAttribute('data-revealed', 'true');
        btn.textContent = 'Masquer';
        if (window.BFMV) window.BFMV.toast('Secret affiché en mode démonstration uniquement.', 'danger');
      }
    });
  });

  document.querySelectorAll('[data-demo-form]').forEach(function (formEl) {
    formEl.addEventListener('submit', function (e) {
      e.preventDefault();
      const message = formEl.getAttribute('data-demo-form') || 'Enregistré (démonstration) — aucun envoi réel.';
      if (window.BFMV) window.BFMV.toast(message, 'info');
      formEl.reset();
      closeDrawers();
    });
  });

  document.querySelectorAll('[data-demo-action]').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      if (window.BFMV) window.BFMV.toast(btn.getAttribute('data-demo-action'), btn.getAttribute('data-demo-kind') || 'info');
    });
  });

  /* Activité live simulée (pastille) */
  const liveDot = document.querySelector('[data-live-dot]');
  if (liveDot) {
    setInterval(function () {
      liveDot.classList.remove('pulse-once');
      void liveDot.offsetWidth;
      liveDot.classList.add('pulse-once');
    }, 8000);
  }

  /* Compteurs de pagination : simple état visuel */
  document.querySelectorAll('.pagination').forEach(function (group) {
    group.addEventListener('click', function (e) {
      const btn = e.target.closest('button[data-page]');
      if (!btn) return;
      group.querySelectorAll('button[data-page]').forEach(function (b) { b.classList.remove('is-active'); });
      btn.classList.add('is-active');
      if (window.BFMV) window.BFMV.toast('Page ' + btn.textContent.trim() + ' (pagination de démonstration).', 'info');
    });
  });
})();
