import { useEffect, useMemo, useState } from "react";

import type { Asset } from "@/domain/entities/asset";

import { DesktopAssetImage } from "./desktop-asset-image";
import { useDesktopI18n } from "./desktop-i18n";

type GalleryOrientation = "portrait" | "square" | "landscape";

/**
 * 作品详情画廊只负责 Presentation：合法的作品图片全部可浏览，主舞台使用 contain
 * 保留完整画面。图片实际解码后的尺寸比旧 Asset 元数据更可靠，因此 onLoad 会修正布局方向。
 */
export function DesktopWorkAssetGallery({
  assets,
  workCode,
  mediaCount,
  assetTypeLabel,
}: {
  assets: Asset[];
  workCode: string;
  mediaCount: number;
  assetTypeLabel: (type: Asset["type"]) => string;
}) {
  const { t } = useDesktopI18n();
  const candidates = useMemo(
    () => sortGalleryAssets(assets).filter(isWorkGalleryAsset),
    [assets],
  );
  const candidateKey = useMemo(() => candidates.map((asset) => asset.id).join("\0"), [candidates]);
  const [index, setIndex] = useState(0);
  const [orientations, setOrientations] = useState<Map<string, GalleryOrientation>>(() => new Map());

  useEffect(() => {
    setIndex(0);
    setOrientations(new Map());
  }, [workCode, candidateKey]);

  const current = candidates[index];
  const canNavigate = candidates.length > 1;
  const previous = () => setIndex((currentIndex) => (currentIndex - 1 + candidates.length) % candidates.length);
  const next = () => setIndex((currentIndex) => (currentIndex + 1) % candidates.length);
  const orientation = current
    ? orientations.get(current.id) ?? galleryOrientation(current.width, current.height)
    : "landscape";

  if (!candidates.length) return null;

  return (
    <section className="desktop-work-gallery" aria-label={t("作品媒体画廊")}>
      <div className={`desktop-work-gallery__stage is-${orientation}`}>
        <DesktopAssetImage
          asset={current}
          alt={`${workCode} ${current.type}`}
          className="desktop-work-gallery__image"
          fallback={<span className="desktop-poster-placeholder"><b>{workCode}</b></span>}
          onLoad={(event) => {
            const image = event.currentTarget;
            const nextOrientation = galleryOrientation(image.naturalWidth, image.naturalHeight);
            setOrientations((currentOrientations) => {
              if (currentOrientations.get(current.id) === nextOrientation) return currentOrientations;
              const nextOrientations = new Map(currentOrientations);
              nextOrientations.set(current.id, nextOrientation);
              return nextOrientations;
            });
          }}
        />
        {canNavigate ? <>
          <button className="desktop-work-gallery__arrow is-prev" type="button" onClick={previous} aria-label={t("上一张")}>‹</button>
          <button className="desktop-work-gallery__arrow is-next" type="button" onClick={next} aria-label={t("下一张")}>›</button>
        </> : null}
        <div className="desktop-work-gallery__overlay">
          <span>{assetTypeLabel(current.type)}</span>
          <span>{`${index + 1} / ${candidates.length}`}</span>
        </div>
      </div>
      <div className="desktop-work-gallery__rail">
        <div className="desktop-work-gallery__tabs" role="tablist" aria-label={t("作品图片")}>
          {candidates.map((asset, assetIndex) => (
            <button
              className={assetIndex === index ? "is-active" : ""}
              key={asset.id}
              onClick={() => setIndex(assetIndex)}
              role="tab"
              type="button"
              aria-selected={assetIndex === index}
            >
              {assetTypeLabel(asset.type)} <small>{assetIndex + 1}</small>
            </button>
          ))}
        </div>
        <div className="desktop-work-gallery__counts">
          <span>{t("本地媒体")} <strong>{mediaCount}</strong></span>
          <span>{t("作品图片")} <strong>{assets.length}</strong></span>
        </div>
      </div>
    </section>
  );
}

function isWorkGalleryAsset(asset: Asset): boolean {
  if (!["poster", "cover", "gallery", "fanart", "screenshot"].includes(asset.type)) return false;
  return !asset.mimeType || asset.mimeType.startsWith("image/");
}

function galleryOrientation(width?: number, height?: number): GalleryOrientation {
  if (!width || !height) return "landscape";
  const ratio = width / height;
  if (ratio < 0.8) return "portrait";
  if (ratio < 1.2) return "square";
  return "landscape";
}

function sortGalleryAssets(assets: Asset[]): Asset[] {
  const priority: Record<Asset["type"], number> = {
    poster: 0,
    cover: 1,
    gallery: 2,
    fanart: 3,
    screenshot: 4,
    portrait: 5,
    logo: 6,
    subtitle: 7,
    document: 8,
    other: 9,
  };
  return [...assets].sort((a, b) => priority[a.type] - priority[b.type] || a.id.localeCompare(b.id));
}
