import assert from 'node:assert/strict';
import test from 'node:test';
import { createSandboxCheckout } from './paypal-server.mjs';

const orderId = 'TESTORDER00001';
const captureId = 'TESTCAPTURE001';

function fixture({ value = '20.00', currency = 'USD', pending = false } = {}) {
  const calls = [];
  const response = (status, orderStatus = 'COMPLETED') => ({
    id: orderId, status: orderStatus, purchase_units: [{ reference_id: 'garden', payments: {
      captures: [{ id: captureId, status, amount: { value, currency_code: currency } }],
    } }],
  });
  const checkout = createSandboxCheckout({ clientId: 'demo-client', secret: 'demo-secret', request: async (url, options) => {
    assert.equal(new URL(url).hostname, 'api-m.sandbox.paypal.com');
    calls.push({ url, options });
    if (url.endsWith('/oauth2/token')) return Response.json({ access_token: 'demo-access', expires_in: 3600 });
    assert.equal(options.headers.Authorization, 'Bearer demo-access');
    if (url.endsWith('/orders')) {
      assert.deepEqual(JSON.parse(options.body).purchase_units[0].amount, { currency_code: 'USD', value: '20.00' });
      return Response.json({ id: orderId }, { status: 201 });
    }
    if (url.endsWith('/capture')) {
      assert.ok(options.headers['PayPal-Request-Id']);
      return Response.json(response(pending ? 'PENDING' : 'COMPLETED'));
    }
    assert.equal(url.endsWith('/' + orderId), true);
    return Response.json(response('COMPLETED'));
  } });
  return { checkout, calls };
}

test('creates a Sandbox order using Circl’s amount and records just one verified capture', async () => {
  const { checkout, calls } = fixture();
  await assert.rejects(checkout.createOrder('unlisted'), { status: 400 });
  const order = await checkout.createOrder('garden');
  await assert.rejects(checkout.captureOrder(order.orderId, 'wrong-token'), { status: 404 });
  const [first, second] = await Promise.all([
    checkout.captureOrder(order.orderId, order.token),
    checkout.captureOrder(order.orderId, order.token),
  ]);
  assert.deepEqual(first, {
    status: 'COMPLETED', orderId, captureId, circle: 'Community Garden', amount: '20.00', currency: 'USD',
  });
  assert.deepEqual(first, second);
  assert.deepEqual(await checkout.captureOrder(order.orderId, order.token), first);
  assert.equal(calls.filter(call => call.url.endsWith('/capture')).length, 1);
});

test('rejects a mismatched amount or currency', async () => {
  for (const options of [{ value: '19.99' }, { currency: 'EUR' }]) {
    const { checkout } = fixture(options);
    const order = await checkout.createOrder('garden');
    await assert.rejects(checkout.captureOrder(order.orderId, order.token), { status: 502 });
  }
});

test('checks a pending payment without capturing it a second time', async () => {
  const { checkout, calls } = fixture({ pending: true });
  const order = await checkout.createOrder('garden');
  assert.deepEqual(await checkout.captureOrder(order.orderId, order.token), { status: 'PENDING' });
  assert.equal((await checkout.captureOrder(order.orderId, order.token)).status, 'COMPLETED');
  assert.equal(calls.filter(call => call.url.endsWith('/capture')).length, 1);
  assert.ok(calls.some(call => call.url.endsWith('/' + orderId) && !call.options.method));
});
