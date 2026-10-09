import { GoogleGenAI } from "@google/genai";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "صرف POST درخواست کی اجازت ہے۔" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "سرور پر API کلید موجود نہیں ہے۔" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const message = (body.message || "").trim();

    if (!message) {
      return res.status(400).json({ error: "براہ کرم پیغام لکھیں۔" });
    }

    const ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: message,
      config: {
        systemInstruction: "صارف جس زبان میں لکھے اسی زبان میں جواب دیں، جواب سیدھا، صاف اور مختصر ہو۔",
      },
    });

    const reply = (response.text || "").trim();
    if (!reply) {
      return res.status(500).json({ error: "معذرت، کوئی جواب موصول نہیں ہوا۔" });
    }

    return res.status(200).json({ reply });
  } catch (error) {
    return res.status(500).json({
      error: "معذرت، جواب حاصل کرنے میں خرابی پیش آئی۔ براہ کرم دوبارہ کوشش کریں۔",
    });
  }
}
