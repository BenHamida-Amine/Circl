import { causes, cycleEnd, discovery, memberships, payout } from './data.js';

export const money = (amount, cents = false) => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', minimumFractionDigits: cents || !Number.isInteger(amount) ? 2 : 0,
  maximumFractionDigits: 2,
}).format(amount);

export const safe = (value) => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);

export const icon = (name) => `<img src="./assets/${name}.svg" alt="">`;
export const badge = (text, variant = '') => `<span class="badge ${variant}">${text}</span>`;
export const link = (label, path, variant = 'secondary', extra = '') =>
  `<a class="btn ${variant} ${extra}" href="#${path}">${label}</a>`;
export const action = (label, key, variant = 'secondary', extra = '', data = '') =>
  `<button class="btn ${variant} ${extra}" type="button" data-action="${key}" ${data}>${label}</button>`;

export const agreementLink = (label, path, variant = 'secondary', extra = '') =>
  link(label, '/agreement?from=' + encodeURIComponent(path), variant, extra);

function heading(kicker, title, description = '', button = '') {
  return `<div class="page-heading">
    <div class="heading-copy">
      ${kicker ? `<p class="eyebrow">${kicker}</p>` : ''}
      <h1>${title}</h1>
      ${description ? `<p class="muted">${description}</p>` : ''}
    </div>
    ${button}
  </div>`;
}

const summary = (label, metric, note) => `<div class="panel summary">
  <small class="muted">${label}</small>
  <p class="metric">${metric}</p>
  <small class="muted">${note}</small>
</div>`;

export const rows = (items) => `<dl class="key-values">${items.map(([label, value]) =>
  `<dt>${label}</dt><dd>${value}</dd>`).join('')}</dl>`;
export const delayNotice = `<div class="notice amber stack">
  <h3>Delay timings are not finalized.</h3>
  <small>Joining and signing open only after the complete agreement is ready.</small>
</div>`;

function circleCard(id, circle) {
  const { name, kind, contribution, members, months, turn, remaining } = circle;
  const special = kind === 'Special';
  const { net, held } = payout(kind, members, contribution);
  return `<a class="panel circle-card" href="#/circles/${id}">
    <div class="row spread"><h2>${name}</h2>${badge(kind, special ? 'blue' : '')}</div>
    <small class="muted">${members} members · ${months}-month commitment</small>
    <div class="row"><strong class="metric">${money(contribution)}</strong><small class="muted">${special ? 'in your 6 paying months' : 'every month'}</small></div>
    <div class="triplet">
      <small class="muted">Receive now<span>${money(net)}</span></small>
      <small class="muted">Held · 10%<span>${money(held)}</span></small>
      <small class="muted">Your turn<span>${turn}</span></small>
    </div>
    <small class="muted">${remaining}</small>
  </a>`;
}

const membershipCards = () => Object.entries(memberships).map(([id, circle]) => circleCard(id, circle)).join('');

