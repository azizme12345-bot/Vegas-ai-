import JSZip from "jszip";

const TEXT_MODELS = [
  "gemini-3.8-flash",
  "gemini-3.5-flash",
  "gemini-3-flash-preview",
  "gemini-3.1-flash-lite",
  "gemini-flash-latest",
];

const IMAGE_MODELS = [
  "gemini-3.1-flash-lite-image",
  "gemini-nano-banana-2.1",
  "gemini-2.5-flash-image",
];

function getDesignApiKey() {
  const designKey = process.env.DESIGN_API_KEY || "";
  const cleanDesign = String(designKey).trim().replace(/^["']|["']$/g, "");
  if (cleanDesign) return cleanDesign;

  const geminiKey =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.API_KEY ||
    process.env.VITE_GEMINI_API_KEY ||
    process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
    "";
  return String(geminiKey).trim().replace(/^["']|["']$/g, "");
}

function getCleanOpenAiKey() {
  const raw = process.env.OPENAI_API_KEY || "";
  const clean = String(raw).trim().replace(/^["']|["']$/g, "");
  return clean.startsWith("sk-") ? clean : "";
}

function escapeXml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function truncate(str, maxLen) {
  const s = String(str || "").trim();
  if (s.length <= maxLen) return s;
  return s.slice(0, Math.max(0, maxLen - 1)).trim() + "…";
}

function sanitizeHex(color, fallback) {
  const s = String(color || "").trim();
  if (/^#[0-9a-fA-F]{3,8}$/.test(s)) return s;
  return fallback;
}

/**
 * Renders a clean concept preview SVG showcasing the color palette swatches and short text summary.
 * No drawn templates or fake SVG mockups.
 */
export function renderUiConceptSvg(concept, index = 0) {
  const defaultPalettes = [
    { bg: "#F8FAFC", surface: "#FFFFFF", text: "#0F172A", muted: "#64748B", primary: "#2563EB", accent: "#3B82F6", border: "#E2E8F0" },
    { bg: "#090D16", surface: "#111827", text: "#F8FAFC", muted: "#94A3B8", primary: "#6366F1", accent: "#22D3EE", border: "#1E293B" },
    { bg: "#FAF7F2", surface: "#FFFFFF", text: "#1C1917", muted: "#78716C", primary: "#EA580C", accent: "#F59E0B", border: "#E7E5E4" },
  ];
  const defPal = defaultPalettes[index % defaultPalettes.length];
  const p = concept?.palette || {};
  const pal = {
    bg: sanitizeHex(p.bg, defPal.bg),
    surface: sanitizeHex(p.surface, defPal.surface),
    text: sanitizeHex(p.text, defPal.text),
    muted: sanitizeHex(p.muted, defPal.muted),
    primary: sanitizeHex(p.primary, defPal.primary),
    accent: sanitizeHex(p.accent, defPal.accent),
    border: sanitizeHex(p.border, defPal.border),
  };

  const title = escapeXml(truncate(concept?.title || "UI Design Concept", 42));
  const badge = escapeXml(truncate(concept?.styleBadge || "Design Concept", 22));
  const desc = escapeXml(truncate(concept?.description || "Color palette and visual theme summary for this concept.", 120));

  const width = 800;
  const height = 480;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
    <rect width="${width}" height="${height}" fill="${pal.bg}" rx="16" />
    <rect x="32" y="32" width="${width - 64}" height="${height - 64}" fill="${pal.surface}" stroke="${pal.border}" stroke-width="2" rx="16" />
    
    <!-- Title & Badge -->
    <text x="64" y="82" fill="${pal.text}" font-family="Inter, system-ui, sans-serif" font-size="22" font-weight="700">${title}</text>
    <rect x="${width - 210}" y="60" width="146" height="30" rx="15" fill="${pal.primary}" />
    <text x="${width - 137}" y="80" text-anchor="middle" fill="#FFFFFF" font-family="Inter, system-ui, sans-serif" font-size="12" font-weight="600">${badge}</text>
    
    <text x="64" y="118" fill="${pal.muted}" font-family="Inter, system-ui, sans-serif" font-size="14">${desc}</text>
    <line x1="64" y1="142" x2="${width - 64}" y2="142" stroke="${pal.border}" stroke-width="1" />

    <!-- Color Palette Swatches -->
    <text x="64" y="180" fill="${pal.text}" font-family="Inter, system-ui, sans-serif" font-size="15" font-weight="600">Color Palette &amp; Design Tokens</text>
    
    <g transform="translate(64, 200)">
      <!-- Swatch 1: Primary -->
      <rect x="0" y="0" width="112" height="85" rx="12" fill="${pal.primary}" />
      <text x="56" y="110" text-anchor="middle" fill="${pal.text}" font-family="Inter, sans-serif" font-size="12" font-weight="600">Primary</text>
      <text x="56" y="127" text-anchor="middle" fill="${pal.muted}" font-family="monospace" font-size="11">${pal.primary}</text>

      <!-- Swatch 2: Accent -->
      <rect x="135" y="0" width="112" height="85" rx="12" fill="${pal.accent}" />
      <text x="191" y="110" text-anchor="middle" fill="${pal.text}" font-family="Inter, sans-serif" font-size="12" font-weight="600">Accent</text>
      <text x="191" y="127" text-anchor="middle" fill="${pal.muted}" font-family="monospace" font-size="11">${pal.accent}</text>

      <!-- Swatch 3: Background -->
      <rect x="270" y="0" width="112" height="85" rx="12" fill="${pal.bg}" stroke="${pal.border}" stroke-width="2" />
      <text x="326" y="110" text-anchor="middle" fill="${pal.text}" font-family="Inter, sans-serif" font-size="12" font-weight="600">Background</text>
      <text x="326" y="127" text-anchor="middle" fill="${pal.muted}" font-family="monospace" font-size="11">${pal.bg}</text>

      <!-- Swatch 4: Surface -->
      <rect x="405" y="0" width="112" height="85" rx="12" fill="${pal.surface}" stroke="${pal.border}" stroke-width="2" />
      <text x="461" y="110" text-anchor="middle" fill="${pal.text}" font-family="Inter, sans-serif" font-size="12" font-weight="600">Surface</text>
      <text x="461" y="127" text-anchor="middle" fill="${pal.muted}" font-family="monospace" font-size="11">${pal.surface}</text>

      <!-- Swatch 5: Text Ink -->
      <rect x="540" y="0" width="112" height="85" rx="12" fill="${pal.text}" />
      <text x="596" y="110" text-anchor="middle" fill="${pal.text}" font-family="Inter, sans-serif" font-size="12" font-weight="600">Text Ink</text>
      <text x="596" y="127" text-anchor="middle" fill="${pal.muted}" font-family="monospace" font-size="11">${pal.text}</text>
    </g>

    <!-- Footer Banner -->
    <rect x="64" y="375" width="${width - 128}" height="42" rx="10" fill="${pal.bg}" stroke="${pal.border}" />
    <text x="${width / 2}" y="401" text-anchor="middle" fill="${pal.muted}" font-family="Inter, sans-serif" font-size="13">Select this concept to convert into complete interactive HTML, CSS &amp; JavaScript code.</text>
  </svg>`;

  const base64Svg = Buffer.from(svg, "utf-8").toString("base64");
  return `data:image/svg+xml;base64,${base64Svg}`;
}

async function callGeminiText(parts, systemInstruction, apiKey, wantJson = false, extraConfig = {}) {
  for (const modelName of TEXT_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(
        apiKey
      )}`;
      // Gemini 3.x Flash models support 65536 max output tokens
      const defaultMaxTokens = 65536;
      const genConfig = wantJson
        ? { responseMimeType: "application/json", temperature: 0.7, maxOutputTokens: defaultMaxTokens, ...extraConfig }
        : { temperature: 0.5, maxOutputTokens: defaultMaxTokens, ...extraConfig };
      const payload = {
        contents: [{ role: "user", parts }],
        generationConfig: genConfig,
      };
      if (systemInstruction) {
        payload.systemInstruction = { parts: [{ text: systemInstruction }] };
      }
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "aistudio-build",
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) continue;
      const data = await res.json();
      const text = (data?.candidates?.[0]?.content?.parts || [])
        .map((p) => (typeof p?.text === "string" ? p.text : ""))
        .join("")
        .trim();
      if (text) return { text, modelName };
    } catch (_e) {}
  }
  return null;
}

async function tryNativeImageModel(promptText, appType, referenceImage, apiKey) {
  const aspectRatio = appType === "mobile" ? "9:16" : "16:9";
  let quotaExceeded = false;

  for (const modelName of IMAGE_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(
        apiKey
      )}`;
      const parts = [];
      if (referenceImage && referenceImage.data) {
        const raw = String(referenceImage.data);
        const comma = raw.indexOf(",");
        const cleanData = (comma !== -1 ? raw.slice(comma + 1) : raw).replace(/\s/g, "");
        const cleanMime = String(referenceImage.mimeType || "image/png").split(";")[0].trim();
        parts.push({ inlineData: { data: cleanData, mimeType: cleanMime } });
      }
      parts.push({
        text: `High-resolution UI design screenshot for a ${appType} application: ${promptText}. Crisp typography, realistic buttons, modern interface layout, clean spacing.`,
      });

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "aistudio-build",
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts }],
          generationConfig: {
            imageConfig: { aspectRatio },
          },
        }),
      });

      if (res.status === 429) {
        quotaExceeded = true;
        continue;
      }
      if (!res.ok) continue;

      const data = await res.json();
      const respParts = data?.candidates?.[0]?.content?.parts || [];
      for (const p of respParts) {
        if (p?.inlineData?.data) {
          const mime = p.inlineData.mimeType || "image/png";
          return {
            imageUrl: `data:${mime};base64,${p.inlineData.data}`,
            provider: modelName,
            quotaExceeded: false,
          };
        }
      }
    } catch (_e) {}
  }

  const openAiKey = getCleanOpenAiKey();
  if (openAiKey) {
    try {
      const res = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openAiKey}`,
        },
        body: JSON.stringify({
          model: "dall-e-3",
          prompt: `Full-page high-resolution UI/UX design mockup screenshot of a ${appType} application: ${promptText}. Clean interface, modern typography, realistic buttons and components.`,
          n: 1,
          size: appType === "mobile" ? "1024x1792" : "1792x1024",
          response_format: "b64_json",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const b64 = data?.data?.[0]?.b64_json;
        if (b64) {
          return {
            imageUrl: `data:image/png;base64,${b64}`,
            provider: "dall-e-3",
            quotaExceeded: false,
          };
        }
      }
    } catch (_e) {}
  }

  return { imageUrl: null, provider: null, quotaExceeded };
}

function parseJsonSafe(rawText) {
  if (!rawText) return null;
  let cleaned = String(rawText)
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch (_e) {
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
      } catch (_e2) {}
    }
  }
  return null;
}

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

  const apiKey = getDesignApiKey();
  if (!apiKey) {
    return res.status(500).json({
      error: "Design key is missing. Add DESIGN_API_KEY in the hosting environment variables.",
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

    const action = String(body.action || "generate-designs").trim();

    // =========================================================================
    // ACTION 1: GENERATE 3 VISUALLY DIFFERENT UI DESIGN CONCEPTS
    // =========================================================================
    if (action === "generate-designs") {
      const prompt = String(body.prompt || "").trim();
      const appType = String(body.appType || "desktop").trim().toLowerCase();
      const referenceImage = body.referenceImage || null;
      const variationSeed = String(body.variationSeed || Date.now());

      if (!prompt && !referenceImage) {
        return res.status(400).json({
          error: "براہ کرم اپنے ڈیزائن کی تفصیل لکھیں یا ریفرنس تصویر اپ لوڈ کریں۔",
        });
      }

      const systemInstruction = `You are a Principal UI/UX Product Designer.
Generate 3 visually distinct, complete UI design concepts for the user's request (App Type: ${appType}, Seed: ${variationSeed}).
- Concept 1: Clean Modern Minimalist (Crisp light mode, airy spacing, high-contrast typography, refined SaaS/App controls)
- Concept 2: Sleek Dark Glassmorphism (Deep obsidian/slate dark theme, vibrant glowing accents, modern dark workspace)
- Concept 3: Editorial & Modular Bento Grid (Rich warm or bold brand palette, Bento card hierarchy, expressive layout)

IMPORTANT CONTENT & DESIGN QUALITY RULES:
- Provide realistic, specific content matching the brand and app type (NO lorem ipsum, NO generic placeholders like "Feature 1" or "Card 1").
- Follow an 8px grid spacing system and distinct typography scale.
- Use high-contrast color palettes (bg, surface, surfaceAlt, text, muted, primary, primaryText, accent, border, statusOk).
- Ensure 1 clear focal section per concept.

Return ONLY valid JSON with this exact structure:
{
  "concepts": [
    {
      "id": "concept-1",
      "title": "Short Concept Title",
      "styleBadge": "Minimalist Light",
      "description": "1-sentence visual summary of layout, colors, and interface components.",
      "appType": "${appType}",
      "imagePrompt": "Detailed visual prompt describing the full-page UI screenshot",
      "palette": {
        "bg": "#F8FAFC",
        "surface": "#FFFFFF",
        "surfaceAlt": "#F1F5F9",
        "text": "#0F172A",
        "muted": "#64748B",
        "primary": "#2563EB",
        "primaryText": "#FFFFFF",
        "accent": "#3B82F6",
        "border": "#E2E8F0",
        "statusOk": "#10B981"
      },
      "uiSpec": {
        "brandName": "Brand Name",
        "layoutStyle": "split-hero | bento-grid | sidebar-dashboard | dual-translator | chat-studio | mobile-app",
        "showSidebar": false,
        "showTopNav": true,
        "showHero": true,
        "showStats": true,
        "searchPlaceholder": "Search...",
        "navItems": ["Home", "Features", "Pricing", "Contact"],
        "ctaText": "Get Started",
        "heroBadge": "NEW RELEASE",
        "heroHeadline": "Main Headline Matching User Request",
        "heroSubtext": "Clear supporting subtitle for the interface",
        "primaryBtn": "Primary Action",
        "secondaryBtn": "Secondary Action",
        "stats": [
          { "label": "Metric 1", "value": "99.9%", "change": "+12%" },
          { "label": "Metric 2", "value": "24K", "change": "+8%" },
          { "label": "Metric 3", "value": "0.2s", "change": "Fast" }
        ],
        "sections": [
          { "title": "Component 1", "subtitle": "Description of UI card 1", "tag": "CORE", "metric": "Active" },
          { "title": "Component 2", "subtitle": "Description of UI card 2", "tag": "PRO", "metric": "Live" },
          { "title": "Component 3", "subtitle": "Description of UI card 3", "tag": "AI", "metric": "Fast" },
          { "title": "Component 4", "subtitle": "Description of UI card 4", "tag": "SYNC", "metric": "100%" }
        ]
      }
    }
  ]
}`;

      const parts = [];
      if (referenceImage && referenceImage.data) {
        const raw = String(referenceImage.data);
        const comma = raw.indexOf(",");
        const cleanData = (comma !== -1 ? raw.slice(comma + 1) : raw).replace(/\s/g, "");
        const cleanMime = String(referenceImage.mimeType || "image/png").split(";")[0].trim();
        parts.push({ inlineData: { data: cleanData, mimeType: cleanMime } });
      }
      parts.push({
        text: `User Design Request: ${prompt || "Create a modern UI design inspired by this reference image"}\nTarget Platform / App Type: ${appType}\nGenerate 3 visually distinct UI design concepts in JSON.`,
      });

      const aiResp = await callGeminiText(parts, systemInstruction, apiKey, true, { maxOutputTokens: 65536 });
      const parsed = parseJsonSafe(aiResp?.text);
      let rawConcepts = Array.isArray(parsed?.concepts) ? parsed.concepts.slice(0, 3) : [];

      if (rawConcepts.length < 3) {
        rawConcepts = [0, 1, 2].map((i) => ({
          id: `concept-${i + 1}-${Date.now()}`,
          title:
            i === 0
              ? "Modern Minimalist UI"
              : i === 1
              ? "Dark Glassmorphic UI"
              : "Editorial Bento UI",
          styleBadge: i === 0 ? "Minimal Light" : i === 1 ? "Dark Slate" : "Warm Bento",
          description: "Clean layout hierarchy with custom palette and responsive structure.",
          appType,
          palette:
            i === 0
              ? { bg: "#F8FAFC", surface: "#FFFFFF", text: "#0F172A", muted: "#64748B", primary: "#2563EB", accent: "#3B82F6", border: "#E2E8F0" }
              : i === 1
              ? { bg: "#090D16", surface: "#111827", text: "#F8FAFC", muted: "#94A3B8", primary: "#6366F1", accent: "#22D3EE", border: "#1E293B" }
              : { bg: "#FAF7F2", surface: "#FFFFFF", text: "#1C1917", muted: "#78716C", primary: "#EA580C", accent: "#F59E0B", border: "#E7E5E4" },
          uiSpec: {
            brandName: prompt ? prompt.slice(0, 18) : "Vegas AI",
            heroHeadline: prompt ? prompt.slice(0, 40) : "Next-Gen Web Interface",
            heroSubtext: "Designed with precision typography and responsive components.",
            primaryBtn: "Get Started",
            secondaryBtn: "Learn More",
          },
        }));
      }

      let usedNativeDiffusion = false;
      let quotaExceeded = false;
      let firstTry = { imageUrl: null, provider: null, quotaExceeded: false };

      if (rawConcepts[0]) {
        firstTry = await tryNativeImageModel(
          rawConcepts[0].imagePrompt || prompt,
          appType,
          referenceImage,
          apiKey
        );
        if (firstTry.imageUrl) {
          usedNativeDiffusion = true;
        } else if (firstTry.quotaExceeded) {
          quotaExceeded = true;
        }
      }

      const finalConcepts = await Promise.all(
        rawConcepts.map(async (c, idx) => {
          c.id = `design-${Date.now()}-${idx + 1}`;
          c.appType = appType;
          const svgMockupUrl = renderUiConceptSvg(c, idx);

          if (idx === 0 && firstTry.imageUrl) {
            return {
              ...c,
              imageUrl: firstTry.imageUrl,
              fallbackSvgUrl: svgMockupUrl,
              renderEngine: firstTry.provider,
            };
          }

          if (usedNativeDiffusion) {
            const nextTry = await tryNativeImageModel(
              c.imagePrompt || prompt,
              appType,
              referenceImage,
              apiKey
            );
            if (nextTry.imageUrl) {
              return {
                ...c,
                imageUrl: nextTry.imageUrl,
                fallbackSvgUrl: svgMockupUrl,
                renderEngine: nextTry.provider,
              };
            }
          }

          return {
            ...c,
            imageUrl: svgMockupUrl,
            fallbackSvgUrl: svgMockupUrl,
            renderEngine: "gemini-ui-architect-vector",
          };
        })
      );

      return res.status(200).json({
        concepts: finalConcepts,
        usedNativeDiffusion,
        modelNotice: usedNativeDiffusion
          ? `Rendered with ${firstTry.provider}`
          : "Rendered via Gemini 3.8 Flash UI Architect.",
      });
    }

    // =========================================================================
    // ACTION 2: CUSTOMIZE / REFINE A SELECTED DESIGN
    // =========================================================================
    if (action === "customize-design") {
      const instruction = String(body.instruction || "").trim();
      const selectedConcept = body.selectedConcept || {};
      const referenceImage = body.referenceImage || null;
      const history = Array.isArray(body.history) ? body.history : [];

      if (!instruction) {
        return res.status(400).json({ error: "براہ کرم تبدیلی کی ہدایت لکھیں۔" });
      }

      const appType = String(selectedConcept.appType || body.appType || "desktop").toLowerCase();

      const systemInstruction = `You are a Senior UI/UX Designer refining an existing UI design concept based on the user's customization request.
Modify the provided JSON design concept to follow the user's instructions:
- If colors are requested, update the "palette" hex codes accordingly.
- If elements are to be removed or simplified, adjust showSidebar/showStats/showHero or "sections".
- If features are added, reflect them in heroHeadline, primaryBtn, or sections.

Return ONLY valid JSON with:
{
  "reply": "Short explanation of design changes applied.",
  "concept": {
    "id": "revised-concept",
    "title": "Updated Concept Title",
    "styleBadge": "Updated Style Badge",
    "description": "Updated description",
    "appType": "${appType}",
    "palette": {
      "bg": "#...", "surface": "#...", "text": "#...", "muted": "#...", "primary": "#...", "primaryText": "#...", "accent": "#...", "border": "#..."
    },
    "uiSpec": { ... }
  }
}`;

      const parts = [];
      if (referenceImage && referenceImage.data) {
        const raw = String(referenceImage.data);
        const comma = raw.indexOf(",");
        const cleanData = (comma !== -1 ? raw.slice(comma + 1) : raw).replace(/\s/g, "");
        const cleanMime = String(referenceImage.mimeType || "image/png").split(";")[0].trim();
        parts.push({ inlineData: { data: cleanData, mimeType: cleanMime } });
      }

      const slimConcept = {
        title: selectedConcept.title,
        styleBadge: selectedConcept.styleBadge,
        description: selectedConcept.description,
        appType,
        palette: selectedConcept.palette,
        uiSpec: selectedConcept.uiSpec,
      };

      parts.push({
        text: `Current Selected Design JSON:\n${JSON.stringify(slimConcept, null, 2)}\n\nPrevious History:\n${
          history.length ? history.join("\n") : "None"
        }\n\nUser Customization Instruction:\n"${instruction}"\n\nReturn updated JSON.`,
      });

      const aiResp = await callGeminiText(parts, systemInstruction, apiKey, true, { maxOutputTokens: 65536 });
      const parsed = parseJsonSafe(aiResp?.text);
      const updatedConcept = parsed?.concept || {
        ...slimConcept,
        title: (slimConcept.title || "Design") + " (Revised)",
        description: instruction,
      };

      updatedConcept.id = `design-rev-${Date.now()}`;
      updatedConcept.appType = appType;

      const nativeTry = await tryNativeImageModel(
        updatedConcept.imagePrompt || `${slimConcept.title}: ${instruction}`,
        appType,
        referenceImage,
        apiKey
      );
      const svgMockupUrl = renderUiConceptSvg(updatedConcept, 0);
      updatedConcept.imageUrl = nativeTry.imageUrl || svgMockupUrl;
      updatedConcept.fallbackSvgUrl = svgMockupUrl;

      return res.status(200).json({
        concept: updatedConcept,
        reply:
          parsed?.reply ||
          "آپ کی ہدایات کے مطابق ڈیزائن کو اپ ڈیٹ کر دیا گیا ہے۔",
      });
    }

    // =========================================================================
    // ACTION 3: CONVERT SELECTED DESIGN TO COMPLETE HTML, CSS & JAVASCRIPT
    // =========================================================================
    if (action === "convert-to-html") {
      const selectedConcept = body.selectedConcept || {};
      const originalPrompt = String(body.originalPrompt || "").trim();
      const codeInstruction = String(body.codeInstruction || "").trim();
      const currentHtml = String(body.currentHtml || "").trim();
      const designImageBase64 = String(body.designImageBase64 || "").trim();

      const slimSpec = {
        title: selectedConcept.title,
        styleBadge: selectedConcept.styleBadge,
        description: selectedConcept.description,
        appType: selectedConcept.appType,
        palette: selectedConcept.palette,
        uiSpec: selectedConcept.uiSpec,
      };

      const systemInstruction = `You are a Principal Frontend Engineer and UI/UX Architect.
Convert the selected UI Design Concept into a COMPLETE, professional, premium-quality, single-file HTML5 application (with embedded modern CSS inside <style> and interactive JavaScript inside <script>).

CRITICAL CODE REQUIREMENTS:
1. Output ONLY the complete HTML code starting with <!DOCTYPE html> and ending with </html>. Do NOT wrap in markdown explanations or conversational text outside the code block.
2. CONTENT & DESIGN:
   - Use realistic, specific content tailored to the brand and app type (NO lorem ipsum, NO generic placeholders like "Feature 1" or "Card 1").
   - Follow a clear typography scale, consistent 8px grid spacing system, the exact color palette provided (${JSON.stringify(
     selectedConcept.palette || {}
   )}), excellent contrast, and visible hover/focus states for all interactive elements.
   - Layout MUST be fully responsive for mobile, tablet, and desktop screens.
   - Include 1 clear focal section (e.g. hero banner, interactive workspace, or core conversion feature).
3. FONTS & RTL:
   - Load Inter for English text and Noto Naskh Arabic for Urdu text from Google Fonts in <head>:
     <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Noto+Naskh+Arabic:wght@400;500;600;700&display=swap" rel="stylesheet">
   - Apply font-family with fallbacks (e.g. font-family: 'Inter', 'Noto Naskh Arabic', system-ui, -apple-system, sans-serif;).
   - Apply dir="rtl" on any section or element containing Urdu text.
4. INTERACTIVITY:
   - Include working, clean JavaScript in <script> for interactive functionality (e.g. tabs, modals, filters, search, or functional app features).`;

      const reviewSystemInstruction = `You are a Principal QA & Frontend Architect reviewing generated HTML code.
Verify against this strict quality checklist:
- Layout structure and positioning bugs or overlaps
- Missing or generic placeholder content
- Responsive design across screen sizes
- Working interactive buttons and handlers
- Proper Google Fonts (Inter & Noto Naskh Arabic) and dir="rtl" for Urdu
- Text overflow or color contrast issues

If any issues exist, fix them. Return ONLY the final corrected HTML code starting with <!DOCTYPE html> and ending with </html> without markdown commentary outside code blocks.`;

      const parts = [];
      if (
        designImageBase64 &&
        (designImageBase64.startsWith("data:image/png") ||
          designImageBase64.startsWith("data:image/jpeg"))
      ) {
        const comma = designImageBase64.indexOf(",");
        const cleanData = designImageBase64.slice(comma + 1).replace(/\s/g, "");
        const mime = designImageBase64.startsWith("data:image/jpeg")
          ? "image/jpeg"
          : "image/png";
        parts.push({ inlineData: { data: cleanData, mimeType: mime } });
      }

      if (currentHtml && codeInstruction) {
        parts.push({
          text: `Selected UI Design Specification:\n${JSON.stringify(
            slimSpec,
            null,
            2
          )}\n\nCurrent HTML Implementation:\n${currentHtml.slice(
            0,
            28000
          )}\n\nUser's Follow-up Modification Request:\n"${codeInstruction}"\n\nReturn the updated complete single-file HTML5 document.`,
        });
      } else {
        parts.push({
          text: `Original User Request: "${originalPrompt}"\nSelected UI Design Specification:\n${JSON.stringify(
            slimSpec,
            null,
            2
          )}\n${
            codeInstruction ? `\nAdditional Instructions: ${codeInstruction}` : ""
          }\n\nGenerate the complete, pixel-faithful, interactive single-file HTML5 + CSS3 + JS implementation.`,
        });
      }

      const aiResp = await callGeminiText(parts, systemInstruction, apiKey, false, { maxOutputTokens: 65536 });
      let rawCode = aiResp?.text || "";

      function extractHtmlCode(text) {
        if (!text) return "";
        let s = String(text).trim();
        const match = s.match(/```(?:html)?\s*([\s\S]*?)```/i);
        if (match && match[1]) {
          s = match[1].trim();
        }
        const docIdx = s.toLowerCase().indexOf("<!doctype html");
        const htmlIdx = s.toLowerCase().indexOf("<html");
        const startIdx = docIdx !== -1 ? docIdx : htmlIdx;
        if (startIdx !== -1) {
          s = s.slice(startIdx).trim();
        }
        return s;
      }

      function isCompleteHtml(code) {
        if (!code) return false;
        const lower = code.toLowerCase().trim();
        return (lower.startsWith("<!doctype html>") || lower.startsWith("<html")) && lower.endsWith("</html>");
      }

      let htmlCode = extractHtmlCode(rawCode);

      // Re-ask ONCE if incomplete
      if (!isCompleteHtml(htmlCode)) {
        const finishPrompt = `The previous HTML code output was incomplete or cut off before closing </html>.
Please provide the COMPLETE single-file HTML document starting with <!DOCTYPE html> and ending with </html> without truncation:

${htmlCode.slice(0, 12000)}`;

        const finishResp = await callGeminiText([{ text: finishPrompt }], systemInstruction, apiKey, false, { maxOutputTokens: 65536 });
        const finishedCode = extractHtmlCode(finishResp?.text || "");
        if (isCompleteHtml(finishedCode)) {
          htmlCode = finishedCode;
        } else if (htmlCode && finishedCode && !finishedCode.toLowerCase().startsWith("<!doctype html>")) {
          const stitched = htmlCode + "\n" + finishedCode;
          if (isCompleteHtml(stitched)) {
            htmlCode = stitched;
          }
        }
      }

      if (!isCompleteHtml(htmlCode)) {
        return res.status(500).json({ error: "Generated HTML was incomplete or cut off. Please try converting again." });
      }

      // Single Review Pass
      try {
        const reviewParts = [
          { text: `Review and fix any layout, content, responsiveness or font bugs in this HTML code:\n\n${htmlCode}` },
        ];
        const reviewResp = await callGeminiText(reviewParts, reviewSystemInstruction, apiKey, false, { maxOutputTokens: 65536 });
        if (reviewResp && reviewResp.text) {
          const reviewedCode = extractHtmlCode(reviewResp.text);
          if (isCompleteHtml(reviewedCode) && reviewedCode.length >= htmlCode.length * 0.7) {
            htmlCode = reviewedCode;
          }
        }
      } catch (_reviewErr) {}

      return res.status(200).json({
        html: htmlCode,
        reply: codeInstruction
          ? "آپ کی ہدایت کے مطابق HTML کوڈ اپ ڈیٹ کر دیا گیا ہے۔"
          : "منتخب کردہ ڈیزائن کے مطابق مکمل HTML، CSS اور JavaScript کوڈ تیار کر دیا گیا ہے۔",
      });
    }

    // =========================================================================
    // ACTION 4: BUNDLE ALL ASSETS INTO A ZIP
    // =========================================================================
    if (action === "bundle-zip") {
      const html = String(body.html || "").trim();
      if (!html) {
        return res.status(400).json({ error: "کوئی HTML کوڈ موجود نہیں ہے جسے زپ بنایا جا سکے۔" });
      }

      const result = await createAssetsZipBundle({
        html,
        selectedConcept: body.selectedConcept || {},
        designImageBase64: String(body.designImageBase64 || "").trim(),
        referenceImage: body.referenceImage || null,
        projectName: String(body.projectName || "").trim(),
      });

      return res.status(200).json({
        success: true,
        filename: result.filename,
        zipBase64: result.zipBase64,
        stats: result.stats,
      });
    }

    return res.status(400).json({ error: "Unknown UI Studio action." });
  } catch (err) {
    return res.status(500).json({
      error: (err && err.message) || "AI UI Design Studio میں خرابی پیش آئی۔ براہ کرم دوبارہ کوشش کریں۔",
    });
  }
}

export async function createAssetsZipBundle({
  html,
  selectedConcept,
  designImageBase64,
  referenceImage,
  projectName,
}) {
  const zip = new JSZip();
  const rawHtml = String(html || "").trim();
  const concept = selectedConcept || {};
  const palette = concept.palette || {
    bg: "#FAFAFA",
    primary: "#2563EB",
    primaryText: "#FFFFFF",
    text: "#0F172A",
    surface: "#FFFFFF",
    border: "#E2E8F0",
  };
  const title = String(projectName || concept.title || "UI Design Website").trim();
  const safeName =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "ui-project";

  let cssBlocks = [];
  let cleanedHtml = rawHtml.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (_, css) => {
    cssBlocks.push(css.trim());
    return "";
  });

  let combinedCss = cssBlocks.join("\n\n/* ===================================================== */\n\n");
  if (!combinedCss.trim()) {
    combinedCss = `/* Modern UI Stylesheet for ${title} */\n:root {\n  --primary: ${
      palette.primary || "#2563EB"
    };\n  --bg: ${palette.bg || "#FAFAFA"};\n  --text: ${
      palette.text || "#0F172A"
    };\n}\n* { box-sizing: border-box; }\nbody { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: var(--bg); color: var(--text); }`;
  }

  let jsBlocks = [];
  cleanedHtml = cleanedHtml.replace(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi, (_, js) => {
    jsBlocks.push(js.trim());
    return "";
  });
  let combinedJs = jsBlocks.join("\n\n// =====================================================\n\n");
  if (!combinedJs.trim()) {
    combinedJs = `// Interactive Scripts for ${title}\nconsole.log("${title} assets loaded successfully.");`;
  }

  const imgFolder = zip.folder("images");
  let assetIndex = 1;
  const imageRegex = /data:image\/(png|jpeg|jpg|webp|gif|svg\+xml);base64,([A-Za-z0-9+/=]+)/g;

  cleanedHtml = cleanedHtml.replace(imageRegex, (match, mime, b64) => {
    const ext = mime.includes("svg") ? "svg" : mime.includes("jpeg") ? "jpg" : mime;
    const filename = `asset_${assetIndex++}.${ext}`;
    try {
      imgFolder.file(filename, Buffer.from(b64, "base64"));
      return `images/${filename}`;
    } catch (_e) {
      return match;
    }
  });

  combinedCss = combinedCss.replace(imageRegex, (match, mime, b64) => {
    const ext = mime.includes("svg") ? "svg" : mime.includes("jpeg") ? "jpg" : mime;
    const filename = `asset_${assetIndex++}.${ext}`;
    try {
      imgFolder.file(filename, Buffer.from(b64, "base64"));
      return `../images/${filename}`;
    } catch (_e) {
      return match;
    }
  });

  // Include design image only if a real raster image exists (PNG/JPG data)
  let mockupImgData = designImageBase64 || concept.pngUrl || concept.imageUrl || "";
  if (mockupImgData && (mockupImgData.startsWith("data:image/png") || mockupImgData.startsWith("data:image/jpeg") || mockupImgData.startsWith("data:image/webp"))) {
    const comma = mockupImgData.indexOf(",");
    if (comma !== -1) {
      const b64 = mockupImgData.slice(comma + 1);
      const isPng = mockupImgData.startsWith("data:image/png");
      const ext = isPng ? "png" : "jpg";
      try {
        imgFolder.file(`ui-design-mockup.${ext}`, Buffer.from(b64, "base64"));
      } catch (_e) {}
    }
  }

  if (referenceImage && referenceImage.data) {
    try {
      const refB64 = String(referenceImage.data).replace(/^data:image\/[^;]+;base64,/, "");
      const refExt = String(referenceImage.mimeType || "").includes("png") ? "png" : "jpg";
      imgFolder.file(`reference-image.${refExt}`, Buffer.from(refB64, "base64"));
    } catch (_e) {}
  }

  const brandInitial = (title.charAt(0) || "V").toUpperCase();
  const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="16" fill="${palette.primary || "#2563EB"}"/>
  <text x="32" y="42" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" font-size="32" font-weight="700" fill="${
    palette.primaryText || "#FFFFFF"
  }" text-anchor="middle">${brandInitial}</text>
</svg>`;
  imgFolder.file("favicon.svg", faviconSvg);

  if (cleanedHtml.includes("</head>")) {
    cleanedHtml = cleanedHtml.replace(
      "</head>",
      `  <link rel="icon" type="image/svg+xml" href="images/favicon.svg">\n  <link rel="stylesheet" href="css/styles.css">\n</head>`
    );
  } else {
    cleanedHtml = `<link rel="stylesheet" href="css/styles.css">\n` + cleanedHtml;
  }

  if (cleanedHtml.includes("</body>")) {
    cleanedHtml = cleanedHtml.replace(
      "</body>",
      `  <script src="js/script.js" defer></script>\n</body>`
    );
  } else {
    cleanedHtml = cleanedHtml + `\n<script src="js/script.js" defer></script>`;
  }

  const designSpec = {
    title,
    appType: concept.appType || "desktop",
    styleBadge: concept.styleBadge || "Modern",
    description: concept.description || "",
    palette,
    uiSpec: concept.uiSpec || {},
    generatedAt: new Date().toISOString(),
    generator: "Vegas AI - AI UI Design Studio",
  };

  const readmeMd = `# ${title} — Web UI Assets Package

Generated with **Vegas AI — AI UI Design Studio**.

This package bundles the complete, modular production assets for the generated website design, with HTML, external CSS, JavaScript, design mockups, and referenced assets organized into dedicated folders.

---

## 📁 Package Structure

\`\`\`
├── index.html                 # Main website entry point (modular & linked)
├── standalone.html            # All-in-one single-file version (self-contained)
├── css/
│   └── styles.css             # Extracted stylesheet with responsive layouts
├── js/
│   └── script.js              # Extracted interactive JavaScript functionality
├── images/
│   ├── ui-design-mockup.png   # High-resolution Stage 1 UI visual design concept
│   ├── favicon.svg            # Branded vector app icon
│   └── asset_*.*              # Extracted graphic and media assets
├── design-spec.json           # Design tokens, color palette, and metadata
└── README.md                  # Project overview & running instructions
\`\`\`

---

## 🎨 Color Palette & Design Tokens

- **Primary Accent**: \`${palette.primary || "#2563EB"}\`
- **Primary Text**: \`${palette.primaryText || "#FFFFFF"}\`
- **Background**: \`${palette.bg || "#FAFAFA"}\`
- **Surface**: \`${palette.surface || "#FFFFFF"}\`
- **Text Ink**: \`${palette.text || "#0F172A"}\`
- **Subtle Muted**: \`${palette.muted || "#64748B"}\`
- **Border**: \`${palette.border || "#E2E8F0"}\`

---

## 🚀 How to Run

### Method 1: Instant Browser View (Zero Setup)
Simply double-click \`index.html\` (or \`standalone.html\`) to open it directly in any modern browser.

### Method 2: Local Web Server (Recommended)
Run a local static server:

\`\`\`bash
# Using npx serve
npx serve .

# Or using Python
python3 -m http.server 8000
\`\`\`
`;

  zip.file("index.html", cleanedHtml);
  zip.file("standalone.html", rawHtml);
  zip.folder("css").file("styles.css", combinedCss);
  zip.folder("js").file("script.js", combinedJs);
  zip.file("design-spec.json", JSON.stringify(designSpec, null, 2));
  zip.file("README.md", readmeMd);

  const zipBuffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });

  return {
    filename: `${safeName}-all-assets.zip`,
    zipBuffer,
    zipBase64: zipBuffer.toString("base64"),
    stats: {
      fileCount: Object.keys(zip.files).length,
      sizeBytes: zipBuffer.length,
    },
  };
}
