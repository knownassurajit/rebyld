/* ================================================================
   rebyld. — Application Logic
   12-Week Bodyweight & Dumbbell Performance System
   
   Storage Model:
   - localStorage  → settings, configs (persist across reloads)
   - sessionStorage → workout progress, water tracking (reset on reload)
   ================================================================ */

'use strict';

// ================================================================
// STORAGE KEYS (rebyld_* with one-time das_* fallback)
// ================================================================
function migrateStorageKey(store, newKey, oldKey) {
  const existing = store.getItem(newKey);
  if (existing !== null) return existing;
  const legacy = store.getItem(oldKey);
  if (legacy !== null) {
    store.setItem(newKey, legacy);
    return legacy;
  }
  return null;
}

function lsGet(newKey, oldKey) {
  return migrateStorageKey(localStorage, newKey, oldKey);
}

function ssGet(newKey, oldKey) {
  return migrateStorageKey(sessionStorage, newKey, oldKey);
}

function lsSet(newKey, value) {
  localStorage.setItem(newKey, value);
}

function ssSet(newKey, value) {
  sessionStorage.setItem(newKey, value);
}

const STORE = {
  layout: 'rebyld_layout_sequence_v2',
  layoutLegacy: 'das_layout_sequence_v2',
  hide: (id) => `rebyld_hide_v2_${id}`,
  hideLegacy: (id) => `das_hide_v2_${id}`,
  waterCustom: 'rebyld_custom_water_v2',
  waterCustomLegacy: 'das_custom_water_v2',
  waterSlots: 'rebyld_checked_slots_v2',
  waterSlotsLegacy: 'das_checked_slots_v2',
  equip: 'rebyld_equip_mode',
  equipLegacy: 'das_equip_mode',
  intensity: 'rebyld_intensity_level',
  intensityLegacy: 'das_intensity_level',
  completed: 'rebyld_completed_exercises',
  completedLegacy: 'das_completed_exercises',
  targets: 'rebyld_user_targets',
  targetsLegacy: 'das_user_targets',
  nutritionPlan: 'rebyld_nutrition_plan',
  planBDay: 'rebyld_plan_b_day'
};

const YT_DEFAULT = 'https://www.youtube.com/@officialdemic/shorts';
const PIN_DEFAULT = 'https://in.pinterest.com/demicofficial/youcan/';

// ================================================================
// SCROLL PROGRESS BAR ENGINE
// ================================================================
window.addEventListener('scroll', () => {
  const winScroll = document.documentElement.scrollTop || document.body.scrollTop;
  const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
  const scrolled = height > 0 ? (winScroll / height) * 100 : 0;
  document.getElementById('scrollProgress').style.width = scrolled + '%';
}, { passive: true });

// ================================================================
// SCOREBAR VISIBILITY CONTROLS
// ================================================================
const scorebar = document.getElementById('scorebar');
let lastY = window.scrollY;
window.addEventListener('scroll', () => {
  const y = window.scrollY;
  if (y > lastY && y > 140) { scorebar.classList.add('hide'); } else { scorebar.classList.remove('hide'); }
  lastY = y;
  document.getElementById('totop').classList.toggle('show', y > 700);
}, { passive: true });

document.getElementById('totop').addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

// ================================================================
// SETTINGS LAYOUT CONTROLLER
// ================================================================
const settingsModal = document.getElementById('settingsModal');
const settingsTrigger = document.getElementById('settingsTrigger');
const settingsClose = document.getElementById('settingsClose');
const settingsModalBackdrop = document.getElementById('settingsModalBackdrop');

function openSettings() { settingsModal.classList.add('active'); }
function closeSettings() { settingsModal.classList.remove('active'); }

settingsTrigger.addEventListener('click', openSettings);
settingsClose.addEventListener('click', closeSettings);
settingsModalBackdrop.addEventListener('click', closeSettings);

// ================================================================
// LAYOUT DRAG-SORTING ENGINE (localStorage — persists)
// ================================================================
const sortableList = document.getElementById('settingsSortableList');
const mainLayoutWrapper = document.getElementById('mainLayoutWrapper');
let dragElement = null;
let pressTimer = null;