export function overview(budget) {
  const available = Math.max(0, budget - 60);
  return `<div class="desktop-only section overview-desktop">
    ${heading('Your overview', 'Good morning, Maya.', '', link('Find a circle', '/explore'))}
    <div class="grid three">
      ${summary('Peak monthly commitments', '$60', `${money(available)} available · Dec–Feb payments: $40`)}
      ${summary('Next amount you receive', '$216', 'Dec 1 · $240 gross less $24 holdback')}
      ${summary('Next completion holdback', '$24', 'Reserved from that payout · not a fee')}
    </div>
    <div class="panel teal banner">
      <div class="stack">
        <p class="eyebrow">Next contribution · Standard</p>
        <div class="row"><strong class="metric">$40</strong><span>Local Makers · due Nov 1</span></div>
        <small>Your full monthly commitment continues after your payout.</small>
      </div>
      ${action('Review payment', 'payment', 'secondary', '', 'data-id="local-makers"')}
    </div>
    <section class="section" aria-labelledby="your-circles">
      <h2 id="your-circles">Your circles</h2>
      <div class="grid two">${membershipCards()}</div>
    </section>
    <div class="grid two">
      <div class="panel sage"><div class="row">${icon('overview-spark')}<h3>Find a circle that fits your paying months</h3></div>
        <small class="muted">Matches check all your commitments, payout dates, and $0-due months. Held money is not available to spend.</small>
        ${link('Explore my matches', '/explore', 'ghost')}
      </div>
      <div class="panel"><h3>Fixed term. Your choice at the end.</h3>
        <small class="muted">Standard: up to 7 months. Special: 9 months. A new cycle always needs fresh consent.</small>
        ${agreementLink('Review agreement preview', '/', 'ghost')}
      </div>
    </div>
  </div>
  <div class="mobile-only mobile-overview">
    ${heading('', 'Good morning, Maya.')}
    <div class="panel sage">
      <p class="eyebrow teal-text">Your paying-month budget</p>
      <p class="metric">${money(available)} available</p>
      <p class="small muted">$60 peak commitments of ${money(budget)}.<br>$40 commitments during Dec–Feb.</p>
      <progress class="progress" value="${Math.min(budget, 60)}" max="${Math.max(budget, 1)}" aria-label="Peak budget used"></progress>
    </div>
    <div class="panel teal">
      <p class="eyebrow">Next contribution · Standard</p><p class="metric big">$40</p><p>Local Makers · due Nov 1</p>
      ${action('Review payment', 'payment', 'secondary', 'full', 'data-id="local-makers"')}
    </div>
    <div class="panel">
      <h3>Your next payout · December 1</h3><p class="metric">$216 to receive</p>
      <p class="small muted">$24 held · $240 gross payout</p><p class="small muted">4 × $40 contributions remain through February.</p>
    </div>
    <div class="panel blue">
      ${badge('Special · Learning Together', 'blue')}
      <h3>$0 due during your turn</h3><p class="small muted">Dec–Feb: your contribution break. Pay $20 in the other 6 months of the 9-month circle.</p>
    </div>
    ${link('View commitment & renewal', '/circles/local-makers')}
  </div>`;
}

export function explore(preferences, filters) {
  const available = Math.max(0, preferences.budget - 60);
  return `${heading('Find your circle', 'Choose your rhythm.', 'Two formats. Clear dates. A commitment you understand.')}
    <div class="grid two equal">
      <div class="panel sage format-panel">
        <h2 class="row">${icon('standard')} Standard circle</h2>
        <small class="muted">2–7 members · one monthly payout · up to 7 months</small>
        <small class="muted">Everyone contributes every month.</small>
      </div>
      <div class="panel blue format-panel">
        <h2 class="row">${icon('calendar')} Special circle</h2>
        <small class="muted">3 members · quarterly payouts · 9 months</small>
        <small class="muted">Pay in 6 months. $0 due during your own 3-month turn.</small>
      </div>
    </div>
    <div class="panel sage banner budget-strip">
      ${icon('matches-spark')}
      <div><strong>${money(preferences.budget)} budget − $60 peak commitments = ${money(available)} available</strong>
        <small class="muted">Matches check paying months, alongside your existing commitments.</small>
      </div>
      ${action('Preferences', 'preferences')}
    </div>
    <div class="filters">
      <label class="search-field">${icon('search-field')}<input type="search" name="search" aria-label="Search by circle name or goal" placeholder="Search by circle name or goal" value="${safe(filters.search)}"></label>
      <select name="format" aria-label="Circle format">
        <option value="all">All formats</option>
        <option${filters.format === 'Standard' ? ' selected' : ''}>Standard</option>
        <option${filters.format === 'Special' ? ' selected' : ''}>Special</option>
      </select>
      <select name="limit" aria-label="Monthly contribution limit">
        <option value="budget">Up to ${money(available)}</option>
        <option value="all"${filters.limit === 'all' ? ' selected' : ''}>All amounts</option>
      </select>
    </div>
    <div id="results" class="grid three equal">${results(preferences, filters)}</div>
    <small class="muted">Up to $100 per paying month per member. Fees are shown separately. No automatic renewal.</small>`;
}

