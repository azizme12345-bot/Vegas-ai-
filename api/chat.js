const BASE_SYSTEM_INSTRUCTION =
  "صارف جس زبان میں لکھے اسی زبان میں جواب دیں۔ اردو میں جواب دیتے وقت صاف، قدرتی اور جدید اردو استعمال کریں، اور جہاں تکنیکی یا عام انگریزی اصطلاحات (جیسے Environment Variables وغیرہ) موزوں ہوں انہیں قدرتی طور پر شامل کریں۔ اہم نکات کو بولڈ عنوان کے ساتھ (جیسے: **تیز رفتار ماڈل فال بیک:** اگر کسی ایک ماڈل پر جواب نہ ملے...) صاف، سیدھے اور مختصر انداز میں لکھیں۔ آپ کوڈنگ (HTML/CSS/JS)، ریاضی، مضمون نویسی، ترجمہ، گرامر کی درستگی، خلاصہ نگاری، GitHub اور Vercel کے مسائل حل کرنے، اور دستاویزات و تصاویر کا تجزیہ کرنے میں ماہر ہیں۔ کبھی بھی اپنے ماڈل کا اندرونی نام ظاہر نہ کریں۔";

const MODELS_BY_MODE = {
  fast: [
    "gemini-3.1-flash-lite",
    "gemini-3-flash-preview",
    "gemini-2.5-flash",
    "gemini-flash-latest",
  ],
  balanced: [
    "gemini-3-flash-preview",
    "gemini-3.1-flash-lite",
    "gemini-2.5-flash",
    "gemini-flash-latest",
  ],
  deep: [
    "gemini-3-flash-preview",
    "gemini-2.5-flash",
    "gemini-3.1-flash-lite",
    "gemini-flash-latest",
  ],
};

function getCleanApiKey() {
  const raw =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.API_KEY ||
    process.env.VITE_GEMINI_API_KEY ||
    process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
    "";
  return String(raw).trim().replace(/^["']|["']$/g, "");
}

function isImageGenerationPrompt(text) {
  if (!text) return false;
  const lower = String(text).toLowerCase().trim();
  if (lower.startsWith("/image ")) return true;
  return /تصویر بنا|عکس بنا|تصویر کیجیے|تصویر بناؤ|تصویر بنائیں|پینٹنگ بنا|generate image|create image|generate an image|create an image|draw a |make an image|picture of |draw an image/i.test(
    lower
  );
}

async function extractUrlContext(text) {
  if (!text) return "";
  const urlMatches = String(text).match(/https?:\/\/[^\s)>\]"']+/gi);
  if (!urlMatches || !urlMatches.length) return "";

  const targetUrl = urlMatches[0];
  try {
    // 1. GitHub Repository URL Analysis
    const ghMatch = targetUrl.match(/github\.com\/([^\/]+)\/([^\/#?]+)/i);
    if (ghMatch) {
      const owner = ghMatch[1];
      const repo = ghMatch[2].replace(/\.git$/i, "");
      const [repoRes, readmeRes] = await Promise.all([
        fetch(`https://api.github.com/repos/${owner}/${repo}`, {
          headers: { "User-Agent": "Vegas-AI-Analyzer" },
        }).catch(() => null),
        fetch(`https://api.github.com/repos/${owner}/${repo}/readme`, {
          headers: {
            "User-Agent": "Vegas-AI-Analyzer",
            Accept: "application/vnd.github.v3.raw",
          },
        }).catch(() => null),
      ]);

      let info = `\n\n[GitHub Repository Context for ${owner}/${repo}]:\n`;
      if (repoRes && repoRes.ok) {
        const meta = await repoRes.json();
        info += `Description: ${meta.description || "N/A"}\nLanguage: ${
          meta.language || "N/A"
        }\nStars: ${meta.stargazers_count || 0} | Forks: ${
          meta.forks_count || 0
        } | Open Issues: ${meta.open_issues_count || 0}\n`;
      }
      if (readmeRes && readmeRes.ok) {
        const readmeText = await readmeRes.text();
        info += `README Content:\n${readmeText.slice(0, 6000)}\n`;
      }
      return info;
    }

    // 2. YouTube Video URL Analysis
    const ytMatch = targetUrl.match(
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/i
    );
    if (ytMatch) {
      const videoId = ytMatch[1];
      let ytInfo = `\n\n[YouTube Video Context (${targetUrl})]:\n`;
      const oembedRes = await fetch(
        `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
      ).catch(() => null);
      if (oembedRes && oembedRes.ok) {
        const oembed = await oembedRes.json();
        ytInfo += `Title: ${oembed.title || ""}\nChannel: ${
          oembed.author_name || ""
        }\n`;
      }
      const pageRes = await fetch(
        `https://www.youtube.com/watch?v=${videoId}`,
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
        }
      ).catch(() => null);
      if (pageRes && pageRes.ok) {
        const html = await pageRes.text();
        const descMatch = html.match(/"shortDescription":"((?:\\.|[^"\\])*)"/);
        if (descMatch && descMatch[1]) {
          try {
            const parsedDesc = JSON.parse(`"${descMatch[1]}"`);
            ytInfo += `Video Description / Details:\n${parsedDesc.slice(
              0,
              4000
            )}\n`;
          } catch (_e) {}
        }
      }
      return ytInfo;
    }

    // 3. General Website URL Content Analysis
    const webRes = await fetch(targetUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; VegasAI/1.0; +https://vercel.app)",
      },
    }).catch(() => null);
    if (webRes && webRes.ok) {
      const contentType = webRes.headers.get("content-type") || "";
      if (contentType.includes("text/html") || contentType.includes("text/plain")) {
        const rawHtml = await webRes.text();
        const titleMatch = rawHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        const pageTitle = titleMatch ? titleMatch[1].trim() : "";
        const cleanText = rawHtml
          .replace(/<script[\s\S]*?<\/script>/gi, " ")
          .replace(/<style[\s\S]*?<\/style>/gi, " ")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 6000);
        if (cleanText) {
          return `\n\n[Webpage Content from ${targetUrl}]:\nTitle: ${pageTitle}\nContent: ${cleanText}\n`;
        }
      }
    }
  } catch (_e) {}
  return "";
}

