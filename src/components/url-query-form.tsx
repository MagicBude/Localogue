"use client";

import type { FormEvent, ReactNode } from "react";
import { useRouter } from "next/navigation";

interface UrlQueryFormProps {
  action: string;
  className?: string;
  children?: ReactNode;
  preserveScroll?: boolean;
}

/**
 * GET 筛选表单的客户端薄包装。
 *
 * 普通 HTML GET form 提交会触发完整导航，浏览器通常把新页面放回顶部。
 * 对长筛选页来说体验很差，所以这里只接管“导航动作”：
 * 1. 仍然用 FormData 收集标准 HTML 表单值；
 * 2. 仍然把状态写进 URL Query String；
 * 3. 仅用 router.push(..., { scroll: false }) 告诉 Next.js 保留当前滚动位置。
 *
 * 因此我们没有牺牲可分享 URL，也没有引入额外状态管理库。
 */
export function UrlQueryForm({
  action,
  className,
  children,
  preserveScroll = true,
}: UrlQueryFormProps) {
  const router = useRouter();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const params = new URLSearchParams();
    for (const [key, value] of formData.entries()) {
      if (typeof value !== "string" || value === "") continue;
      params.append(key, value);
    }

    const query = params.toString();
    router.push(query ? `${action}?${query}` : action, { scroll: !preserveScroll });
  }

  return (
    <form action={action} className={className} method="get" onSubmit={handleSubmit}>
      {children}
    </form>
  );
}
