#!/usr/bin/env node

/**
 * 只读 JavBus genre 索引审计工具。
 *
 * 输出的是来源候选，不写入 library，也不把来源词自动变成 Canonical Genre。
 * 这样既能检查两个索引页是否完整，也能让后续人工审核决定三语名称和映射。
 */
const pages = [
  { kind: "censored", url: "https://www.javbus.com/genre", prefix: "/genre/" },
  { kind: "uncensored", url: "https://www.javbus.com/uncensored/genre", prefix: "/uncensored/genre/" },
];

function text(value) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function auditPage(html, page) {
  const result = [];
  const sectionPattern = /<h4[^>]*>([\s\S]*?)<\/h4>[\s\S]*?<div[^>]*class=["'][^"']*genre-box[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi;
  for (const match of html.matchAll(sectionPattern)) {
    const category = text(match[1]);
    const links = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    for (const link of match[2].matchAll(links)) {
      const href = link[1];
      if (!href.includes(page.prefix)) continue;
      const name = text(link[2]);
      if (name) result.push({ provider: "javbus", kind: page.kind, category, name, href });
    }
  }
  return result;
}

const all = [];
for (const page of pages) {
  const response = await fetch(page.url, { headers: { "user-agent": "Mozilla/5.0", "accept-language": "zh-CN,zh;q=0.9,en;q=0.8" } });
  if (!response.ok) throw new Error(`${page.url}: HTTP ${response.status}`);
  all.push(...auditPage(await response.text(), page));
}

const categories = [...new Set(all.map((item) => item.category))];
console.log(JSON.stringify({ fetchedAt: new Date().toISOString(), count: all.length, categories, items: all }, null, 2));