sortableList.addEventListener('pointerdown', (e) => {
  const item = e.target.closest('.settings-toggle-item');
  if (!item || e.target.closest('.switch-control')) return;

  pressTimer = setTimeout(() => {
    dragElement = item;
    dragElement.classList.add('dragging');
    if (navigator.vibrate) navigator.vibrate(40);
  }, 200);
});

window.addEventListener('pointermove', (e) => {
  if (!dragElement) return;
  e.preventDefault();

  const siblings = [...sortableList.querySelectorAll('.settings-toggle-item:not(.dragging)')];
  const nextSibling = siblings.find(sibling => {
    const box = sibling.getBoundingClientRect();
    return e.clientY <= box.top + box.height / 2;
  });

  sortableList.insertBefore(dragElement, nextSibling);
});

const stopDragging = () => {
  clearTimeout(pressTimer);
  if (dragElement) {
    dragElement.classList.remove('dragging');
    dragElement = null;
    synchronizePageLayout();
  }
};

window.addEventListener('pointerup', stopDragging);
window.addEventListener('pointercancel', stopDragging);

function synchronizePageLayout() {
  const currentOrder = [...sortableList.querySelectorAll('.settings-toggle-item')].map(item => item.dataset.target);
  currentOrder.forEach(id => {
    const targetSection = document.getElementById(id);
    if (targetSection) mainLayoutWrapper.appendChild(targetSection);
  });
  lsSet(STORE.layout, JSON.stringify(currentOrder));
}

// ================================================================
// VISIBILITY SWITCHES (localStorage — persists)
// ================================================================
const toggles = document.querySelectorAll('.settings-toggle-item input[type="checkbox"]');
const navTabsContainer = document.getElementById('navTabs');
const drawerNavContainer = document.getElementById('drawerNav');

function applyVisibilityState(targetId, isVisible) {
  const targetElement = document.getElementById(targetId);
  if (!targetElement) return;

  if (isVisible) {
    targetElement.classList.remove('section-hidden');
  } else {
    targetElement.classList.add('section-hidden');
  }

  const desktopTab = navTabsContainer.querySelector(`[data-nav="${targetId}"]`);
  const mobileTab = drawerNavContainer.querySelector(`[data-nav="${targetId}"]`);

  if (desktopTab) desktopTab.classList.toggle('nav-hidden', !isVisible);
  if (mobileTab) mobileTab.classList.toggle('nav-hidden', !isVisible);
}

toggles.forEach(box => {
  const target = box.dataset.toggleTarget;
  const cachedState = lsGet(STORE.hide(target), STORE.hideLegacy(target));
  if (cachedState === 'true') {
    box.checked = false;
    applyVisibilityState(target, false);
  }

  box.addEventListener('change', (e) => {
    const isVisible = e.target.checked;
    applyVisibilityState(target, isVisible);
    lsSet(STORE.hide(target), String(!isVisible));
  });
});

// ================================================================
// LOAD CACHED LAYOUT ARRANGEMENT (localStorage — persists)
// ================================================================
(function initializeLayoutFromCache() {
  const raw = lsGet(STORE.layout, STORE.layoutLegacy);
  const cachedSequence = raw ? JSON.parse(raw) : null;
  if (cachedSequence) {
    cachedSequence.forEach(id => {
      const section = document.getElementById(id);
      if (section) mainLayoutWrapper.appendChild(section);

      const configItem = sortableList.querySelector(`[data-target="${id}"]`);
      if (configItem) sortableList.appendChild(configItem);
    });
  }
})();

// ================================================================
// ACTIVE SECTION NAVIGATION HIGHLIGHT
// ================================================================
const sections = ['diet', 'workout', 'hydration', 'science'].map(id => document.getElementById(id));
const desktopLinks = document.querySelectorAll('.tabs a');
const mobileLinks = document.querySelectorAll('.drawer-nav a');

const io = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting && !entry.target.classList.contains('section-hidden')) {
      const activeId = '#' + entry.target.id;
      desktopLinks.forEach(a => a.classList.toggle('active', a.getAttribute('href') === activeId));
      mobileLinks.forEach(a => a.classList.toggle('active', a.getAttribute('href') === activeId));
    }
  });
}, { rootMargin: '-30% 0px -60% 0px' });
sections.forEach(s => s && io.observe(s));

