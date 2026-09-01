# Localogue V1-04 交付清单

## 版本主题

**Evidence-first 文件导入基础。**

## 用户反馈修复

- [x] 修复点击“应用筛选”后页面跳回顶部；
- [x] 保留 GET Query String 与可分享 URL；
- [x] 使用 Next.js 客户端导航保留当前滚动位置。

## 新增导入功能

- [x] `/import` 导入工作台；
- [x] 文件上传预览；
- [x] JSON 粘贴预览；
- [x] JSON Importer；
- [x] NFO Importer；
- [x] CSV Importer；
- [x] XLSX Importer；
- [x] 统一 Normalizer；
- [x] 基础 Validator；
- [x] Evidence Preview；
- [x] 原始数据与规范化数据对照；
- [x] 解析警告展示；
- [x] Evidence 保存到私人资料目录；
- [x] 导入不直接修改 Canonical Work / Person；
- [x] JSON / NFO / CSV / XLSX 虚构示例文件。

## 新依赖

- `fast-xml-parser`：NFO/XML 解析；
- `exceljs`：XLSX 读取。

## 学习文档

- `docs/development/v1-04-import-pipeline-walkthrough.md`
- `docs/development/v1-04-filter-submit-scroll.md`
- `docs/import/v1-04-supported-formats.md`
- `docs/import/evidence-storage.md`

## 本地检查

```bash
pnpm install
pnpm check
pnpm dev
```

建议再使用 `examples/imports/` 下四种示例文件逐一测试 `/import`。
