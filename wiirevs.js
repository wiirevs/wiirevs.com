// Sort and display choices are remembered per browser; storage can be unavailable or blocked.
const PREFS_KEY = 'wiirevs-prefs';
const readPrefs = () => { try { return JSON.parse(localStorage.getItem(PREFS_KEY)) || {}; } catch { return {}; } };
const savePref = (key, value) => { try { localStorage.setItem(PREFS_KEY, JSON.stringify({ ...readPrefs(), [key]: value })); } catch {} };
function restorePrefs() {
  const prefs = readPrefs();
  if ([...sortBy.options].some(option => option.value === prefs.sortBy)) sortBy.value = prefs.sortBy;
  if ([...sortOrder.options].some(option => option.value === prefs.sortOrder)) sortOrder.value = prefs.sortOrder;
  if (typeof prefs.showGameplay === 'boolean') screenMode.checked = prefs.showGameplay;
  if (typeof prefs.showTbc === 'boolean') showTbc.checked = prefs.showTbc;
  if (typeof prefs.showTech === 'boolean') showTech.checked = prefs.showTech;
  if ([...filterDeveloper.options].some(option => option.value === prefs.developer)) filterDeveloper.value = prefs.developer;
  if ([...asOf.options].some(option => option.value === prefs.asOf)) asOf.value = prefs.asOf;
}

// The selected screen is the resting state; hover, focus or tap previews the other.
const screenMode = document.getElementById('show-gameplay');
const showTbc = document.getElementById('show-tbc');
const showTech = document.getElementById('show-tech');
const asOf = document.getElementById('as-of');
const filterDeveloper = document.getElementById('filter-developer');
const sortBy = document.getElementById('sort-by');
const sortOrder = document.getElementById('sort-order');
restorePrefs();
const resetScreenPreviews = [];
document.querySelectorAll('button.game-screen').forEach(button => {
  let pinned = false;
  const base = () => screenMode.checked;
  const preview = show => { button.dataset.preview = String(show); };
  const reset = () => {
    pinned = false;
    button.setAttribute('aria-pressed', 'false');
    button.setAttribute('aria-label', `${base() ? 'Preview title screen' : 'Preview attract mode'}: ${button.parentElement.dataset.name}`);
    preview(base());
  };
  resetScreenPreviews.push(reset);
  button.addEventListener('pointerenter', event => {
    if (event.pointerType === 'mouse') preview(!base());
  });
  button.addEventListener('pointerleave', () => { if (!pinned) preview(base()); });
  button.addEventListener('focus', () => preview(!base()));
  button.addEventListener('blur', () => { if (!pinned) preview(base()); });
  button.addEventListener('click', () => {
    pinned = !pinned;
    button.setAttribute('aria-pressed', String(pinned));
    preview(pinned ? !base() : base());
  });
  button.addEventListener('keydown', event => {
    if (event.key === 'Escape') reset();
  });
  reset();
});
screenMode.addEventListener('change', () => { savePref('showGameplay', screenMode.checked); resetScreenPreviews.forEach(reset => reset()); });
window.addEventListener('pageshow', () => { restorePrefs(); resetScreenPreviews.forEach(reset => reset()); });

const sortStatus = document.getElementById('sort-status');
const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
function sortGames(announce = true) {
  const key = sortBy.value;
  const direction = sortOrder.value === 'desc' ? -1 : 1;
  document.querySelectorAll('.game-grid').forEach(grid => {
    const cards = [...grid.querySelectorAll(':scope > .game-card')];
    cards.sort((a, b) => {
      // Coming-soon teasers stay at the end in release order, whatever the sort
      if ('soon' in a.dataset || 'soon' in b.dataset)
        return 'soon' in a.dataset && 'soon' in b.dataset ? Number(a.dataset.soon) - Number(b.dataset.soon) : 'soon' in a.dataset ? 1 : -1;
      // Release order: undated placeholders stay at the end in either direction
      if (key === 'release' && !a.dataset.release !== !b.dataset.release) return a.dataset.release ? -1 : 1;
      const compared = key === 'year' ? Number(a.dataset.year) - Number(b.dataset.year)
        : key === 'release' ? (a.dataset.release || '').localeCompare(b.dataset.release || '')
        : collator.compare(a.dataset[key], b.dataset[key]);
      return direction * (compared || collator.compare(a.dataset.name, b.dataset.name));
    });
    grid.append(...cards);
  });
  const mergedBonus = document.querySelector('.bonus-section--inline');
  if (mergedBonus) document.getElementById('main-game-grid').append(mergedBonus);
  if (announce) sortStatus.textContent = `Sorted by ${key === "release" ? "WiiRevs order" : key}, ${sortOrder.value === 'asc' ? 'ascending' : 'descending'}.`;
}
sortBy.addEventListener('change', () => { savePref('sortBy', sortBy.value); sortGames(); });
sortOrder.addEventListener('change', () => { savePref('sortOrder', sortOrder.value); sortGames(); });
// Re-sort if the browser restores dropdown selections when revisiting the page.
window.addEventListener('pageshow', () => sortGames(false));
sortGames(false);

