"use client";

import { useEffect, useState } from "react";

import { RATING_MAX } from "@/domain/entities/presentation-preference";
import type { UiDictionary } from "@/i18n/ui";

interface RatingStarsProps {
  workId: string;
  dictionary: UiDictionary;
}

/**
 * 作品个人评分（1–5 星）。
 *
 * 评分与收藏一样属于“展示偏好”私人层：初始值从 GET /api/presentation/work/{id} 读取，
 * 修改通过 PUT 同一接口写回。再次点击当前星级可清除评分（rating: null）。
 */
export function RatingStars({ workId, dictionary }: RatingStarsProps) {
  const [rating, setRating] = useState<number | null>(null);
  const [hover, setHover] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`/api/presentation/work/${workId}`)
      .then((response) => response.json())
      .then((data: { preference?: { rating?: number | null } }) => {
        if (!active) return;
        setRating(typeof data.preference?.rating === "number" ? data.preference.rating : null);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [workId]);

  async function rate(value: number) {
    // 再次点击当前星级 → 清除。
    const next = rating === value ? null : value;
    setRating(next);
    try {
      await fetch(`/api/presentation/work/${workId}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rating: next }),
      });
    } catch {
      // 写入失败时回退到本地原值，让用户感知到未保存。
      void loadLatest();
    }
  }

  async function loadLatest() {
    try {
      const response = await fetch(`/api/presentation/work/${workId}`);
      const data: { preference?: { rating?: number | null } } = await response.json();
      setRating(typeof data.preference?.rating === "number" ? data.preference.rating : null);
    } catch {
      /* 忽略 */
    }
  }

  return (
    <div className="rating-stars" aria-label={dictionary.yourRating}>
      <span className="rating-stars__label">{dictionary.yourRating}</span>
      <div
        className="rating-stars__icons"
        onMouseLeave={() => setHover(0)}
        role="radiogroup"
      >
        {Array.from({ length: RATING_MAX }, (_, index) => index + 1).map((value) => {
          const highlighted = (hover || rating || 0) >= value;
          return (
            <button
              className={`rating-stars__star${highlighted ? " is-active" : ""}`}
              key={value}
              onClick={() => rate(value)}
              onMouseEnter={() => setHover(value)}
              type="button"
              aria-label={`${value} / ${RATING_MAX}`}
              aria-checked={rating === value}
              role="radio"
            >
              <svg
                aria-hidden="true"
                fill={highlighted ? "currentColor" : "none"}
                height="20"
                stroke="currentColor"
                strokeWidth="1.6"
                viewBox="0 0 24 24"
                width="20"
              >
                <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.8 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z" />
              </svg>
            </button>
          );
        })}
      </div>
      {rating !== null ? (
        <button
          className="rating-stars__clear"
          onClick={() => rate(rating)}
          type="button"
        >
          {dictionary.clearRating}
        </button>
      ) : null}
      {!loaded ? <span className="rating-stars__hint" /> : null}
    </div>
  );
}