export function results(preferences, filters) {
  const available = Math.max(0, preferences.budget - 60);
  const search = filters.search.trim().toLowerCase();
  const matches = Object.entries(discovery).filter(([, c]) =>
    (filters.format === 'all' || c.kind === filters.format) &&
    (filters.limit === 'all' || c.contribution <= available) &&
    `${c.name} ${c.goal}`.toLowerCase().includes(search));
  if (!matches.length) return '<p class="panel muted">No circles match these filters. Try another search, format, or amount.</p>';
  return matches.map(([id, c]) => {
    const { net, held } = payout(c.kind, c.members, c.contribution);
    const special = c.kind === 'Special';
    const room = available - c.contribution;
    const fit = room < 0 ? `${money(-room)} above your available budget` : `Fits your budget · ${money(room)} monthly room left`;
    return `<article class="panel result-card">
      ${badge(c.kind, special ? 'blue' : '')}
      <h2>${c.name}</h2>
      <small class="muted">${c.members} members · ${c.months} months</small>
      <div class="row"><strong class="metric">${money(c.contribution)}</strong><small class="muted">${special ? 'in 6 paying months' : 'every month'}</small></div>
      <strong class="teal-text">Receive ${money(net)} · ${money(held)} held (10%)</strong>
      <small class="muted">Your turn · ${c.turn}</small>
      <small class="muted">${special && room >= 0 ? `$0 due ${c.breakMonths} during your turn` : fit}</small>
      ${action('Review commitment', 'membership', 'primary', 'full', `data-id="${id}"`)}
    </article>`;
  }).join('');
}

export function myCircles() {
  return `${heading('My circles', 'Your circles', 'View your contributions, payout dates, and commitments.', link('Create a circle', '/create'))}
    <div class="grid two">${membershipCards()}</div>`;
}

export function circleDetails(id) {
  const c = memberships[id];
  const special = c.kind === 'Special';
  const { gross, net, held } = payout(c.kind, c.members, c.contribution);
  const amount = money(c.contribution);
  const path = '/circles/' + id;
  const schedule = special
    ? `<div class="panel"><h2>One recipient every three months</h2>
        ${c.schedule.map(([dates, who, due, turn]) => `<div class="panel ${due ? 'subtle' : 'blue'}">
          <div class="row spread row-wrap"><strong>${dates}</strong><small>${who}</small></div>
          <p class="teal-text">You pay ${money(due)} each month</p>
          <small class="muted">${turn} · ${money(net)} received + ${money(held)} held</small>
        </div>`).join('')}
        <small class="muted">The other two members fund each turn: 2 × ${amount} × 3 months = ${money(gross)}. Your scheduled $0 months are exempt.</small>
      </div>`
    : `<div class="panel">
        <h2>Round 3 · contributions in progress</h2>
        <div class="row row-wrap"><strong class="metric">$200</strong><small class="muted">of $240 collected · next recipient: Daniel</small></div>
        <progress class="progress" max="240" value="200" aria-label="Round contributions collected"></progress>
        <small class="muted">Payouts pause if the required contributions are missing.</small>
      </div>
      <div class="panel"><h2>Fixed payout schedule</h2>
        <ol class="schedule">${c.schedule.map(([who, date, status], i) => `<li><span class="round">${i + 1}</span><strong>${who}</strong><small class="muted">${date}</small>${badge(status, status === 'Next' ? 'blue' : status === 'Scheduled' ? 'subtle' : '')}</li>`).join('')}</ol>
        <small class="muted">Each ${money(gross)} payout releases ${money(net)} and holds ${money(held)} until that member completes their commitment.</small>
      </div>`;
  return `${heading('My circles / ' + c.kind, c.name, `${c.members} members · ${c.period} · a ${c.months}-month commitment`, link('Back to overview', '/'))}
    <div class="grid three">
      ${summary(special ? 'Contribution in paying months' : 'Monthly contribution', amount, special ? '6 paying months · $120 total per member' : '6 contributions total · maximum term 7 months')}
      ${summary('Receive on ' + c.receiveDate, money(net), `${money(gross)} gross payout less 10% holdback`)}
      ${summary('Completion holdback', money(held), 'Released after full commitment & settlement')}
    </div>
    <div class="grid split">
      <div class="stack">${schedule}</div>
      <div class="stack">
        ${special ? `<div class="panel blue">${icon('special-calendar')}<h2>$0 due in Dec–Feb</h2><small class="muted">This is your three-month turn. Your payout arrives at its end and contributions resume in March.</small></div>` : ''}
        <div class="panel teal"><p class="eyebrow">Remaining contributions</p>
          <p class="metric big">${money(c.contribution * 4)}</p>
          <p>4 payments × ${amount}, including the next payment.</p>
          <small>Due ${c.due}. Keep contributing after your payout.</small>
          ${action(`Review next ${amount} payment`, 'payment', 'secondary', 'full', `data-id="${id}"`)}
          ${special ? `<small>Scheduled cycle end: ${c.ends}.</small>` : ''}
        </div>
        ${special ? '' : `<div class="panel sage">
          <h2>Your ${money(held)} completion holdback</h2>
          <small class="muted">Reserved from your December payout. Released after all your contributions are paid and settlement is complete.</small>
          <small class="teal-text">The holdback belongs to you until release or settlement.</small>
          <small class="muted">Scheduled cycle end: ${c.ends}.</small>
        </div>`}
      </div>
    </div>
    <div class="actions">
      ${agreementLink('View agreement', path)}
      ${action('Delays & defaults', 'policy')}
      ${link(special ? 'End-of-cycle choices' : 'End-of-cycle preview', path + '/completion')}
    </div>`;
}

