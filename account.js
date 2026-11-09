import { supabaseUrl, supabasePublishableKey } from './account-config.js';
import { action, badge, link, safe } from './views.js';

export const demoAccounts = !supabaseUrl && !supabasePublishableKey;
const demoPassword = 'SampleCircle!42';
const sampleCode = '482615';
const demoSessionKey = 'circl:preview-account';
const kinds = { person: 'Person', organization: 'Organization' };
const sampleEmails = { person: 'maya@example.test', organization: 'studio@example.test' };
const socialHosts = ['linkedin.com', 'facebook.com', 'instagram.com', 'x.com', 'twitter.com', 'tiktok.com',
  'youtube.com', 'threads.net', 'threads.com', 'bsky.app'];

let clientPromise;
let pending;
let notice = '';

function client() {
  clientPromise ??= (async () => {
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(supabaseUrl) ||
        !supabasePublishableKey.startsWith('sb_publishable_')) {
      throw new Error('Account service is not configured correctly.');
    }
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0/+esm');
    return createClient(supabaseUrl, supabasePublishableKey, { auth: { detectSessionInUrl: false } });
  })();
  return clientPromise;
}

export function isAccountPath(path) {
  return /^\/account(?:\/(?:sign-in|sign-up)(?:\/(?:person|organization))?|\/confirm)?$/.test(path);
}

function demoProfile(kind) {
  return { id: 'preview-' + kind, kind, name: kind === 'person' ? 'Maya Adams' : 'Sample organization' };
}

function enterDemo(kind) {
  try {
    sessionStorage.setItem(demoSessionKey, kind);
  } catch {
    // A browser can block storage, so the current tab still works in memory.
  }
  return demoProfile(kind);
}

async function readProfile(supabase, user) {
  if (!user?.email_confirmed_at) throw new Error('Confirm your email before continuing.');
  const { data, error } = await supabase.from('circl_profiles')
    .select('account_type,display_name').eq('id', user.id).single();
  if (error || !Object.hasOwn(kinds, data?.account_type)) throw new Error('Could not load this account profile.');
  return { id: user.id, kind: data.account_type, name: data.display_name || 'Organization account' };
}

export async function restoreAccount(onSignOut) {
  if (demoAccounts) {
    try {
      const kind = sessionStorage.getItem(demoSessionKey);
      return Object.hasOwn(kinds, kind) ? demoProfile(kind) : null;
    } catch {
      return null;
    }
  }

  const supabase = await client();
  supabase.auth.onAuthStateChange(event => {
    if (event === 'SIGNED_OUT') onSignOut();
  });
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session) return null;
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  return readProfile(supabase, user);
}

export async function signOutAccount() {
  pending = undefined;
  notice = '';
  if (demoAccounts) {
    try { sessionStorage.removeItem(demoSessionKey); } catch { /* The in-memory session still ends. */ }
    return;
  }
  const supabase = await client();
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  if (error) throw error;
}

function accountPanel(kicker, title, copy, body) {
  const message = notice;
  notice = '';
  return `<section class="panel account-panel">
    <div class="row spread row-wrap"><p class="eyebrow">${kicker}</p>${demoAccounts ? badge('Sample accounts', 'blue') : ''}</div>
    <h1>${title}</h1>
    <p class="muted">${copy}</p>
    ${message ? `<div class="notice amber" role="status">${safe(message)}</div>` : ''}
    ${body}
  </section>`;
}