// ================================================================
// MOBILE DRAWER MECHANISMS
// ================================================================
const navToggle = document.getElementById('navToggle');
const drawer = document.getElementById('drawer');
const drawerOverlay = document.getElementById('drawerOverlay');
const drawerLinksList = document.querySelectorAll('.drawer-nav a');

function openDrawer() {
  drawer.classList.add('active');
  drawerOverlay.classList.add('active');
  navToggle.classList.add('active');
}

function closeDrawer() {
  drawer.classList.remove('active');
  drawerOverlay.classList.remove('active');
  navToggle.classList.remove('active');
}

navToggle.addEventListener('click', () => {
  if (drawer.classList.contains('active')) { closeDrawer(); } else { openDrawer(); }
});
drawerOverlay.addEventListener('click', closeDrawer);
drawerLinksList.forEach(link => link.addEventListener('click', closeDrawer));

// ================================================================
// SCROLL REVEAL ANIMATIONS
// ================================================================
const revealEls = document.querySelectorAll('.reveal');
const rIo = new IntersectionObserver((entries) => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); rIo.unobserve(e.target); } });
}, { threshold: 0.05 });
revealEls.forEach(el => rIo.observe(el));

// ================================================================
// NUTRITION PLAN SWITCHER (Plan A Chrono / Plan B AM Run Cook)
// ================================================================
const planToggle = document.getElementById('planToggle');
const dietToggle = document.getElementById('dietToggle');
const planBDayToggle = document.getElementById('planBDayToggle');
const planAGroup = document.getElementById('planAGroup');
const planBGroup = document.getElementById('planBGroup');

function setNutritionPlan(plan) {
  const isB = plan === 'b';
  lsSet(STORE.nutritionPlan, plan);

  if (planToggle) {
    planToggle.querySelectorAll('.pt-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.plan === plan);
    });
    planToggle.classList.toggle('plan-b-active', isB);
  }

  if (planAGroup) planAGroup.classList.toggle('active', !isB);
  if (planBGroup) planBGroup.classList.toggle('active', isB);
  if (dietToggle) dietToggle.classList.toggle('hidden-toggle', isB);
  if (planBDayToggle) planBDayToggle.classList.toggle('hidden-toggle', !isB);

  if (isB) {
    const day = localStorage.getItem(STORE.planBDay) || 'monfri';
    setPlanBDay(day);
  } else {
    const activeA = dietToggle?.querySelector('.dt-btn.active');
    const day = activeA?.dataset.day || 'weekday';
    document.querySelectorAll('#planAGroup .day-panel').forEach(p => p.classList.remove('active'));
    const panel = document.getElementById('panel-' + day);
    if (panel) panel.classList.add('active');
  }
}

function setPlanBDay(day) {
  lsSet(STORE.planBDay, day);
  if (planBDayToggle) {
    planBDayToggle.querySelectorAll('.pb-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.day === day);
    });
    planBDayToggle.classList.toggle('sat-active', day === 'sat');
    planBDayToggle.classList.toggle('sun-active', day === 'sun');
  }
  document.querySelectorAll('#planBGroup .day-panel').forEach(p => p.classList.remove('active'));
  const panel = document.getElementById('panel-b-' + day);
  if (panel) panel.classList.add('active');
}

if (planToggle) {
  planToggle.querySelectorAll('.pt-btn').forEach(btn => {
    btn.addEventListener('click', () => setNutritionPlan(btn.dataset.plan));
  });
}

if (planBDayToggle) {
  planBDayToggle.querySelectorAll('.pb-btn').forEach(btn => {
    btn.addEventListener('click', () => setPlanBDay(btn.dataset.day));
  });
}

document.querySelectorAll('#dietToggle .dt-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#dietToggle .dt-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('#planAGroup .day-panel').forEach(p => p.classList.remove('active'));
    const panel = document.getElementById('panel-' + btn.dataset.day);
    if (panel) panel.classList.add('active');

    if (btn.dataset.day === 'weekend') {
      dietToggle.classList.add('weekend-active');
    } else {
      dietToggle.classList.remove('weekend-active');
    }
  });
});