export function createCircle(kind, draft) {
  const special = kind === 'Special';
  const path = special ? '/create/special' : '/create';
  return `${heading(special ? 'Create a circle / Special' : 'Create a circle',
    special ? 'Three members. Three shared turns.' : 'Start with a clear commitment.',
    special ? 'A fixed 9-month commitment with a contribution break during your own turn.' : 'Choose a format, review the numbers, then prepare an agreement.')}
    <nav class="actions" aria-label="Creation format">
      <a class="btn ${special ? 'secondary' : 'primary'}" href="#/create" ${special ? '' : 'aria-current="page"'}>Standard · monthly payouts</a>
      <a class="btn ${special ? 'primary' : 'secondary'}" href="#/create/special" ${special ? 'aria-current="page"' : ''}>Special · quarterly payouts</a>
    </nav>
    <div class="grid split">
      <form class="panel fields" id="create-form">
        ${badge(special ? 'Special · fixed 3 members · 9 months' : 'Standard · up to 7 months', special ? 'blue' : '')}
        <label>Circle name<input name="name" required maxlength="80" value="${safe(draft.name)}"></label>
        <div class="grid two form-grid">
          <label>${special ? 'Amount in paying months' : 'Monthly amount'} · up to $100<input name="contribution" type="number" min="0.01" max="100" step="0.01" required value="${safe(draft.contribution)}"></label>
          ${special
            ? '<div class="field-label">Members · fixed for Special<span class="field-value">3 members</span></div>'
            : `<label>Members · maximum 7<select name="members">${[2, 3, 4, 5, 6, 7].map(n => `<option value="${n}" ${Number(draft.members) === n ? 'selected' : ''}>${n} members</option>`).join('')}</select></label>`}
          <label>First contribution date<input name="start" type="date" required value="${safe(draft.start)}"></label>
          <div class="field-label">Duration · ${special ? 'fixed for Special' : 'one turn per member'}<output class="field-value" id="duration">${special ? 9 : Number(draft.members)} months</output></div>
        </div>
        ${special ? `<div class="notice blue stack"><strong>Pay in the other members’ turns.</strong>
          <small class="muted">Your own turn has $0 due each month. All members agree the order before signing.</small></div>
          <small class="amber-text">Grace periods and the missed-payment review threshold remain undecided. Agreements cannot be signed yet.</small>`
          : `<small class="muted">All members contribute every month, including after their own payout. Payout order is fixed before the circle starts.</small>
          <div class="notice amber stack"><strong>Delay timings still need a decision</strong>
            <small>Grace periods and the missed-payment review threshold must be finalized before anyone can sign.</small></div>`}
        <div class="actions">
          ${special ? '' : action('Save draft', 'save-draft')}
          <button class="btn primary" type="submit">${special ? 'Review Special circle' : 'Review circle & agreement'}</button>
        </div>
      </form>
      <div class="stack">
        <div class="panel sage">
          <p class="eyebrow teal-text">Each member’s payout</p>
          <div id="draft-estimate" class="stack">${draftEstimate(kind, draft)}</div>
          ${agreementLink('Preview agreement terms', path)}
        </div>
        <div class="panel">
          ${icon('assistant-spark')}
          <h3>${special ? 'Budget for the months you pay.' : 'Build around a realistic budget.'}</h3>
          <small class="muted">${special ? 'Affordability uses the full amount required in paying months.' : 'The assistant preview shows how a suggested format and schedule could work.'}</small>
          ${special ? '' : action('Ask the circle assistant', 'assistant', 'ghost')}
        </div>
      </div>
    </div>`;
}

