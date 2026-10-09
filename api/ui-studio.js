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
 * Generates a high-resolution, realistic UI screenshot SVG data URL from a structured UI concept.
 * Supports desktop websites, mobile apps, dashboards, translators, and AI chat apps.
 */
export function renderUiConceptSvg(concept, index = 0) {
  const appType = String(concept?.appType || "desktop").toLowerCase();
  const isMobile = appType === "mobile";
  const width = isMobile ? 480 : 1200;
  const height = isMobile ? 880 : 780;

  const defaultPalettes = [
    {
      bg: "#F8FAFC",
      surface: "#FFFFFF",
      surfaceAlt: "#F1F5F9",
      text: "#0F172A",
      muted: "#64748B",
      primary: "#2563EB",
      primaryText: "#FFFFFF",
      accent: "#3B82F6",
      border: "#E2E8F0",
      statusOk: "#10B981",
    },
    {
      bg: "#090D16",
      surface: "#111827",
      surfaceAlt: "#1E293B",
      text: "#F8FAFC",
      muted: "#94A3B8",
      primary: "#6366F1",
      primaryText: "#FFFFFF",
      accent: "#22D3EE",
      border: "#1E293B",
      statusOk: "#34D399",
    },
    {
      bg: "#FAF7F2",
      surface: "#FFFFFF",
      surfaceAlt: "#F3EFE6",
      text: "#1C1917",
      muted: "#78716C",
      primary: "#EA580C",
      primaryText: "#FFFFFF",
      accent: "#F59E0B",
      border: "#E7E5E4",
      statusOk: "#16A34A",
    },
  ];

  const defPal = defaultPalettes[index % defaultPalettes.length];
  const p = concept?.palette || {};
  const pal = {
    bg: sanitizeHex(p.bg, defPal.bg),
    surface: sanitizeHex(p.surface, defPal.surface),
    surfaceAlt: sanitizeHex(p.surfaceAlt, defPal.surfaceAlt),
    text: sanitizeHex(p.text, defPal.text),
    muted: sanitizeHex(p.muted, defPal.muted),
    primary: sanitizeHex(p.primary, defPal.primary),
    primaryText: sanitizeHex(p.primaryText, defPal.primaryText),
    accent: sanitizeHex(p.accent, defPal.accent),
    border: sanitizeHex(p.border, defPal.border),
    statusOk: sanitizeHex(p.statusOk, defPal.statusOk),
  };

  const spec = concept?.uiSpec || {};
  const brand = truncate(spec.brandName || concept?.title || "Vikawa Studio", 22);
  const heroBadge = truncate(spec.heroBadge || concept?.styleBadge || "AI POWERED PLATFORM", 28);
  const heroHeadline = truncate(
    spec.heroHeadline || concept?.title || "Next-Gen Digital Experience",
    46
  );
  const heroSubtext = truncate(
    spec.heroSubtext ||
      concept?.description ||
      "Designed with precision typography, clean hierarchy, and responsive components.",
    85
  );
  const primaryBtn = truncate(spec.primaryBtn || "Get Started", 18);
  const secondaryBtn = truncate(spec.secondaryBtn || "Live Demo", 18);
  const ctaText = truncate(spec.ctaText || "Launch App", 16);

  const navItems = Array.isArray(spec.navItems) && spec.navItems.length
    ? spec.navItems.slice(0, 4).map((n) => truncate(n, 14))
    : ["Overview", "Features", "Workspace", "Pricing"];

  const stats = Array.isArray(spec.stats) && spec.stats.length
    ? spec.stats.slice(0, 3)
    : [
        { label: "Active Users", value: "128.4K", change: "+18.2%" },
        { label: "Response Speed", value: "0.24s", change: "99.9% SLA" },
        { label: "Satisfaction", value: "4.9/5", change: "+4.1%" },
      ];

  const sections = Array.isArray(spec.sections) && spec.sections.length
    ? spec.sections.slice(0, 4)
    : [
        {
          title: "Smart Workflow",
          subtitle: "Automated processing with real-time visual feedback and instant export.",
          tag: "CORE",
          metric: "98%",
        },
        {
          title: "Analytics Hub",
          subtitle: "Interactive metrics, live usage tracking, and customizable reporting.",
          tag: "LIVE",
          metric: "24/7",
        },
        {
          title: "Cloud Sync",
          subtitle: "Seamless multi-device state persistence with end-to-end encryption.",
          tag: "SECURE",
          metric: "AES-256",
        },
        {
          title: "Custom Themes",
          subtitle: "Adaptive design tokens with instant dark and light appearance switching.",
          tag: "UI KIT",
          metric: "100+",
        },
      ];

  const showSidebar =
    spec.showSidebar !== undefined
      ? Boolean(spec.showSidebar)
      : appType === "dashboard" || index === 1;
  const showTopNav = spec.showTopNav !== undefined ? Boolean(spec.showTopNav) : true;
  const showHero = spec.showHero !== undefined ? Boolean(spec.showHero) : true;
  const showStats = spec.showStats !== undefined ? Boolean(spec.showStats) : true;
  const layoutStyle = String(
    spec.layoutStyle ||
      (appType === "translator"
        ? "dual-translator"
        : appType === "chat"
        ? "chat-studio"
        : appType === "dashboard"
        ? "sidebar-dashboard"
        : index === 2
        ? "bento-grid"
        : "split-hero")
  ).toLowerCase();

  let svgBody = "";

  if (isMobile) {
    // MOBILE APP UI SCREENSHOT (480 x 880)
    svgBody = `
      <!-- Outer Backdrop -->
      <rect width="480" height="880" fill="${pal.surfaceAlt}" />
      <circle cx="80" cy="100" r="180" fill="${pal.primary}" opacity="0.12" filter="url(#blurFilter)" />
      <circle cx="400" cy="760" r="180" fill="${pal.accent}" opacity="0.12" filter="url(#blurFilter)" />

      <!-- Phone Frame -->
      <rect x="28" y="20" width="424" height="840" rx="44" fill="${pal.bg}" stroke="${pal.border}" stroke-width="6" filter="url(#cardShadow)" />
      <!-- Dynamic Island / Notch -->
      <rect x="176" y="34" width="128" height="24" rx="12" fill="${pal.text}" opacity="0.9" />
      <!-- Status Bar -->
      <text x="58" y="51" fill="${pal.text}" font-family="Inter, system-ui, sans-serif" font-size="12" font-weight="600">9:41</text>
      <circle cx="390" cy="46" r="4" fill="${pal.statusOk}" />
      <rect x="400" y="41" width="22" height="10" rx="3" fill="${pal.text}" opacity="0.8" />

      <!-- App Header -->
      ${
        showTopNav
          ? `
      <g transform="translate(48, 72)">
        <rect width="38" height="38" rx="12" fill="${pal.primary}" />
        <text x="19" y="25" text-anchor="middle" fill="${pal.primaryText}" font-family="Inter, sans-serif" font-size="16" font-weight="700">${escapeXml(
              brand.slice(0, 1).toUpperCase()
            )}</text>
        <text x="50" y="20" fill="${pal.text}" font-family="Inter, sans-serif" font-size="16" font-weight="700">${escapeXml(
              brand
            )}</text>
        <text x="50" y="35" fill="${pal.muted}" font-family="Inter, sans-serif" font-size="11">${escapeXml(
              heroBadge
            )}</text>
        <rect x="336" y="4" width="48" height="30" rx="15" fill="${pal.surface}" stroke="${pal.border}" />
        <circle cx="360" cy="19" r="6" fill="${pal.primary}" />
      </g>`
          : ""
      }

      <!-- Search / Command Bar -->
      <g transform="translate(48, 124)">
        <rect width="384" height="42" rx="14" fill="${pal.surface}" stroke="${pal.border}" />
        <circle cx="22" cy="21" r="6" fill="none" stroke="${pal.muted}" stroke-width="2" />
        <line x1="27" y1="26" x2="32" y2="31" stroke="${pal.muted}" stroke-width="2" />
        <text x="44" y="26" fill="${pal.muted}" font-family="Inter, sans-serif" font-size="13">${escapeXml(
          truncate(spec.searchPlaceholder || `Search in ${brand}...`, 34)
        )}</text>
      </g>

      <!-- Hero Card -->
      ${
        showHero
          ? `
      <g transform="translate(48, 180)">
        <rect width="384" height="168" rx="22" fill="url(#primaryGrad)" filter="url(#cardShadow)" />
        <rect x="18" y="16" width="110" height="22" rx="11" fill="#FFFFFF" opacity="0.2" />
        <text x="73" y="31" text-anchor="middle" fill="#FFFFFF" font-family="Inter, sans-serif" font-size="10" font-weight="700">${escapeXml(
              truncate(heroBadge, 16)
            )}</text>
        <text x="18" y="64" fill="#FFFFFF" font-family="Inter, sans-serif" font-size="20" font-weight="700">${escapeXml(
              truncate(heroHeadline, 28)
            )}</text>
        <text x="18" y="88" fill="#FFFFFF" opacity="0.9" font-family="Inter, sans-serif" font-size="12">${escapeXml(
              truncate(heroSubtext, 48)
            )}</text>
        <rect x="18" y="114" width="132" height="36" rx="12" fill="#FFFFFF" />
        <text x="84" y="137" text-anchor="middle" fill="${pal.primary}" font-family="Inter, sans-serif" font-size="12" font-weight="700">${escapeXml(
              primaryBtn
            )}</text>
        <rect x="160" y="114" width="112" height="36" rx="12" fill="#FFFFFF" opacity="0.18" />
        <text x="216" y="137" text-anchor="middle" fill="#FFFFFF" font-family="Inter, sans-serif" font-size="12" font-weight="600">${escapeXml(
              secondaryBtn
            )}</text>
      </g>`
          : ""
      }

      <!-- Stats Strip -->
      ${
        showStats
          ? stats
              .map((st, idx) => {
                const sx = 48 + idx * 131;
                return `
      <g transform="translate(${sx}, 362)">
        <rect width="122" height="70" rx="16" fill="${pal.surface}" stroke="${pal.border}" />
        <text x="14" y="26" fill="${pal.muted}" font-family="Inter, sans-serif" font-size="11">${escapeXml(
                  truncate(st.label, 14)
                )}</text>
        <text x="14" y="48" fill="${pal.text}" font-family="Inter, sans-serif" font-size="17" font-weight="700">${escapeXml(
                  truncate(st.value, 10)
                )}</text>
        <text x="14" y="62" fill="${pal.statusOk}" font-family="Inter, sans-serif" font-size="10" font-weight="600">${escapeXml(
                  truncate(st.change || "+12%", 10)
                )}</text>
      </g>`;
              })
              .join("")
          : ""
      }

      <!-- Feature Cards List -->
      ${sections
        .slice(0, 3)
        .map((sec, idx) => {
          const cy = (showStats ? 448 : 366) + idx * 104;
          return `
      <g transform="translate(48, ${cy})">
        <rect width="384" height="92" rx="18" fill="${pal.surface}" stroke="${pal.border}" filter="url(#cardShadow)" />
        <rect x="16" y="18" width="52" height="52" rx="14" fill="${pal.primary}" opacity="0.14" />
        <circle cx="42" cy="44" r="11" fill="${pal.primary}" />
        <text x="82" y="34" fill="${pal.text}" font-family="Inter, sans-serif" font-size="15" font-weight="700">${escapeXml(
            truncate(sec.title, 26)
          )}</text>
        <text x="82" y="54" fill="${pal.muted}" font-family="Inter, sans-serif" font-size="12">${escapeXml(
            truncate(sec.subtitle, 40)
          )}</text>
        <rect x="304" y="20" width="64" height="24" rx="12" fill="${pal.surfaceAlt}" />
        <text x="336" y="36" text-anchor="middle" fill="${pal.primary}" font-family="Inter, sans-serif" font-size="10" font-weight="700">${escapeXml(
            truncate(sec.tag || sec.metric || "PRO", 8)
          )}</text>
      </g>`;
        })
        .join("")}

      <!-- Bottom Tab Navigation Bar -->
      <g transform="translate(48, 776)">
        <rect width="384" height="62" rx="22" fill="${pal.surface}" stroke="${pal.border}" filter="url(#cardShadow)" />
        ${navItems
          .slice(0, 4)
          .map((nav, idx) => {
            const nx = 48 + idx * 96;
            const active = idx === 0;
            return `
          <circle cx="${nx}" cy="22" r="8" fill="${active ? pal.primary : pal.muted}" opacity="${
              active ? "1" : "0.45"
            }" />
          <text x="${nx}" y="46" text-anchor="middle" fill="${
              active ? pal.primary : pal.muted
            }" font-family="Inter, sans-serif" font-size="11" font-weight="${
              active ? "700" : "500"
            }">${escapeXml(truncate(nav, 10))}</text>`;
          })
          .join("")}
      </g>
    `;
  } else {
    // DESKTOP WEBSITE / DASHBOARD / TRANSLATOR / AI CHAT APP (1200 x 780)
    const contentX = showSidebar ? 248 : 48;
    const contentW = showSidebar ? 912 : 1104;

    // Top Browser Bar + App Navigation
    const browserChrome = `
      <rect width="1200" height="780" fill="${pal.bg}" />
      <circle cx="180" cy="110" r="240" fill="${pal.primary}" opacity="0.08" filter="url(#blurFilter)" />
      <circle cx="1020" cy="650" r="260" fill="${pal.accent}" opacity="0.08" filter="url(#blurFilter)" />

      <!-- Browser Window Top Bar -->
      <rect x="0" y="0" width="1200" height="42" fill="${pal.surface}" stroke="${pal.border}" />
      <circle cx="24" cy="21" r="6" fill="#EF4444" />
      <circle cx="44" cy="21" r="6" fill="#F59E0B" />
      <circle cx="64" cy="21" r="6" fill="#10B981" />
      <rect x="340" y="9" width="520" height="24" rx="8" fill="${pal.surfaceAlt}" stroke="${pal.border}" />
      <text x="600" y="25" text-anchor="middle" fill="${pal.muted}" font-family="Inter, sans-serif" font-size="11">https://${escapeXml(
      brand.toLowerCase().replace(/[^a-z0-9]/g, "") || "vikawa"
    )}.app/${escapeXml(appType)}</text>
      <rect x="1080" y="10" width="96" height="22" rx="11" fill="${pal.primary}" opacity="0.12" />
      <text x="1128" y="25" text-anchor="middle" fill="${pal.primary}" font-family="Inter, sans-serif" font-size="10" font-weight="700">${escapeXml(
      truncate(concept?.styleBadge || "CONCEPT " + (index + 1), 14)
    )}</text>
    `;

    const sidebarBlock = showSidebar
      ? `
      <!-- Left Sidebar -->
      <g transform="translate(0, 42)">
        <rect width="220" height="738" fill="${pal.surface}" stroke="${pal.border}" />
        <rect x="20" y="20" width="34" height="34" rx="10" fill="${pal.primary}" />
        <text x="37" y="43" text-anchor="middle" fill="${pal.primaryText}" font-family="Inter, sans-serif" font-size="16" font-weight="700">${escapeXml(
          brand.slice(0, 1).toUpperCase()
        )}</text>
        <text x="66" y="38" fill="${pal.text}" font-family="Inter, sans-serif" font-size="16" font-weight="700">${escapeXml(
          truncate(brand, 15)
        )}</text>
        <text x="66" y="52" fill="${pal.muted}" font-family="Inter, sans-serif" font-size="10">WORKSPACE</text>

        ${navItems
          .map((nav, i) => {
            const ny = 84 + i * 46;
            const active = i === 0;
            return `
          <rect x="16" y="${ny}" width="188" height="38" rx="10" fill="${
              active ? pal.primary : "transparent"
            }" opacity="${active ? "0.14" : "1"}" />
          <circle cx="36" cy="${ny + 19}" r="6" fill="${active ? pal.primary : pal.muted}" />
          <text x="54" y="${ny + 24}" fill="${
              active ? pal.primary : pal.text
            }" font-family="Inter, sans-serif" font-size="13" font-weight="${
              active ? "700" : "500"
            }">${escapeXml(nav)}</text>`;
          })
          .join("")}

        <!-- Sidebar Bottom Card -->
        <rect x="16" y="610" width="188" height="104" rx="14" fill="${pal.surfaceAlt}" stroke="${pal.border}" />
        <text x="30" y="636" fill="${pal.text}" font-family="Inter, sans-serif" font-size="12" font-weight="700">${escapeXml(
          truncate(heroBadge, 20)
        )}</text>
        <text x="30" y="656" fill="${pal.muted}" font-family="Inter, sans-serif" font-size="11">Pro Design System</text>
        <rect x="30" y="672" width="160" height="28" rx="8" fill="${pal.primary}" />
        <text x="110" y="690" text-anchor="middle" fill="${pal.primaryText}" font-family="Inter, sans-serif" font-size="11" font-weight="600">${escapeXml(
          ctaText
        )}</text>
      </g>`
      : "";

    const topNavbarBlock = showTopNav
      ? `
      <!-- Top Navigation Bar -->
      <g transform="translate(${contentX}, 58)">
        <rect width="${contentW}" height="56" rx="16" fill="${pal.surface}" stroke="${pal.border}" filter="url(#cardShadow)" />
        <rect x="18" y="13" width="30" height="30" rx="8" fill="${pal.primary}" />
        <text x="33" y="33" text-anchor="middle" fill="${pal.primaryText}" font-family="Inter, sans-serif" font-size="14" font-weight="700">${escapeXml(
          brand.slice(0, 1).toUpperCase()
        )}</text>
        <text x="58" y="34" fill="${pal.text}" font-family="Inter, sans-serif" font-size="16" font-weight="700">${escapeXml(
          brand
        )}</text>
        ${
          !showSidebar
            ? navItems
                .map((nav, i) => {
                  const nx = 260 + i * 115;
                  return `<text x="${nx}" y="33" fill="${
                    i === 0 ? pal.primary : pal.muted
                  }" font-family="Inter, sans-serif" font-size="13" font-weight="${
                    i === 0 ? "700" : "500"
                  }">${escapeXml(nav)}</text>`;
                })
                .join("")
            : `<text x="240" y="33" fill="${pal.muted}" font-family="Inter, sans-serif" font-size="13">${escapeXml(
                truncate(heroHeadline, 42)
              )}</text>`
        }
        <rect x="${contentW - 142}" y="11" width="126" height="34" rx="10" fill="${pal.primary}" />
        <text x="${contentW - 79}" y="33" text-anchor="middle" fill="${pal.primaryText}" font-family="Inter, sans-serif" font-size="12" font-weight="700">${escapeXml(
          ctaText
        )}</text>
      </g>`
      : "";

    let mainWorkspace = "";
    const startY = showTopNav ? 132 : 66;

    if (layoutStyle === "dual-translator" || appType === "translator") {
      // SPECIALIZED DUAL-PANEL TRANSLATOR UI
      const df = spec.domainFeature || {};
      const srcLang = truncate(df.sourceLang || "English (Detected)", 22);
      const tgtLang = truncate(df.targetLang || "Urdu (اردو) — AI Neural", 26);
      const srcText = truncate(
        df.sourceText ||
          "Welcome to our next-generation AI translator. Speak or type naturally for instant contextual translation.",
        95
      );
      const tgtText = truncate(
        df.translatedText ||
          "ہمارے جدید ترین AI مترجم میں خوش آمدید۔ فوری اور درست ترجمے کے لیے قدرتی انداز میں بولیں یا لکھیں۔",
        95
      );
      const halfW = Math.floor((contentW - 20) / 2);

      mainWorkspace = `
        <!-- Translator Header Banner -->
        <g transform="translate(${contentX}, ${startY})">
          <rect width="${contentW}" height="88" rx="18" fill="url(#primaryGrad)" filter="url(#cardShadow)" />
          <text x="28" y="38" fill="#FFFFFF" font-family="Inter, sans-serif" font-size="22" font-weight="700">${escapeXml(
            heroHeadline
          )}</text>
          <text x="28" y="64" fill="#FFFFFF" opacity="0.9" font-family="Inter, sans-serif" font-size="13">${escapeXml(
            heroSubtext
          )}</text>
          <rect x="${contentW - 170}" y="24" width="142" height="40" rx="12" fill="#FFFFFF" />
          <text x="${contentW - 99}" y="49" text-anchor="middle" fill="${pal.primary}" font-family="Inter, sans-serif" font-size="13" font-weight="700">${escapeXml(
            primaryBtn
          )}</text>
        </g>

        <!-- Dual Translation Panels -->
        <g transform="translate(${contentX}, ${startY + 106})">
          <!-- Source Language Panel -->
          <rect x="0" y="0" width="${halfW}" height="280" rx="20" fill="${pal.surface}" stroke="${pal.border}" filter="url(#cardShadow)" />
          <rect x="18" y="16" width="160" height="32" rx="10" fill="${pal.surfaceAlt}" />
          <text x="32" y="37" fill="${pal.text}" font-family="Inter, sans-serif" font-size="13" font-weight="700">${escapeXml(
            srcLang
          )}</text>
          <line x1="0" y1="62" x2="${halfW}" y2="62" stroke="${pal.border}" />
          <text x="24" y="102" fill="${pal.text}" font-family="Inter, sans-serif" font-size="16" font-weight="500">${escapeXml(
            srcText.slice(0, 48)
          )}</text>
          <text x="24" y="130" fill="${pal.text}" font-family="Inter, sans-serif" font-size="16" font-weight="500">${escapeXml(
            srcText.slice(48, 96)
          )}</text>
          <!-- Mic & Audio Toolbar -->
          <rect x="20" y="224" width="110" height="36" rx="12" fill="${pal.primary}" />
          <text x="75" y="247" text-anchor="middle" fill="${pal.primaryText}" font-family="Inter, sans-serif" font-size="12" font-weight="600">Voice Input</text>
          <rect x="140" y="224" width="90" height="36" rx="12" fill="${pal.surfaceAlt}" />
          <text x="185" y="247" text-anchor="middle" fill="${pal.muted}" font-family="Inter, sans-serif" font-size="12">Listen</text>

          <!-- Target Language Panel -->
          <rect x="${halfW + 20}" y="0" width="${halfW}" height="280" rx="20" fill="${pal.surface}" stroke="${pal.primary}" stroke-width="2" filter="url(#cardShadow)" />
          <rect x="${halfW + 38}" y="16" width="190" height="32" rx="10" fill="${pal.primary}" opacity="0.14" />
          <text x="${halfW + 52}" y="37" fill="${pal.primary}" font-family="Inter, sans-serif" font-size="13" font-weight="700">${escapeXml(
            tgtLang
          )}</text>
          <line x1="${halfW + 20}" y1="62" x2="${contentW}" y2="62" stroke="${pal.border}" />
          <text x="${halfW + 44}" y="104" fill="${pal.text}" font-family="Inter, sans-serif" font-size="16" font-weight="600">${escapeXml(
            tgtText.slice(0, 48)
          )}</text>
          <text x="${halfW + 44}" y="134" fill="${pal.text}" font-family="Inter, sans-serif" font-size="16" font-weight="600">${escapeXml(
            tgtText.slice(48, 96)
          )}</text>
          <rect x="${halfW + 40}" y="224" width="110" height="36" rx="12" fill="${pal.surfaceAlt}" />
          <text x="${halfW + 95}" y="247" text-anchor="middle" fill="${pal.text}" font-family="Inter, sans-serif" font-size="12" font-weight="600">Copy Text</text>
          <rect x="${halfW + 160}" y="224" width="110" height="36" rx="12" fill="${pal.primary}" opacity="0.15" />
          <text x="${halfW + 215}" y="247" text-anchor="middle" fill="${pal.primary}" font-family="Inter, sans-serif" font-size="12" font-weight="700">Speak AI</text>
        </g>

        <!-- Bottom Feature Strip -->
        <g transform="translate(${contentX}, ${startY + 404})">
          ${sections
            .slice(0, 3)
            .map((sec, idx) => {
              const cw = Math.floor((contentW - 32) / 3);
              const cx = idx * (cw + 16);
              return `
              <rect x="${cx}" y="0" width="${cw}" height="180" rx="18" fill="${pal.surface}" stroke="${pal.border}" filter="url(#cardShadow)" />
              <rect x="${cx + 20}" y="20" width="40" height="40" rx="12" fill="${pal.primary}" opacity="0.15" />
              <circle cx="${cx + 40}" cy="40" r="9" fill="${pal.primary}" />
              <text x="${cx + 20}" y="86" fill="${pal.text}" font-family="Inter, sans-serif" font-size="16" font-weight="700">${escapeXml(
                truncate(sec.title, 24)
              )}</text>
              <text x="${cx + 20}" y="112" fill="${pal.muted}" font-family="Inter, sans-serif" font-size="12">${escapeXml(
                truncate(sec.subtitle, 38)
              )}</text>
              <rect x="${cx + 20}" y="134" width="76" height="24" rx="8" fill="${pal.surfaceAlt}" />
              <text x="${cx + 58}" y="150" text-anchor="middle" fill="${pal.primary}" font-family="Inter, sans-serif" font-size="11" font-weight="700">${escapeXml(
                truncate(sec.tag || sec.metric || "AI", 10)
              )}</text>`;
            })
            .join("")}
        </g>
      `;
    } else {
      // HERO + STATS + BENTO/CARDS WORKSPACE
      const heroH = showHero ? 196 : 0;
      const statsY = startY + (showHero ? heroH + 18 : 0);
      const statsH = showStats ? 86 : 0;
      const cardsY = statsY + (showStats ? statsH + 18 : 0);

      mainWorkspace = `
        ${
          showHero
            ? `
        <!-- Hero Banner -->
        <g transform="translate(${contentX}, ${startY})">
          <rect width="${contentW}" height="${heroH}" rx="22" fill="${pal.surface}" stroke="${pal.border}" filter="url(#cardShadow)" />
          <rect x="0" y="0" width="${contentW}" height="${heroH}" rx="22" fill="url(#primaryGrad)" opacity="${
                index === 1 ? "0.22" : "0.09"
              }" />
          <rect x="32" y="24" width="160" height="26" rx="13" fill="${pal.primary}" opacity="0.16" />
          <text x="112" y="41" text-anchor="middle" fill="${pal.primary}" font-family="Inter, sans-serif" font-size="11" font-weight="700">${escapeXml(
                truncate(heroBadge, 22)
              )}</text>
          <text x="32" y="84" fill="${pal.text}" font-family="Inter, sans-serif" font-size="28" font-weight="800">${escapeXml(
                truncate(heroHeadline, 42)
              )}</text>
          <text x="32" y="114" fill="${pal.muted}" font-family="Inter, sans-serif" font-size="14">${escapeXml(
                truncate(heroSubtext, 75)
              )}</text>
          <rect x="32" y="136" width="148" height="40" rx="12" fill="${pal.primary}" />
          <text x="106" y="161" text-anchor="middle" fill="${pal.primaryText}" font-family="Inter, sans-serif" font-size="13" font-weight="700">${escapeXml(
                primaryBtn
              )}</text>
          <rect x="192" y="136" width="136" height="40" rx="12" fill="${pal.surfaceAlt}" stroke="${pal.border}" />
          <text x="260" y="161" text-anchor="middle" fill="${pal.text}" font-family="Inter, sans-serif" font-size="13" font-weight="600">${escapeXml(
                secondaryBtn
              )}</text>

          <!-- Decorative Visual Preview Widget inside Hero -->
          <g transform="translate(${contentW - 310}, 22)">
            <rect width="282" height="152" rx="16" fill="${pal.surfaceAlt}" stroke="${pal.border}" />
            <circle cx="30" cy="30" r="10" fill="${pal.primary}" />
            <rect x="50" y="22" width="120" height="8" rx="4" fill="${pal.text}" opacity="0.7" />
            <rect x="50" y="36" width="80" height="6" rx="3" fill="${pal.muted}" opacity="0.5" />
            <!-- Mini Bar Chart -->
            <rect x="28" y="96" width="28" height="36" rx="6" fill="${pal.primary}" opacity="0.45" />
            <rect x="68" y="76" width="28" height="56" rx="6" fill="${pal.primary}" opacity="0.65" />
            <rect x="108" y="62" width="28" height="70" rx="6" fill="${pal.primary}" opacity="0.85" />
            <rect x="148" y="48" width="28" height="84" rx="6" fill="${pal.primary}" />
            <rect x="188" y="68" width="28" height="64" rx="6" fill="${pal.accent}" />
            <rect x="228" y="42" width="28" height="90" rx="6" fill="${pal.statusOk}" />
          </g>
        </g>`
            : ""
        }

        ${
          showStats
            ? `
        <!-- KPI / Stats Row -->
        <g transform="translate(${contentX}, ${statsY})">
          ${stats
            .map((st, idx) => {
              const sw = Math.floor((contentW - 32) / 3);
              const sx = idx * (sw + 16);
              return `
              <rect x="${sx}" y="0" width="${sw}" height="${statsH}" rx="16" fill="${pal.surface}" stroke="${pal.border}" filter="url(#cardShadow)" />
              <text x="${sx + 22}" y="30" fill="${pal.muted}" font-family="Inter, sans-serif" font-size="12" font-weight="500">${escapeXml(
                truncate(st.label, 24)
              )}</text>
              <text x="${sx + 22}" y="62" fill="${pal.text}" font-family="Inter, sans-serif" font-size="24" font-weight="800">${escapeXml(
                truncate(st.value, 14)
              )}</text>
              <rect x="${sx + sw - 88}" y="28" width="68" height="26" rx="13" fill="${pal.statusOk}" opacity="0.15" />
              <text x="${sx + sw - 54}" y="45" text-anchor="middle" fill="${pal.statusOk}" font-family="Inter, sans-serif" font-size="11" font-weight="700">${escapeXml(
                truncate(st.change || "+14%", 9)
              )}</text>`;
            })
            .join("")}
        </g>`
            : ""
        }

        <!-- 4-Card Bento / Feature Grid -->
        <g transform="translate(${contentX}, ${cardsY})">
          ${sections
            .slice(0, 4)
            .map((sec, idx) => {
              const cols = 2;
              const col = idx % cols;
              const row = Math.floor(idx / cols);
              const cw = Math.floor((contentW - 18) / 2);
              const ch = showHero && showStats ? 132 : 175;
              const cx = col * (cw + 18);
              const cy = row * (ch + 16);
              return `
              <rect x="${cx}" y="${cy}" width="${cw}" height="${ch}" rx="18" fill="${pal.surface}" stroke="${pal.border}" filter="url(#cardShadow)" />
              <rect x="${cx + 20}" y="${cy + 20}" width="44" height="44" rx="12" fill="${pal.primary}" opacity="0.14" />
              <circle cx="${cx + 42}" cy="${cy + 42}" r="10" fill="${pal.primary}" />
              <text x="${cx + 78}" y="${cy + 38}" fill="${pal.text}" font-family="Inter, sans-serif" font-size="16" font-weight="700">${escapeXml(
                truncate(sec.title, 28)
              )}</text>
              <text x="${cx + 78}" y="${cy + 60}" fill="${pal.muted}" font-family="Inter, sans-serif" font-size="12">${escapeXml(
                truncate(sec.subtitle, 48)
              )}</text>
              <rect x="${cx + cw - 92}" y="${cy + 20}" width="72" height="24" rx="12" fill="${pal.surfaceAlt}" />
              <text x="${cx + cw - 56}" y="${cy + 36}" text-anchor="middle" fill="${pal.primary}" font-family="Inter, sans-serif" font-size="10" font-weight="700">${escapeXml(
                truncate(sec.tag || sec.metric || "FEATURE", 10)
              )}</text>
              <line x1="${cx + 20}" y1="${cy + ch - 38}" x2="${cx + cw - 20}" y2="${cy + ch - 38}" stroke="${pal.border}" />
              <text x="${cx + 20}" y="${cy + ch - 16}" fill="${pal.primary}" font-family="Inter, sans-serif" font-size="11" font-weight="600">Explore Component →</text>
              <text x="${cx + cw - 20}" y="${cy + ch - 16}" text-anchor="end" fill="${pal.muted}" font-family="Inter, sans-serif" font-size="11" font-weight="600">${escapeXml(
                truncate(sec.metric || "Active", 12)
              )}</text>`;
            })
            .join("")}
        </g>
      `;
    }

    svgBody = browserChrome + sidebarBlock + topNavbarBlock + mainWorkspace;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
    <defs>
      <linearGradient id="primaryGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${pal.primary}" />
        <stop offset="100%" stop-color="${pal.accent}" />
      </linearGradient>
      <filter id="cardShadow" x="-5%" y="-5%" width="110%" height="115%">
        <feDropShadow dx="0" dy="6" stdDeviation="10" flood-color="#000000" flood-opacity="0.08" />
      </filter>
      <filter id="blurFilter">
        <feGaussianBlur stdDeviation="50" />
      </filter>
    </defs>
    ${svgBody}
  </svg>`;

  const base64Svg = Buffer.from(svg, "utf-8").toString("base64");
  return `data:image/svg+xml;base64,${base64Svg}`;
}