setNutritionPlan(localStorage.getItem(STORE.nutritionPlan) || 'a');

// ================================================================
// WORKOUT DAY TABS
// ================================================================
document.querySelectorAll('.day-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.day-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    document.querySelectorAll('.workout-panel').forEach(p => p.classList.remove('active'));
    document.getElementById(tab.dataset.target).classList.add('active');
  });
});

// ================================================================
// MOBILE INTERACTIVE TABLE EXPANSION
// ================================================================
document.querySelectorAll('.ex-row').forEach(row => {
  row.addEventListener('click', () => {
    if (window.innerWidth <= 760) row.classList.toggle('open');
  });
});

// ================================================================
// METRICS COUNT-UP MODULATOR
// ================================================================
function countUp(el) {
  const target = parseFloat(el.dataset.count);
  const suffixEl = el.querySelector('small');
  const suffix = suffixEl ? suffixEl.outerHTML : '';
  let cur = 0;
  const step = Math.max(target / 30, 1);
  const tick = () => {
    cur += step;
    if (cur >= target) { el.innerHTML = target + suffix; return; }
    el.innerHTML = Math.floor(cur) + suffix;
    requestAnimationFrame(tick);
  };
  tick();
}
const macroObserver = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.querySelectorAll('.num[data-count]').forEach(countUp);
      macroObserver.unobserve(e.target);
    }
  });
}, { threshold: 0.1 });
document.querySelectorAll('.macro-strip').forEach(m => macroObserver.observe(m));

// ================================================================
// FLUID TRACKING SYSTEM (sessionStorage — resets on reload)
// ================================================================
const waterFill = document.getElementById('waterFill');
const waterLoggedVal = document.getElementById('waterLoggedVal');
const waterItems = document.querySelectorAll('.water-slots .ws-item');
const inputWaterCustom = document.getElementById('inputWaterCustom');

let customWater = parseInt(ssGet(STORE.waterCustom, STORE.waterCustomLegacy) || '0', 10);
let checkedSlots = JSON.parse(ssGet(STORE.waterSlots, STORE.waterSlotsLegacy) || '[]');

waterItems.forEach((item, index) => {
  if (checkedSlots.includes(index)) item.classList.add('checked');

  item.addEventListener('click', () => {
    item.classList.toggle('checked');
    const activeChecks = [];
    waterItems.forEach((it, idx) => {
      if (it.classList.contains('checked')) activeChecks.push(idx);
    });
    checkedSlots = activeChecks;
    ssSet(STORE.waterSlots, JSON.stringify(checkedSlots));
    updateWaterUI();
  });
});

function updateWaterUI() {
  let total = customWater;
  waterItems.forEach(item => {
    if (item.classList.contains('checked')) {
      total += parseInt(item.dataset.amount || '0', 10);
    }
  });

  const liters = (total / 1000).toFixed(2) + 'L';
  waterLoggedVal.textContent = liters;

  const goal = window.__waterGoalMl || 4000;
  const pct = Math.min((total / goal) * 100, 100);
  waterFill.style.height = pct + '%';
}

document.getElementById('btnWaterAdd250').addEventListener('click', () => {
  customWater += 250;
  ssSet(STORE.waterCustom, String(customWater));
  updateWaterUI();
});

document.getElementById('btnWaterAdd500').addEventListener('click', () => {
  customWater += 500;
  ssSet(STORE.waterCustom, String(customWater));
  updateWaterUI();
});

document.getElementById('btnWaterCustomLog').addEventListener('click', () => {
  const val = parseInt(inputWaterCustom.value, 10);
  if (val && val > 0 && val <= 3000) {
    customWater += val;
    ssSet(STORE.waterCustom, String(customWater));
    inputWaterCustom.value = '';
    updateWaterUI();
  }
});

document.getElementById('btnWaterReset').addEventListener('click', () => {
  customWater = 0;
  checkedSlots = [];
  ssSet(STORE.waterCustom, '0');
  ssSet(STORE.waterSlots, '[]');
  waterItems.forEach(item => item.classList.remove('checked'));
  updateWaterUI();
});

updateWaterUI();

