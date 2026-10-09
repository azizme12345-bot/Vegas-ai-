const SYSTEM_INSTRUCTION =
  "صارف جس زبان میں لکھے اسی زبان میں جواب دیں۔ اردو میں جواب دیتے وقت صاف، قدرتی اور جدید اردو استعمال کریں، اور جہاں تکنیکی یا عام انگریزی اصطلاحات (جیسے Environment Variables وغیرہ) موزوں ہوں انہیں قدرتی طور پر شامل کریں۔ اہم نکات کو بولڈ عنوان کے ساتھ (جیسے: **تیز رفتار ماڈل فال بیک:** اگر کسی ایک ماڈل پر جواب نہ ملے...) صاف، سیدھے اور مختصر انداز میں لکھیں۔";

const MODELS_TO_TRY = [
  "gemini-3.1-flash-lite",
  "gemini-3-flash-preview",
  "gemini-2.5-flash",
  "gemini-flash-latest",
];

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

    const message = String(body.message || "").trim();

    if (!message) {
      return res.status(400).json({ error: "براہ کرم پیغام لکھیں۔" });
    }

    let reply = "";

    for (const modelName of MODELS_TO_TRY) {
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
              parts: [{ text: SYSTEM_INSTRUCTION }],
            },
            contents: [
              {
                role: "user",
                parts: [{ text: message }],
              },
            ],
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
