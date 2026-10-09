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
      error: "سرور پر GEMINI_API_KEY موجود نہیں ہے۔",
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

    const rawAudio = String(body.audio || "");
    const commaIdx = rawAudio.indexOf(",");
    const cleanBase64 = (
      commaIdx !== -1 && rawAudio.startsWith("data:")
        ? rawAudio.slice(commaIdx + 1)
        : rawAudio
    ).replace(/\s/g, "");
    const cleanMime =
      String(body.mimeType || "audio/webm")
        .split(";")[0]
        .trim() || "audio/webm";

    if (!cleanBase64) {
      return res.status(400).json({ error: "کوئی آواز سنائی نہیں دی۔" });
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
            return res.status(200).json({ text: "" });
          }
          if (transcript) {
            return res.status(200).json({ text: transcript, reply: transcript });
          }
        }
      } catch (_e) {}
    }

    return res.status(500).json({
      error: "آواز شناخت کرنے میں خرابی پیش آئی۔ براہ کرم دوبارہ کوشش کریں۔",
    });
  } catch (_err) {
    return res.status(500).json({
      error: "آواز شناخت کرنے میں خرابی پیش آئی۔",
    });
  }
}