function accountForm(mode, kind) {
  const signingUp = mode === 'sign-up';
  const accountLabel = kinds[kind].toLowerCase();
  const article = kind === 'person' ? 'a' : 'an';
  const title = signingUp ? `Create ${article} ${accountLabel} account` : `Sign in as ${article} ${accountLabel}`;
  const profileFields = kind === 'person'
    ? `<label>Full name<input name="display_name" autocomplete="name" maxlength="100" required></label>
       <label>Username<input name="username" autocomplete="username" minlength="3" maxlength="24" required>
         <small class="muted">3–24 letters, numbers, or underscores. Usernames are case-insensitive.</small></label>`
    : `<label>Organization phone<input name="phone" type="tel" autocomplete="tel" placeholder="+1 202 555 0143" required>
         <small class="muted">Include the country code.</small></label>
       <label>Social profile link<input name="social_url" type="url" maxlength="500" autocomplete="url" placeholder="https://…" required>
         <small class="muted">For example, your organization’s LinkedIn or Instagram page.</small></label>`;
  return accountPanel(signingUp ? 'New to Circl' : 'Returning to Circl', title,
    signingUp ? 'We’ll ask you to confirm your email before entering Circl.' : 'Enter the email and password for this account.',
    `<form class="fields" id="account-form" data-mode="${mode}" data-kind="${kind}">
      ${signingUp ? profileFields : ''}
      <label>Email<input name="email" type="email" autocomplete="email" maxlength="254" required></label>
      <label>Password<input name="password" type="password" autocomplete="${signingUp ? 'new-password' : 'current-password'}" required>
        ${signingUp ? '<small class="muted">At least 12 characters. Include upper and lowercase letters, a number, and a symbol.</small>' : ''}
      </label>
      <p data-account-feedback class="small" role="status"></p>
      ${demoAccounts ? '<small class="muted">Use sample details here. The preview does not create a real account or send email.</small>' : ''}
      <div class="actions">
        <button class="btn primary" type="submit">${signingUp ? 'Continue to email confirmation' : 'Sign in'}</button>
        ${demoAccounts ? action('Fill sample details', 'account-fill') : ''}
      </div>
      ${!signingUp && !demoAccounts ? link('I have a confirmation code', '/account/confirm', 'ghost') : ''}
      ${link('Back to account types', '/account/' + mode, 'ghost')}
    </form>`);
}

export function accountView(path) {
  if (path === '/account/confirm') {
    if (demoAccounts && !pending) {
      return accountPanel('Email confirmation', 'Start a sample sign-up', 'The sample code appears after you complete the sign-up form.',
        link('Back to Circl entry', '/account', 'primary'));
    }
    return accountPanel('Email confirmation', 'Confirm your email', demoAccounts
      ? 'This sample inbox shows what the confirmation message will contain.'
      : 'Enter the confirmation code from the email sent to your inbox.',
    `${demoAccounts ? `<div class="notice sage stack"><strong>Sample inbox · ${safe(pending.email)}</strong><p>Confirmation code: <strong>${sampleCode}</strong></p><small>No email was sent.</small></div>` : ''}
      <form class="fields" id="account-form" data-mode="confirm">
        <label>Email<input name="email" type="email" maxlength="254" autocomplete="email" value="${safe(pending?.email ?? '')}" required></label>
        <label>Confirmation code<input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required></label>
        <p data-account-feedback class="small" role="status"></p>
        <button class="btn primary" type="submit">Confirm and enter Circl</button>
        ${demoAccounts ? '' : action('Send a new code', 'account-resend', 'secondary')}
        ${link('Back to Circl entry', '/account', 'ghost')}
      </form>`);
  }
  const [, , mode, kind] = path.split('/');
  if (kind) return accountForm(mode, kind);
  if (mode) {
    return accountPanel(mode === 'sign-up' ? 'New to Circl' : 'Returning to Circl', 'Choose your account type',
      'Continue as an individual or on behalf of an organization.',
      `<div class="actions">
        ${link('Person', path + '/person', 'primary')}
        ${link('Organization', path + '/organization')}
      </div>${link('Back to Circl entry', '/account', 'ghost')}`);
  }
  return accountPanel('Community savings and giving', 'Welcome to Circl', 'Choose how you’d like to continue.',
    `<div class="actions">
      ${link('I’m new to Circl', '/account/sign-up', 'primary')}
      ${link('I already have an account', '/account/sign-in')}
    </div>`);
}

