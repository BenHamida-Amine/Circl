import assert from 'node:assert/strict';
import test from 'node:test';
import { advisorFacts, advisorReport, nextAdvisorQuestions } from './advisor.js';
import { selectAdvisorQuestion } from './advisor-server.mjs';

const now = new Date('2026-11-10T12:00:00Z');
const report = facts => advisorReport(facts, { now, useSampleCommitments: true });

test('asks for only the missing details and avoids recurring commitments without income', () => {
  assert.deepEqual(nextAdvisorQuestions({}), ['income']);
  assert.deepEqual(nextAdvisorQuestions({ income: 'none', goal: 'group' }), ['target']);
  assert.deepEqual(nextAdvisorQuestions({ income: 'steady', goal: 'group' }), ['members', 'budget', 'target']);
  assert.deepEqual(nextAdvisorQuestions({ income: 'steady', goal: 'save', target: 100, saved: 100 }), []);
  const paused = report({ income: 'none', goal: 'group', budget: 100, members: 4, target: 200 });
  assert.deepEqual(paused.matches, []);
  assert.equal(paused.draft, null);
});

test('compares paying months, net payout, target deadline and independent saving', () => {
  const tight = report({ income: 'variable', goal: 'save', budget: 60, target: 250, saved: 60, deadline: '2027-02' });
  assert.equal(tight.gap, 190);
  assert.deepEqual(tight.matches.map(x => x.id), ['garden']);
  assert.equal(tight.matches[0].remaining, 100);
  assert.equal(tight.matches[0].held, 10);
  assert.equal(tight.matches[0].late, true);
  assert.deepEqual(tight.savings, { months: 7, by: '2027-06' });
  assert.ok(!report({ income: 'variable', goal: 'save', budget: 75, target: 210 }).matches.some(x => x.kind === 'Special'));
  const special = report({ income: 'steady', goal: 'save', budget: 80, target: 210 }).matches.find(x => x.kind === 'Special');
  assert.equal(special.payingCount, 6);
  assert.equal(special.net, 216);
  assert.equal(special.held, 24);
});

test('caps a new draft and a one-time gift to the available money', () => {
  const group = report({ income: 'steady', goal: 'group', budget: 90, members: 4, target: 200, deadline: '2027-02' }).draft;
  assert.equal(group.contribution, 50);
  assert.equal(group.remaining, 20);
  assert.equal(group.late, true);
  assert.deepEqual(report({ income: 'steady', goal: 'give', budget: 90, target: 100, saved: 40 }).gift,
    { amount: 30, remaining: 30 });
});

test('sends only recognized facts and rejects a question outside the allowed set', async () => {
  const input = { income: 'variable', goal: 'group', goalLabel: 'Do not send', email: 'ignored@example.test' };
  assert.deepEqual(advisorFacts({ ...input, budget: -3 }), { income: 'variable', goal: 'group', budget: null });
  const result = await selectAdvisorQuestion(input, { key: 'test', request: async (url, init) => {
    assert.equal(url, 'https://api.openai.com/v1/responses');
    assert.ok(!init.body.includes('Do not send'));
    assert.ok(!init.body.includes('ignored@example.test'));
    const body = JSON.parse(init.body);
    assert.equal(body.store, false);
    assert.deepEqual(body.text.format.schema.properties.question.enum, ['members', 'budget', 'target']);
    return modelResponse('budget');
  } });
  assert.deepEqual(result, { question: 'budget', source: 'openai' });
  await assert.rejects(selectAdvisorQuestion(input, { key: 'test', request: async () => modelResponse('income') }),
    /invalid question/);
});

function modelResponse(question) {
  return Response.json({ status: 'completed',
    output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ question }) }] }] });
}