async function tryGenerateImage(promptText, apiKey) {
  const cleanPrompt = String(promptText)
    .replace(/^\/image\s+/i, "")
    .trim();

  // 1. Try Gemini native image model first
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-image:generateContent?key=${encodeURIComponent(
      apiKey
    )}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "aistudio-build",
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: cleanPrompt }] }],
      }),
    });
    if (response.ok) {
      const data = await response.json();
      const parts = data?.candidates?.[0]?.content?.parts || [];
      for (const p of parts) {
        if (p?.inlineData?.data) {
          const mime = p.inlineData.mimeType || "image/png";
          return {
            imageUrl: `data:${mime};base64,${p.inlineData.data}`,
            reply: "آپ کی فرمائش کے مطابق تصویر تیار کر دی گئی ہے:",
          };
        }
      }
    }
  } catch (_e) {}

  return null;
}

async function transcribeAudioWithGemini(audioBase64, mimeType, apiKey) {
  const rawAudio = String(audioBase64 || "");
  const commaIdx = rawAudio.indexOf(",");
  const cleanBase64 = (
    commaIdx !== -1 && rawAudio.startsWith("data:")
      ? rawAudio.slice(commaIdx + 1)
      : rawAudio
  ).replace(/\s/g, "");
  const cleanMime =
    String(mimeType || "audio/webm")
      .split(";")[0]
      .trim() || "audio/webm";

  if (!cleanBase64) {
    return { error: "کوئی آواز سنائی نہیں دی۔ براہ کرم دوبارہ بولنے کی کوشش کریں۔" };
  }

  const sttModels = [
    "gemini-2.5-flash",
    "gemini-3-flash-preview",
    "gemini-3.1-flash-lite",
    "gemini-flash-latest",
  ];

  const promptText =
    "Transcribe the spoken words in this audio recording accurately. " +
    "IMPORTANT: If the speech is in Urdu or Hindi, you MUST write it strictly in Urdu script (اردو رسم الخط، مثلاً: اسلام علیکم، آپ کیسے ہیں؟) and NEVER in Devanagari/Hindi script. " +
    "If the speech is in English, write it in English. " +
    "Output ONLY the transcribed text without any quotes, explanations, or commentary. " +
    "If there is only silence or background noise with no human speech, output [NO_SPEECH].";

  for (const modelName of sttModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(
        apiKey
      )}`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "aistudio-build",
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  inlineData: {
                    mimeType: cleanMime,
                    data: cleanBase64,
                  },
                },
                { text: promptText },
              ],
            },
          ],
        }),
      });

      if (!response.ok) continue;

      const data = await response.json();
      const parts = data?.candidates?.[0]?.content?.parts;
      if (Array.isArray(parts)) {
        const transcript = parts
          .map((p) => (typeof p?.text === "string" ? p.text : ""))
          .join("")
          .trim()
          .replace(/^["'“”]+|["'“”]+$/g, "");

        if (transcript.includes("[NO_SPEECH]")) {
          return { text: "" };
        }
        if (transcript) {
          return { text: transcript };
        }
      }
    } catch (_e) {}
  }

  return {
    error: "آواز شناخت کرنے میں خرابی پیش آئی۔ براہ کرم دوبارہ کوشش کریں۔",
  };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "صرف POST درخواست کی اجازت ہے۔" });
  }

  const apiKey = getCleanApiKey();

  if (!apiKey) {
    return res.status(500).json({
      error:
        "سرور پر GEMINI_API_KEY موجود نہیں ہے۔ براہ کرم Vercel کے Environment Variables میں GEMINI_API_KEY شامل کر کے Redeploy کریں۔",
    });
  }

  try {
    let body = req.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body || "{}");
      } catch (_e) {
        body = {};
      }
    } else if (!body || typeof body !== "object") {
      body = {};
    }

    // Handle Voice-to-Text Transcription request
    if (body.action === "transcribe" || (body.audio && !body.message && !body.messages)) {
      const sttResult = await transcribeAudioWithGemini(
        body.audio,
        body.mimeType,
        apiKey
      );
      if (sttResult.error) {
        return res.status(500).json({ error: sttResult.error });
      }
      return res.status(200).json({ text: sttResult.text || "", reply: sttResult.text || "" });
    }

    const singleMessage = String(body.message || "").trim();
    const rawMessages = Array.isArray(body.messages) ? body.messages : null;
    const customInstructions = String(body.customInstructions || "").trim();
    const responseLength = String(body.responseLength || "balanced").trim();
    const aiMode = String(body.aiMode || "fast").trim();

    if (!singleMessage && (!rawMessages || !rawMessages.length)) {
      return res.status(400).json({ error: "براہ کرم پیغام لکھیں۔" });
    }

    const latestUserText =
      singleMessage ||
      (rawMessages && rawMessages.length
        ? String(rawMessages[rawMessages.length - 1]?.text || "")
        : "");

    // Check if user requested image generation
    if (isImageGenerationPrompt(latestUserText)) {
      const imgResult = await tryGenerateImage(latestUserText, apiKey);
      if (imgResult && imgResult.imageUrl) {
        return res.status(200).json(imgResult);
      }
    }

    // Build system instruction with length and custom instructions
    let systemPrompt = BASE_SYSTEM_INSTRUCTION;
    if (responseLength === "short") {
      systemPrompt +=
        "\nطوالت کی ہدایت: جواب انتہائی مختصر، ٹو دی پوائنٹ اور جامع رکھیں (صرف ضروری نکات)۔";
    } else if (responseLength === "detailed") {
      systemPrompt +=
        "\nطوالت کی ہدایت: جواب مکمل تفصیل، مثالوں اور مرحلہ وار وضاحت (Step-by-step explanation) کے ساتھ دیں۔";
    }
    if (customInstructions) {
      systemPrompt += `\nصارف کی خصوصی ہدایات: ${customInstructions}`;
    }

    // Extract live URL / GitHub / YouTube context if present in the latest message
    const urlContext = await extractUrlContext(latestUserText);

    // Build multi-turn contents array for Gemini
    let contents = [];
    if (rawMessages && rawMessages.length) {
      const recent = rawMessages.slice(-16);
      contents = recent.map((m, idx) => {
        const parts = [];
        if (Array.isArray(m.media)) {
          for (const item of m.media) {
            if (item.textContent) {
              parts.push({
                text: `\n[Attached File: ${item.name || "document"}]\n${String(
                  item.textContent
                ).slice(0, 25000)}\n`,
              });
            } else if (item.data && item.mimeType) {
              const rawStr = String(item.data);
              const commaIdx = rawStr.indexOf(",");
              const cleanData = (
                commaIdx !== -1 && rawStr.startsWith("data:")
                  ? rawStr.slice(commaIdx + 1)
                  : rawStr
              ).replace(/\s/g, "");
              const cleanMime =
                String(item.mimeType).split(";")[0].trim() || "image/jpeg";
              parts.push({
                inlineData: { data: cleanData, mimeType: cleanMime },
              });
            }
          }
        }
        let msgText = String(m.text || m.content || "").trim();
        if (idx === recent.length - 1 && urlContext) {
          msgText += urlContext;
        }
        if (msgText || !parts.length) {
          parts.push({ text: msgText || "Analyze this attachment." });
        }
        return {
          role: m.role === "assistant" ? "model" : "user",
          parts,
        };
      });
    } else {
      contents = [
        {
          role: "user",
          parts: [{ text: singleMessage + urlContext }],
        },
      ];
    }

    const modelsToTry = MODELS_BY_MODE[aiMode] || MODELS_BY_MODE.fast;
    let reply = "";

    for (const modelName of modelsToTry) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(
          apiKey
        )}`;

        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "aistudio-build",
          },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: systemPrompt }],
            },
            contents,
          }),
        });

        if (!response.ok) {
          continue;
        }

        const data = await response.json();
        const parts = data?.candidates?.[0]?.content?.parts;
        if (Array.isArray(parts)) {
          const text = parts
            .map((p) => (typeof p?.text === "string" ? p.text : ""))
            .join("")
            .trim();
          if (text) {
            reply = text;
            break;
          }
        }
      } catch (_err) {
        // Try next model in fallback list
      }
    }

    if (!reply) {
      return res.status(500).json({
        error: "معذرت، اس وقت جواب حاصل نہیں ہو سکا۔ براہ کرم دوبارہ کوشش کریں۔",
      });
    }

    return res.status(200).json({ reply });
  } catch (_error) {
    return res.status(500).json({
      error: "معذرت، جواب حاصل کرنے میں خرابی پیش آئی۔ براہ کرم دوبارہ کوشش کریں۔",
    });
  }
}