// ================================================================
// SLEEP ARC DRAW
// ================================================================
const sleepObserver = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      document.getElementById('sleepArc').style.transition = 'stroke-dashoffset 1.2s ease-out';
      document.getElementById('sleepArc').style.strokeDashoffset = '0';
      sleepObserver.unobserve(e.target);
    }
  });
}, { threshold: 0.1 });
sleepObserver.observe(document.querySelector('.sleep-card'));

// ================================================================
// DIAGNOSTICS ACCORDION
// ================================================================
document.querySelectorAll('.acc-head').forEach(head => {
  head.addEventListener('click', () => {
    const item = head.parentElement;
    const wasOpen = item.classList.contains('open');
    document.querySelectorAll('.acc-item').forEach(i => i.classList.remove('open'));
    if (!wasOpen) item.classList.add('open');
  });
});

// ================================================================
// WORKOUT EQUIPMENT FILTER (localStorage — persists)
// ================================================================
const equipButtons = document.querySelectorAll('.btn-filter-equip');
let currentEquipMode = lsGet(STORE.equip, STORE.equipLegacy) || 'all';

function setEquipmentMode(mode) {
  currentEquipMode = mode;
  lsSet(STORE.equip, mode);
  equipButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.equip === mode));

  document.querySelectorAll('.ex-row').forEach(row => {
    if (mode === 'bw' && row.dataset.exEquip === 'db') {
      row.classList.add('bodyweight-hidden');
    } else {
      row.classList.remove('bodyweight-hidden');
    }
  });
}

equipButtons.forEach(btn => {
  btn.addEventListener('click', () => setEquipmentMode(btn.dataset.equip));
});
setEquipmentMode(currentEquipMode);

// ================================================================
// WORKOUT INTENSITY SWITCH (localStorage — persists)
// ================================================================
const intensityButtons = document.querySelectorAll('.btn-filter-intensity');
let currentIntensity = lsGet(STORE.intensity, STORE.intensityLegacy) || 'standard';

function setIntensityLevel(level) {
  currentIntensity = level;
  lsSet(STORE.intensity, level);
  intensityButtons.forEach(btn => {
    const isTarget = btn.dataset.intensity === level;
    btn.classList.toggle('active', isTarget);
    if (level === 'burn' && isTarget) {
      btn.classList.add('active-burn');
    } else {
      btn.classList.remove('active-burn');
    }
  });

  const restSpan = document.getElementById('restTimerVal');
  if (level === 'burn') {
    if (restSpan) restSpan.textContent = '30–45 seconds (High Intensity Burn)';
    document.querySelectorAll('.ex-sets').forEach(el => {
      if (!el.dataset.origSets) el.dataset.origSets = el.textContent;
      el.textContent = '4 × 15–20';
    });
  } else {
    if (restSpan) restSpan.textContent = '60–90 seconds';
    document.querySelectorAll('.ex-sets').forEach(el => {
      if (el.dataset.origSets) el.textContent = el.dataset.origSets;
    });
  }
}

intensityButtons.forEach(btn => {
  btn.addEventListener('click', () => setIntensityLevel(btn.dataset.intensity));
});
setIntensityLevel(currentIntensity);

// ================================================================
// EXERCISE COMPLETION TRACKING (sessionStorage — resets on reload)
// ================================================================
let completedExercises = new Set(JSON.parse(ssGet(STORE.completed, STORE.completedLegacy) || '[]'));

function saveCompletionState() {
  ssSet(STORE.completed, JSON.stringify([...completedExercises]));
}

function markExerciseComplete(exId) {
  if (!exId) return;
  completedExercises.add(exId);
  saveCompletionState();

  // Find and update all matching rows
  document.querySelectorAll(`[data-ex-id="${exId}"]`).forEach(el => {
    el.classList.add('completed', 'just-completed');
    setTimeout(() => el.classList.remove('just-completed'), 600);
  });

  updateDayTabCompletion();
}

