import {
  accountView, demoAccounts, fillSample, isAccountPath, resendConfirmation, restoreAccount, signOutAccount, submitAccount,
} from './account.js';
import { memberships } from './data.js';
import { dialogView } from './dialogs.js';
import {
  agreement, challenge, charity, circleDetails, completion, createCircle, draftEstimate, explore,
  money, myCircles, overview, results,
} from './views.js';

const main = document.querySelector('#main');
const dialog = document.querySelector('#dialog');
const navigation = document.querySelector('#navigation');
const sidebar = document.querySelector('.sidebar');
const headerTools = document.querySelector('#header-tools');
const defaults = {
  Standard: { name: 'Creative Futures', contribution: 40, members: 6, start: '2026-11-01' },
  Special: { name: 'Skills Fund', contribution: 40, members: 3, start: '2026-11-01' },
};
const preferences = { budget: 100, goal: '' };
const filters = { search: '', format: 'all', limit: 'budget' };
const storageKey = (kind) => {
  const scope = activeAccount.id === 'preview-person' ? '' : activeAccount.id + ':';
  return 'circl:draft:' + scope + kind.toLowerCase();
};

function readDraft(kind) {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey(kind)));
    if (saved && typeof saved.name === 'string' && typeof saved.start === 'string' &&
      Number.isInteger(saved.members) && saved.members >= 2 && saved.members <= 7 &&
      Number.isFinite(saved.contribution) && saved.contribution >= 0.01 && saved.contribution <= 100) {
      return { ...saved, members: kind === 'Special' ? 3 : saved.members };
    }
  } catch {
    // Storage can be disabled or contain a draft from a previous version.
  }
  return { ...defaults[kind] };
}

const drafts = {};
let currentPath = '/';
let currentKind = 'Standard';
let donationAmount = 25;
let lastTrigger;
let activeAccount = null;
let accountLoading = !demoAccounts;
let accountUnavailable = false;
let afterAccountPath = '/';

function useAccount(account) {
  activeAccount = account;
  if (!account) return;
  Object.assign(preferences, { budget: 100, goal: '' });
  Object.assign(filters, { search: '', format: 'all', limit: 'budget' });
  drafts.Standard = readDraft('Standard');
  drafts.Special = readDraft('Special');
}

const navItems = [
  ['/', 'Overview', 'Home', 'home'],
  ['/explore', 'Find a circle', 'Explore', 'search'],
  ['/circles', 'My circles', 'Circles', 'circles'],
  ['/charity', 'Charity', 'Charity', 'heart'],
  ['/challenge', 'Challenge', 'Challenge', 'challenge'],
  ['/create', 'Create a circle', 'Create', 'plus'],
];

const routes = {
  '/': { title: 'Overview', nav: '/', view: () => overview(preferences.budget, activeAccount.kind === 'person' ? activeAccount.name : null) },
  '/explore': { title: 'Find a circle', nav: '/explore', view: () => explore(preferences, filters) },
  '/circles': { title: 'My circles', nav: '/circles', view: myCircles },
  '/charity': { title: 'Charity', nav: '/charity', view: charity },
  '/challenge': { title: 'Challenge', nav: '/challenge', view: challenge },
  '/create': { title: 'Create a circle', nav: '/create', kind: 'Standard', view: () => createCircle('Standard', drafts.Standard) },
  '/create/special': { title: 'Create a Special circle', nav: '/create', kind: 'Special', view: () => createCircle('Special', drafts.Special) },
  '/agreement': { title: 'Agreement preview', view: (query) => {
    const from = query.get('from');
    return agreement(Object.hasOwn(routes, from) && from !== '/agreement' ? from : '/');
  } },
};

for (const [id, circle] of Object.entries(memberships)) {
  const path = '/circles/' + id;
  routes[path] = { title: circle.name, nav: '/circles', view: () => circleDetails(id) };
  routes[path + '/completion'] = { title: 'End-of-cycle preview', nav: '/circles', view: () => completion(id) };
}

