/* ==========================================================================
   BF-MedVerify — site.js
   Interactions du site vitrine : simulateur de vérification, scénarios SMS,
   rejeu des animations du design system, formulaires de démonstration.
   Aucun appel réseau : tout est simulé côté navigateur.
   ========================================================================== */
(function () {
  'use strict';

  const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

  function checksum(corps) {
    let total = 0;
    for (let i = 0; i < corps.length; i++) {
      total += (i + 1) * ALPHABET.indexOf(corps[i]);
    }
    return ALPHABET[total % 31];
  }

  function normalize(value) {
    const t = (value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    return t.startsWith('VERIF') ? t.slice(5) : t;
  }

  function codeIsWellFormed(code) {
    if (code.length !== 11 || !code.startsWith('BF')) return false;
    for (const c of code.slice(0, 10)) {
      if (ALPHABET.indexOf(c) === -1) return false;
    }
    return checksum(code.slice(0, -1)) === code[code.length - 1];
  }

  /* ----------------------------------------------------------------------
     Données de démonstration
     ---------------------------------------------------------------------- */
  const DEMO = {
    BF7K2M9Q4XZ: {
      status: 'VRAI',
      label: 'Authentique',
      tone: 'green',
      icon: 'check-circle',
      produit: 'Paracétamol 500 mg',
      dosage: '500 mg · comprimé',
      lot: 'BF-2291',
      expiration: '31/08/2028',
      premiere: 'Première vérification — 24/10/2026 à 10:42',
      resume: 'Le code correspond à un lot déclaré, actif et jamais vérifié auparavant.',
      conseil: 'Comparez le nom, le dosage et la date sur la boîte avant de prendre le médicament. Conservez la boîte et la notice.',
      sms: "BF-MedVerify: AUTHENTIQUE. Paracetamol 500 mg, lot BF-2291, exp 08/28. Comparez avec la boite. Si la maladie continue, consultez."
    },
    BF3T8N5R2W5: {
      status: 'DEJA_UTILISE',
      label: 'Déjà vérifié',
      tone: 'gold',
      icon: 'alert-triangle',
      produit: 'Amoxicilline 500 mg',
      dosage: '500 mg · gélule',
      lot: 'AMX-1180',
      expiration: '30/11/2027',
      premiere: 'Première vérification — 22/10/2026 à 16:08 (autre numéro)',
      conseil: 'Ce code a déjà été vérifié par un autre téléphone. S\'il ne s\'agit pas de vous, la boîte peut être une copie : ne la prenez pas et rapportez-la à la pharmacie.',
      sms: "BF-MedVerify: ATTENTION. Code deja verifie le 22/10. Si ce n'est pas vous, copie possible: ne prenez pas ce produit, rapportez-le a la pharmacie."
    },
    BFH4P7V2KDG: {
      status: 'EXPIRE',
      label: 'Médicament expiré',
      tone: 'red',
      icon: 'alert-circle',
      produit: 'Artéméther-Luméfantrine',
      dosage: '80/480 mg · comprimé',
      lot: 'AL-0921',
      expiration: '30/06/2026',
      premiere: 'Lot déclaré — expiré depuis le 30/06/2026',
      conseil: 'La date d\'expiration du lot est dépassée. N\'utilisez pas ce produit et rapportez-le à la pharmacie ou au centre de santé.',
      sms: "BF-MedVerify: ATTENTION. Medicament expire (06/26). Ne le prenez pas. Rapportez-le a la pharmacie."
    },
    BF9C6B3Z8M4: {
      status: 'REVOQUE',
      label: 'Lot rappelé',
      tone: 'red',
      icon: 'shield',
      produit: 'Ceftriaxone 1 g',
      dosage: '1 g · poudre pour injection',
      lot: 'CF-8812',
      expiration: '31/03/2028',
      premiere: 'Rappel national notifié le 18/10/2026',
      conseil: 'Ce lot fait l\'objet d\'un rappel ou d\'une suspicion. Ne l\'utilisez pas et rapportez-le immédiatement au point de vente ou à la Faso FDA.',
      sms: "BF-MedVerify: ATTENTION. Ce lot est signale (rappel ou suspicion). Ne le prenez pas. Rapportez-le a la pharmacie."
    },
    BF5J7Y2N4T8: {
      status: 'INCONNU',
      label: 'Code non reconnu',
      tone: 'red',
      icon: 'alert-circle',
      produit: 'Non identifié',
      dosage: '—',
      lot: '—',
      expiration: '—',
      premiere: 'Aucun lot associé dans la base de démonstration',
      resume: 'Le code est bien formé mais aucun lot ne lui correspond dans la base.',
      conseil: 'Vérifiez les 11 caractères ; si le code est exact, considérez la boîte comme suspecte et signalez-la.',
      sms: "BF-MedVerify: CODE NON RECONNU. Verifiez les 11 caracteres. Si le code est exact, ne prenez pas ce produit, rapportez-le a la pharmacie."
    },
    MAL: {
      status: 'MAL_ECRIT',
      label: 'Code mal écrit',
      tone: 'gold',
      icon: 'help',
      produit: '—',
      dosage: '—',
      lot: '—',
      expiration: '—',
      premiere: 'Aucune recherche en base : le code n\'a pas la bonne forme',
      resume: 'La forme du code ne permet pas de lancer une vérification.',
      conseil: 'Un code BF-MedVerify comporte 11 caractères et commence par BF. Relisez la couche grattable et renvoyez le code, sans espaces ni tirets.',
      sms: "BF-MedVerify: Code mal ecrit (11 caracteres, commence par BF). Relisez-le et renvoyez-le."
    }
  };

  const ORDER = ['BF7K2M9Q4XZ', 'BF3T8N5R2W5', 'BFH4P7V2KDG', 'BF9C6B3Z8M4', 'BF5J7Y2N4T8', 'BF7K2M9Q4X1'];

  /* ----------------------------------------------------------------------
     Simulateur de vérification
     ---------------------------------------------------------------------- */
  const form = document.querySelector('[data-verif-form]');
  if (form) {
    const input = form.querySelector('[data-code-input]');
    const phoneInput = form.querySelector('[data-phone-input]');
    const canalInput = form.querySelector('[data-canal-input]');
    const submitBtn = form.querySelector('[data-verif-submit]');
    const panel = document.querySelector('[data-result-panel]');
    const thread = document.querySelector('[data-verif-thread]');
    const stepperSteps = document.querySelectorAll('[data-stepper] span');
    let currentCode = null;
    let busy = false;

    const EMPTY_STATE =
      '<div class="result-empty">' +
        '<svg class="empty-art" viewBox="0 0 160 130" aria-hidden="true">' +
          '<circle cx="80" cy="62" r="46" fill="#e2eee5"/>' +
          '<rect x="52" y="38" width="56" height="48" rx="7" fill="#fcfaf5" stroke="#c9bfac" stroke-width="1.5"/>' +
          '<path d="M52 47h56" stroke="#0e5535" stroke-width="7"/>' +
          '<path d="M62 58h22M62 65h30M62 72h16" stroke="#c9bfac" stroke-width="2" stroke-linecap="round"/>' +
          '<circle cx="108" cy="82" r="14" fill="#0e5535"/>' +
          '<path d="m102 82 4 4 8-9" stroke="#fcfaf5" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' +
          '<path d="M30 96c12 8 28 12 50 12s38-4 50-12" stroke="#d2e0d2" stroke-width="2" fill="none"/>' +
        '</svg>' +
        '<h3>La réponse s\'affichera ici</h3>' +
        '<p>Entrez un code de démonstration ou choisissez un scénario pour voir le parcours complet.</p>' +
      '</div>';

    function setStep(n) {
      stepperSteps.forEach(function (s, i) {
        s.classList.toggle('is-active', i + 1 <= n);
      });
    }

    /* Le témoin : personnage dessiné qui gratte la boîte puis réagit au verdict. */
    const TESTER_SCENE =
      '<svg class="tester-scene" viewBox="0 0 240 150" role="img" aria-label="Le patient gratte le code de la boîte et attend la réponse">' +
        '<circle cx="120" cy="76" r="66" fill="#e2eee5"/>' +
        '<path class="tester-spark" d="m130 30 2.4 5.4 5.9.6-4.5 4 1.3 5.8-5.1-3.1-5.1 3.1 1.3-5.8-4.5-4 5.9-.6Z" fill="#e6b41c"/>' +
        '<g transform="rotate(-6 176 84)">' +
          '<rect x="140" y="54" width="76" height="60" rx="6" fill="#fcfaf5" stroke="#c9bfac" stroke-width="1.6"/>' +
          '<rect x="140" y="54" width="76" height="13" rx="6" fill="#0e5535"/>' +
          '<rect x="148" y="76" width="30" height="4" rx="2" fill="#c9bfac"/>' +
          '<rect x="148" y="84" width="20" height="4" rx="2" fill="#ded6c6"/>' +
          '<rect x="148" y="94" width="58" height="14" rx="3" fill="#fbf0cf" stroke="#e6b41c" stroke-dasharray="3 3"/>' +
          '<text class="tester-code" x="151" y="103.6" font-size="5.6" font-family="monospace" fill="#8a650c">BF 7K2M 9Q4XZ</text>' +
          '<circle cx="206" cy="101" r="6" fill="#0e5535"/>' +
          '<path d="m203 101 2 2 4-5" stroke="#fcfaf5" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' +
        '</g>' +
        '<path d="M30 150c0-30 16-46 40-46s40 16 40 46Z" fill="#e6b41c" stroke="#c99a10" stroke-width="1.6"/>' +
        '<path d="M52 110c6 8 11 11 18 11s12-3 18-11" stroke="#0a4229" stroke-width="5" fill="none" stroke-linecap="round"/>' +
        '<g class="tester-head">' +
          '<rect x="61" y="90" width="18" height="26" rx="8" fill="#7c4e2e"/>' +
          '<circle cx="70" cy="64" r="27" fill="#14241b"/>' +
          '<circle cx="70" cy="68" r="21" fill="#8a5a38"/>' +
          '<path d="M49 64c3-16 10-24 21-24s18 8 21 24c-6-5-13-7-21-7s-15 2-21 7Z" fill="#14241b"/>' +
          '<circle cx="62" cy="69" r="1.8" class="tester-eye" fill="#14241b"/>' +
          '<circle cx="78" cy="69" r="1.8" class="tester-eye" fill="#14241b"/>' +
          '<path d="M64 77c4 3 8 3 12 0" stroke="#14241b" stroke-width="1.8" fill="none" stroke-linecap="round"/>' +
        '</g>' +
        '<path d="M104 118c14-5 26-11 38-20" stroke="#c99a10" stroke-width="13" fill="none" stroke-linecap="round"/>' +
        '<g class="tester-hand">' +
          '<circle cx="146" cy="96" r="7.5" fill="#6e4423"/>' +
          '<path d="M143 89c1-3 4-4 6-2" stroke="#6e4423" stroke-width="3.6" fill="none" stroke-linecap="round"/>' +
        '</g>' +
      '</svg>';

    function testerFace(tone) {
      const brows = tone === 'red'
        ? '<path d="M19.6 21.4c2.2-1.4 4.6-1.2 6.6.4M30 21.8c2-1.6 4.4-1.8 6.6-.4" stroke="#14241b" stroke-width="1.5" fill="none" stroke-linecap="round"/>'
        : tone === 'gold'
          ? '<path d="M19.6 21c2.2-.9 4.4-.5 6.4 1M30.1 22c2-1.5 4.2-1.9 6.4-1" stroke="#14241b" stroke-width="1.5" fill="none" stroke-linecap="round"/>'
          : '<path d="M19.6 21.6c2-1.6 4.4-1.6 6.4-.2M30.1 21.4c2-1.4 4.4-1.4 6.4.2" stroke="#14241b" stroke-width="1.5" fill="none" stroke-linecap="round"/>';
      const mouth = tone === 'red'
        ? '<path d="M23.4 32.6c1.6-2.2 7.6-2.2 9.2 0" stroke="#14241b" stroke-width="1.9" fill="none" stroke-linecap="round"/>'
        : tone === 'gold'
          ? '<path d="M23.8 31.8h8.6" stroke="#14241b" stroke-width="1.9" fill="none" stroke-linecap="round"/>'
          : '<path d="M23.4 30.6c1.6 2.4 7.6 2.4 9.2 0" stroke="#14241b" stroke-width="1.9" fill="none" stroke-linecap="round"/>';
      return '<svg class="tester-face" viewBox="0 0 56 56" aria-hidden="true">' +
        '<defs><clipPath id="testerClip"><circle cx="28" cy="28" r="27"/></clipPath></defs>' +
        '<circle class="tester-bg" cx="28" cy="28" r="27" fill="#e2eee5"/>' +
        '<g clip-path="url(#testerClip)">' +
          '<path class="tester-shirt" d="M6 56c0-11 10-18 22-18s22 7 22 18Z" fill="#e6b41c"/>' +
          '<rect x="23.5" y="30" width="9" height="13" rx="4" fill="#7c4e2e"/>' +
          '<circle class="tester-skin" cx="28" cy="24" r="14.6" fill="#8a5a38"/>' +
          '<circle cx="13.6" cy="26" r="3" fill="#7c4e2e"/>' +
          '<circle cx="42.4" cy="26" r="3" fill="#7c4e2e"/>' +
          '<path class="tester-hair" d="M13.4 25.6c-.8-11.8 5-18.6 14.6-18.6s15.4 6.8 14.6 18.6c-2.2-4.4-5-7-8.4-8.2-2.6 3.6-9.4 4.4-12.6 1-3.4 1.6-6.2 4-8.2 7.2Z" fill="#14241b"/>' +
          '<circle class="tester-eye" cx="22.6" cy="25.2" r="1.9"/>' +
          '<circle class="tester-eye" cx="33.4" cy="25.2" r="1.9"/>' +
          brows + mouth +
        '</g>' +
      '</svg>';
    }

    function loadingState() {
      panel.innerHTML =
        '<div class="result-loading">' +
          TESTER_SCENE +
          '<h3>Vérification en cours…</h3>' +
          '<p>Le patient gratte la boîte. Normalisation du code, empreinte HMAC-SHA256 et recherche du lot.</p>' +
        '</div>';
      if (window.BFMV) window.BFMV.hydrateIcons(panel);
    }

    function bubble(text, out, alert) {
      return '<div class="bubble' + (out ? ' bubble--out' : '') + (alert ? ' bubble--alert' : '') + '">' + text +
        '<time>maintenant</time></div>';
    }

    function renderResult(code, data, phone) {
      const toneClass = data.tone === 'gold' ? ' result-hero--gold' : data.tone === 'red' ? ' result-hero--red' : '';
      const adviceIcon = data.tone === 'green' ? 'check-circle' : 'alert-triangle';
      const phoneLabel = phone || '+226 70 00 00 00';
      panel.innerHTML =
        '<div class="result-hero' + toneClass + '">' +
          '<div class="result-hero-top">' +
            '<div class="result-id">' + testerFace(data.tone) +
              '<div>' +
                '<p class="result-kicker">Résultat · ' + data.status + '</p>' +
                '<h3>' + data.label + '</h3>' +
              '</div>' +
            '</div>' +
            '<span class="result-icon" data-icon="' + data.icon + '"></span>' +
          '</div>' +
          '<p>' + data.resume + '</p>' +
          '<div class="result-hero-top" style="margin-top:.6rem">' +
            '<span class="cell-code">' + code + '</span>' +
            '<span class="badge ' + (data.tone === 'green' ? 'badge--ok' : data.tone === 'gold' ? 'badge--warn' : 'badge--danger') + '">' +
              (data.tone === 'green' ? 'Succès' : data.tone === 'gold' ? 'Attention' : 'Risque') +
            '</span>' +
          '</div>' +
        '</div>' +
        '<div class="result-body">' +
          '<dl class="result-details">' +
            '<div><dt>Produit</dt><dd>' + data.produit + '</dd></div>' +
            '<div><dt>Dosage</dt><dd>' + data.dosage + '</dd></div>' +
            '<div><dt>Numéro de lot</dt><dd>' + data.lot + '</dd></div>' +
            '<div><dt>Expiration</dt><dd>' + data.expiration + '</dd></div>' +
            '<div><dt>Canal</dt><dd>' + (canalInput ? canalInput.value : 'SMS') + '</dd></div>' +
            '<div><dt>Téléphone testé</dt><dd>' + phoneLabel + '</dd></div>' +
          '</dl>' +
          '<div class="result-sms">' +
            '<p class="result-kicker">SMS de réponse · GSM-7, sans accents</p>' +
            '<div class="bubble bubble--out">' + data.sms.replace(/</g, '&lt;') + '<time>maintenant</time></div>' +
          '</div>' +
          '<div class="result-advice"><span data-icon="' + adviceIcon + '"></span><span>' + data.conseil + '</span></div>' +
          '<p class="result-hint">' + data.premiere + '. Simulation locale — aucune donnée n\'a été envoyée.</p>' +
        '</div>' +
        '<div class="result-actions">' +
          '<button class="btn btn--ghost" type="button" data-reset>Recommencer</button>' +
          '<button class="btn btn--ghost" type="button" data-toast="Signalement transmis à la Faso FDA (démonstration)." data-toast-kind="info"><span data-icon="flag"></span>Signaler la boîte</button>' +
          '<button class="btn btn--primary" type="button" data-next-scenario>Scénario suivant<span data-icon="arrow-right"></span></button>' +
        '</div>';

      if (window.BFMV) {
        window.BFMV.hydrateIcons(panel);
        panel.querySelectorAll('[data-toast]').forEach(function (el) {
          el.addEventListener('click', function () {
            window.BFMV.toast(el.getAttribute('data-toast'), el.getAttribute('data-toast-kind'));
          });
        });
      }

      const reset = panel.querySelector('[data-reset]');
      if (reset) reset.addEventListener('click', resetAll);

      const next = panel.querySelector('[data-next-scenario]');
      if (next) next.addEventListener('click', function () {
        const idx = ORDER.indexOf(code);
        const nextCode = ORDER[(idx + 1) % ORDER.length];
        if (input) input.value = nextCode;
        run(nextCode);
      });

      if (thread) {
        thread.innerHTML =
          bubble('VERIF ' + code, true, false) +
          bubble(data.sms.replace(/</g, '&lt;'), false, data.tone === 'red') +
          bubble('Merci. Je vais montrer la boîte au pharmacien.', true, false);
        thread.scrollTop = thread.scrollHeight;
      }

      if (window.matchMedia && window.matchMedia('(max-width: 1080px)').matches) {
        panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }

    function run(code) {
      if (busy) return;
      const normalized = normalize(code);
      if (!normalized) {
        input.focus();
        if (window.BFMV) window.BFMV.toast('Entrez d\'abord un code à 11 caractères.', 'danger');
        return;
      }

      busy = true;
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span data-icon="refresh"></span>Vérification…';
        if (window.BFMV) window.BFMV.hydrateIcons(submitBtn);
      }
      setStep(2);
      loadingState();
      currentCode = normalized;

      setTimeout(function () {
        let data;
        if (!codeIsWellFormed(normalized)) {
          data = DEMO.MAL;
        } else if (DEMO[normalized]) {
          data = DEMO[normalized];
        } else {
          data = DEMO.BF5J7Y2N4T8;
        }
        renderResult(normalized, data, phoneInput ? phoneInput.value : '');
        setStep(3);
        busy = false;
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<span data-icon="scan"></span>Vérifier le code';
          if (window.BFMV) window.BFMV.hydrateIcons(submitBtn);
        }
      }, 1150);
    }

    function resetAll() {
      form.reset();
      if (phoneInput) phoneInput.value = '+226 70 00 00 00';
      if (input) {
        input.value = '';
        input.focus();
      }
      panel.innerHTML = EMPTY_STATE;
      if (window.BFMV) window.BFMV.hydrateIcons(panel);
      setStep(1);
      if (thread) {
        thread.innerHTML =
          bubble('Bonjour, je voudrais vérifier un médicament.', true, false) +
          bubble('Envoyez le code gratté, précédé de VERIF. Exemple : VERIF BF7K2M9Q4XZ', false, false);
      }
      currentCode = null;
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      run(input ? input.value : '');
    });

    if (input) {
      input.addEventListener('input', function () {
        const pos = input.selectionStart;
        const cleaned = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
        if (cleaned !== input.value) {
          input.value = cleaned;
          if (pos !== null) {
            try { input.setSelectionRange(Math.min(pos, cleaned.length), Math.min(pos, cleaned.length)); } catch (err) { /* noop */ }
          }
        }
      });
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          run(input.value);
        }
      });
    }

    document.querySelectorAll('[data-reset-form]').forEach(function (btn) {
      btn.addEventListener('click', resetAll);
    });

    document.querySelectorAll('[data-fill]').forEach(function (chip) {
      chip.addEventListener('click', function () {
        const code = chip.getAttribute('data-fill');
        if (input) input.value = code;
        run(code);
      });
    });

    // Premier rendu : état vide + fil de discussion d'exemple
    setStep(1);
    if (thread) {
      thread.innerHTML =
        bubble('Bonjour, je voudrais vérifier un médicament.', true, false) +
        bubble('Envoyez le code gratté, précédé de VERIF. Exemple : VERIF BF7K2M9Q4XZ', false, false);
    }
    if (window.BFMV) window.BFMV.hydrateIcons(panel);

    // Exposer pour les boutons éventuels
    window.BFMV = window.BFMV || {};
    window.BFMV.verifier = run;
  }

  /* ----------------------------------------------------------------------
     Rejeu des animations (design system)
     ---------------------------------------------------------------------- */
  document.querySelectorAll('[data-replay]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const id = btn.getAttribute('data-replay');
      const stage = document.querySelector('[data-motion="' + id + '"]');
      if (!stage) return;
      const target = stage.querySelector('.motion-demo-block, .motion-demo-dot, .motion-demo-scan, .motion-demo-check');
      if (!target) return;
      target.classList.remove('is-playing');
      void target.offsetWidth;
      target.classList.add('is-playing');
    });
  });

  /* ----------------------------------------------------------------------
     Formulaires de démonstration
     ---------------------------------------------------------------------- */
  document.querySelectorAll('[data-demo-form]').forEach(function (formEl) {
    formEl.addEventListener('submit', function (e) {
      e.preventDefault();
      const message = formEl.getAttribute('data-demo-form') || 'Formulaire enregistré (démonstration). Aucun envoi réel.';
      if (window.BFMV) window.BFMV.toast(message, 'info');
      formEl.reset();
    });
  });

  /* Année dans les pages sans layout injecté (sécurité) */
  document.querySelectorAll('[data-year]').forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });
})();