function updateDayTabCompletion() {
  document.querySelectorAll('.workout-panel').forEach(panel => {
    const allExercises = panel.querySelectorAll('.ex-row[data-ex-id], .wu-item[data-ex-id]');
    const totalCount = allExercises.length;
    let completedCount = 0;

    allExercises.forEach(row => {
      if (completedExercises.has(row.dataset.exId)) {
        completedCount++;
        row.classList.add('completed');
      }
    });

    // Update corresponding day tab
    const tabTarget = panel.id;
    const dayTab = document.querySelector(`.day-tab[data-target="${tabTarget}"]`);
    if (!dayTab) return;

    // Update or create completion badge
    let badge = dayTab.querySelector('.completion-badge');
    if (!badge) {
      badge = document.createElement('div');
      badge.className = 'completion-badge';
      dayTab.appendChild(badge);
    }

    if (completedCount > 0) {
      badge.textContent = `${completedCount}/${totalCount}`;
      badge.style.display = '';
    } else {
      badge.style.display = 'none';
    }

    dayTab.classList.toggle('day-complete', completedCount === totalCount && totalCount > 0);
  });
}

// Restore completion state from session on load
(function restoreCompletionState() {
  completedExercises.forEach(exId => {
    document.querySelectorAll(`[data-ex-id="${exId}"]`).forEach(el => {
      el.classList.add('completed');
    });
  });
  updateDayTabCompletion();
})();

// ================================================================
// EXERCISE DEMONSTRATION POP-UP MODAL
// ================================================================
const exerciseModal = document.getElementById('exerciseModal');
const modalCloseBtn = document.getElementById('modalCloseBtn');
const modalExTitle = document.getElementById('modalExTitle');
const modalMusclesList = document.getElementById('modalMusclesList');
const modalFormCues = document.getElementById('modalFormCues');
const modalMistakes = document.getElementById('modalMistakes');
const modalEquipTag = document.getElementById('modalEquipTag');
const modalSvgBox = document.getElementById('modalSvgBox');
const btnMarkComplete = document.getElementById('btnMarkComplete');

// Extended modal elements
const modalPosture = document.getElementById('modalPosture');
const modalBreathing = document.getElementById('modalBreathing');
const modalTempo = document.getElementById('modalTempo');
const modalProgression = document.getElementById('modalProgression');
const modal5kBenefit = document.getElementById('modal5kBenefit');
const modalAbsBenefit = document.getElementById('modalAbsBenefit');
const modalFormGuide = document.getElementById('modalFormGuide');
const btnModalYoutube = document.getElementById('btnModalYoutube');
const btnModalPinterest = document.getElementById('btnModalPinterest');

let currentModalExId = null;