async function callGeminiText(parts, systemInstruction, apiKey, wantJson = false) {
  for (const modelName of TEXT_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(
        apiKey
      )}`;
      const payload = {
        contents: [{ role: "user", parts }],
        generationConfig: wantJson
          ? { responseMimeType: "application/json", temperature: 0.7 }
          : { temperature: 0.5 },
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

  // 1. Try Gemini Native Image Generation Models
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
        text: `High-resolution, full-page Dribbble/Figma UI design screenshot mockup for a ${appType} application: ${promptText}. Crisp typography, realistic buttons, modern interface layout, clean spacing, complete UI screen.`,
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

  // 2. Try OpenAI DALL-E 3 if OPENAI_API_KEY is configured
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
    const firstBracket = cleaned.indexOf("[");
    const lastBracket = cleaned.lastIndexOf("]");
    if (firstBracket !== -1 && lastBracket > firstBracket) {
      try {
        return JSON.parse(cleaned.slice(firstBracket, lastBracket + 1));
      } catch (_e3) {}
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

  const apiKey = getCleanApiKey();
  if (!apiKey) {
    return res.status(500).json({
      error:
        "GEMINI_API_KEY سرور پر موجود نہیں ہے۔ براہ کرم Environment Variables میں GEMINI_API_KEY شامل کریں۔",
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

If a reference image is attached, analyze its layout structure, component hierarchy, and aesthetic, and create 3 distinct variations inspired by it while following the user's instructions.

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
        ],
        "domainFeature": {
          "sourceLang": "English",
          "targetLang": "Urdu",
          "sourceText": "Sample input text relevant to prompt",
          "translatedText": "Sample output text relevant to prompt"
        }
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

      const aiResp = await callGeminiText(parts, systemInstruction, apiKey, true);
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
          styleBadge: i === 0 ? "Minimalist Light" : i === 1 ? "Dark Glass" : "Bento Grid",
          description: `Complete ${appType} interface concept for: ${prompt || "Reference UI"}`,
          appType,
          imagePrompt: `${prompt} (${
            i === 0 ? "clean light mode" : i === 1 ? "sleek dark mode" : "warm bento layout"
          })`,
          uiSpec: {
            brandName: prompt.split(/\s+/).slice(0, 2).join(" ") || "Vikawa UI",
            heroHeadline: prompt.slice(0, 44) || "Modern App Interface",
            showSidebar: i === 1 || appType === "dashboard",
            showTopNav: true,
            showHero: true,
            showStats: true,
          },
        }));
      }

      // Check native diffusion image model once first; if available, generate all 3 with native diffusion
      const firstTry = await tryNativeImageModel(
        rawConcepts[0].imagePrompt || prompt,
        appType,
        referenceImage,
        apiKey
      );

      let usedNativeDiffusion = Boolean(firstTry.imageUrl);
      let quotaExceeded = Boolean(firstTry.quotaExceeded);

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
          : quotaExceeded
          ? "Rendered via Gemini 3.8 Flash UI Architect (High-DPI PNG/SVG Mockups). Note: Native Gemini image diffusion (gemini-3.1-flash-lite-image) returned 429 on the current free-tier API key; attach a paid Gemini key or OPENAI_API_KEY for diffusion raster generation."
          : "Rendered via Gemini 3.8 Flash UI Architect (High-DPI PNG/SVG Mockups).",
      });
    }

    // =========================================================================
    // ACTION 2: CUSTOMIZE / REFINE A SELECTED DESIGN (CONVERSATION-BASED)
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

      const systemInstruction = `You are a Senior UI/UX Designer refining an existing UI design mockup based on the user's customization request.
Carefully modify the provided JSON design concept to follow the user's exact instructions:
- If the user asks to change colors (e.g., green, dark mode, purple, warm, light mode), update the "palette" hex codes accordingly.
- If the user asks to remove elements (e.g., "remove sidebar", "remove stats", "remove hero", "simplify layout"), set showSidebar / showStats / showHero to false or simplify "sections".
- If the user asks to add features, buttons, or sections, update "heroHeadline", "primaryBtn", "navItems", "sections", or "domainFeature" to include them prominently.

Return ONLY valid JSON with:
{
  "reply": "Short friendly explanation of the design changes applied (in the same language as the user's instruction).",
  "concept": {
    "id": "revised-concept",
    "title": "Updated Concept Title",
    "styleBadge": "Updated Style Badge",
    "description": "Updated description",
    "appType": "${appType}",
    "imagePrompt": "Updated detailed visual prompt",
    "palette": {
      "bg": "#...",
      "surface": "#...",
      "surfaceAlt": "#...",
      "text": "#...",
      "muted": "#...",
      "primary": "#...",
      "primaryText": "#...",
      "accent": "#...",
      "border": "#...",
      "statusOk": "#..."
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
        text: `Current Selected Design JSON:\n${JSON.stringify(slimConcept, null, 2)}\n\nPrevious Revision History:\n${
          history.length ? history.join("\n") : "None"
        }\n\nUser's New Customization Instruction:\n"${instruction}"\n\nApply these exact changes and return the updated JSON.`,
      });

      const aiResp = await callGeminiText(parts, systemInstruction, apiKey, true);
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
          "آپ کی ہدایات کے مطابق ڈیزائن کو اپ ڈیٹ کر دیا گیا ہے۔ اصل ڈیزائن بھی محفوظ ہے۔",
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

      const systemInstruction = `You are a Principal Frontend Engineer.
Convert the selected UI Design Concept into a COMPLETE, single-file, production-ready HTML5 application (with embedded modern CSS and interactive JavaScript).
CRITICAL RULES:
1. Output ONLY the complete HTML code starting with <!DOCTYPE html> and ending with </html>. Do NOT wrap in markdown explanations outside the code block.
2. Match the selected design's exact color palette (${JSON.stringify(
        selectedConcept.palette || {}
      )}), brand name, typography, layout structure, navigation, hero section, stats, cards, and domain features (${
        selectedConcept.appType || "desktop"
      }).
3. Make the layout fully responsive for both mobile and desktop screens, with smooth hover transitions, clean spacing, and working interactive JavaScript (e.g. working tabs, interactive translator/chat/dashboard demo functionality, modal/toast feedback, and filter/search interactivity).`;

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
          )}\n\nUser's Follow-up Code Modification Request:\n"${codeInstruction}"\n\nReturn the updated complete single-file HTML5 document.`,
        });
      } else {
        parts.push({
          text: `Original User Request: "${originalPrompt}"\nSelected UI Design Specification:\n${JSON.stringify(
            slimSpec,
            null,
            2
          )}\n${
            codeInstruction ? `\nAdditional Instructions: ${codeInstruction}` : ""
          }\n\nGenerate the complete, pixel-faithful, interactive single-file HTML5 + CSS3 + JS implementation matching this selected design.`,
        });
      }

      const aiResp = await callGeminiText(parts, systemInstruction, apiKey, false);
      let rawCode = aiResp?.text || "";

      const codeBlockMatch = rawCode.match(/```(?:html)?\s*([\s\S]*?)```/i);
      if (codeBlockMatch && codeBlockMatch[1]) {
        rawCode = codeBlockMatch[1].trim();
      } else {
        const docIdx = rawCode.indexOf("<!DOCTYPE html");
        const htmlIdx = rawCode.indexOf("<html");
        const startIdx = docIdx !== -1 ? docIdx : htmlIdx;
        if (startIdx > 0) {
          rawCode = rawCode.slice(startIdx).trim();
        }
      }

      if (!rawCode || !rawCode.includes("<")) {
        return res.status(500).json({
          error: "کوڈ تیار کرنے میں خرابی پیش آئی۔ براہ کرم دوبارہ کوشش کریں۔",
        });
      }

      return res.status(200).json({
        html: rawCode,
        reply: codeInstruction
          ? "آپ کی ہدایت کے مطابق HTML کوڈ اپ ڈیٹ کر دیا گیا ہے۔"
          : "منتخب کردہ ڈیزائن کے مطابق مکمل HTML، CSS اور JavaScript کوڈ تیار کر دیا گیا ہے۔",
      });
    }

    // =========================================================================
    // ACTION 4: BUNDLE ALL ASSETS INTO A ZIP (HTML, CSS, JS, IMAGES & METADATA)
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
      error: "AI UI Design Studio میں خرابی پیش آئی۔ براہ کرم دوبارہ کوشش کریں۔",
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

  // 1. Separate CSS from <style> blocks
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

  // 2. Separate JS from inline <script> blocks (excluding external CDN scripts)
  let jsBlocks = [];
  cleanedHtml = cleanedHtml.replace(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi, (_, js) => {
    jsBlocks.push(js.trim());
    return "";
  });
  let combinedJs = jsBlocks.join("\n\n// =====================================================\n\n");
  if (!combinedJs.trim()) {
    combinedJs = `// Interactive Scripts for ${title}\nconsole.log("${title} assets loaded successfully.");`;
  }

  // 3. Extract Embedded Base64 Images into images/
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

  // 4. Save UI Design Mockup Image into images/
  let mockupImgData = designImageBase64 || concept.pngUrl || concept.imageUrl || "";
  if (mockupImgData && mockupImgData.startsWith("data:image/")) {
    const comma = mockupImgData.indexOf(",");
    if (comma !== -1) {
      const b64 = mockupImgData.slice(comma + 1);
      const isPng = mockupImgData.startsWith("data:image/png");
      const ext = isPng ? "png" : mockupImgData.startsWith("data:image/svg") ? "svg" : "jpg";
      try {
        imgFolder.file(`ui-design-mockup.${ext}`, Buffer.from(b64, "base64"));
      } catch (_e) {}
    }
  } else if (concept.fallbackSvgUrl && concept.fallbackSvgUrl.startsWith("data:image/svg+xml")) {
    try {
      const svgDecoded = decodeURIComponent(
        concept.fallbackSvgUrl.replace("data:image/svg+xml;utf8,", "")
      );
      imgFolder.file("ui-design-mockup.svg", svgDecoded);
    } catch (_e) {}
  }

  // 5. Save Reference Image if provided
  if (referenceImage && referenceImage.data) {
    try {
      const refB64 = String(referenceImage.data).replace(/^data:image\/[^;]+;base64,/, "");
      const refExt = String(referenceImage.mimeType || "").includes("png") ? "png" : "jpg";
      imgFolder.file(`reference-image.${refExt}`, Buffer.from(refB64, "base64"));
    } catch (_e) {}
  }

  // 6. Generate Favicon
  const brandInitial = (title.charAt(0) || "V").toUpperCase();
  const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="16" fill="${palette.primary || "#2563EB"}"/>
  <text x="32" y="42" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" font-size="32" font-weight="700" fill="${
    palette.primaryText || "#FFFFFF"
  }" text-anchor="middle">${brandInitial}</text>
