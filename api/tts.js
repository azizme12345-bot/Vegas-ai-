export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
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

    const text = String(body.text || "").trim();
    if (!text) {
      return res.status(400).json({ error: "Text is required" });
    }

    let clean = text
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/`[^`]*`/g, " ")
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1")
      .replace(/[#*_~>|]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!clean) {
      return res.status(400).json({ error: "No speakable text" });
    }

    if (clean.length > 1200) {
      clean = clean.slice(0, 1200);
    }

    const isUrdu = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/.test(clean);
    const isHindi = /[\u0900-\u097F]/.test(clean);
    const tl = isUrdu ? "ur" : isHindi ? "hi" : "en";

    const rawSentences = clean.match(/[^.!?۔؟\n]+[.!?۔؟\n]*/g) || [clean];
    const chunks = [];
    let currentChunk = "";

    for (const s of rawSentences) {
      const trimmed = s.trim();
      if (!trimmed) continue;
      if ((currentChunk + " " + trimmed).trim().length <= 170) {
        currentChunk = (currentChunk + " " + trimmed).trim();
      } else {
        if (currentChunk) chunks.push(currentChunk);
        if (trimmed.length <= 170) {
          currentChunk = trimmed;
        } else {
          const subChunks = trimmed.match(/.{1,165}(\s|$)/g) || [trimmed];
          for (const sc of subChunks) {
            if (sc.trim()) chunks.push(sc.trim());
          }
          currentChunk = "";
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
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
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
        const dataUri = `data:audio/mpeg;base64,${combinedMp3.toString("base64")}`;
        return res.status(200).json({ audio: dataUri });
      }
    }

    return res.status(503).json({ error: "TTS audio generation failed" });
  } catch (_e) {
    return res.status(500).json({ error: "TTS service error" });
  }
}
