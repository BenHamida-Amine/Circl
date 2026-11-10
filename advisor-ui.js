import { advisorFacts, advisorOptions, advisorReport, nextAdvisorQuestions } from './advisor.js';
import { action, badge, icon, link, money, safe } from './views.js';

export function newAdvisor() {
  return { facts: {}, question: 'income', history: [], live: false, liveUsed: false, busy: false, error: '' };
}

function choices(options, name) {
  return `<fieldset class="advisor-choices"><legend class="advisor-sr">Choose one answer</legend>
    ${Object.entries(options).map(([value, label]) => `<label class="advisor-choice">
      <input type="radio" name="${name}" value="${value}" required><span>${label}</span></label>`).join('')}
  </fieldset>`;
}

const numberField = (name, label, required = false) =>
  `<label>${label}<input name="${name}" type="number" min="0" max="1000000" step="any" inputmode="decimal"${required ? ' required' : ''}></label>`;

function advisorQuestion(state, demo) {
  const { question, facts } = state;
  switch (question) {
    case 'income': return ['Do you currently have a source of income?',
      'Choose the option that describes what you can rely on today.', choices(advisorOptions.income, 'income')];
    case 'goal': return ['What would you like to achieve?',
      'Choose the goal you want to plan for first.',
      choices(advisorOptions.goal, 'goal') + '<label>Give your goal a name (optional)<input name="goalLabel" maxlength="80" placeholder="For example, a laptop or school supplies"></label>'];
    case 'budget': return [facts.goal === 'give' ? 'What can you spare this month?' : 'What can you safely set aside each month?',
      (demo ? 'Start with what’s left after essentials, debt payments and commitments outside your sample Circl circles. We’ll subtract your scheduled Circl contributions.' :
        'Use what’s left after essentials, debt payments, and all existing commitments, including circles.') +
        (facts.income === 'variable' ? ' Use an amount you could spare even in a low-income month.' : ''),
      numberField('budget', 'Amount in USD', true)];
    case 'members': return ['How many trusted people would be in your circle?',
      'Count yourself. A Standard circle needs 2–7 people who know and trust each other.',
      '<label>Group size<select name="members"><option value="0">I don’t have a confirmed group yet</option>' +
      [2, 3, 4, 5, 6, 7].map(n => `<option value="${n}">${n} members</option>`).join('') + '</select></label>'];
    case 'target': {
      const giving = facts.goal === 'give';
      return [giving ? 'How much would you like to give in total?' : 'What amount would reach your goal?',
        'An estimate is fine. You can skip this if you don’t know yet.',
        `<div class="grid two form-grid">${numberField('target', 'Target in USD', true)}
          ${numberField('saved', giving ? 'Already given in USD' : 'Already set aside in USD')}</div>
        <label>Target month (optional)<input name="deadline" type="month"></label>`];
    }
    default: throw new Error('Unknown advisor question');
  }
}

const monthLabel = date => new Intl.DateTimeFormat('en-US', {
  month: 'long', year: 'numeric', timeZone: 'UTC',
}).format(new Date(date + '-01T00:00:00Z'));

function gapCopy(remaining) {
  if (remaining === null) return '';
  return remaining ? `${money(remaining)} of your target would still be open.` : 'This amount covers the stated gap.';
}

function reportCard(kicker, title, copy, button = '') {
  return `<article class="panel"><p class="eyebrow teal-text">${kicker}</p><h3>${title}</h3>
    <p class="muted">${copy}</p>${button}</article>`;
}

