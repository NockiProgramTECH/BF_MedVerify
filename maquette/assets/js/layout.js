/* ==========================================================================
   BF-MedVerify — layout.js
   Injecte l'en-tête public ou la coque de l'application, les icônes SVG,
   la palette de commandes et les interactions communes (mouvement, menu).
   Aucune dépendance externe.
   ========================================================================== */
(function () {
  'use strict';

  /* ----------------------------------------------------------------------
     1. Jeu d'icônes (trait 1,8 — 24 × 24)
     ---------------------------------------------------------------------- */
  const ICONS = {
    check: '<path d="m4.5 12.5 5 5 10-11"/>',
    'check-circle': '<circle cx="12" cy="12" r="9"/><path d="m8 12.4 2.7 2.7 5.4-6.2"/>',
    'alert-triangle': '<path d="M10.3 4.2 2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    'alert-circle': '<circle cx="12" cy="12" r="9"/><path d="M12 8v4.5"/><path d="M12 16h.01"/>',
    x: '<path d="M6 6 18 18M18 6 6 18"/>',
    'arrow-right': '<path d="M4 12h16"/><path d="m14 6 6 6-6 6"/>',
    'arrow-left': '<path d="M20 12H4"/><path d="m10 6-6 6 6 6"/>',
    'arrow-up': '<path d="M12 20V4"/><path d="m6 10 6-6 6 6"/>',
    'arrow-down': '<path d="M12 4v16"/><path d="m6 14 6 6 6-6"/>',
    'arrow-up-right': '<path d="M7 17 17 7"/><path d="M8 7h9v9"/>',
    'chevron-down': '<path d="m6 9 6 6 6-6"/>',
    'chevron-right': '<path d="m9 6 6 6-6 6"/>',
    'chevron-left': '<path d="m15 6-6 6 6 6"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
    bell: '<path d="M18 9a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6"/><path d="M10.5 20a2 2 0 0 0 3 0"/>',
    download: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M4 19h16"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
    grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',
    shield: '<path d="M12 3 5 6v6c0 4.5 3 7.7 7 9 4-1.3 7-4.5 7-9V6Z"/><path d="m9 12 2 2 4-4"/>',
    pill: '<path d="m10.5 20.5-7-7a4.95 4.95 0 0 1 7-7l7 7a4.95 4.95 0 0 1-7 7Z"/><path d="m8.5 8.5 7 7"/>',
    box: '<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9Z"/><path d="m4 7.5 8 4.5 8-4.5"/><path d="M12 12v9"/>',
    building: '<path d="M4 21V6l8-3 8 3v15"/><path d="M9 21v-5h6v5"/><path d="M8 8h.01M12 8h.01M16 8h.01M8 11h.01M12 11h.01M16 11h.01"/>',
    store: '<path d="M4 9.5V20h16V9.5"/><path d="M3 9.5 5 4h14l2 5.5a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0Z"/><path d="M9 20v-5h6v5"/>',
    users: '<path d="M16 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20"/><circle cx="9.5" cy="7" r="3.2"/><path d="M17 4.2a3.2 3.2 0 0 1 0 6.2"/><path d="M21 20v-1.5a4 4 0 0 0-3-3.87"/>',
    user: '<circle cx="12" cy="8" r="3.4"/><path d="M5 20v-1a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v1"/>',
    phone: '<path d="M7 3.5h3l1.5 4-2 1.5a12 12 0 0 0 5.5 5.5l1.5-2 4 1.5v3a2 2 0 0 1-2.2 2A17 17 0 0 1 5 5.7 2 2 0 0 1 7 3.5Z"/>',
    smartphone: '<rect x="7" y="2.5" width="10" height="19" rx="2.2"/><path d="M10.5 18.5h3"/>',
    wifi: '<path d="M2.5 9a15 15 0 0 1 19 0"/><path d="M5.5 12.5a10 10 0 0 1 13 0"/><path d="M8.8 16a5 5 0 0 1 6.4 0"/><path d="M12 19.5h.01"/>',
    message: '<path d="M20 15a3 3 0 0 1-3 3H8l-4 3V6a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3Z"/><path d="M8.5 9h7M8.5 12.5h4"/>',
    chart: '<path d="M4 20h16"/><path d="M7 20v-6M12 20V7M17 20v-9"/>',
    'trend-up': '<path d="m4 16 5.5-5.5 3.5 3.5L20 7"/><path d="M15 7h5v5"/>',
    'map-pin': '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.5"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="16" rx="2.5"/><path d="M8 3v4M16 3v4M3.5 10h17"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5.2l3.2 2"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.1-1.55 1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V9a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1Z"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.4"/><path d="M12 17h.01"/>',
    external: '<path d="M14 4h6v6"/><path d="m20 4-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/>',
    refresh: '<path d="M20 11a8 8 0 0 0-14-4L4 9"/><path d="M4 4v5h5"/><path d="M4 13a8 8 0 0 0 14 4l2-2"/><path d="M20 20v-5h-5"/>',
    file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h6"/>',
    lock: '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 1 1 8 0v3"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9"/><path d="m17 6 3 3"/><path d="m19 4 3 3"/>',
    database: '<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6"/><path d="M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
    truck: '<path d="M3 7h11v9H3z"/><path d="M14 10h4l3 3v3h-7"/><circle cx="7" cy="18" r="1.8"/><circle cx="17" cy="18" r="1.8"/>',
    star: '<path d="m12 3 2.7 5.8 6.3.8-4.6 4.4 1.2 6.2L12 17.3 6.4 20.2l1.2-6.2L3 9.6l6.3-.8Z"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18Z"/>',
    book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5Z"/><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20v3H6.5"/>',
    play: '<path d="M8 5.5v13l10-6.5Z"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>',
    edit: '<path d="M4 20h4l10-10a2.8 2.8 0 0 0-4-4L4 16Z"/><path d="m13.5 6.5 4 4"/>',
    trash: '<path d="M4 7h16"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/><path d="M6 7v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7"/><path d="M10 11v6M14 11v6"/>',
    send: '<path d="m21 3-9 18-2.5-7.5L3 11Z"/><path d="M21 3 9.5 13.5"/>',
    scan: '<path d="M4 8V6a2 2 0 0 1 2-2h2"/><path d="M16 4h2a2 2 0 0 1 2 2v2"/><path d="M20 16v2a2 2 0 0 1-2 2h-2"/><path d="M8 20H6a2 2 0 0 1-2-2v-2"/><path d="M4 12h16"/>',
    qr: '<rect x="3.5" y="3.5" width="6" height="6" rx="1"/><rect x="14.5" y="3.5" width="6" height="6" rx="1"/><rect x="3.5" y="14.5" width="6" height="6" rx="1"/><path d="M14.5 14.5h3v3h-3zM20.5 14.5h-1M20.5 17.5v3M14.5 20.5h3"/>',
    flag: '<path d="M5 21V4"/><path d="M5 4h12l-2.5 4L17 12H5"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5Z"/><path d="m3 13 9 5 9-5"/>',
    activity: '<path d="M3 12h4l2.5-7 5 14 2.5-7h4"/>',
    clipboard: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1"/><path d="M9 10h6M9 14h6M9 18h3"/>',
    spark: '<path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9Z"/>',
    cross: '<path d="M9 4h6v5h5v6h-5v5H9v-5H4V9h5Z"/>',
    'user-check': '<circle cx="9" cy="8" r="3.4"/><path d="M3 20v-1a5 5 0 0 1 5-5h2.5"/><path d="m15 17 2 2 4-4.5"/>',
    'file-check': '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5"/><path d="m9 14 2 2 4-4"/>',
    radio: '<circle cx="12" cy="12" r="2"/><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4"/><path d="M4.9 4.9a10 10 0 0 0 0 14.2M19.1 4.9a10 10 0 0 1 0 14.2"/>',
    server: '<rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 7.5h.01M7 16.5h.01"/>',
    package: '<path d="M21 8v8l-9 5-9-5V8l9-5Z"/><path d="m3 8 9 5 9-5"/><path d="M12 13v8"/><path d="M7.5 5.5l9 5"/>'
  };

  function icon(name, extraClass) {
    const body = ICONS[name] || ICONS.help;
    return '<svg class="icon ' + (extraClass || '') + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + body + '</svg>';
  }

  function hydrateIcons(root) {
    (root || document).querySelectorAll('[data-icon]').forEach(function (el) {
      const name = el.getAttribute('data-icon');
      const cls = el.getAttribute('data-icon-class') || '';
      el.innerHTML = icon(name, cls);
      el.removeAttribute('data-icon');
      el.removeAttribute('data-icon-class');
      el.classList.add('icon-slot');
    });
  }

  const IS_APP = document.body.getAttribute('data-layout') === 'app';
  const PAGE = document.body.getAttribute('data-page') || '';

  /* ----------------------------------------------------------------------
     2. En-tête public
     ---------------------------------------------------------------------- */
  const PUBLIC_NAV = [
    { href: 'index.html#probleme', label: 'Le problème', id: 'probleme' },
    { href: 'index.html#solution', label: 'Le dispositif', id: 'solution' },
    { href: 'verifier.html', label: 'Vérifier un code', id: 'verifier' },
    { href: 'ecosysteme.html', label: 'Écosystème', id: 'ecosysteme' },
    { href: 'design-system.html', label: 'Design', id: 'design' }
  ];

  const LOGO = '<img src="assets/img/logo.svg" width="38" height="38" alt="">';

  const PUBLIC_HEADER =
    '<a class="skip-link" href="#main">Aller au contenu</a>' +
    '<header class="site-header" data-site-header>' +
      '<div class="container">' +
        '<a class="brand" href="index.html" aria-label="BF-MedVerify, accueil">' +
          '<img src="assets/img/logo.svg" width="38" height="38" alt="">' +
          '<span class="brand-name"><span>BF-MedVerify</span><span>Vérification des médicaments</span></span>' +
        '</a>' +
        '<nav class="site-nav" aria-label="Navigation principale">' +
          PUBLIC_NAV.map(function (n) {
            return '<a href="' + n.href + '"' + (PAGE === n.id ? ' aria-current="page"' : '') + '>' + n.label + '</a>';
          }).join('') +
        '</nav>' +
        '<div class="site-actions">' +
          '<a class="btn btn--ghost" href="app/index.html">Espace de pilotage</a>' +
          '<a class="btn btn--primary" href="verifier.html"><span data-icon="scan"></span>Vérifier un code</a>' +
          '<button class="nav-toggle" type="button" aria-label="Ouvrir le menu" aria-expanded="false" data-nav-toggle><span data-icon="menu"></span></button>' +
        '</div>' +
      '</div>' +
    '</header>' +
    '<nav class="mobile-nav" aria-label="Menu mobile" data-mobile-nav>' +
      PUBLIC_NAV.map(function (n) {
        return '<a href="' + n.href + '">' + n.label + '</a>';
      }).join('') +
      '<a href="app/index.html">Espace de pilotage</a>' +
      '<div class="site-actions"><a class="btn btn--primary btn--block" href="verifier.html">Vérifier un code</a></div>' +
    '</nav>';

  const PUBLIC_FOOTER =
    '<footer class="site-footer">' +
      '<div class="container">' +
        '<div class="footer-top">' +
          '<div class="footer-brand">' +
            '<a class="brand brand--light" href="index.html">' +
              LOGO +
              '<span class="brand-name"><span>BF-MedVerify</span><span>Vérification des médicaments</span></span>' +
            '</a>' +
            '<p>Un code à gratter, un SMS, une réponse claire. Le dispositif de vérification de l\'authenticité des médicaments pensé pour le Burkina Faso, même hors connexion internet.</p>' +
          '</div>' +
          '<div class="footer-col"><h4>Le dispositif</h4>' +
            '<a href="index.html#solution">Comment ça marche</a>' +
            '<a href="verifier.html">Vérifier un code</a>' +
            '<a href="index.html#sms">SMS sans internet</a>' +
            '<a href="ecosysteme.html">Écosystème</a>' +
          '</div>' +
          '<div class="footer-col"><h4>Pilotage</h4>' +
            '<a href="app/index.html">Tableau de bord</a>' +
            '<a href="app/alertes.html">Alertes Faso FDA</a>' +
            '<a href="app/medicaments.html">Lots &amp; codes</a>' +
            '<a href="app/rapports.html">Rapports</a>' +
          '</div>' +
          '<div class="footer-col"><h4>Ressources</h4>' +
            '<a href="design-system.html">Design system</a>' +
            '<a href="ecosysteme.html#acteurs">Cartographie des acteurs</a>' +
            '<a href="ecosysteme.html#feuille-de-route">Feuille de route</a>' +
            '<a href="app/parametres.html">Configuration &amp; sécurité</a>' +
          '</div>' +
        '</div>' +
        '<div class="footer-bottom">' +
          '<span>© <span data-year>2026</span> BF-MedVerify · Burkina Faso</span>' +
          '<span class="demo-note"><span data-icon="spark"></span>Maquette de démonstration — données fictives</span>' +
          '<span class="footer-legal"><a href="design-system.html#accessibilite">Accessibilité</a><a href="design-system.html#couleurs">Couleurs</a><a href="ecosysteme.html#contact">Contact</a></span>' +
        '</div>' +
      '</div>' +
    '</footer>';

  /* ----------------------------------------------------------------------
     3. Coque de l'application
     ---------------------------------------------------------------------- */
  const SPACES = {
    regulateur: { label: 'Faso FDA', href: 'index.html', page: 'dashboard' },
    pharmacie: { label: 'Pharmacie', href: 'portail-pharmacie.html', page: 'ph-dashboard' },
    laboratoire: { label: 'Laboratoire', href: 'portail-laboratoire.html', page: 'lab-dashboard' }
  };

  const NAV = {
    regulateur: [
      { group: 'Pilotage', items: [
        { id: 'dashboard', label: "Vue d'ensemble", icon: 'grid', href: 'index.html' },
        { id: 'alertes', label: 'Alertes', icon: 'bell', href: 'alertes.html', count: 3 },
        { id: 'verifications', label: 'Vérifications', icon: 'activity', href: 'verifications.html' },
        { id: 'medicaments', label: 'Médicaments & lots', icon: 'pill', href: 'medicaments.html' }
      ]},
      { group: 'Réseau', items: [
        { id: 'pharmacies', label: 'Pharmacies partenaires', icon: 'store', href: 'pharmacies.html' },
        { id: 'territoire', label: 'Couverture territoriale', icon: 'map-pin', href: 'territoire.html' },
        { id: 'sms', label: 'Passerelle SMS', icon: 'message', href: 'sms.html' }
      ]},
      { group: 'Institution', items: [
        { id: 'rapports', label: 'Rapports & exports', icon: 'file', href: 'rapports.html' },
        { id: 'utilisateurs', label: 'Utilisateurs & rôles', icon: 'users', href: 'utilisateurs.html' },
        { id: 'parametres', label: 'Paramètres', icon: 'settings', href: 'parametres.html' },
        { id: 'aide', label: 'Aide & raccourcis', icon: 'help', href: 'aide.html' }
      ]}
    ],
    laboratoire: [
      { group: 'Mon laboratoire', items: [
        { id: 'lab-dashboard', label: "Vue d'ensemble", icon: 'grid', href: 'portail-laboratoire.html' },
        { id: 'lab-lots', label: 'Lots déclarés', icon: 'box', href: 'portail-laboratoire.html#lots' },
        { id: 'lab-codes', label: 'Codes sécurisés', icon: 'key', href: 'portail-laboratoire.html#codes' },
        { id: 'lab-signalements', label: 'Signalements', icon: 'alert-triangle', href: 'portail-laboratoire.html#signalements' }
      ]},
      { group: 'Ressources', items: [
        { id: 'lab-documentation', label: 'Documentation AMM', icon: 'book', href: 'portail-laboratoire.html#documentation' },
        { id: 'lab-rapports', label: 'Mes rapports', icon: 'file', href: 'portail-laboratoire.html#rapports' }
      ]}
    ],
    pharmacie: [
      { group: 'Mon officine', items: [
        { id: 'ph-dashboard', label: "Vue d'ensemble", icon: 'grid', href: 'portail-pharmacie.html' },
        { id: 'ph-verifier', label: 'Vérifier une boîte', icon: 'scan', href: 'portail-pharmacie.html#verifier' },
        { id: 'ph-stock', label: 'Stock & péremption', icon: 'calendar', href: 'portail-pharmacie.html#stock' },
        { id: 'ph-ventes', label: 'Ventes vérifiées', icon: 'chart', href: 'portail-pharmacie.html#ventes' }
      ]},
      { group: 'Aide', items: [
        { id: 'ph-signaler', label: 'Signaler un produit', icon: 'flag', href: 'portail-pharmacie.html#signaler' },
        { id: 'ph-formation', label: 'Formation & notices', icon: 'book', href: 'portail-pharmacie.html#formation' }
      ]}
    ]
  };

  const USERS = {
    regulateur: { initials: 'AF', name: 'Awa Fofana', role: 'Régulatrice · Faso FDA' },
    pharmacie: { initials: 'PK', name: 'Philippe Kaboré', role: 'Pharmacien · Ouaga 2000' },
    laboratoire: { initials: 'SO', name: 'Dr Salif Ouédraogo', role: 'Affaires réglementaires' }
  };

  const PALETTE_ITEMS = [
    { label: "Vue d'ensemble", group: 'Pilotage', href: 'index.html', icon: 'grid' },
    { label: 'Alertes', group: 'Pilotage', href: 'alertes.html', icon: 'bell' },
    { label: 'Vérifications', group: 'Pilotage', href: 'verifications.html', icon: 'activity' },
    { label: 'Médicaments & lots', group: 'Pilotage', href: 'medicaments.html', icon: 'pill' },
    { label: 'Pharmacies partenaires', group: 'Réseau', href: 'pharmacies.html', icon: 'store' },
    { label: 'Couverture territoriale', group: 'Réseau', href: 'territoire.html', icon: 'map-pin' },
    { label: 'Passerelle SMS', group: 'Réseau', href: 'sms.html', icon: 'message' },
    { label: 'Rapports & exports', group: 'Institution', href: 'rapports.html', icon: 'file' },
    { label: 'Utilisateurs & rôles', group: 'Institution', href: 'utilisateurs.html', icon: 'users' },
    { label: 'Paramètres', group: 'Institution', href: 'parametres.html', icon: 'settings' },
    { label: 'Portail pharmacie', group: 'Espaces', href: 'portail-pharmacie.html', icon: 'store' },
    { label: 'Portail laboratoire', group: 'Espaces', href: 'portail-laboratoire.html', icon: 'building' },
    { label: 'Site public', group: 'Espaces', href: '../index.html', icon: 'globe' },
    { label: 'Simulateur de vérification', group: 'Site public', href: '../verifier.html', icon: 'scan' },
    { label: 'Écosystème', group: 'Site public', href: '../ecosysteme.html', icon: 'layers' }
  ];

  function buildSidebar(space) {
    const user = USERS[space] || USERS.regulateur;
    const groups = NAV[space] || NAV.regulateur;
    const sidebarHome = (SPACES[space] || SPACES.regulateur).href;
    const spaceSwitch = Object.keys(SPACES).map(function (key) {
      return '<a href="' + SPACES[key].href + '"' + (key === space ? ' class="is-active" aria-current="true"' : '') + '>' + SPACES[key].label + '</a>';
    }).join('');

    const navHtml = groups.map(function (g) {
      return '<div class="side-group">' +
        '<p class="side-group-title">' + g.group + '</p>' +
        g.items.map(function (it) {
          const active = PAGE === it.id;
          return '<a class="side-link' + (active ? ' is-active' : '') + '" href="' + it.href + '"' + (active ? ' aria-current="page"' : '') + '>' +
            icon(it.icon) +
            '<span>' + it.label + '</span>' +
            (it.count ? '<span class="side-count">' + it.count + '</span>' : '') +
          '</a>';
        }).join('') +
      '</div>';
    }).join('');

    return '<aside class="app-sidebar" id="appSidebar" aria-label="Navigation de l\'application">' +
      '<div class="side-head">' +
        '<a class="brand brand--light" href="' + sidebarHome + '">' +
          LOGO +
          '<span class="brand-name"><span>BF-MedVerify</span><span>Pilotage</span></span>' +
        '</a>' +
        '<button class="side-close" type="button" aria-label="Fermer le menu" data-sidebar-close><span data-icon="x"></span></button>' +
      '</div>' +
      '<div class="space-switch">' +
        '<p class="space-label">Espace de travail</p>' +
        '<div class="space-links">' + spaceSwitch + '</div>' +
      '</div>' +
      '<nav class="side-nav" aria-label="Sections">' + navHtml + '</nav>' +
      '<div class="side-foot">' +
        '<div class="side-env"><span class="pill-dot"></span><span>Démo · données fictives</span></div>' +
        '<a class="side-public" href="../index.html"><span data-icon="globe"></span>Retour au site public<span data-icon="external"></span></a>' +
        '<div class="side-user">' +
          '<span class="avatar">' + user.initials + '</span>' +
          '<span class="side-user-text"><strong>' + user.name + '</strong><small>' + user.role + '</small></span>' +
        '</div>' +
      '</div>' +
    '</aside>';
  }

  function buildTopbar(space) {
    const spaceLabel = (SPACES[space] || SPACES.regulateur).label;
    const crumb = document.body.getAttribute('data-crumb') || 'Vue d\'ensemble';
    const user = USERS[space] || USERS.regulateur;
    return '<header class="app-topbar">' +
      '<div class="topbar-left">' +
        '<button class="menu-btn" type="button" aria-label="Ouvrir le menu" aria-expanded="false" data-sidebar-open><span data-icon="menu"></span></button>' +
        '<div class="crumb"><span>' + spaceLabel + '</span><span class="crumb-sep">/</span><strong>' + crumb + '</strong></div>' +
      '</div>' +
      '<div class="topbar-right">' +
        '<button class="top-search" type="button" data-open-palette aria-label="Rechercher dans le pilotage">' +
          '<span data-icon="search"></span><span class="top-search-label">Rechercher</span><kbd>Ctrl K</kbd>' +
        '</button>' +
        '<a class="top-icon" href="alertes.html" aria-label="Alertes, 3 non lues">' +
          '<span data-icon="bell"></span><span class="top-icon-count">3</span>' +
        '</a>' +
        '<a class="top-icon top-icon--help" href="aide.html" aria-label="Aide"><span data-icon="help"></span></a>' +
        '<div class="top-user">' +
          '<span class="avatar">' + user.initials + '</span>' +
          '<span class="top-user-text"><strong>' + user.name + '</strong><small>' + user.role + '</small></span>' +
          '<span data-icon="chevron-down" data-icon-class="top-user-caret"></span>' +
        '</div>' +
      '</div>' +
    '</header>';
  }

  function buildPalette() {
    return '<div class="cmd-layer" hidden data-palette>' +
      '<div class="cmd-backdrop" data-palette-close></div>' +
      '<div class="cmd" role="dialog" aria-modal="true" aria-label="Recherche rapide">' +
        '<div class="cmd-input-row">' +
          '<span data-icon="search"></span>' +
          '<input type="search" placeholder="Rechercher une page, un lot, une pharmacie…" aria-label="Rechercher" data-palette-input>' +
          '<kbd>Échap</kbd>' +
        '</div>' +
        '<ul class="cmd-list" data-palette-list>' +
          PALETTE_ITEMS.map(function (it) {
            return '<li><a href="' + it.href + '" data-search="' + (it.label + ' ' + it.group).toLowerCase() + '">' +
              icon(it.icon) +
              '<span>' + it.label + '</span>' +
              '<small>' + it.group + '</small>' +
              '<span data-icon="arrow-right" data-icon-class="cmd-arrow"></span>' +
            '</a></li>';
          }).join('') +
        '</ul>' +
        '<div class="cmd-foot"><span><kbd>↑</kbd><kbd>↓</kbd> naviguer</span><span><kbd>↵</kbd> ouvrir</span><span>Maquette · navigation locale</span></div>' +
      '</div>' +
    '</div>';
  }

  function buildBackdrop() {
    return '<div class="sidebar-backdrop" data-sidebar-close hidden></div>';
  }

  function buildAppFooter() {
    return '<footer class="app-footer">' +
      '<span>BF-MedVerify · maquette de pilotage · données fictives</span>' +
      '<span class="app-footer-links"><a href="../index.html">Site public</a><a href="aide.html">Aide</a><a href="parametres.html">Paramètres</a></span>' +
    '</footer>';
  }

  /* ----------------------------------------------------------------------
     4. Assemblage
     ---------------------------------------------------------------------- */
  if (IS_APP) {
    const space = document.body.getAttribute('data-space') || 'regulateur';
    const main = document.getElementById('main');
    if (main) {
      const shell = document.createElement('div');
      shell.className = 'app-shell';
      main.parentNode.insertBefore(shell, main);

      const sidebarWrap = document.createElement('div');
      sidebarWrap.innerHTML = buildSidebar(space);
      shell.appendChild(sidebarWrap.firstChild);

      const col = document.createElement('div');
      col.className = 'app-main';
      col.innerHTML = buildTopbar(space);
      shell.appendChild(col);
      col.appendChild(main);
      col.insertAdjacentHTML('beforeend', buildAppFooter());

      document.body.insertAdjacentHTML('afterbegin', '<a class="skip-link" href="#main">Aller au contenu</a>');
      document.body.insertAdjacentHTML('beforeend', buildBackdrop() + buildPalette());
    }
  } else {
    document.body.insertAdjacentHTML('afterbegin', PUBLIC_HEADER);
    document.body.insertAdjacentHTML('beforeend', PUBLIC_FOOTER);
  }

  hydrateIcons();

  document.querySelectorAll('[data-year]').forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });

  /* ----------------------------------------------------------------------
     5. Menu public / sidebar mobile
     ---------------------------------------------------------------------- */
  const navToggle = document.querySelector('[data-nav-toggle]');
  const mobileNav = document.querySelector('[data-mobile-nav]');
  if (navToggle && mobileNav) {
    navToggle.addEventListener('click', function () {
      const open = mobileNav.classList.toggle('is-open');
      navToggle.setAttribute('aria-expanded', String(open));
      navToggle.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
      navToggle.innerHTML = icon(open ? 'x' : 'menu');
    });
    mobileNav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        mobileNav.classList.remove('is-open');
        navToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  const sidebar = document.querySelector('[data-sidebar-open], [data-sidebar-close]');
  const appSidebar = document.getElementById('appSidebar');
  const sidebarBackdrop = document.querySelector('.sidebar-backdrop');

  function setSidebar(open) {
    if (!appSidebar) return;
    appSidebar.classList.toggle('is-open', open);
    document.body.classList.toggle('sidebar-open', open);
    if (sidebarBackdrop) sidebarBackdrop.hidden = !open;
    const opener = document.querySelector('[data-sidebar-open]');
    if (opener) opener.setAttribute('aria-expanded', String(open));
  }

  document.querySelectorAll('[data-sidebar-open]').forEach(function (btn) {
    btn.addEventListener('click', function () { setSidebar(true); });
  });
  document.querySelectorAll('[data-sidebar-close]').forEach(function (el) {
    el.addEventListener('click', function () { setSidebar(false); });
  });
  if (appSidebar) {
    appSidebar.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () { setSidebar(false); });
    });
  }

  // En-tête public : ombre au défilement
  const siteHeader = document.querySelector('[data-site-header]');
  if (siteHeader) {
    const onScroll = function () {
      siteHeader.classList.toggle('is-scrolled', window.scrollY > 8);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ----------------------------------------------------------------------
     6. Palette de commandes
     ---------------------------------------------------------------------- */
  const palette = document.querySelector('[data-palette]');
  const paletteInput = document.querySelector('[data-palette-input]');
  const paletteList = document.querySelector('[data-palette-list]');

  function openPalette() {
    if (!palette) return;
    palette.hidden = false;
    document.body.classList.add('palette-open');
    if (paletteInput) {
      paletteInput.value = '';
      filterPalette('');
      setTimeout(function () { paletteInput.focus(); }, 30);
    }
  }
  function closePalette() {
    if (!palette) return;
    palette.hidden = true;
    document.body.classList.remove('palette-open');
  }
  function filterPalette(q) {
    if (!paletteList) return;
    const term = q.trim().toLowerCase();
    let visible = 0;
    paletteList.querySelectorAll('li').forEach(function (li) {
      const match = !term || (li.querySelector('a').getAttribute('data-search') || '').indexOf(term) !== -1;
      li.hidden = !match;
      if (match) visible++;
    });
    let empty = paletteList.querySelector('[data-palette-empty]');
    if (!visible) {
      if (!empty) {
        empty = document.createElement('li');
        empty.setAttribute('data-palette-empty', '');
        empty.className = 'cmd-empty';
        empty.textContent = 'Aucun résultat. Essayez « alertes », « SMS » ou « lots ».';
        paletteList.appendChild(empty);
      }
      empty.hidden = false;
    } else if (empty) {
      empty.hidden = true;
    }
  }

  document.querySelectorAll('[data-open-palette]').forEach(function (btn) {
    btn.addEventListener('click', openPalette);
  });
  document.querySelectorAll('[data-palette-close]').forEach(function (el) {
    el.addEventListener('click', closePalette);
  });
  if (paletteInput) {
    paletteInput.addEventListener('input', function () { filterPalette(paletteInput.value); });
  }

  document.addEventListener('keydown', function (e) {
    const target = e.target;
    const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT');
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      palette && palette.hidden ? openPalette() : closePalette();
    } else if (e.key === '/' && !typing && !IS_APP) {
      e.preventDefault();
      openPalette();
    } else if (e.key === 'Escape') {
      closePalette();
      setSidebar(false);
      document.querySelectorAll('.drawer.is-open').forEach(function (d) { d.classList.remove('is-open'); });
      document.body.classList.remove('drawer-open');
    } else if (e.key === 'Enter' && palette && !palette.hidden && document.activeElement === paletteInput) {
      const first = paletteList.querySelector('li:not([hidden]) a');
      if (first) window.location.href = first.getAttribute('href');
    }
  });

  /* ----------------------------------------------------------------------
     7. Révélation au défilement, compteurs, jauges
     ---------------------------------------------------------------------- */
  const revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('is-visible'); });
  }

  const counters = document.querySelectorAll('[data-count]');
  if (counters.length) {
    const animateCount = function (el) {
      const target = parseFloat(el.getAttribute('data-count'));
      const suffix = el.getAttribute('data-suffix') || '';
      const decimals = parseInt(el.getAttribute('data-decimals') || '0', 10);
      const duration = 1100;
      const start = performance.now();
      const format = function (v) {
        return v.toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
      };
      const step = function (now) {
        const p = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = format(target * eased) + suffix;
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    if ('IntersectionObserver' in window) {
      const cio = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            animateCount(entry.target);
            cio.unobserve(entry.target);
          }
        });
      }, { threshold: 0.4 });
      counters.forEach(function (el) { cio.observe(el); });
    } else {
      counters.forEach(animateCount);
    }
  }

  const bars = document.querySelectorAll('[data-bar]');
  if (bars.length) {
    requestAnimationFrame(function () {
      bars.forEach(function (bar) {
        bar.style.width = (bar.getAttribute('data-bar') || '0') + '%';
      });
    });
  }

  /* ----------------------------------------------------------------------
     8. Toast global
     ---------------------------------------------------------------------- */
  let toastTimer = null;
  function toast(message, kind) {
    let el = document.querySelector('.toast');
    if (!el) {
      el = document.createElement('div');
      el.className = 'toast';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      document.body.appendChild(el);
    }
    el.innerHTML = icon(kind === 'danger' ? 'alert-circle' : kind === 'info' ? 'help' : 'check-circle') + '<span>' + message + '</span>';
    el.className = 'toast is-visible' + (kind ? ' toast--' + kind : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('is-visible'); }, 3600);
  }

  document.querySelectorAll('[data-toast]').forEach(function (el) {
    el.addEventListener('click', function (e) {
      if (el.tagName === 'A' && el.getAttribute('href') === '#') e.preventDefault();
      toast(el.getAttribute('data-toast'), el.getAttribute('data-toast-kind'));
    });
  });

  // Exposition utilitaire pour les scripts de page
  window.BFMV = { icon: icon, toast: toast, hydrateIcons: hydrateIcons, openPalette: openPalette };
})();
