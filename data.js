export const memberships = {
  'local-makers': {
    name: 'Local Makers', kind: 'Standard', members: 6, months: 6, contribution: 40,
    turn: 'Dec 1, 2026', receiveDate: 'December 1', ends: 'Feb 28, 2027',
    period: 'Sep 2026–Feb 2027', remaining: '4 payments remain · ends Feb 28, 2027',
    due: 'Nov 1, Dec 1, Jan 1, and Feb 1',
    schedule: [
      ['Ana', 'Sep 1, 2026', 'Released'], ['Oak Studio · organization', 'Oct 1, 2026', 'Released'],
      ['Daniel', 'Nov 1, 2026', 'Next'], ['You · Maya', 'Dec 1, 2026', 'Your turn'],
      ['Nour', 'Jan 1, 2027', 'Scheduled'], ['Sam', 'Feb 1, 2027', 'Scheduled'],
    ],
  },
  'learning-together': {
    name: 'Learning Together', kind: 'Special', members: 3, months: 9, contribution: 20,
    turn: 'Feb 28, 2027', receiveDate: 'February 28', ends: 'May 31, 2027',
    period: 'Sep 2026–May 2027', remaining: '$0 due Dec–Feb · ends May 31, 2027',
    due: 'Nov 1, Mar 1, Apr 1, and May 1',
    schedule: [
      ['Sep–Nov 2026', 'Oak Studio · organization', 20, 'Nov 30'],
      ['Dec 2026–Feb 2027', 'You · Maya', 0, 'Feb 28'],
      ['Mar–May 2027', 'Nour', 20, 'May 31'],
    ],
  },
};

export const discovery = {
  neighborhood: { name: 'Neighborhood Builders', kind: 'Standard', members: 7, months: 7, contribution: 30, turn: 'May 1, 2027', goal: 'building community projects' },
  skills: { name: 'Skills Together', kind: 'Special', members: 3, months: 9, contribution: 40, turn: 'Jul 31, 2027', goal: 'learning education', breakMonths: 'May–Jul' },
  garden: { name: 'Community Garden', kind: 'Standard', members: 5, months: 5, contribution: 20, turn: 'Mar 1, 2027', goal: 'growing a neighborhood garden' },
};

export const causes = {
  pantry: { name: 'Community Pantry', group: 'Food & essentials', description: 'Help put fresh meals on family tables.', icon: 'food', raised: 3600, goal: 5000 },
  books: { name: 'Books for Every Child', group: 'Education', description: 'Give young readers a stronger start.', icon: 'book', raised: 2600, goal: 4000 },
};

export const gracePeriodDays = 7;

// An illustrative Standard circle with seven members and a $100 contribution.
const recoveryLoss = 600;
const recoveryHoldback = payout('Standard', 7, 100).held;
const recoveryDonated = 200;
export const recoveryExample = {
  name: 'Sample circle recovery fund',
  loss: recoveryLoss,
  holdback: recoveryHoldback,
  donated: recoveryDonated,
  repaymentDue: recoveryLoss - recoveryHoldback,
  stillNeeded: recoveryLoss - recoveryHoldback - recoveryDonated,
};

export function payout(kind, members, contribution) {
  const gross = Math.round(contribution * 100) * (kind === 'Special' ? 6 : members);
  const held = Math.round(gross / 10);
  return { gross: gross / 100, net: (gross - held) / 100, held: held / 100 };
}

export function cycleEnd(start, months) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return 'Choose a date';
  const [year, month] = start.split('-').map(Number);
  const end = new Date(Date.UTC(year, month + months - 1, 0));
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' }).format(end);
}