function advisorResults(state, demo) {
  const { facts } = state;
  const report = advisorReport(facts, { useSampleCommitments: demo });
  const { gap, capacity, matches, draft, savings, gift } = report;
  const cards = [];

  if (gap === 0) {
    cards.push(reportCard('Goal reached', 'You’ve already reached your target.',
      'Your stated progress covers this goal. You can keep your funds available or set a new goal.'));
  } else if (!capacity) {
    const reason = ['none', 'unsure'].includes(facts.income)
      ? 'You didn’t report a dependable source of income. A circle requires contributions throughout the term, including after payout.'
      : 'You didn’t report an amount you could reliably set aside after essentials.';
    cards.push(reportCard('Pause', 'Keep room in your budget.', reason + ' Revisit this plan when you have a reliable amount to spare.'));
    if (facts.goal === 'give') cards.push(reportCard('Help without spending', 'Explore causes you could support with your time.',
      'Start by learning what local groups need. There’s no suggested donation amount in this plan.', link('Explore causes', '/charity')));
  } else if (facts.goal === 'give') {
    if (gift.amount > 0) {
      const timing = facts.deadline && facts.deadline < new Date().toISOString().slice(0, 7) ? ' Your target month has passed.' : '';
      cards.push(reportCard('Charity', 'Consider a one-time gift.',
        `Your answers leave up to ${money(gift.amount)} for this goal this month. Choose an amount you feel comfortable giving. ${gapCopy(gift.remaining)}${timing}`,
        link('Explore causes', '/charity')));
    } else {
      cards.push(reportCard('Wait for room', 'Your current commitments come first.',
        'There is no room for a gift this month after the scheduled payments included in this estimate.'));
    }
  } else {
    if (draft) {
      cards.push(reportCard('Create a circle', `Explore a ${draft.members}-member Standard circle`,
        `${money(draft.contribution)} per member each month for ${draft.members} months. The estimated payout at your turn is ${money(draft.net)} before fees, with ${money(draft.held)} held until completion. Using the last turn as a planning estimate puts it in ${monthLabel(draft.by)}.${draft.late ? ' This could miss your target month.' : ''} ${gapCopy(draft.remaining)}`,
        link('Open circle setup', '/create')));
    } else if (facts.goal === 'group') {
      cards.push(reportCard('Create later', 'Confirm the group and its budget first.',
        'Create a circle when 2–7 trusted members agree on a schedule and there is room for every payment.'));
    }
    for (const match of matches) {
      const button = match.late ? '' : action('Review commitment', 'membership', 'secondary', '', `data-id="${match.id}"`);
      cards.push(reportCard(match.late ? 'Timing mismatch' : 'Join a sample circle', match.name,
        `${match.kind} · ${money(match.contribution)} in each of ${match.payingCount} paying months. Sample turn: ${match.turnLabel}. ${money(match.net)} available at payout before fees, with ${money(match.held)} held until completion.${match.late ? ' This is after your target month.' : ''} ${gapCopy(match.remaining)}`, button));
    }
    if (!matches.length) cards.push(reportCard('No current match', 'There’s no sample circle that fits every paying month.',
      'A circle payment must fit the budget on the months it is due. You can still compare the options in discovery.', link('Browse circles', '/explore')));
    if (savings) {
      const late = facts.deadline && (!savings.by || savings.by > facts.deadline);
      cards.push(reportCard('Save independently', 'Set money aside on your own schedule.',
        savings.by ? `If you set aside the available amount each month starting next month, the estimate is ${savings.months} ${savings.months === 1 ? 'month' : 'months'}, around ${monthLabel(savings.by)}.${late ? ' This is after your target month.' : ''}`
          : 'At the amount you reported, reaching this target would take more than ten years.'));
    }
  }

  const mode = state.liveUsed ? 'Live AI helped choose follow-ups' : 'Guided preview';
  return `<div class="stack advisor-content">
    <section class="panel sage">
      ${badge(mode, 'blue')}<h1>Your recommendation report</h1>
      <p>${safe(facts.goalLabel || advisorOptions.goal[facts.goal])}</p>
      <dl class="key-values">
        <dt>Gap from your target</dt><dd>${gap === null ? 'Target amount not provided' : money(gap)}</dd>
        <dt>Amount available this month</dt><dd>${capacity ? money(report.thisMonth) : 'No reliable amount provided'}</dd>
        ${facts.deadline ? `<dt>Target month</dt><dd>${monthLabel(facts.deadline)}</dd>` : ''}
      </dl>
    </section>
    <div class="grid two">${cards.join('')}</div>
    <p class="small muted">Each option is estimated separately in USD. A circle changes when your pooled contributions are available. You keep paying after receiving your payout, and missed payments can delay it. Estimates use your answers${demo ? ' and the sample payment schedule' : ''}. The listed circles are sample data.</p>
    <div class="actions">${action('Review last answer', 'advisor-back')}${action('Start over', 'advisor-restart', 'ghost')}</div>
  </div>`;
}

