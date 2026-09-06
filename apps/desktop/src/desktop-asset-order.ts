import type { Asset } from "@/domain/entities/asset";

/**
 * Asset 顺序属于产品规则，必须集中维护。
 *
 * 管理列表先放 poster，方便核对作品墙封面；详情 Hero 则排除 poster，优先展示更适合
 * 宽舞台的 fanart / screenshot。两种场景意图不同，但都不应各自复制一份魔法数字。
 */
const MANAGEMENT_ORDER: readonly Asset["type"][] = [
  "poster", "fanart", "screenshot", "cover", "gallery", "portrait", "logo", "subtitle", "document", "other",
];
const HERO_ORDER: readonly Asset["type"][] = ["fanart", "screenshot", "gallery", "cover"];

export function sortWorkAssetsForManagement(assets: readonly Asset[]): Asset[] {
  return sortByTypeOrder(assets, MANAGEMENT_ORDER);
}

export function workHeroAssets(assets: readonly Asset[]): Asset[] {
  return sortByTypeOrder(
    assets.filter((asset) => HERO_ORDER.includes(asset.type) && (!asset.mimeType || asset.mimeType.startsWith("image/"))),
    HERO_ORDER,
  );
}

function sortByTypeOrder(assets: readonly Asset[], order: readonly Asset["type"][]): Asset[] {
  const weights = new Map(order.map((type, index) => [type, index]));
  return [...assets].sort((a, b) => (weights.get(a.type) ?? order.length) - (weights.get(b.type) ?? order.length) || a.id.localeCompare(b.id));
}
