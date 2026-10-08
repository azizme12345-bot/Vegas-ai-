import express from 'express';
import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';
import path from 'path';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '25mb' }));

  const geminiApiKey = process.env.GEMINI_API_KEY;
  const openaiApiKey = process.env.OPENAI_API_KEY;

  const geminiAi = geminiApiKey
    ? new GoogleGenAI({
        apiKey: geminiApiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      })
    : null;

  const isValidOpenAiKey = Boolean(openaiApiKey && openaiApiKey.trim().startsWith('sk-'));
  const openaiClient = isValidOpenAiKey ? new OpenAI({ apiKey: openaiApiKey!.trim() }) : null;

  // Cache models that hit 429 quota limits so we skip them immediately on future requests
  const exhaustedModels = new Map<string, number>();
  // In-memory TTS audio cache for instant 0ms playback
  const ttsAudioCache = new Map<string, string>();

  function isModelExhausted(modelId: string): boolean {
    const expiry = exhaustedModels.get(modelId);
    if (!expiry) return false;
    if (Date.now() > expiry) {
      exhaustedModels.delete(modelId);
      return false;
    }
    return true;
  }

  function markModelExhausted(modelId: string, durationMs = 15 * 60 * 1000) {
    exhaustedModels.set(modelId, Date.now() + durationMs);
  }

  const coreSystemPrompt =
    "You are Vegas AI, an intelligent, articulate, friendly, and thoughtful conversational companion.\n" +
    "GUIDELINES:\n" +
    "1. LANGUAGE: Respond strictly in the same language the user communicates in (Urdu if user writes in Urdu, English if English, Hindi if Hindi, etc.). Do not mix multiple languages or duplicate answers.\n" +
    "2. COMPREHENSIVE & CLEAR CONVERSATION: Provide detailed, well-explained, clear, and comprehensive conversation (لمبی، تفصیلی، اور واضح بات چیت). Explain things clearly and thoroughly with depth, helpful insights, and warm conversational tone.\n" +
    "3. NATURAL HUMAN STYLE: Speak naturally and warmly like a normal, engaging human conversation (عام بول چال اور گفتگو). Do NOT create tables, rigid boxes, cards, or artificial framing borders. Write in smooth, easy-to-read, standard prose.\n" +
    "4. VIDEO ANALYSIS (ویڈیو اینالائزر): When the user shares a video or video frames, thoroughly analyze the video: explain how it is made/filmed/edited, its style and structure, identify any flaws, technical issues, or visual problems inside it, and give clear, practical advice on how to fix and improve it.\n" +
    "5. IMAGE & PHOTO PROBLEM SOLVER (تصویر اینالائزر اور مسئلہ حل کرنے والا): When the user shares a photo/image, carefully inspect it. If there is any problem, error, defect, or question in the image, clearly diagnose what the issue is and provide practical, step-by-step suggestions to solve it.\n" +
    "6. HELPFUL & DIRECT: Answer the user's questions clearly, sensibly, and immediately.";

  // Helper for Gemini chat stream (Optimized for <1s Time-To-First-Token)
  async function streamGeminiChat(
    contents: any[],
    res: express.Response
  ): Promise<{ success: boolean; modelName: string }> {
    if (!geminiAi) return { success: false, modelName: '' };

    const modelsToTry = [
      { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite' },
      { id: 'gemini-3.1-flash-lite-preview', name: 'Gemini 3.1 Flash Lite Preview' },
      { id: 'gemini-flash-latest', name: 'Gemini Flash' },
      { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash' },
    ];

    for (const m of modelsToTry) {
      if (isModelExhausted(m.id)) continue;

      try {
        const responseStream = await geminiAi.models.generateContentStream({
          model: m.id,
          contents: contents,
          config: {
            systemInstruction: coreSystemPrompt,
            thinkingConfig: {
              thinkingBudget: 0,
            },
          },
        });

        for await (const chunk of responseStream) {
          if (chunk.text) {
            res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
            if (typeof (res as any).flush === 'function') {
              (res as any).flush();
            }
          }
        }

        return { success: true, modelName: m.name };
      } catch (err: any) {
        const msg = String(err?.message || err || '');
        console.error('Gemini model error for', m.id, ':', msg);
        if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota')) {
          markModelExhausted(m.id, 60 * 60 * 1000);
        }
      }
    }
    return { success: false, modelName: '' };
  }

  // Helper for OpenAI chat stream
  async function streamOpenAIChat(
    messages: any[],
    res: express.Response
  ): Promise<{ success: boolean; modelName: string }> {
    if (!openaiClient) return { success: false, modelName: '' };

    const openAiMsgs = messages.map((m: any) => {
      const parts: any[] = [];

      if (m.media && Array.isArray(m.media)) {
        for (const item of m.media) {
          if (item.data && item.mimeType && item.mimeType.startsWith('image/')) {
            parts.push({
              type: 'image_url',
              image_url: { url: `data:${item.mimeType};base64,${item.data}` },
            });
          }
        }
      }

      parts.push({ type: 'text', text: m.text || m.content || '' });

      return {
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: parts.length === 1 && parts[0].type === 'text' ? parts[0].text : parts,
      };
    });

    openAiMsgs.unshift({
      role: 'system',
      content: coreSystemPrompt,
    });

    const modelsToTry = [
      { id: 'gpt-4o-mini', name: 'OpenAI GPT-4o Mini' },
      { id: 'gpt-4o', name: 'OpenAI GPT-4o' },
    ];

    for (const m of modelsToTry) {
      if (isModelExhausted(m.id)) continue;

      try {
        const stream = await openaiClient.chat.completions.create({
          model: m.id,
          messages: openAiMsgs as any,
          stream: true,
        });

        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || '';
          if (content) {
            res.write(`data: ${JSON.stringify({ text: content })}\n\n`);
            if (typeof (res as any).flush === 'function') {
              (res as any).flush();
            }
          }
        }

        return { success: true, modelName: m.name };
      } catch (err: any) {
        const msg = String(err?.message || err || '');
        if (msg.includes('429') || msg.includes('quota') || msg.includes('401')) {
          markModelExhausted(m.id, 60 * 60 * 1000);
        }
      }
    }
    return { success: false, modelName: '' };
  }

  // /api/chat - Dual AI Streaming Route
  app.post('/api/chat', async (req, res) => {
    try {
      const { messages, providerPreference } = req.body;
      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Messages array is required' });
      }

      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      if (typeof (res as any).flushHeaders === 'function') {
        (res as any).flushHeaders();
      }

      const geminiContents = messages.map((m: any) => {
        const parts: any[] = [];
        if (m.media && Array.isArray(m.media)) {
          for (const item of m.media) {
            if (item.data && item.mimeType) {
              const cleanData = String(item.data).replace(/^data:[^;]+;base64,/, '');
              parts.push({
                inlineData: { data: cleanData, mimeType: item.mimeType },
              });
            }
          }
        }
        if (m.text || m.content) parts.push({ text: m.text || m.content });
        return {
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: parts.length > 0 ? parts : [{ text: '' }],
        };
      });

      let order: ('gemini' | 'openai')[] = ['gemini', 'openai'];
      if (providerPreference === 'openai') {
        order = ['openai', 'gemini'];
      }

      let handled = false;

      for (const provider of order) {
        if (provider === 'gemini' && geminiAi) {
          const result = await streamGeminiChat(geminiContents, res);
          if (result.success) {
            handled = true;
            break;
          }
        } else if (provider === 'openai' && openaiClient) {
          const result = await streamOpenAIChat(messages, res);
          if (result.success) {
            handled = true;
            break;
          }
        }
      }

      if (!handled) {
        res.write(
          `data: ${JSON.stringify({
            error: 'معذرت، اس وقت تمام AI ماڈلز کا کوٹہ ختم ہے یا مصروف ہیں۔ براہ کرم کچھ دیر بعد کوشش کریں۔',
          })}\n\n`
        );
      } else {
        res.write('data: [DONE]\n\n');
      }
      res.end();
    } catch (_err: any) {
      if (!res.headersSent) {
        res.status(500).json({ error: 'سرور میں غیر متوقع خرابی پیش آئی۔' });
      } else {
        res.write(
          `data: ${JSON.stringify({
            error: 'معذرت، رابطہ قائم نہیں ہو سکا۔',
          })}\n\n`
        );
        res.end();
      }
    }
  });

  // /api/transcribe - 1-Second Voice-to-Text Route (Gemini 3.1 Flash Lite + OpenAI Whisper)
  app.post('/api/transcribe', async (req, res) => {
    try {
      const { audio, mimeType } = req.body;
      if (!audio || typeof audio !== 'string') {
        return res.status(400).json({ error: 'Audio data is required' });
      }

      const cleanBase64 = audio.replace(/^data:[^;]+;base64,/, '');
      const cleanMime = mimeType || 'audio/webm';

      // 1. Primary: Ultra-fast Gemini 3.1 Flash Lite audio transcription (~1.2s)
      if (geminiAi) {
        const sttModels = ['gemini-3.1-flash-lite', 'gemini-3.1-flash-lite-preview', 'gemini-flash-latest'];
        for (const m of sttModels) {
          if (isModelExhausted(m)) continue;
          try {
            const response = await geminiAi.models.generateContent({
              model: m,
              contents: [
                {
                  role: 'user',
                  parts: [
                    {
                      inlineData: {
                        mimeType: cleanMime,
                        data: cleanBase64,
                      },
                    },
                    {
                      text:
                        'Transcribe the spoken words in this audio recording accurately. ' +
                        'IMPORTANT SCRIPT RULE: If the speech is in Urdu or Hindi, you MUST write it strictly in Urdu Arabic script (اردو رسم الخط، مثلاً: اوور تھنکنگ کیا ہے اور اس سے کیسے بچا جا سکتا ہے؟) and NEVER in Devanagari/Hindi script (देवनागरी ہرگز استعمال نہ کریں). ' +
                        'If the speech is in English, write it in English. ' +
                        'Output ONLY the transcribed text without any quotes, explanations, or commentary. ' +
                        'If there is only silence or background noise with no human speech, output [NO_SPEECH].',
                    },
                  ],
                },
              ],
              config: {
                thinkingConfig: { thinkingBudget: 0 },
              },
            });

            const transcript = (response.text || '').trim().replace(/^["'“”]+|["'“”]+$/g, '');
            if (transcript && !transcript.includes('[NO_SPEECH]')) {
              return res.json({ text: transcript });
            }
            return res.json({ text: '' });
          } catch (err: any) {
            const msg = String(err?.message || err || '');
            console.warn(`Gemini STT error on ${m}:`, msg);
            if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
              markModelExhausted(m, 30 * 60 * 1000);
            }
          }
        }
      }

      // 2. Fallback: OpenAI Whisper if valid OpenAI key is configured
      if (openaiClient) {
        try {
          const buffer = Buffer.from(cleanBase64, 'base64');
          const file = await OpenAI.toFile(buffer, 'voice.webm', { type: cleanMime });
          const transcription = await openaiClient.audio.transcriptions.create({
            file,
            model: 'whisper-1',
          });
          return res.json({ text: (transcription.text || '').trim() });
        } catch (err: any) {
          console.warn('OpenAI Whisper error:', err?.message || err);
        }
      }

      return res.status(503).json({ error: 'Voice transcription unavailable' });
    } catch (err: any) {
      return res.status(500).json({ error: 'Transcription error' });
    }
  });

  // /api/tts - Instant Natural Female Human-Like Voice Route (<350ms latency)
  app.post('/api/tts', async (req, res) => {
    try {
      const { text } = req.body;
      if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: 'Text is required' });
      }

      let clean = text
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/`[^`]*`/g, ' ')
        .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
        .replace(/[#*_~>|]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (!clean) {
        return res.status(400).json({ error: 'No speakable text' });
      }

      if (clean.length > 1200) {
        clean = clean.slice(0, 1200);
      }

      // Check in-memory cache first for 0ms instant response
      const cached = ttsAudioCache.get(clean);
      if (cached) {
        return res.json({ audio: cached });
      }

      // 1. OpenAI TTS "nova" (Natural Human Female Voice) if valid OpenAI key is configured
      if (openaiClient && !isModelExhausted('tts-1')) {
        try {
          const mp3Response = await openaiClient.audio.speech.create({
            model: 'tts-1',
            voice: 'nova',
            input: clean,
          });
          const arrayBuffer = await mp3Response.arrayBuffer();
          const dataUri = `data:audio/mpeg;base64,${Buffer.from(arrayBuffer).toString('base64')}`;
          if (ttsAudioCache.size > 100) ttsAudioCache.clear();
          ttsAudioCache.set(clean, dataUri);
          return res.json({ audio: dataUri });
        } catch (openAiTtsErr: any) {
          const msg = String(openAiTtsErr?.message || '');
          if (msg.includes('401') || msg.includes('429')) {
            markModelExhausted('tts-1', 60 * 60 * 1000);
          }
        }
      }

      // 2. Ultra-Fast Parallel Neural Female Voice (~250ms) for Urdu, Hindi, and English
      try {
        const isUrdu = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/.test(clean);
        const isHindi = /[\u0900-\u097F]/.test(clean);
        const tl = isUrdu ? 'ur' : isHindi ? 'hi' : 'en';

        // Split text cleanly into natural sentence chunks <= 170 chars
        const rawSentences = clean.match(/[^.!?۔؟\n]+[.!?۔؟\n]*/g) || [clean];
        const chunks: string[] = [];
        let currentChunk = '';

        for (const s of rawSentences) {
          const trimmed = s.trim();
          if (!trimmed) continue;
          if ((currentChunk + ' ' + trimmed).trim().length <= 170) {
            currentChunk = (currentChunk + ' ' + trimmed).trim();
          } else {
            if (currentChunk) chunks.push(currentChunk);
            if (trimmed.length <= 170) {
              currentChunk = trimmed;
            } else {
              const subChunks = trimmed.match(/.{1,165}(\s|$)/g) || [trimmed];
              for (const sc of subChunks) {
                if (sc.trim()) chunks.push(sc.trim());
              }
              currentChunk = '';
            }
          }
        }
        if (currentChunk) chunks.push(currentChunk);

        const buffers = await Promise.all(
          chunks.map(async (chunkText) => {
            const url =
              `https://translate.googleapis.com/translate_tts?ie=UTF-8&client=gtx&tl=${tl}&q=` +
              encodeURIComponent(chunkText);
            const r = await fetch(url, {
              headers: {
                'User-Agent':
                  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
              },
            });
            if (!r.ok) throw new Error(`Status ${r.status}`);
            const ab = await r.arrayBuffer();
            return Buffer.from(ab);
          })
        );

        if (buffers.length > 0) {
          const combinedMp3 = Buffer.concat(buffers);
          if (combinedMp3.length > 200) {
            const dataUri = `data:audio/mpeg;base64,${combinedMp3.toString('base64')}`;
            if (ttsAudioCache.size > 100) ttsAudioCache.clear();
            ttsAudioCache.set(clean, dataUri);
            return res.json({ audio: dataUri });
          }
        }
      } catch (fastTtsErr: any) {
        console.warn('Fast Neural TTS fallback error:', fastTtsErr?.message || fastTtsErr);
      }

      // 3. Fallback: Gemini TTS models with natural female voice "Kore"
      if (geminiAi) {
        const ttsModels = [
          'gemini-3.1-flash-tts-preview',
          'gemini-3.8-flash-tts',
          'gemini-3.8-flash-lite-tts',
        ];

        for (const ttsModel of ttsModels) {
          if (isModelExhausted(ttsModel)) continue;
          try {
            const ttsResponse = await geminiAi.models.generateContent({
              model: ttsModel,
              contents: [
                {
                  role: 'user',
                  parts: [
                    {
                      text: clean.slice(0, 400),
                    },
                  ],
                },
              ],
              config: {
                responseModalities: ['AUDIO'],
                speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: 'Kore' },
                  },
                },
              },
            });

            const base64Audio =
              ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
            const mimeType =
              ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.mimeType ||
              'audio/wav';

            if (base64Audio) {
              const dataUri = `data:${mimeType};base64,${base64Audio}`;
              if (ttsAudioCache.size > 100) ttsAudioCache.clear();
              ttsAudioCache.set(clean, dataUri);
              return res.json({ audio: dataUri });
            }
          } catch (geminiTtsErr: any) {
            const msg = String(geminiTtsErr?.message || geminiTtsErr || '');
            if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
              markModelExhausted(ttsModel, 60 * 60 * 1000);
            }
          }
        }
      }

      res.status(503).json({ error: 'TTS unavailable' });
    } catch (_err: any) {
      res.status(500).json({ error: 'TTS service error' });
    }
  });

  // /api/image - Dual Image Route
  app.post('/api/image', async (req, res) => {
    try {
      const { prompt, providerPreference } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: 'تصویر بنانے کا پیغام درکار ہے۔' });
      }

      let imageUrl = '';
      let usedModel = '';

      let order: ('gemini' | 'openai')[] = ['gemini', 'openai'];
      if (providerPreference === 'openai') {
        order = ['openai', 'gemini'];
      }

      for (const provider of order) {
        if (provider === 'gemini' && geminiAi && !isModelExhausted('gemini-3.1-flash-lite-image')) {
          try {
            const response = await geminiAi.models.generateContent({
              model: 'gemini-3.1-flash-lite-image',
              contents: { parts: [{ text: prompt }] },
              config: { imageConfig: { aspectRatio: '1:1' } },
            });
            if (response.candidates?.[0]?.content?.parts) {
              for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) {
                  imageUrl = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
                  usedModel = 'Gemini Flash Lite Image';
                  break;
                }
              }
            }
          } catch (e: any) {
            const msg = String(e?.message || e || '');
            if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
              markModelExhausted('gemini-3.1-flash-lite-image', 60 * 60 * 1000);
            }
          }
        }

        if (!imageUrl && provider === 'openai' && openaiClient && !isModelExhausted('dall-e-3')) {
          try {
            const imageRes = await openaiClient.images.generate({
              model: 'dall-e-3',
              prompt: prompt,
              n: 1,
              size: '1024x1024',
              response_format: 'b64_json',
            });
            const b64 = imageRes.data && imageRes.data[0] ? imageRes.data[0].b64_json : null;
            if (b64) {
              imageUrl = `data:image/png;base64,${b64}`;
              usedModel = 'OpenAI DALL-E 3';
            }
          } catch (e: any) {
            const msg = String(e?.message || e || '');
            if (msg.includes('429')) {
              markModelExhausted('dall-e-3', 30 * 60 * 1000);
            }
          }
        }

        if (imageUrl) break;
      }

      if (!imageUrl) {
        return res.status(500).json({
          error: 'معذرت، تصویر نہیں بنائی جا سکی۔ براہ کرم کچھ دیر بعد دوبارہ کوشش کریں۔',
        });
      }

      res.json({ imageUrl });
    } catch (_err: any) {
      res.status(500).json({
        error: 'معذرت، تصویر بنانے میں خرابی ہوئی ہے۔',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    app.use('*', async (req, res, next) => {
      try {
        const url = req.originalUrl;
        const indexPath = path.resolve(process.cwd(), 'index.html');
        let indexHtml = fs.readFileSync(indexPath, 'utf-8');
        let template = await vite.transformIndexHtml(url, indexHtml);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    app.use(express.static('dist'));
    app.use('*', (req, res) => {
      res.sendFile(path.resolve(process.cwd(), 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Vegas AI Server running on port ${PORT}`);
  });
}

startServer();
