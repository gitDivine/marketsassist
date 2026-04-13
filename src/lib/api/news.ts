import type { NewsItem } from "../types";

const CRYPTOCOMPARE_URL = "https://min-api.cryptocompare.com/data/v2/news/";

function scoreSentiment(text: string): "positive" | "negative" | "neutral" {
  const lower = text.toLowerCase();
  const positive = [
    "bull", "surge", "rally", "gain", "up", "high", "record", "breakout",
    "adoption", "launch", "partner", "growth", "profit", "moon", "pump",
    "approval", "upgrade", "milestone", "ath",
  ];
  const negative = [
    "bear", "crash", "drop", "fall", "down", "low", "hack", "scam",
    "fraud", "ban", "dump", "sell", "risk", "fear", "decline", "loss",
    "lawsuit", "sec", "warning", "collapse",
  ];

  let score = 0;
  for (const word of positive) if (lower.includes(word)) score++;
  for (const word of negative) if (lower.includes(word)) score--;

  if (score > 0) return "positive";
  if (score < 0) return "negative";
  return "neutral";
}

export async function getCryptoNews(asset?: string): Promise<NewsItem[]> {
  try {
    const url = asset
      ? `${CRYPTOCOMPARE_URL}?categories=${asset.toUpperCase()}&feeds=coindesk,cointelegraph,bitcoinist,decrypt&extraParams=MarketPressure`
      : `${CRYPTOCOMPARE_URL}?feeds=coindesk,cointelegraph,bitcoinist,decrypt&extraParams=MarketPressure`;

    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) return [];

    const data = await res.json();
    const articles = (data.Data || []).slice(0, 15);

    return articles.map(
      (a: { title: string; source: string; url: string; published_on: number; body: string }) => ({
        title: a.title,
        source: a.source,
        url: a.url,
        sentiment: scoreSentiment(a.title + " " + (a.body || "").slice(0, 200)),
        publishedAt: new Date(a.published_on * 1000).toISOString(),
      })
    );
  } catch {
    return [];
  }
}

export async function getGoogleNews(query: string): Promise<NewsItem[]> {
  try {
    const encoded = encodeURIComponent(query);
    const res = await fetch(
      `https://news.google.com/rss/search?q=${encoded}&hl=en-US&gl=US&ceid=US:en`,
      { next: { revalidate: 600 } }
    );
    if (!res.ok) return [];

    const xml = await res.text();
    const items: NewsItem[] = [];

    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    while ((match = itemRegex.exec(xml)) !== null && items.length < 10) {
      const itemXml = match[1];
      const title = itemXml.match(/<title>(.*?)<\/title>/)?.[1]?.replace(/<!\[CDATA\[(.*?)\]\]>/, "$1") || "";
      const link = itemXml.match(/<link>(.*?)<\/link>/)?.[1] || "";
      const source = itemXml.match(/<source.*?>(.*?)<\/source>/)?.[1] || "Google News";
      const pubDate = itemXml.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || "";

      items.push({
        title: title.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">"),
        source,
        url: link,
        sentiment: scoreSentiment(title),
        publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
      });
    }

    return items;
  } catch {
    return [];
  }
}
