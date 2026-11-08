import { causes, cycleEnd, discovery, memberships, payout } from './data.js';
import { action, agreementLink, badge, delayNotice, icon, link, money, rows, safe } from './views.js';

const small = (text) => `<small class="muted">${text}</small>`;
const previewNote = small('This preview does not connect to PayPal or transfer money.');

export function dialogView(key, options) {
  const { id, path, draft, kind, preferences, donationAmount } = options;
  let title;
  let content;
  let graphic = 'dialog-shield';
  const wide = key === 'policy';

  switch (key) {
    case 'payment': {
      const c = memberships[id];
      const amount = money(c.contribution, true);
      const { net, held } = payout(c.kind, c.members, c.contribution);
      title = `Your next ${c.kind.toLowerCase()} contribution`;
      content = `${small(c.name + ' · due November 1, 2026')}
        ${rows([['Contribution', amount], ['Fee in this preview', '$0.00']])}<hr>
        ${rows([['Total to pay', amount]])}
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
      const cause = causes[id];
      title = 'Support ' + cause.name;
      graphic = 'giving-heart';
      content = `<p class="muted">Choose a little kindness today.</p>
        <div class="actions" aria-label="Donation amount">${[10, 25, 50].map(amount =>
          action(money(amount), 'choose-donation', amount === donationAmount ? 'primary' : 'secondary', '',
            `data-amount="${amount}" aria-pressed="${amount === donationAmount}"`)).join('')}</div>
        ${rows([['Your one-time donation', `<span id="donation-total" aria-live="polite">${money(donationAmount, true)}</span>`]])}
        <p class="muted">Your donation is separate from circle contributions. Giving does not change payout order.</p>
        ${action('Review donation in PayPal', 'checkout-donation', 'primary', 'full', `data-id="${id}"`)}
        ${small('Leaderboard sharing is optional. Your name stays private by default.')}`;
      break;
    }
    case 'checkout':
    case 'checkout-donation': {
      const donation = key === 'checkout-donation';
      const item = donation ? causes[id] : memberships[id];
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
    case 'assistant':
      title = 'A clearer starting point.';
      content = `${small('Sample request: “Six friends want to fund courses and tools.”')}
        <div class="notice sage stack"><strong>Standard circle · 6 months</strong>
          ${small('6 members × $40 each month. Each member receives $216 at their turn, with $24 held until completion.')}
          ${small('A Special alternative uses 3 members for 9 months, with a $0-due quarter for each recipient.')}
        </div>
        ${small('Sample AI response. Members confirm the final amounts, schedule, and agreement.')}
        ${action('Use Standard details', 'use-assistant', 'primary', 'full')}
        ${link('Explore Special format', '/create/special', 'secondary', 'full')}`;
      break;
    case 'policy':
      title = 'Delays, default, and your rights';
      content = `${small('Policy preview · timing decisions remain open')}
        <div class="notice amber stack"><strong>A payment is late</strong>${small('Grace-period duration and the review threshold are still to be finalized before agreements can be signed.')}</div>
        <div class="notice blue stack"><strong>A Special month has $0 due</strong>${small('A scheduled contribution break is exempt from late-payment review.')}</div>
        <div class="notice sage stack"><strong>Default is confirmed after payout</strong>${small('The recipient’s 10% holdback may be applied to documented losses in that circle and credited against the outstanding amount. Unpaid obligations remain.')}</div>
        <div class="notice subtle stack"><strong>Participation is prohibited</strong>${small('Confirmed abandonment after payout results in a permanent participation ban. Repayment, statements, support, and appeal remain accessible.')}</div>
        <small class="teal-text">Leaving after a fully completed and settled cycle has no penalty.</small>
        ${action('See a default settlement example', 'settlement', 'primary', 'full')}`;
      break;
    case 'settlement':
      title = 'Default settlement example';
      content = `${small('Illustrative amounts for a confirmed default after payout.')}
        ${rows([['Unpaid contributions', '$600'], ['Holdback applied', '−$70'], ['Remaining unpaid', '$530']])}
        ${small('The holdback offsets part of the loss and is credited once against the outstanding balance.')}
        ${action('Back to delay policy', 'policy', 'secondary', 'full')}`;
      break;
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