function renderNavigation(active) {
  navigation.innerHTML = navItems.map(([path, label, mobile, symbol]) => `
    <a class="nav-link ${path === '/create' ? 'create-link' : ''}" href="#${path}" ${active === path ? 'aria-current="page"' : ''}>
      <picture>${['plus', 'challenge'].includes(symbol) ? '' : `<source media="(max-width: 700px)" srcset="./assets/mobile-${symbol}.svg">`}
        <img src="./assets/${symbol}.svg" alt="">
      </picture>
      <span class="desktop-only">${label}</span><span class="mobile-only">${mobile}</span>
    </a>`).join('');
}

function render({ focus = false, scroll = false } = {}) {
  if (dialog.open) dialog.close();
  const requested = location.hash.slice(1) || '/';
  const [path, query] = requested.split('?');
  sidebar.hidden = headerTools.hidden = !activeAccount;
  main.classList.toggle('account-layout', !activeAccount);
  if (!activeAccount) {
    navigation.innerHTML = '';
    document.title = 'Circl · Account';
    if (accountLoading || accountUnavailable) {
      main.innerHTML = accountLoading
        ? '<section class="panel account-panel" role="status"><h1>Checking your account…</h1></section>'
        : '<section class="panel account-panel"><h1>Account service unavailable</h1><p>Reload this page to try again.</p></section>';
    } else {
      if (!isAccountPath(path) && Object.hasOwn(routes, path)) afterAccountPath = requested;
      const entryPath = isAccountPath(path) ? path : '/account';
      if (entryPath !== path) window.history.replaceState(null, '', '#' + entryPath);
      main.innerHTML = accountView(entryPath);
    }
  } else {
    const appPath = isAccountPath(path) ? '/' : path;
    if (appPath !== path) window.history.replaceState(null, '', '#/');
    const route = Object.hasOwn(routes, appPath) ? routes[appPath] : null;
    currentPath = route ? appPath : '/';
    currentKind = route?.kind ?? 'Standard';
    renderNavigation(route?.nav);
    document.querySelector('#account-name').textContent = activeAccount.name;
    document.querySelector('#account-type').textContent = activeAccount.kind === 'person' ? 'Personal account' : 'Organization account';
    const avatar = document.querySelector('#account-avatar');
    avatar.textContent = activeAccount.name.split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase();
    avatar.setAttribute('aria-label', activeAccount.name);
    document.title = route ? `Circl · ${route.title}` : 'Circl · Page not found';
    main.innerHTML = route ? route.view(new URLSearchParams(query)) :
      '<div class="panel"><h1>Page not found</h1><a class="btn secondary" href="#/">Back to overview</a></div>';
  }
  main.classList.remove('page-enter');
  requestAnimationFrame(() => main.classList.add('page-enter'));
  if (scroll) window.scrollTo(0, 0);
  if (focus) main.focus({ preventScroll: true });
}

function showDialog(key, id) {
  const { wide, markup } = dialogView(key, {
    id, path: currentPath, draft: drafts[currentKind], kind: currentKind, preferences, donationAmount,
  });
  dialog.classList.toggle('wide', wide);
  dialog.innerHTML = markup;
  if (!dialog.open) dialog.showModal();
  dialog.scrollTop = 0;
  dialog.querySelector('[data-action="close"]').focus();
}

function readForm(form) {
  const fields = form.elements;
  return {
    name: fields.name.value.trim(),
    contribution: Number(fields.contribution.value),
    members: currentKind === 'Special' ? 3 : Number(fields.members.value),
    start: fields.start.value,
  };
}

function captureDraft(form) {
  fieldsValidName(form.elements.name);
  if (!form.reportValidity()) return false;
  drafts[currentKind] = readForm(form);
  return true;
}

function fieldsValidName(field) {
  field.setCustomValidity(field.value.trim() ? '' : 'Enter a circle name.');
}

function refreshResults() {
  document.querySelector('#results').innerHTML = results(preferences, filters);
}

function goTo(path) {
  window.history.replaceState(null, '', '#' + path);
  render({ focus: true, scroll: true });
}

function leaveAccount() {
  if (!activeAccount) return;
  activeAccount = null;
  afterAccountPath = '/';
  goTo('/account');
}

async function withAccountFeedback(button, status, task) {
  if (button.disabled) return;
  status.textContent = '';
  status.hidden = false;
  button.disabled = true;
  try {
    await task();
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : 'Please try again.';
  } finally {
    button.disabled = false;
  }
}

document.querySelector('.skip').addEventListener('click', (event) => {
  event.preventDefault();
  main.focus();
});

