let settingsRequest;
let sdkInstanceRequest;

export function sandboxSettings() {
  if (!['http:', 'https:'].includes(location.protocol)) return Promise.resolve(null);
  settingsRequest ??= fetch('./api/paypal', { signal: AbortSignal.timeout(4000) })
    .then(response => response.ok && response.headers.get('content-type')?.includes('application/json') ? response.json() : null)
    .then(data => data?.enabled && typeof data.clientId === 'string' && data.clientId ? data : null)
    .catch(() => null);
  return settingsRequest;
}

async function paypalRequest(route, body) {
  const response = await fetch('./api/paypal/' + route, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body), signal: AbortSignal.timeout(25000),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'PayPal Sandbox is unavailable.');
  return data;
}

function paypalInstance(clientId) {
  sdkInstanceRequest ??= (async () => {
    if (!window.paypal?.createInstance) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        const timeout = setTimeout(() => script.onerror(), 10000);
        script.src = 'https://www.sandbox.paypal.com/web-sdk/v6/core';
        script.onload = () => { clearTimeout(timeout); resolve(); };
        script.onerror = () => {
          clearTimeout(timeout);
          script.remove();
          reject(new Error('The PayPal Sandbox button could not load.'));
        };
        document.head.append(script);
      });
    }
    return window.paypal.createInstance({ clientId, components: ['paypal-payments'] });
  })().catch(error => { sdkInstanceRequest = null; throw error; });
  return sdkInstanceRequest;
}

export async function mountSandboxCheckout(container, state, circleId) {
  const status = container.querySelector('[data-paypal-status]');
  const controls = container.querySelector('[data-paypal-controls]');
  const visible = () => container.isConnected && container.closest('dialog')?.open;
  function say(message) {
    if (visible()) status.textContent = message;
  }

  function showReceipt(receipt) {
    if (!visible()) return;
    controls.replaceChildren();
    say(`PayPal Sandbox confirmed USD ${receipt.amount} for ${receipt.circle}. Capture ID: ${receipt.captureId}.`);
  }

  function offerVerification() {
    if (!visible()) return;
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'btn secondary full';
    retry.textContent = 'Check the same payment';
    retry.addEventListener('click', verifyPayment);
    controls.replaceChildren(retry);
  }

  async function verifyPayment() {
    if (state.capturing) return;
    state.capturing = true;
    say('Checking the contribution with PayPal Sandbox…');
    try {
      const result = await paypalRequest('capture', state.order);
      if (result.status === 'COMPLETED') {
        state.receipt = result;
        showReceipt(result);
      } else {
        say('PayPal reports this payment is pending. Check the same payment again shortly.');
        offerVerification();
      }
    } catch (error) {
      say(error.message || 'PayPal has not confirmed this payment.');
      offerVerification();
    } finally {
      state.capturing = false;
    }
    return state.receipt;
  }

  if (state.receipt) return showReceipt(state.receipt);
  if (state.approved) {
    say('This order was approved. Check with PayPal to confirm the contribution.');
    return offerVerification();
  }

  try {
    const config = await sandboxSettings();
    if (!config) return say('Connect a PayPal Sandbox app to run this checkout locally.');
    const instance = await paypalInstance(config.clientId);
    if (!visible()) return;
    const eligibility = await instance.findEligibleMethods();
    if (!eligibility.isEligible('paypal')) return say('PayPal Sandbox checkout is unavailable in this browser.');
    const session = await instance.createPayPalOneTimePaymentSession({
      onApprove({ orderId }) {
        state.starting = false;
        if (state.order?.orderId !== orderId) return say('PayPal returned a different order.');
        state.approved = true;
        if (visible()) return verifyPayment();
      },
      onCancel() {
        state.starting = false;
        if (!state.approved) say('You cancelled the Sandbox checkout.');
      },
      onError() {
        state.starting = false;
        if (!state.approved) say('PayPal Sandbox could not complete checkout.');
      },
    });
    if (!visible()) return;
    const button = document.createElement('paypal-button');
    button.addEventListener('click', async () => {
      if (state.starting || state.approved) return;
      state.starting = true;
      say('Opening PayPal Sandbox…');
      try {
        const order = paypalRequest('order', { circleId }).then(result => {
          state.order = result;
          return { orderId: result.orderId };
        });
        await session.start({ presentationMode: 'auto' }, order);
      } catch {
        state.starting = false;
        if (!state.approved) say('Checkout did not finish. Try opening PayPal Sandbox again.');
      }
    });
    controls.replaceChildren(button);
    say('Continue with your personal PayPal Sandbox test account.');
  } catch {
    say('The PayPal Sandbox button could not load.');
  }
}