export function draftEstimate(kind, draft) {
  const contribution = Number(draft.contribution);
  if (!contribution || contribution > 100 || contribution < 0.01) {
    return '<p class="muted">Enter an amount between $0.01 and $100 to preview the payout.</p>';
  }
  const special = kind === 'Special';
  const months = special ? 9 : Number(draft.members);
  const { gross, net, held } = payout(kind, Number(draft.members), contribution);
  const totals = [['Receive at your turn', money(net)], ['Held until completion', money(held)]];
  if (special) totals.push(['Paying months', '6 of 9'], ['Own turn', '$0 / month']);
  totals.push(['Total contributions', money(gross)], ['Scheduled end', cycleEnd(draft.start, months)]);
  return `<h2>${money(gross)} gross</h2>${rows(totals)}
    <small class="muted">${special
      ? `Each quarterly payout is funded by the other two members. 2 × ${money(contribution)} × 3 months = ${money(gross)}.`
      : 'The holdback is 10% of the payout. It stays attributed to its recipient until release or agreed default settlement.'}</small>`;
}

export function charity() {
  return `${heading('The charity space', 'A little kindness goes far.', 'Support a cause you care about, at an amount that suits you.')}
    <div class="panel sage banner charity-banner">
      <div class="stack"><h2 class="feature-title">Help grows when we give together.</h2>
        <p class="muted">Explore community causes and see where your contribution goes.</p>
        <small class="teal-text">Giving is optional and never changes a circle’s payout order.</small>
      </div>
      ${icon('charity-heart')}
    </div>
    <div class="grid split">
      <section class="section"><h2>Find a cause</h2><div class="grid two equal tight">
        ${Object.entries(causes).map(([id, c]) => `<article class="panel">
          <div class="cause-art">${icon(c.icon)}</div>
          ${badge(c.group)}<h2>${c.name}</h2><p class="muted">${c.description}</p>
          <progress class="progress" value="${c.raised}" max="${c.goal}" aria-label="${c.name} fundraising progress"></progress>
          <small class="muted">${money(c.raised)} raised of ${money(c.goal)}</small>
          ${action('Support this cause', 'donation', 'primary', 'full', `data-id="${id}"`)}
        </article>`).join('')}
      </div></section>
      <div class="stack">
        <div class="panel"><h2>Your giving</h2><p class="metric big">$25</p>
          <p class="muted">Thank you for supporting Community Pantry.</p>${badge('Every contribution matters')}</div>
        <div class="panel sage"><h2>Community kindness</h2><small class="muted">A thank-you to people who choose to share.</small>
          ${rows([['1 · Lina', '$120'], ['2 · Omar', '$90'], ['3 · You · Maya', '$25']])}
          <small class="muted">Recognition only. Your payout position stays the same.</small>
        </div>
      </div>
    </div>
    <small class="muted">Donations stay separate: no circle holdback and no change to payout priority.</small>`;
}

