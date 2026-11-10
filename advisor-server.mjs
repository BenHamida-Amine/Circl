import { advisorFacts, nextAdvisorQuestions } from './advisor.js';

export async function selectAdvisorQuestion(input, { key, model = 'gpt-5.6-terra', request = fetch }) {
  const facts = advisorFacts(input);
  const eligible = nextAdvisorQuestions(facts);
  if (eligible.length < 2) return { question: eligible[0] ?? null, source: 'guided' };
  const response = await request('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(10000),
    body: JSON.stringify({
      model, store: false, max_output_tokens: 300,
      ...(model === 'gpt-5.6-terra' ? { reasoning: { effort: 'none' } } : {}),
      instructions: [
        'Choose the next missing question that would most clarify this circle planning interview.',
        'budget asks what is safely available after essentials. target asks for the amount, progress, and optional month.',
        'members asks whether the user has a trusted group and how many members.',
        'Consider the selected goal and what is already known. Prioritize affordability when income varies.',
        'For creating, an unconfirmed group may be decisive. For a purchase, a known target can clarify timing.',
        'Only choose from the allowed questions. Do not recommend a transaction or calculate a budget.',
      ].join(' '),
      input: JSON.stringify({ facts, eligible }),
      text: { format: { type: 'json_schema', name: 'advisor_next_question', strict: true, schema: {
        type: 'object', properties: { question: { type: 'string', enum: eligible } },
        required: ['question'], additionalProperties: false,
      } } },
    }),
  });
  if (!response.ok) {
    const error = new Error('The model request failed.');
    error.status = response.status;
    throw error;
  }
  const payload = await response.json();
  const output = payload.output?.find(item => item.type === 'message')?.content
    ?.find(part => part.type === 'output_text')?.text;
  const question = output ? JSON.parse(output).question : null;
  if (payload.status !== 'completed' || !eligible.includes(question)) {
    throw new Error('The model returned an invalid question.');
  }
  return { question, source: 'openai' };
}