export function advisorView(state, { demo, liveAvailable }) {
  if (!state.question) return advisorResults(state, demo);
  const { question, error } = state;
  const [title, helper, fields] = advisorQuestion(state, demo);
  const skip = question === 'target' || question === 'budget';
  return `<div class="stack advisor-content">
    <section class="panel advisor-panel">
      <div class="row spread row-wrap"><p class="eyebrow">Circle advisor</p>${badge(state.liveUsed ? 'Live AI helped choose follow-ups' : 'Guided preview', 'blue')}</div>
      <h1>${title}</h1><p class="muted">${helper}</p>
      <form id="advisor-form" class="fields">
        ${fields}
        <p id="advisor-feedback" class="small muted" role="status">${safe(error)}</p>
        <div class="actions">
          <button class="btn primary" type="submit">Continue</button>
          ${skip ? action('Skip this question', 'advisor-skip') : ''}
        </div>
      </form>
      ${state.history.length ? action('Review last answer', 'advisor-back', 'ghost') : ''}
    </section>
    <div class="panel sage advisor-privacy">
      <h2 class="row">${icon('overview-spark')} About this advisor</h2>
      <p class="muted">Use approximate amounts. Your answers stay in this tab for this session. Please leave out bank details, employer names, and other identifying information.</p>
      <label class="labeled-check" id="advisor-live-option"${liveAvailable ? '' : ' hidden'}><input type="checkbox" id="advisor-live"${state.live ? ' checked' : ''}>
        Use live AI to choose follow-ups. Selected answers and amounts will be sent to OpenAI. Your goal name stays in this tab.</label>
      <small class="muted" id="advisor-guided-only"${liveAvailable ? ' hidden' : ''}>The guided preview adapts to your answers without sending them to a live model.</small>
    </div>
  </div>`;
}

export function advisorAnswer(state, form) {
  const fields = new FormData(form);
  const { question } = state;
  const facts = { ...state.facts };
  if (question === 'target' || question === 'budget') {
    const value = fields.get(question);
    if (value === '' || !Number.isFinite(Number(value))) throw new Error('Enter an amount, or skip this question.');
    facts[question] = Number(value);
    if (question === 'target') {
      if (facts.target <= 0) throw new Error('Enter a target above $0, or skip this question.');
      facts.saved = Number(fields.get('saved') || 0);
      facts.deadline = fields.get('deadline') || '';
    }
  } else if (question === 'members') {
    facts.members = Number(fields.get('members'));
  } else {
    facts[question] = fields.get(question);
    if (question === 'goal') facts.goalLabel = String(fields.get('goalLabel') ?? '').trim().slice(0, 80);
  }
  return { ...advisorFacts(facts), goalLabel: facts.goalLabel };
}

export async function chooseAdvisorQuestion(facts, useLive) {
  const candidates = nextAdvisorQuestions(facts);
  const fallback = { question: candidates[0] ?? null, liveUsed: false, unavailable: false };
  if (!useLive || candidates.length < 2) return fallback;
  try {
    const response = await fetch('./api/advisor', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(advisorFacts(facts)), signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) return { ...fallback, unavailable: true };
    const { question, source } = await response.json();
    if (source !== 'openai' || !candidates.includes(question)) return { ...fallback, unavailable: true };
    return { question, liveUsed: true, unavailable: false };
  } catch {
    return { ...fallback, unavailable: true };
  }
}
