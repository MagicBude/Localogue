# Localogue V1-01 交付清单

本文件用于快速检查这次覆盖仓库后应该出现的新增内容。

## 工程文件

- `package.json`
- `next.config.ts`
- `tsconfig.json`
- `eslint.config.mjs`
- `.nvmrc`
- `.env.example`

## Web

- `src/app/layout.tsx`
- `src/app/page.tsx`
- `src/app/works/page.tsx`
- `src/app/works/[id]/page.tsx`
- `src/app/people/page.tsx`
- `src/app/people/[id]/page.tsx`
- `src/app/about/page.tsx`
- `src/app/globals.css`

## 架构

- `src/domain/`
- `src/application/`
- `src/infrastructure/`
- `src/components/`
- `src/i18n/`
- `src/lib/`

## 示例数据

- `data/demo-library/works/`
- `data/demo-library/people/`
- `data/demo-library/organizations/`
- `data/demo-library/series/`
- `data/demo-library/genres/`
- `data/demo-library/tags/`
- `data/demo-library/assets/`
- `public/demo/`

所有 `DEMO-*` 内容与人物均为虚构演示资料。

## 新增教材文档

- `docs/development/learning-path.md`
- `docs/development/v1-foundation-walkthrough.md`
- `docs/development/json-repository-walkthrough.md`
- `docs/decisions/ADR-011-single-app-before-monorepo.md`