const mergeBonus = document.getElementById('merge-bonus');
const bonusSection = document.getElementById('bonus-games');
function applyBonusLayout(announce = true) {
  // Keep the hidden option at its default even if the browser restores an old value.
  if (mergeBonus.closest('label').hidden) mergeBonus.checked = mergeBonus.defaultChecked;
  bonusSection.classList.toggle('bonus-section--inline', mergeBonus.checked);
  if (mergeBonus.checked) {
    document.getElementById('main-game-grid').append(bonusSection);
  } else {
    document.getElementById('about').before(bonusSection);
  }
  if (announce) sortStatus.textContent = mergeBonus.checked
    ? 'Bonus games appear at the end of the main list.'
    : 'Bonus games appear in their own section.';
}
mergeBonus.addEventListener('change', () => applyBonusLayout());
// Safari can restore the checkbox after a reload; restore its layout too.
window.addEventListener('pageshow', () => applyBonusLayout(false));
applyBonusLayout(false);

// TBC placeholders are built hidden; the option only appears when such games exist.
// Dated games show once the chosen "as of" date reaches their release date.
function applyVisibility() {
  const tbcCards = document.querySelectorAll('.game-card[data-tbc]');
  showTbc.closest('label').hidden = tbcCards.length === 0;
  document.querySelectorAll('.game-card').forEach(card => {
    card.hidden = ('tbc' in card.dataset && !showTbc.checked)
      || Boolean(card.dataset.release && card.dataset.release > asOf.value)
      || Boolean(filterDeveloper.value && card.dataset.developer !== filterDeveloper.value)
      || Boolean(card.dataset.soonUntil && card.dataset.soonUntil <= asOf.value);
    // A game released on the chosen "as of" day (today by default) is new
    card.toggleAttribute('data-new', card.dataset.release === asOf.value);
  });
  // The dock's "N of M games released", as of the chosen date
  const released = document.getElementById('released-count');
  if (released) released.textContent = `${[...document.querySelectorAll('.game-card:not([data-tbc]):not([data-soon])')]
    .filter(card => !(card.dataset.release && card.dataset.release > asOf.value)).length} of ${released.dataset.total} games released`;
  [['main-game-grid', 'main-count'], ['bonus-game-grid', 'bonus-count']].forEach(([grid, count]) => {
    const total = document.querySelectorAll(`#${grid} > .game-card:not([hidden]):not([data-soon])`).length;
    document.getElementById(count).textContent = `${total} games`;
    if (grid === 'bonus-game-grid') document.getElementById('bonus-games').hidden = !document.querySelector(`#${grid} > .game-card:not([hidden])`);
  });
}
showTbc.addEventListener('change', () => { savePref('showTbc', showTbc.checked); applyVisibility(); });
asOf.addEventListener('change', () => { savePref('asOf', asOf.value); applyVisibility(); });
filterDeveloper.addEventListener('change', () => { savePref('developer', filterDeveloper.value); applyVisibility(); });
window.addEventListener('pageshow', applyVisibility);
applyVisibility();

// Technical notes are built into every card that has them and hidden until requested.
function applyTech() {
  showTech.closest('label').hidden = !document.querySelector('.game-tech');
  document.body.classList.toggle('show-tech', showTech.checked);
}
showTech.addEventListener('change', () => { savePref('showTech', showTech.checked); applyTech(); });
window.addEventListener('pageshow', applyTech);
applyTech();
