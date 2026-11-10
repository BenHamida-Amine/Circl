import { causes, cycleEnd, discovery, gracePeriodDays, memberships, payout, recoveryExample } from './data.js';
import { action, agreementLink, badge, delayNotice, exitRule, icon, link, money, rows, safe, trustRule } from './views.js';

const small = (text) => `<small class="muted">${text}</small>`;
const previewNote = small('This preview does not connect to PayPal or transfer money.');

export function dialogView(key, options) {
  const { id, path, draft, kind, preferences, donationAmount } = options;
  let title;
  let content;
  let graphic = 'dialog-shield';
  const wide = key === 'policy' || key === 'settlement';

  switch (key) {
    case 'payment': {
      const c = memberships[id];
      const amount = money(c.contribution, true);
      const { net, held } = payout(c.kind, c.members, c.contribution);
      title = `Your next ${c.kind.toLowerCase()} contribution`;
      content = `${small(c.name + ' · due November 1, 2026')}
        ${rows([['Contribution', amount], ['Fee in this preview', '$0.00']])}<hr>
        ${rows([['Total to pay', amount]])}
        ${small(exitRule)}
        ${small(`After this payment: 3 × ${money(c.contribution)} remain. Your payout releases ${money(net)} and holds ${money(held)} until completion.`)}
        ${action('Continue to PayPal', 'checkout', 'primary', 'full', `data-id="${id}"`)}
        ${previewNote}`;
      break;
    }
    case 'membership': {
      const c = discovery[id];
      const special = c.kind === 'Special';
      const amount = money(c.contribution);
      const { gross, net, held } = payout(c.kind, c.members, c.contribution);
      title = 'Review ' + c.name;
      content = `${small(`${c.kind} circle · ${c.months} months`)}
        ${rows([
          ['Contribution', special ? `${amount} in 6 paying months` : `${amount} every month`],
          ['Gross scheduled payout', money(gross)], ['Receive at your turn', money(net)],
          ['Held until completion', money(held)], ['Your payout date', c.turn],
          ['Total contributions', `${special ? 6 : c.members} × ${amount} = ${money(gross)}`],
        ])}
        ${small(special ? `$0 due ${c.breakMonths} during your turn. Contributions continue during the other members’ turns.` : 'Continue contributing every month, including after receiving your payout.')}
        ${delayNotice}
        ${agreementLink('Preview agreement before joining', path, 'primary', 'full')}`;
      break;
    }
    case 'donation': {
      const recovery = id === 'recovery';
      const cause = recovery ? recoveryExample : causes[id];
      title = recovery ? 'Contribute to circle recovery' : 'Support ' + cause.name;
      graphic = 'giving-heart';
      content = `<p class="muted">${recovery ? `${money(recoveryExample.stillNeeded)} is still needed in this sample case.` : 'Choose a little kindness today.'}</p>
        <div class="actions" aria-label="Donation amount">${[10, 25, 50].map(amount =>
          action(money(amount), 'choose-donation', amount === donationAmount ? 'primary' : 'secondary', '',
            `data-amount="${amount}" aria-pressed="${amount === donationAmount}"`)).join('')}</div>
        ${rows([['Your one-time donation', `<span id="donation-total" aria-live="polite">${money(donationAmount, true)}</span>`]])}
        <p class="muted">${recovery ? 'Your donation helps affected members while repayment is pending. Once they are made whole through PayPal repayment, remaining funds go to another available charity or return to the original donors with thanks.' : 'Your donation is separate from circle contributions. Giving does not change payout order.'}</p>
        ${action('Review donation in PayPal', 'checkout-donation', 'primary', 'full', `data-id="${id}"`)}
        ${small('Leaderboard sharing is optional. Your name stays private by default.')}`;
      break;
    }
    case 'checkout':
    case 'checkout-donation': {
      const donation = key === 'checkout-donation';
      const item = donation ? (id === 'recovery' ? recoveryExample : causes[id]) : memberships[id];
      const amount = donation ? donationAmount : item.contribution;
      title = 'Continue with PayPal';
      graphic = 'payment-shield';
      content = `<p class="muted">${donation ? 'Donation to' : 'Contribution to'} ${item.name} · ${money(amount, true)}</p>
        ${badge('Design preview', 'blue')}
        <p class="muted">This screen shows where PayPal checkout will open. PayPal is not connected in this build.</p>
        ${link(donation ? 'Return to charity' : 'Return to overview', donation ? '/charity' : '/', 'primary', 'full')}`;
      break;
    }
    case 'review-draft': {
      const special = kind === 'Special';
      const months = special ? 9 : Number(draft.members);
      const { gross, net, held } = payout(kind, Number(draft.members), Number(draft.contribution));
      title = 'Review ' + draft.name;
      content = `${small(`${kind} · ${draft.members} members · scheduled end ${cycleEnd(draft.start, months)}`)}
        ${rows([['Contribution', `${money(Number(draft.contribution))} / paying month`], ['Duration', `${months} months`],
          ['Gross payout', money(gross)], ['Receive at your turn', money(net)], ['Completion holdback', money(held)]])}
        ${small('Every member accepts the fixed payout order and complete agreement before the circle starts.')}
        ${small(trustRule)}
        ${delayNotice}
        ${agreementLink('Prepare agreement preview', path, 'primary', 'full')}
        ${action('Save as draft', 'save-draft', 'secondary', 'full')}`;
      break;
    }
    case 'draft-saved':
      title = 'Draft saved';
      content = `<p class="muted">Your ${kind} draft is saved in this browser. You can edit it on the creation screen.</p>
        ${link('Return to overview', '/', 'primary', 'full')}`;
      break;
    case 'draft-unavailable':
      title = 'Draft could not be saved';
      content = '<p class="muted">Browser storage is unavailable. Your draft remains on this screen while this tab is open.</p>';
      break;
    case 'preferences':
      title = 'Match your real paying months.';
      content = `${small('This preview filters sample circles by available monthly budget and your search goal.')}
        <form class="fields" id="preferences-form">
          <label>Monthly budget<input name="budget" type="number" min="0" max="100000" step="1" required value="${preferences.budget}"></label>
          <label>Your goal<input name="goal" maxlength="100" placeholder="e.g. community garden" value="${safe(preferences.goal)}"></label>
          ${small(`Current peak commitments: $60. Available in those months: ${money(Math.max(0, preferences.budget - 60))}. Learning Together has $0 due in your Dec–Feb turn.`)}
          <small class="teal-text">The 10% completion holdback is unavailable to spend while held.</small>
          <button class="btn primary full" type="submit">Show matching circles</button>
        </form>`;
      break;
    case 'policy':
      title = 'Late payments, exits, and recovery';
      content = `${small('Circle agreement preview')}
        <div class="notice amber stack"><strong>${gracePeriodDays} days to pay</strong>${small(exitRule + ' The PayPal account holder is barred from joining Circl.')}</div>
        <div class="notice blue stack"><strong>A Special month has $0 due</strong>${small('A scheduled contribution break is exempt.')}</div>
        <div class="notice sage stack"><strong>Holdback and repayment</strong>${small('Any holdback from the exiting member’s payout is divided equally among the other circle members. The exiting member is asked to repay the remaining loss to affected members through PayPal.')}</div>
        <div class="notice subtle stack"><strong>Voluntary recovery donations</strong>${small('The charity recovery fund can help cover the gap while repayment is pending. Donations leave the debt in place.')}</div>
        <small class="teal-text">Leaving after a fully completed and settled cycle has no penalty.</small>
        ${action('See how repayment works', 'settlement', 'primary', 'full')}`;
      break;
    case 'settlement': {
      const example = recoveryExample;
      title = 'Circle recovery example';
      content = `${small('Sample: one of seven members exits after receiving a payout.')}
        ${rows([
          ['Total loss', money(example.loss)],
          ['Holdback split among the other six members', money(example.holdback)],
          ['Exiting member still owes', money(example.repaymentDue)],
          ['Recovery donations already applied', money(example.donated)],
          ['Loss still uncovered', money(example.stillNeeded)],
        ])}
        <div class="notice sage stack"><strong>When the exiting member repays in full</strong>
          ${small(`${money(example.stillNeeded)} covers the remaining loss in the affected members’ PayPal accounts. The other ${money(example.donated)} replenishes the amount already covered by donors, so each loss is covered once.`)}
          ${small('Remaining recovery funds go to another available charity. If none is available, they return to the original donors with a thank-you.')}</div>
        ${path === '/charity' ? action('Contribute to recovery', 'donation', 'primary', 'full', 'data-id="recovery"') : link('View recovery fund in Charity', '/charity', 'primary', 'full')}`;
      break;
    }
    case 'finish':
      title = 'Cycle closed';
      content = `<p class="muted">This example shows what leaving looks like after all contributions and settlement are complete.</p>
        ${link('Find another circle', '/explore', 'primary', 'full')}`;
      break;
    case 'renew':
      title = 'Review a new cycle';
      content = `<p class="muted">A new cycle requires fresh agreement from every member. The amount, dates and payout order must be confirmed again.</p>
        ${agreementLink('Review the new agreement preview', path, 'primary', 'full')}`;
      break;
    default:
      throw new Error('Unknown preview: ' + key);
  }

  return { wide, markup: `<div class="dialog-content">
    <div class="dialog-top">${icon(graphic)}${action('Close', 'close', 'ghost')}</div>
    <h2 id="dialog-title">${safe(title)}</h2>
    ${content}
  </div>` };
}