document.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) {
    const anchor = event.target.closest('a[href^="#/"]');
    if (anchor && dialog.contains(anchor)) {
      lastTrigger = null;
      dialog.close();
    }
    return;
  }

  const { action, id, amount } = button.dataset;
  if (action === 'account-fill') {
    fillSample(button.form);
    return;
  }
  if (action === 'account-resend') {
    const email = button.form.elements.namedItem('email');
    if (!email.reportValidity()) return;
    const status = button.form.querySelector('[data-account-feedback]');
    void withAccountFeedback(button, status, async () => {
      await resendConfirmation(email.value.trim().toLowerCase());
      status.textContent = 'Check your inbox for a new code.';
    });
    return;
  }
  if (action === 'account-sign-out') {
    void withAccountFeedback(button, document.querySelector('#session-feedback'), async () => {
      await signOutAccount();
      leaveAccount();
    });
    return;
  }
  if (!dialog.open) lastTrigger = button;

  switch (action) {
    case 'close':
      dialog.close();
      break;
    case 'donation':
      donationAmount = 25;
      showDialog(action, id);
      break;
    case 'choose-donation':
      donationAmount = Number(amount);
      dialog.querySelector('#donation-total').textContent = money(donationAmount, true);
      for (const choice of dialog.querySelectorAll('[data-action="choose-donation"]')) {
        const chosen = Number(choice.dataset.amount) === donationAmount;
        choice.setAttribute('aria-pressed', String(chosen));
        choice.classList.toggle('primary', chosen);
        choice.classList.toggle('secondary', !chosen);
      }
      break;
    case 'save-draft': {
      if (!captureDraft(document.querySelector('#create-form'))) break;
      try {
        localStorage.setItem(storageKey(currentKind), JSON.stringify(drafts[currentKind]));
      } catch {
        showDialog('draft-unavailable');
        break;
      }
      showDialog('draft-saved');
      break;
    }
    case 'use-assistant':
      drafts.Standard = { ...defaults.Standard };
      lastTrigger = null;
      render({ focus: true });
      break;
    default:
      showDialog(action, id);
  }
});

dialog.addEventListener('close', () => {
  if (!dialog.open && lastTrigger?.isConnected) lastTrigger.focus();
  lastTrigger = null;
});

document.addEventListener('input', (event) => {
  const field = event.target;
  if (field.name === 'search') {
    filters.search = field.value;
    refreshResults();
  }
  const form = field.closest('#create-form');
  if (form) {
    if (field.name === 'name') fieldsValidName(field);
    drafts[currentKind] = readForm(form);
    document.querySelector('#draft-estimate').innerHTML = draftEstimate(currentKind, drafts[currentKind]);
    document.querySelector('#duration').textContent =
      (currentKind === 'Special' ? 9 : drafts[currentKind].members) + ' months';
  }
});

document.addEventListener('change', (event) => {
  const field = event.target;
  if (field.name === 'format' || field.name === 'limit') {
    filters[field.name] = field.value;
    refreshResults();
  }
});

document.addEventListener('submit', (event) => {
  const form = event.target;
  if (form.id === 'account-form') {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    void withAccountFeedback(button, form.querySelector('[data-account-feedback]'), async () => {
      const result = await submitAccount(form);
      if (result.account) {
        useAccount(result.account);
        const destination = afterAccountPath;
        afterAccountPath = '/';
        goTo(destination);
      } else {
        goTo(result.path);
      }
    });
    return;
  }
  if (form.id === 'create-form') {
    event.preventDefault();
    lastTrigger = event.submitter;
    if (captureDraft(form)) showDialog('review-draft');
  }
  if (form.id === 'preferences-form') {
    event.preventDefault();
    preferences.budget = Number(form.elements.budget.value);
    preferences.goal = form.elements.goal.value.trim();
    filters.search = preferences.goal;
    filters.limit = 'budget';
    lastTrigger = null;
    render({ focus: true });
  }
});

window.addEventListener('hashchange', () => render({ focus: true, scroll: true }));
restoreAccount(leaveAccount).then(account => {
  useAccount(account);
}).catch(() => {
  accountUnavailable = true;
}).finally(() => {
  accountLoading = false;
  render();
});
if (accountLoading) render();
