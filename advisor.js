import { discovery, memberships, payout } from './data.js';

export const advisorOptions = {
  income: { steady: 'Yes, fairly steady', variable: 'Yes, but it varies', none: 'No income right now', unsure: 'Prefer not to say' },
  goal: { save: 'Save for a purchase or project', give: 'Help people or support a cause', group: 'Start a circle with people I trust', explore: 'Explore my options' },
};

const maxAmount = 1000000;
const toCents = amount => Math.round(amount * 100);
const dollars = cents => cents / 100;
const calendarMonth = index => `${Math.floor(index / 12)}-${String(index % 12 + 1).padStart(2, '0')}`;
const monthIndex = month => Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1;
const currentMonth = date => date.toISOString().slice(0, 7);
const hasIncome = input => ['steady', 'variable'].includes(input.income);
const amount = value => Number.isFinite(value) && value >= 0 && value <= maxAmount
  ? dollars(toCents(value)) : null;

export function advisorFacts(input) {
  if (!input || typeof input !== 'object') return {};
  const facts = {};
  for (const name of ['income', 'goal']) {
    if (typeof input[name] === 'string' && Object.hasOwn(advisorOptions[name], input[name])) facts[name] = input[name];
  }
  if (Object.hasOwn(input, 'budget')) facts.budget = amount(input.budget);
  if (Object.hasOwn(input, 'target')) facts.target = amount(input.target);
  if (Object.hasOwn(input, 'saved')) facts.saved = amount(input.saved) ?? 0;
  if (typeof input.deadline === 'string' && /^[2-9]\d{3}-(0[1-9]|1[0-2])$/.test(input.deadline)) facts.deadline = input.deadline;
  if (Number.isInteger(input.members) && (input.members === 0 || (input.members >= 2 && input.members <= 7))) {
    facts.members = input.members;
  }
  return facts;
}

export function nextAdvisorQuestions(input) {
  if (!input.income) return ['income'];
  if (!input.goal) return ['goal'];
  const needsTarget = input.goal !== 'explore' && input.target === undefined;
  const reached = input.target > 0 && (input.saved ?? 0) >= input.target;
  if (reached) return [];
  const needsBudget = hasIncome(input) && input.budget === undefined;
  const needsMembers = input.goal === 'group' && hasIncome(input) &&
    input.budget !== 0 && input.budget !== null && input.members === undefined;
  if (input.goal === 'group') {
    return [needsMembers && 'members', needsBudget && 'budget', needsTarget && 'target'].filter(Boolean);
  }
  if (input.goal === 'give') {
    return [needsBudget && 'budget', needsTarget && 'target'].filter(Boolean);
  }
  return [needsTarget && 'target', needsBudget && 'budget'].filter(Boolean);
}

function roomForMonth(budgetCents, month, useSampleCommitments) {
  const committed = useSampleCommitments ? Object.values(memberships)
    .filter(circle => circle.remainingDueMonths.includes(month))
    .reduce((total, circle) => total + toCents(circle.contribution), 0) : 0;
  return Math.max(0, budgetCents - committed);
}

function payingMonths(start, months, breakStart = null) {
  const first = monthIndex(start);
  return Array.from({ length: months }, (_, i) => calendarMonth(first + i))
    .filter(month => !breakStart || monthIndex(month) < monthIndex(breakStart) ||
      monthIndex(month) >= monthIndex(breakStart) + 3);
}

function remainingAt(gap, net) {
  return gap === null ? null : dollars(Math.max(0, gap - toCents(net)));
}

export function advisorReport(input, { useSampleCommitments = false, now = new Date() } = {}) {
  const month = currentMonth(now);
  const first = monthIndex(month) + 1;
  const gap = input.target > 0 ? Math.max(0, toCents(input.target) - toCents(input.saved ?? 0)) : null;
  const capacity = hasIncome(input) && input.budget > 0 ? toCents(input.budget) : 0;
  const room = date => roomForMonth(capacity, date, useSampleCommitments);
  const result = { goal: input.goal, gap: gap === null ? null : dollars(gap), capacity: dollars(capacity),
    thisMonth: dollars(room(month)), matches: [], draft: null, savings: null, gift: null };

  if (gap === 0 || !capacity) return result;
  if (input.goal === 'give') {
    const gift = Math.min(gap ?? room(month), room(month));
    result.gift = { amount: dollars(gift), remaining: gap === null ? null : dollars(gap - gift) };
    return result;
  }

  if (gap !== null) {
    let accumulated = 0;
    // Check existing commitments month by month, then calculate the remaining time directly.
    let index = first;
    const obligations = useSampleCommitments
      ? Object.values(memberships).flatMap(circle => circle.remainingDueMonths).map(monthIndex) : [];
    const lastObligation = Math.max(first - 1, ...obligations);
    while (index <= lastObligation && accumulated < gap) {
      accumulated += room(calendarMonth(index));
      index++;
    }
    const months = index - first + Math.ceil(Math.max(0, gap - accumulated) / capacity);
    result.savings = { months, by: months <= 120 ? calendarMonth(first + months - 1) : null };
  }

  result.matches = Object.entries(discovery).flatMap(([id, circle]) => {
    if (circle.startMonth <= month) return [];
    const turn = circle.turnMonth;
    const schedule = payingMonths(circle.startMonth, circle.months, circle.breakStart);
    if (schedule.some(date => room(date) < toCents(circle.contribution))) return [];
    const split = payout(circle.kind, circle.members, circle.contribution);
    return [{ id, name: circle.name, contribution: circle.contribution, kind: circle.kind,
      payingCount: schedule.length, turn, turnLabel: circle.turn, ...split, remaining: remainingAt(gap, split.net),
      late: !!input.deadline && turn > input.deadline }];
  }).sort((a, b) => Number(a.late) - Number(b.late) || (a.remaining ?? 0) - (b.remaining ?? 0) ||
    a.contribution - b.contribution || a.turn.localeCompare(b.turn)).slice(0, 3);

  if (input.goal === 'group' && input.members >= 2 && input.members <= 7) {
    const schedule = payingMonths(calendarMonth(first), input.members);
    const maximum = Math.min(10000, ...schedule.map(room));
    if (maximum > 0) {
      const needed = gap === null ? maximum : Math.ceil(gap / (input.members * 0.9));
      const contribution = dollars(Math.min(maximum, needed));
      const split = payout('Standard', input.members, contribution);
      const by = schedule.at(-1);
      result.draft = { members: input.members, contribution, by, ...split, remaining: remainingAt(gap, split.net),
        late: !!input.deadline && by > input.deadline };
    }
  }
  return result;
}