</svg>`;
  imgFolder.file("favicon.svg", faviconSvg);

  // 7. Insert Asset Links in cleaned index.html
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

  // 8. Add Spec and Documentation
  const designSpec = {
    title,
    appType: concept.appType || "desktop",
    styleBadge: concept.styleBadge || "Modern",
    description: concept.description || "",
    palette,
    uiSpec: concept.uiSpec || {},
    generatedAt: new Date().toISOString(),
    generator: "Vikawa AI - AI UI Design Studio",
  };

  const readmeMd = `# ${title} — Web UI Assets Package

Generated with **Vikawa AI — AI UI Design Studio**.

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
Simply double-click \`index.html\` (or \`standalone.html\`) to open it directly in any modern browser (Chrome, Edge, Firefox, Safari).

### Method 2: Local Web Server (Recommended)
Run a local static server to test all features:

\`\`\`bash
# Using npx serve
npx serve .

# Or using Python
python3 -m http.server 8000

# Or using VS Code
# Right-click index.html -> "Open with Live Server"
\`\`\`

---

## 🛠️ Customization

- **Styling**: Edit \`css/styles.css\` to change colors, typography, or grid spacing.
- **Interactions**: Edit \`js/script.js\` to add or modify button handlers, modals, or API calls.
- **Content**: Update copy directly inside \`index.html\`.
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