export function fillSample(form) {
  const { kind, mode } = form.dataset;
  const sample = {
    email: mode === 'sign-up' ? sampleEmails[kind].replace('@', '+new@') : sampleEmails[kind],
    password: demoPassword, display_name: 'Maya Adams', username: 'maya_circle',
    phone: '+12025550143', social_url: 'https://www.linkedin.com/company/example-circle/',
  };
  for (const [name, value] of Object.entries(sample)) {
    const field = form.elements.namedItem(name);
    if (field) field.value = value;
  }
  form.querySelector('[data-account-feedback]').textContent = '';
}

function signupProfile(fields, kind) {
  const password = fields.get('password');
  if (password.length < 12 || new TextEncoder().encode(password).length > 72 ||
      !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password) || !/[^a-zA-Z0-9\s]/.test(password)) {
    throw new Error('Choose a password with at least 12 characters, upper and lowercase letters, a number, and a symbol. Use no more than 72 bytes.');
  }
  if (kind === 'person') {
    const display_name = fields.get('display_name').trim();
    const username = fields.get('username').trim().toLowerCase();
    if (!display_name || !/^[a-z0-9_]{3,24}$/.test(username)) throw new Error('Enter your name and a valid username.');
    return { account_type: kind, display_name, username };
  }

  const phone = fields.get('phone').replace(/[ ().-]/g, '');
  const social_url = fields.get('social_url').trim();
  let social;
  try { social = new URL(social_url); } catch { /* Handled below. */ }
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) throw new Error('Enter a valid international phone number with its country code.');
  if (!social || social.protocol !== 'https:' || social.port || social.username || social.password ||
      social.pathname === '/' || !socialHosts.some(host => social.hostname === host || social.hostname.endsWith('.' + host))) {
    throw new Error('Enter an HTTPS link to an organization profile on a social platform.');
  }
  return { account_type: kind, phone, social_url };
}

export async function submitAccount(form) {
  const fields = new FormData(form);
  const { mode, kind } = form.dataset;
  const email = fields.get('email').trim().toLowerCase();
  const password = fields.get('password');
  const profile = mode === 'sign-up' ? signupProfile(fields, kind) : null;
  const token = fields.get('code');

  if (demoAccounts) {
    if (mode === 'sign-up') {
      if (!email.endsWith('.test')) throw new Error('Use a sample .test email here, or choose Fill sample details.');
      pending = { email, kind };
      return { path: '/account/confirm' };
    }
    if (mode === 'confirm') {
      if (pending?.email !== email || token !== sampleCode) throw new Error('Enter the email and code shown in the sample inbox.');
      const account = enterDemo(pending.kind);
      pending = undefined;
      return { account };
    }
    if (email !== sampleEmails[kind] || password !== demoPassword) {
      throw new Error('Choose Fill sample details to sign in with the built-in preview account.');
    }
    pending = undefined;
    return { account: enterDemo(kind) };
  }

  const supabase = await client();
  if (mode === 'sign-up') {
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: profile } });
    if (error) throw new Error('Could not create the account. Check your details and try another username if you chose one.');
    if (data.session) {
      await supabase.auth.signOut({ scope: 'local' });
      throw new Error('Email confirmation must be enabled before creating Circl accounts.');
    }
    pending = { email };
    return { path: '/account/confirm' };
  }
  if (mode === 'confirm') {
    const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
    if (error) throw new Error('The confirmation code is invalid or expired. Check your email or request a new code.');
    const account = await readProfile(supabase, data.user);
    pending = undefined;
    return { account };
  }
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error?.code === 'email_not_confirmed') {
    pending = { email };
    notice = 'Confirm your email before signing in.';
    return { path: '/account/confirm' };
  }
  if (error) throw new Error('Could not sign in. Check your email and password.');
  const account = await readProfile(supabase, data.user);
  if (account.kind !== kind) {
    await supabase.auth.signOut({ scope: 'local' });
    throw new Error('This email is registered under the other account type. Go back and select that type.');
  }
  return { account };
}

export async function resendConfirmation(email) {
  const supabase = await client();
  const { error } = await supabase.auth.resend({ type: 'signup', email });
  if (error) throw new Error('Could not resend the code. Check the email address and try again in a moment.');
}
