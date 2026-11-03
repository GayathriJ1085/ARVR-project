
import express from 'express';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(express.json({ limit: '20kb' }));

// Check API key
if (!process.env.GEMINI_API_KEY) {
  console.error('Missing GEMINI_API_KEY. Check your .env file.');
  process.exit(1);
}

// Initialize Gemini
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

// Supported languages
const LANGUAGES = [
  'English',
  'Malayalam',
  'Tamil',
  'Telugu',
  'Hindi',
  'Marathi',
];

// Gemini models
const PRIMARY_MODEL = 'gemini-3.1-flash-lite';
const FALLBACK_MODEL = 'gemini-2.5-flash';

// Message for questions outside the tutor's purpose
const OFF_TOPIC_MESSAGE =
  'I can only help with hand signs, gestures and sign language. Try asking how to sign a word, a letter, or what a hand gesture means.';

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'SignSteps AI Tutor',
  });
});

// Instructions for the AI tutor
function systemPrompt(language) {
  return [
    'You are the hand-sign tutor inside SignSteps AR.',
    'Only help with hand signs, hand gestures, fingerspelling and learning sign language.',
    'If the question is about anything else, reply with exactly: OFF_TOPIC',
    `Reply in ${language}. Keep it under 100 words.`,
    'Start with what the sign or gesture means, then give 3-5 short steps covering handshape, palm direction and movement.',
    'Plain text only. No # headings, no tables. Use "-" for bullet points.',
    'Do not compare sign languages or mention ISL or ASL unless the learner asks.',
    'If you are unsure of the exact form, say so in one short sentence.',
  ].join('\n');
}

// Detect temporary errors where trying another model may help
function isTemporaryModelError(error) {
  const status = Number(error?.status ?? error?.code);

  const message = String(
    error?.message || ''
  ).toLowerCase();

  return (
    status === 429 ||
    status === 500 ||
    status === 503 ||
    message.includes('unavailable') ||
    message.includes('high demand') ||
    message.includes('overloaded') ||
    message.includes('temporarily')
  );
}

// Request a streamed response from Gemini
async function openStream(model, language, question) {
  const config = {
    systemInstruction: systemPrompt(language),
    temperature: 0.2,
    maxOutputTokens: 300,
    thinkingConfig: {
      thinkingLevel: 'MINIMAL',
    },
  };

  return await ai.models.generateContentStream({
    model,
    contents: question,
    config,
  });
}

// AI tutor endpoint
app.post('/api/tutor', async (req, res) => {
  const { language, question } = req.body ?? {};

  // Validate language
  if (!LANGUAGES.includes(language)) {
    return res.status(400).json({
      error: 'Please select a supported response language.',
    });
  }

  // Validate question
  if (
    typeof question !== 'string' ||
    !question.trim() ||
    question.length > 1000
  ) {
    return res.status(400).json({
      error: 'Enter a question of up to 1000 characters.',
    });
  }

  const text = question.trim();

  let started = false;

  try {
    let stream;

    // Try the primary model first
    try {
      stream = await openStream(
        PRIMARY_MODEL,
        language,
        text
      );
    } catch (primaryError) {
      console.error('Primary Gemini model failed:', {
        status: primaryError?.status,
        message: primaryError?.message,
      });

      // Try fallback only for temporary errors
      if (!isTemporaryModelError(primaryError)) {
        throw primaryError;
      }

      console.log(
        `Trying fallback model: ${FALLBACK_MODEL}`
      );

      stream = await openStream(
        FALLBACK_MODEL,
        language,
        text
      );
    }

    // Streaming response headers
    res.setHeader(
      'Content-Type',
      'text/plain; charset=utf-8'
    );

    res.setHeader(
      'Cache-Control',
      'no-cache'
    );

    let buffer = '';
    let decided = false;

    // Read streamed response
    for await (const chunk of stream) {
      const piece = chunk.text || '';

      if (!decided) {
        buffer += piece;

        // Wait until we can identify an off-topic response
        if (buffer.trim().length < 9) {
          continue;
        }

        decided = true;

        if (
          buffer.trim().toUpperCase().startsWith('OFF_TOPIC')
        ) {
          res.setHeader('X-Off-Topic', '1');
          return res.end(OFF_TOPIC_MESSAGE);
        }

        started = true;
        res.write(buffer);
      } else {
        res.write(piece);
      }
    }

    // Handle an empty or very short response
    if (!decided) {
      if (
        buffer.trim().toUpperCase().startsWith('OFF_TOPIC')
      ) {
        res.setHeader('X-Off-Topic', '1');
        return res.end(OFF_TOPIC_MESSAGE);
      }

      return res.end(
        buffer.trim() ||
        'No answer came back. Please try again.'
      );
    }

    return res.end();

  } catch (error) {
    const status = Number(
      error?.status ?? error?.code
    );

    const message = String(
      error?.message || 'Unknown error'
    );

    // Log useful diagnostic information
    console.error('FULL GEMINI ERROR:', error);
console.error('ERROR MESSAGE:', error?.message);
console.error('ERROR STATUS:', error?.status);
console.error('ERROR DETAILS:', error?.details);

    // If streaming already started, close the response
    if (started) {
      return res.end();
    }

    let userMessage =
      'The tutor could not answer right now. Please try again shortly.';

    if (
      /api key|invalid.*key|unauthorized|permission/i.test(
        message
      )
    ) {
      userMessage =
        'The API key may be invalid or lack permission.';
    } else if (status === 400) {
      userMessage =
        'The AI request was rejected. Check the model and request configuration.';
    } else if (
      status === 429 ||
      /quota|rate limit/i.test(message)
    ) {
      userMessage =
        'The AI service rate limit or quota was reached. Check your Gemini API usage and try again later.';
    } else if (
      status === 503 ||
      /unavailable|high demand|overloaded/i.test(message)
    ) {
      userMessage =
        'The AI service is temporarily busy. Please try again shortly.';
    }

    return res.status(502).json({
      error: userMessage,
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(
    `SignSteps backend running at http://localhost:${PORT}`
  );
});