function openExerciseModal(elem) {
  const exId = elem.dataset.exId || null;
  const exName = elem.dataset.exName || elem.querySelector('.ex-name, .wu-t')?.textContent?.trim() || 'Exercise Demo';
  const equip = elem.dataset.exEquip === 'db' ? 'Dumbbell & Bodyweight Resistance' : 'Calisthenics Bodyweight Motion';
  const muscles = (elem.dataset.exMuscles || 'Core, Stabilizers').split(',');
  const cues = elem.dataset.exCues || 'Maintain rigid core alignment. Focus on smooth 2-second eccentric phase.';
  const mistakes = elem.dataset.exMistakes || 'Avoid using body swing momentum or hyperextending lower back.';
  const runBenefit = elem.dataset.ex5k || 'Improves core stamina and pelvic alignment for 5K running.';
  const absBenefit = elem.dataset.exAbs || 'Engages transverse abdominis for a sculpted waistline.';
  const posture = elem.dataset.exPosture || 'Maintain neutral spine with shoulder blades retracted. Feet shoulder-width apart, weight distributed through mid-foot.';
  const breathing = elem.dataset.exBreathing || 'Exhale during concentric (lifting) phase. Inhale during eccentric (lowering) phase with 2-second controlled descent.';
  const tempo = elem.dataset.exTempo || '2-1-2-0';
  const progression = elem.dataset.exProgression || 'When all prescribed sets and reps can be completed with perfect form, increase load by 1–2 kg or add 2–3 reps per set.';
  const intervals = elem.dataset.exIntervals || '';
  const ytUrl = elem.dataset.exYoutube || YT_DEFAULT;
  const pinUrl = elem.dataset.exPinterest || PIN_DEFAULT;

  currentModalExId = exId;

  modalExTitle.textContent = exName;
  modalEquipTag.textContent = equip;
  modalFormCues.textContent = cues;
  modalMistakes.textContent = mistakes;

  modalMusclesList.innerHTML = muscles.map((m, idx) => `
    <span class="muscle-tag ${idx === 0 ? 'primary' : ''}">${m.trim()}</span>
  `).join('');

  if (modalPosture) modalPosture.textContent = posture;
  if (modalBreathing) modalBreathing.textContent = breathing;
  if (modalProgression) modalProgression.textContent = progression;

  if (modalFormGuide) {
    const guideParts = [
      `<strong>Posture setup:</strong> ${posture}`,
      intervals ? `<strong>Intervals:</strong> ${intervals}` : `<strong>Tempo:</strong> ${tempo} (ecc–pause–con–hold)`,
      `<strong>Breathing:</strong> ${breathing}`,
      `<strong>Watch for:</strong> ${mistakes}`
    ];
    modalFormGuide.innerHTML = guideParts.map(p => `<p>${p}</p>`).join('');
  }

  if (btnModalYoutube) btnModalYoutube.href = ytUrl;
  if (btnModalPinterest) btnModalPinterest.href = pinUrl;

  if (modalTempo) {
    const parts = tempo.split('-');
    const labels = ['Eccentric', 'Pause', 'Concentric', 'Hold'];
    modalTempo.innerHTML = '<div class="tempo-display">' +
      parts.map((val, i) => `
        <div class="tempo-phase">
          <span class="tempo-val">${val}</span>
          <span class="tempo-label">${labels[i] || ''}</span>
        </div>
        ${i < parts.length - 1 ? '<span class="tempo-sep">·</span>' : ''}
      `).join('') +
    '</div>';
  }

  if (modal5kBenefit) modal5kBenefit.textContent = runBenefit;
  if (modalAbsBenefit) modalAbsBenefit.textContent = absBenefit;

  if (elem.dataset.exEquip === 'db') {
    modalSvgBox.innerHTML = `
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="var(--lime)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 8h1a4 4 0 0 1 0 8h-1"></path>
        <path d="M2 8h16v8H2z"></path>
        <line x1="6" y1="1" x2="6" y2="4"></line>
        <line x1="10" y1="1" x2="10" y2="4"></line>
        <line x1="14" y1="1" x2="14" y2="4"></line>
      </svg>
    `;
  } else {
    modalSvgBox.innerHTML = `
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="var(--lime)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="5" r="3"></circle>
        <path d="M6 22l4-8 2 3 4-7"></path>
        <path d="M17 14l-5 4-4-3-3 5"></path>
      </svg>
    `;
  }

  if (exId && completedExercises.has(exId)) {
    btnMarkComplete.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Completed ✓`;
    btnMarkComplete.className = 'btn-modal-action completed-state';
  } else {
    btnMarkComplete.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Mark Set Complete`;
    btnMarkComplete.className = 'btn-modal-action';
    btnMarkComplete.style.background = '';
    btnMarkComplete.style.color = '';
  }

  if (typeof exerciseModal.showModal === 'function') {
    exerciseModal.showModal();
  } else {
    exerciseModal.setAttribute('open', '');
  }
}

function closeExerciseModal() {
  if (typeof exerciseModal.close === 'function') {
    exerciseModal.close();
  } else {
    exerciseModal.removeAttribute('open');
  }
}

// Attach Event Listeners to Exercise Rows & Buttons
document.addEventListener('click', (e) => {
  const demoBtn = e.target.closest('.btn-ex-demo');
  const exRow = e.target.closest('.ex-row');
  const wuItem = e.target.closest('.wu-item');

  if (demoBtn) {
    e.stopPropagation();
    const parentTarget = demoBtn.closest('.ex-row, .wu-item');
    if (parentTarget) openExerciseModal(parentTarget);
  } else if (exRow) {
    openExerciseModal(exRow);
  } else if (wuItem && !e.target.closest('.wu-d')) {
    openExerciseModal(wuItem);
  }
});

modalCloseBtn.addEventListener('click', closeExerciseModal);

