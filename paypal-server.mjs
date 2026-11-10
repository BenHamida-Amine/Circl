import { randomUUID } from 'node:crypto';
import { discovery } from './data.js';

const sandbox = 'https://api-m.sandbox.paypal.com';
const paypalId = /^[a-z0-9-]{8,64}$/i;
const maxOrders = 100;

function checkoutError(status, message) {
  return Object.assign(new Error(message), { status });
}

export function createSandboxCheckout({ clientId, secret, request = fetch }) {
  const enabled = Boolean(clientId && secret);
  const orders = new Map();
  let token;
  let tokenRequest;

  async function accessToken() {
    if (token && token.expiresAt > Date.now()) return token.value;
    tokenRequest ??= (async () => {
      const credentials = Buffer.from(clientId + ':' + secret).toString('base64');
      const response = await request(sandbox + '/v1/oauth2/token', {
        method: 'POST',
        headers: { Authorization: 'Basic ' + credentials, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'grant_type=client_credentials',
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw checkoutError(502, 'PayPal Sandbox did not accept the app credentials.');
      const data = await response.json();
      if (typeof data.access_token !== 'string' || !data.access_token) {
        throw checkoutError(502, 'PayPal Sandbox did not return an access token.');
      }
      token = { value: data.access_token, expiresAt: Date.now() + Math.max(0, Number(data.expires_in) - 30) * 1000 };
      return token.value;
    })().finally(() => { tokenRequest = null; });
    return tokenRequest;
  }

  async function ordersRequest(path, options = {}) {
    const access = await accessToken();
    const response = await request(sandbox + '/v2/checkout/orders' + path, {
      ...options,
      headers: { Authorization: 'Bearer ' + access, Accept: 'application/json',
        'Content-Type': 'application/json', Prefer: 'return=representation', ...options.headers },
      signal: AbortSignal.timeout(10000),
    });
    return { ok: response.ok, data: await response.json().catch(() => ({})) };
  }

  async function createOrder(circleId) {
    if (!enabled) throw checkoutError(503, 'PayPal Sandbox is not configured.');
    if (typeof circleId !== 'string' || !Object.hasOwn(discovery, circleId)) {
      throw checkoutError(400, 'Choose a sample circle first.');
    }
    if (orders.size >= maxOrders) throw checkoutError(429, 'This local demo has reached its order limit.');
    const circle = discovery[circleId];
    const value = circle.contribution.toFixed(2);
    const { ok, data } = await ordersRequest('', {
      method: 'POST',
      headers: { 'PayPal-Request-Id': randomUUID() },
      body: JSON.stringify({ intent: 'CAPTURE', purchase_units: [{
        reference_id: circleId, description: 'Circl Sandbox contribution: ' + circle.name,
        amount: { currency_code: 'USD', value },
      }] }),
    });
    if (!ok || typeof data.id !== 'string' || !paypalId.test(data.id)) {
      throw checkoutError(502, 'PayPal Sandbox could not create the order.');
    }
    const token = randomUUID();
    orders.set(data.id, { circleId, name: circle.name, value, token, captureKey: randomUUID() });
    return { orderId: data.id, token };
  }

  async function verifyCapture(orderId, order) {
    const path = '/' + orderId;
    let result = order.pending ? await ordersRequest(path) : await ordersRequest(path + '/capture', {
      method: 'POST',
      headers: { 'PayPal-Request-Id': order.captureKey },
      body: '{}',
    });
    if (!result.ok && result.data.details?.some(detail => detail.issue === 'ORDER_ALREADY_CAPTURED')) {
      result = await ordersRequest(path);
    }
    if (!result.ok) throw checkoutError(502, 'PayPal Sandbox did not confirm the capture. Check the same order before starting another.');
    const { data } = result;
    const unit = data.purchase_units?.[0];
    const capture = unit?.payments?.captures?.[0];
    if (data.id !== orderId || data.purchase_units?.length !== 1 || unit?.reference_id !== order.circleId ||
        unit.payments?.captures?.length !== 1 || !capture ||
        capture.amount?.currency_code !== 'USD' || capture.amount?.value !== order.value) {
      throw checkoutError(502, 'PayPal’s response did not match this contribution.');
    }
    if (capture.status === 'PENDING') {
      order.pending = true;
      return { status: 'PENDING' };
    }
    if (data.status !== 'COMPLETED' || capture.status !== 'COMPLETED' || !paypalId.test(capture.id ?? '')) {
      throw checkoutError(409, 'PayPal has not completed this payment.');
    }
    order.receipt = {
      status: 'COMPLETED', orderId, captureId: capture.id,
      circle: order.name, amount: order.value, currency: 'USD',
    };
    return order.receipt;
  }

  async function captureOrder(orderId, token) {
    if (!enabled) throw checkoutError(503, 'PayPal Sandbox is not configured.');
    if (typeof orderId !== 'string' || !paypalId.test(orderId)) {
      throw checkoutError(400, 'Invalid PayPal order.');
    }
    const order = orders.get(orderId);
    if (!order || order.token !== token) throw checkoutError(404, 'This order does not belong to this checkout.');
    if (order.receipt) return order.receipt;
    order.captureRequest ??= verifyCapture(orderId, order).finally(() => { order.captureRequest = null; });
    return order.captureRequest;
  }

  return { enabled, clientId: enabled ? clientId : null, createOrder, captureOrder };
}
