/**
 * Contrôle structurel de la maquette (hors navigateur).
 *
 * - vérifie la coque (sidebar / topbar / palette / footer ou header public) ;
 * - vérifie qu'il y a exactement un lien de navigation actif ;
 * - vérifie que toutes les icônes `[data-icon]` ont été hydratées ;
 * - vérifie que chaque graphique `[data-*-chart]` contient bien un SVG ;
 * - remonte les erreurs JS de chargement.
 *
 * Usage : npm install (dans ce dossier, une seule fois) puis `npm run check`.
 */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const root = path.resolve(__dirname, '..');
const pages = [];
(function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    const st = fs.statSync(p);
    if (st.isDirectory() && f !== 'node_modules') walk(p);
    else if (f.endsWith('.html')) pages.push(p);
  }
})(root);
pages.sort();

let failures = 0;
for (const file of pages) {
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => errors.push('jsdom: ' + e.message));
  vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));
  let html = fs.readFileSync(file, 'utf8');
  // inline les scripts locaux pour que jsdom les exécute de façon synchrone
  html = html.replace(/<script src="([^"]+)"><\/script>/g, (m, src) => {
    const sp = path.resolve(path.dirname(file), src);
    return '<script>' + fs.readFileSync(sp, 'utf8') + '</script>';
  });
  const dom = new JSDOM(html, {
    url: 'file://' + file,
    runScripts: 'dangerously',
    resources: undefined,
    pretendToBeVisual: true,
    virtualConsole: vc
  });
  const { window } = dom;

  const check = () => {
    const doc = window.document;
    const isApp = doc.body.getAttribute('data-layout') === 'app';
    const report = [];
    if (isApp) {
      if (!doc.querySelector('.app-sidebar')) report.push('sidebar missing');
      if (!doc.querySelector('.app-topbar')) report.push('topbar missing');
      if (!doc.querySelector('[data-palette]')) report.push('palette missing');
      if (!doc.querySelector('.app-footer')) report.push('app-footer missing');
      const active = doc.querySelectorAll('.side-link.is-active').length;
      if (active !== 1) report.push('active nav links = ' + active);
    } else {
      if (!doc.querySelector('.site-header')) report.push('public header missing');
      if (!doc.querySelector('.site-footer')) report.push('footer missing');
      if (!doc.querySelector('.mobile-nav')) report.push('mobile nav missing');
    }
    // icônes non hydratées
    const leftovers = doc.querySelectorAll('[data-icon]').length;
    if (leftovers) report.push('un-hydrated icons: ' + leftovers);
    // graphiques vides
    doc.querySelectorAll('[data-line-chart],[data-bar-chart],[data-donut-chart],[data-spark]').forEach(el => {
      if (!el.querySelector('svg')) report.push('chart not rendered: ' + (el.getAttribute('data-line-chart') !== null ? 'line' : el.getAttribute('data-bar-chart') !== null ? 'bar' : el.getAttribute('data-donut-chart') !== null ? 'donut' : 'spark'));
    });
    if (errors.length) report.push('JS errors: ' + [...new Set(errors)].join(' | '));
    const status = report.length ? 'FAIL' : 'OK  ';
    if (report.length) failures++;
    console.log(status, path.relative(root, file), report.length ? '\n     ' + report.join('\n     ') : '');
    dom.window.close();
  };
  setTimeout(check, 120);
}

setTimeout(() => {
  console.log('\n' + (failures ? failures + ' page(s) with issues' : 'all pages OK'));
  process.exit(failures ? 1 : 0);
}, 6000);