// Light-Dismiss Fallback for Browsers without closedBy
if (!('closedBy' in HTMLDialogElement.prototype)) {
  exerciseModal.addEventListener('click', (event) => {
    if (event.target !== exerciseModal) return;
    const rect = exerciseModal.getBoundingClientRect();
    const isInside = (
      rect.top <= event.clientY &&
      event.clientY <= rect.top + rect.height &&
      rect.left <= event.clientX &&
      event.clientX <= rect.left + rect.width
    );
    if (!isInside) closeExerciseModal();
  });
}

// Mark Set Complete Handler
btnMarkComplete.addEventListener('click', () => {
  if (currentModalExId && completedExercises.has(currentModalExId)) return;
  
  if (navigator.vibrate) navigator.vibrate([40, 30, 40]);
  
  if (currentModalExId) {
    markExerciseComplete(currentModalExId);
  }
  
  btnMarkComplete.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Completed ✓`;
  btnMarkComplete.className = 'btn-modal-action completed-state';
  
  setTimeout(closeExerciseModal, 700);
});

// ================================================================
// CUSTOM USER PROTOCOL METRICS (localStorage — persists)
// ================================================================
const cfgTargetWeight = document.getElementById('cfgTargetWeight');
const cfgTargetKcal = document.getElementById('cfgTargetKcal');
const cfgTargetProtein = document.getElementById('cfgTargetProtein');
const cfgTargetWater = document.getElementById('cfgTargetWater');

function loadUserTargets() {
  const raw = lsGet(STORE.targets, STORE.targetsLegacy);
  const savedTargets = JSON.parse(raw || '{}');
  if (savedTargets.weight && cfgTargetWeight) cfgTargetWeight.value = savedTargets.weight;
  if (savedTargets.kcal && cfgTargetKcal) cfgTargetKcal.value = savedTargets.kcal;
  if (savedTargets.protein && cfgTargetProtein) cfgTargetProtein.value = savedTargets.protein;
  if (savedTargets.water && cfgTargetWater) cfgTargetWater.value = savedTargets.water;

  applyUserTargetsToUI(savedTargets);
}

function saveUserTargets() {
  const targets = {
    weight: cfgTargetWeight ? cfgTargetWeight.value : '58-60',
    kcal: cfgTargetKcal ? cfgTargetKcal.value : '1525',
    protein: cfgTargetProtein ? cfgTargetProtein.value : '130',
    water: cfgTargetWater ? cfgTargetWater.value : '4.0'
  };
  lsSet(STORE.targets, JSON.stringify(targets));
  applyUserTargetsToUI(targets);
}

function applyUserTargetsToUI(t) {
  if (t.weight) {
    const weightStat = document.querySelector('.hero-stats .stat:nth-child(4) b');
    if (weightStat) weightStat.textContent = t.weight + ' kg';
  }
  if (t.kcal) {
    ['#panel-weekday', '#panel-b-monfri'].forEach(sel => {
      const kcalEl = document.querySelector(`${sel} .macro-cell:nth-child(1) .num`);
      if (kcalEl) {
        kcalEl.dataset.count = t.kcal;
        const small = kcalEl.querySelector('small');
        kcalEl.innerHTML = t.kcal + (small ? small.outerHTML : '<small>kcal</small>');
      }
    });
  }
  if (t.protein) {
    ['#panel-weekday', '#panel-b-monfri'].forEach(sel => {
      const proteinEl = document.querySelector(`${sel} .macro-cell:nth-child(2) .num`);
      if (proteinEl) {
        proteinEl.dataset.count = t.protein;
        const small = proteinEl.querySelector('small');
        proteinEl.innerHTML = t.protein + (small ? small.outerHTML : '<small>g</small>');
      }
    });
  }
  if (t.water) {
    const liters = parseFloat(t.water);
    if (!isNaN(liters) && liters > 0) {
      window.__waterGoalMl = liters * 1000;
      updateWaterUI();
    }
  }
}

[cfgTargetWeight, cfgTargetKcal, cfgTargetProtein, cfgTargetWater].forEach(inp => {
  if (inp) inp.addEventListener('change', saveUserTargets);
});
loadUserTargets();

// ================================================================
// SERVICE WORKER REGISTRATION (offline-first shell)
// ================================================================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
