// Shared category definitions and classifier (classic script -> globals).
// Loaded by popup.js and dashboard.js.

const CATEGORY_COLORS = {
  Social: "#ec4899",
  Entertainment: "#f59e0b",
  Development: "#10b981",
  Productivity: "#4f8cff",
  News: "#8b5cf6",
  Shopping: "#ef4444",
  Search: "#14b8a6",
  AI: "#6366f1",
  Other: "#94a3b8",
};

const CATEGORY_ORDER = [
  "Productivity",
  "Development",
  "AI",
  "Social",
  "Entertainment",
  "News",
  "Shopping",
  "Search",
  "Other",
];

// Substring rules: if the (www-stripped) host contains the key, it maps to the
// category. Checked in order; first match wins.
const DOMAIN_RULES = [
  // Social
  ["facebook.", "Social"], ["instagram.", "Social"], ["twitter.", "Social"],
  ["x.com", "Social"], ["reddit.", "Social"], ["tiktok.", "Social"],
  ["linkedin.", "Social"], ["snapchat.", "Social"], ["pinterest.", "Social"],
  ["threads.", "Social"], ["mastodon", "Social"], ["discord.", "Social"],
  ["whatsapp.", "Social"], ["telegram.", "Social"], ["tumblr.", "Social"],

  // Entertainment
  ["youtube.", "Entertainment"], ["netflix.", "Entertainment"],
  ["twitch.", "Entertainment"], ["hulu.", "Entertainment"],
  ["disneyplus.", "Entertainment"], ["spotify.", "Entertainment"],
  ["primevideo.", "Entertainment"], ["soundcloud.", "Entertainment"],
  ["hbomax.", "Entertainment"], ["vimeo.", "Entertainment"],

  // AI (before Development/Search so chatgpt/openai land here)
  ["chatgpt.", "AI"], ["openai.", "AI"], ["claude.", "AI"],
  ["anthropic.", "AI"], ["gemini.", "AI"], ["bard.", "AI"],
  ["perplexity.", "AI"], ["copilot.", "AI"], ["midjourney.", "AI"],

  // Development
  ["github.", "Development"], ["gitlab.", "Development"],
  ["stackoverflow.", "Development"], ["stackexchange.", "Development"],
  ["npmjs.", "Development"], ["developer.mozilla.", "Development"],
  ["kaggle.", "Development"], ["huggingface.", "Development"],
  ["localhost", "Development"], ["vercel.", "Development"],
  ["netlify.", "Development"], ["codepen.", "Development"],
  ["leetcode.", "Development"], ["replit.", "Development"],
  ["readthedocs.", "Development"], ["pypi.", "Development"],

  // Productivity
  ["docs.google.", "Productivity"], ["drive.google.", "Productivity"],
  ["sheets.google.", "Productivity"], ["calendar.google.", "Productivity"],
  ["mail.google.", "Productivity"], ["notion.", "Productivity"],
  ["slack.", "Productivity"], ["trello.", "Productivity"],
  ["asana.", "Productivity"], ["atlassian.", "Productivity"],
  ["jira.", "Productivity"], ["figma.", "Productivity"],
  ["outlook.", "Productivity"], ["office.", "Productivity"],
  ["zoom.", "Productivity"], ["dropbox.", "Productivity"],

  // News
  ["cnn.", "News"], ["bbc.", "News"], ["nytimes.", "News"],
  ["theguardian.", "News"], ["reuters.", "News"], ["bloomberg.", "News"],
  ["news.ycombinator.", "News"], ["medium.", "News"], ["apnews.", "News"],
  ["wsj.", "News"],

  // Shopping
  ["amazon.", "Shopping"], ["ebay.", "Shopping"], ["aliexpress.", "Shopping"],
  ["etsy.", "Shopping"], ["walmart.", "Shopping"], ["bestbuy.", "Shopping"],
  ["target.", "Shopping"], ["shopify.", "Shopping"],

  // Search / Reference
  ["google.", "Search"], ["bing.", "Search"], ["duckduckgo.", "Search"],
  ["wikipedia.", "Search"], ["wolframalpha.", "Search"], ["yahoo.", "Search"],
];

function normalizeHost(host) {
  return (host || "").replace(/^www\./, "").toLowerCase();
}

// True if keyLabels appears as a contiguous run of labels within hostLabels.
// e.g. ["mail","google"] matches ["mail","google","com"], and ["x","com"]
// matches ["x","com"] but NOT ["netflix","com"] (no naive substring traps).
function labelMatch(hostLabels, keyLabels) {
  if (!keyLabels.length) return false;
  for (let i = 0; i + keyLabels.length <= hostLabels.length; i++) {
    let ok = true;
    for (let j = 0; j < keyLabels.length; j++) {
      if (hostLabels[i + j] !== keyLabels[j]) { ok = false; break; }
    }
    if (ok) return true;
  }
  return false;
}

// Returns the category for a host, honoring user overrides first.
function categoryOf(host, overrides) {
  const h = normalizeHost(host);
  if (overrides && overrides[host]) return overrides[host];
  if (overrides && overrides[h]) return overrides[h];
  const labels = h.split(".");
  for (const [needle, cat] of DOMAIN_RULES) {
    const keyLabels = needle.replace(/^\.+|\.+$/g, "").split(".");
    if (labelMatch(labels, keyLabels)) return cat;
  }
  return "Other";
}

function colorOf(category) {
  return CATEGORY_COLORS[category] || CATEGORY_COLORS.Other;
}
