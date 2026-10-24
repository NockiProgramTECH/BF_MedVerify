/**
 * Tests d'interaction de la maquette (hors navigateur, via jsdom).
 *
 * Couvre : filtres de tableau, recherche vide, réinitialisation, tiroirs
 * (ouverture / fermeture / Échap), palette Ctrl+K, toast, onglets,
 * simulateur de vérification (3 scénarios) et absence d'erreur JS.
 *
 * Usage : npm install (dans ce dossier, une seule fois) puis `npm run interactions`.
 */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const root = path.resolve(__dirname, '..');

function load(rel) {
  const file = path.join(root, rel);
  let html = fs.readFileSync(file, 'utf8');
  html = html.replace(/<script src="([^"]+)"><\/script>/g, (m, src) =>
    '<script>' + fs.readFileSync(path.resolve(path.dirname(file), src), 'utf8') + '</script>');
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => errors.push(e.message));
  const dom = new JSDOM(html, { url: 'file://' + file, runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc });
  return { dom, window: dom.window, doc: dom.window.document, errors };
}

function click(el) {
  el.dispatchEvent(new el.ownerDocument.defaultView.MouseEvent('click', { bubbles: true, cancelable: true }));
}
const out = [];
const fail = m => out.push('FAIL ' + m);
const ok = m => out.push('ok   ' + m);

/* ---------- 1. Alertes : filtres + tiroirs ---------- */
{
  const { window, doc, errors } = load('app/alertes.html');
  const rows = () => [...doc.querySelectorAll('#table-alertes tbody tr')].filter(r => !r.hidden);
  const before = rows().length;
  const chipCritique = doc.querySelector('[data-filter="critique"]');
  click(chipCritique);
  const afterCritique = rows().length;
  const tagsOk = rows().every(r => r.getAttribute('data-tags').includes('critique'));
  afterCritique > 0 && afterCritique < before && tagsOk ? ok('filtre critique : ' + before + ' → ' + afterCritique) : fail('filtre critique');

  const search = doc.querySelector('[data-search-target="#table-alertes"]');
  search.value = 'zzzz-introuvable';
  search.dispatchEvent(new window.Event('input', { bubbles: true }));
  rows().length === 0 && !doc.querySelector('[data-table-empty]').hidden ? ok('recherche vide + message') : fail('recherche vide');

  doc.querySelector('[data-filter-reset]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  rows().length === before ? ok('réinitialisation des filtres') : fail('reset filtres');

  // ouvrir/fermer un tiroir
  const btn = doc.querySelector('[data-drawer="drawer-alerte-copie"]');
  click(btn);
  const drawer = doc.getElementById('drawer-alerte-copie');
  drawer.classList.contains('is-open') && doc.body.classList.contains('drawer-open') ? ok('ouverture du tiroir') : fail('ouverture tiroir');
  click(doc.querySelector('#drawer-alerte-copie [data-drawer-close]'));
  !drawer.classList.contains('is-open') ? ok('fermeture du tiroir') : fail('fermeture tiroir');

  // Échap ferme
  click(btn);
  doc.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  !drawer.classList.contains('is-open') ? ok('Échap ferme le tiroir') : fail('Échap');

  // palette Ctrl+K
  doc.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true, cancelable: true }));
  const palette = doc.querySelector('[data-palette]');
  !palette.hidden ? ok('palette Ctrl+K ouverte') : fail('palette');
  const input = doc.querySelector('[data-palette-input]');
  input.value = 'verif';
  input.dispatchEvent(new window.Event('input', { bubbles: true }));
  const visible = [...palette.querySelectorAll('li')].filter(li => !li.hidden).length;
  visible > 0 ? ok('palette filtrage : ' + visible + ' résultat(s)') : fail('palette filtrage');

  // toast
  const toastBtn = doc.querySelector('[data-demo-action]');
  click(toastBtn);
  doc.querySelector('.toast.is-visible') ? ok('toast affiché') : fail('toast');
  errors.length ? fail('erreurs JS alertes : ' + errors.join(' | ')) : ok('aucune erreur JS (alertes)');
  window.close();
}

/* ---------- 2. Médicaments : onglets + table ---------- */
{
  const { window, doc, errors } = load('app/medicaments.html');
  const tabCodes = doc.querySelector('[data-tab="codes"]');
  click(tabCodes);
  const panel = doc.querySelector('[data-tab-panel="codes"]');
  !panel.hidden && doc.querySelector('[data-tab-panel="lots"]').hidden ? ok('bascule d’onglet') : fail('onglets');
  const malecrit = doc.querySelector('[data-filter="rappel"]');
  click(malecrit);
  const rows = [...doc.querySelectorAll('#table-lots tbody tr')].filter(r => !r.hidden);
  rows.length === 1 && rows[0].getAttribute('data-tags') === 'rappel' ? ok('filtre rappel = 1 lot') : fail('filtre rappel');
  errors.length ? fail('erreurs JS médicaments : ' + errors.join(' | ')) : ok('aucune erreur JS (médicaments)');
  window.close();
}

/* ---------- 3. Simulateur ---------- */
{
  const { window, doc, errors } = load('verifier.html');
  const form = doc.querySelector('[data-verif-form]');
  const input = doc.querySelector('[data-code-input]');
  input.value = 'BF7K2M9Q4XZ';
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  setTimeout(() => {
    const panel = doc.querySelector('[data-result-panel]');
    const html = panel.innerHTML;
    const okVerdict = /AUTHENTIQUE|Authentique/.test(html);
    okVerdict && html.includes('Paracétamol 500 mg') ? ok('simulateur : code authentique rendu') : fail('simulateur authentique');
    const bubbles = doc.querySelectorAll('[data-verif-thread] .bubble').length;
    bubbles === 3 ? ok('fil SMS mis à jour (3 bulles)') : fail('fil SMS ' + bubbles);

    // scénario déjà utilisé via chip
    const chip = doc.querySelector('[data-fill="BF3T8N5R2W5"]');
    click(chip);
    setTimeout(() => {
      const h2 = panel.innerHTML;
      h2.includes('Déjà vérifié') ? ok('simulateur : scénario déjà utilisé') : fail('simulateur déjà utilisé');
      // code invalide
      input.value = 'BF7K2M9Q4X1';
      form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
      setTimeout(() => {
        panel.innerHTML.includes('Code mal écrit') ? ok('simulateur : erreur de saisie') : fail('simulateur mal écrit');
        errors.length ? fail('erreurs JS simulateur : ' + errors.join(' | ')) : ok('aucune erreur JS (simulateur)');
        window.close();
        done();
      }, 1400);
    }, 1400);
  }, 1400);
}

function done() {
  console.log(out.join('\n'));
  const f = out.filter(l => l.startsWith('FAIL')).length;
  console.log('\n' + (f ? f + ' échec(s)' : 'tous les tests d’interaction passent'));
  process.exit(f ? 1 : 0);
}
