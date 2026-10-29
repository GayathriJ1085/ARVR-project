import express from 'express';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();
const app = express();
const PORT = Number(process.env.PORT || 3000);
app.use(express.json({ limit: '20kb' }));

if (!process.env.GEMINI_API_KEY) {
  console.error('Missing GEMINI_API_KEY. Check your .env file.');
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const LANGUAGES = ['English', 'Malayalam', 'Tamil', 'Telugu', 'Hindi', 'Marathi'];
const PRIMARY_MODEL = 'gemini-3.8-flash';
const FALLBACK_MODEL = 'gemini-3.5-flash-lite';
const OFF_TOPIC_MESSAGE =
  'I can only help with hand signs, gestures and sign language. Try asking how to sign a word, a letter, or what a hand gesture means.';

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'SignSteps AI Tutor' });
});

// Short on purpose: a small prompt means a faster answer.
function systemPrompt(language) {
  return [
    'You are the hand-sign tutor inside SignSteps AR.',
    'Only help with hand signs, hand gestures, fingerspelling and learning sign language.',
    'If the question is about anything else, reply with exactly: OFF_TOPIC',
    `Reply in ${language}. Keep it under 150 words.`,
    'Start with what the sign or gesture means, then give 3-5 short steps covering handshape, palm direction and movement.',
    'Plain text only. No # headings, no tables. Use "-" for bullet points.',
    'Do not compare sign languages or mention ISL or ASL unless the learner asks.',
    'If you are unsure of the exact form, say so in one short sentence.',
  ].join('\n');
}

function isTemporaryModelError(error) {
  const status = Number(error?.status ?? error?.code);
  const message = String(error?.message || '').toLowerCase();
  return status === 503 || status === 429 || status === 500 ||
    message.includes('unavailable') || message.includes('high demand') ||
    message.includes('overloaded') || message.includes('temporarily');
}

const generate = (model, language, question) =>
  ai.models.generateContent({
    model,
    contents: question,
    config: { systemInstruction: systemPrompt(language), temperature: 0.2, maxOutputTokens: 450 },
  });

app.post('/api/tutor', async (req, res) => {
  const { language, question } = req.body ?? {};
  if (!LANGUAGES.includes(language)) {
    return res.status(400).json({ error: 'Please select a supported response language.' });
  }
  if (typeof question !== 'string' || !question.trim() || question.length > 1000) {
    return res.status(400).json({ error: 'Enter a question of up to 1000 characters.' });
  }

  const text = question.trim();
  try {
    let result;
    try {
      result = await generate(PRIMARY_MODEL, language, text);
    } catch (primaryError) {
      if (!isTemporaryModelError(primaryError)) throw primaryError;
      result = await generate(FALLBACK_MODEL, language, text);
    }
    const answer = (result.text || '').trim();
    if (!answer) return res.json({ answer: 'No answer came back. Please try again.' });
    if (answer.toUpperCase().startsWith('OFF_TOPIC')) {
      return res.json({ answer: OFF_TOPIC_MESSAGE, offTopic: true });
    }
    return res.json({ answer });
  } catch (error) {
    const status = Number(error?.status ?? error?.code);
    const message = String(error?.message || 'Unknown error');
    console.error('AI request failed:', { status, message });
    let userMessage = 'The tutor could not answer right now. Please try again shortly.';
    if (status === 400 || /api key|invalid.*key|unauthorized|permission/i.test(message)) {
      userMessage = 'The tutor could not start. Check that the API key in your .env file is valid.';
    } else if (status === 429 || /quota|rate limit/i.test(message)) {
      userMessage = 'Too many requests for now. Wait a little and try again.';
    } else if (status === 503 || /unavailable|high demand|overloaded/i.test(message)) {
      userMessage = 'The tutor is busy at the moment. Please try again in a minute.';
    }
    return res.status(502).json({ error: userMessage });
  }
});

app.listen(PORT, () => console.log(`SignSteps backend running at http://localhost:${PORT}`));