const agreementSections = [
  ['Your circle and schedule', 'The final agreement names every member, the contribution amount, due dates, fixed payout order, and scheduled end date. Organizations name an authorized representative.'],
  ['Two fixed commitment formats', 'Standard: 2–7 members, one monthly turn each, up to 7 months. Special: 3 members, 3 quarterly turns, 9 months. The recipient pays $0 during their own turn.'],
  ['The 10% completion holdback', 'Receive 90% of your scheduled payout at your turn. The remaining 10% stays attributed to you until you complete your obligations and settlement is finished.'],
  ['Contributions continue after your payout', 'The agreement shows your remaining payment obligations. Scheduled $0-due months in a Special circle are exempt.'],
  ['Delays, default, and the holdback', 'Delay timings are still undecided. Confirmed default after payout can apply your holdback to documented losses in that circle, credited against the outstanding amount.'],
  ['Completion and renewal', 'Finish the cycle and settle outstanding amounts. You may stop or review a new cycle. Renewal requires fresh consent. Unpaid obligations remain due after the scheduled end.'],
];

export function agreement(back) {
  return `${heading('Your commitment / template preview', 'Understand before you commit.', 'Every member accepts the same terms before a circle starts.', link('Back to previous screen', back))}
    <div class="grid split">
      <div class="panel">
        ${badge('Agreement preview · version 0.2', 'blue')}
        ${agreementSections.map(([title, copy], i) => `<h3>${i + 1}. ${title}</h3><small class="muted">${copy}</small>`).join('')}
      </div>
      <div class="stack">
        <div class="panel amber"><h2>Some terms are still undecided</h2>
          ${rows([['Grace period', 'Not finalized'], ['Review threshold', 'Not finalized']])}
          <small>Signing remains unavailable until these rules and the circle-specific schedule are complete.</small>
        </div>
        <div class="panel"><h2>Electronic agreement</h2>
          <label>Member name · sample<input value="Maya Adams" readonly></label>
          <label class="labeled-check"><input type="checkbox" disabled> I have reviewed the complete circle agreement.</label>
          <button class="btn full" disabled>Sign agreement · unavailable</button>
          <small class="muted">After signing, a dated copy, verified member identity, and the accepted agreement version will be recorded.</small>
          <small class="muted">This is a preview.</small>
          ${action('Review delay & default policy', 'policy')}
        </div>
      </div>
    </div>`;
}

export function completion(id) {
  const c = memberships[id];
  const special = c.kind === 'Special';
  const { gross, net, held } = payout(c.kind, c.members, c.contribution);
  return `${heading('End of cycle / illustrative state', 'You completed your commitment.', `${c.name} · example after ${c.ends}`, link('Back to overview', '/'))}
    <div class="panel sage row">
      ${icon('completion-check')}<div class="stack"><h2 class="feature-title">All contributions paid. Settlement complete.</h2>
      <p class="muted">Your ${money(held)} holdback is released. Continuing is entirely your choice.</p></div>
    </div>
    <div class="grid three">
      ${summary('Total you contributed', money(gross), `${special ? 6 : c.members} payments × ${money(c.contribution)}`)}
      ${summary('Released at your payout', money(net), `90% of the ${money(gross)} scheduled payout`)}
      ${summary('Holdback returned', money(held), `Total received: ${money(gross)} before any fees`)}
    </div>
    <div class="grid two equal">
      <div class="panel">${icon('finish-check')}<h2 class="feature-title">Finish here</h2>
        <p class="muted">Your commitment is complete. Leave this circle without a penalty, keep your records, and remain free to use Circl.</p>
        ${action('Finish & leave this circle', 'finish')}
      </div>
      <div class="panel sage">${icon('mobile-brand')}<h2 class="feature-title">Continue with fresh consent</h2>
        <p class="muted">Review the members, amount, dates, payout order, and a new agreement before joining another cycle.</p>
        ${action('Review a new cycle', 'renew', 'primary')}
      </div>
    </div>
    <div class="panel amber"><strong>A scheduled end date does not erase unpaid contributions.</strong>
      <small>If obligations or disputes remain, the circle stays in settlement.</small>
      ${action('View a default settlement example', 'settlement', 'ghost')}
    </div>`;
}
