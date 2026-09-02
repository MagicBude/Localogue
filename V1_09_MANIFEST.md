# Localogue V1-09 Manifest

## 版本主题

**实例设置中心、Shared Pack 与 Local Override 数据分层。**

## 新增路由

- `/settings`
- `GET /api/settings`
- `PUT /api/settings`

## 新增核心模块

- `src/domain/entities/instance-settings.ts`
- `src/domain/entities/shared-pack.ts`
- `src/application/settings/settings-service.ts`
- `src/infrastructure/settings/instance-settings-store.ts`
- `src/infrastructure/shared-packs/shared-pack-resolver.ts`
- `src/components/settings-form.tsx`
- `src/i18n/settings.ts`
- `scripts/lib/runtime-settings.mjs`

## 数据层变化

- `JsonFileStore` 支持多个只读根按 ID 合并。
- `JsonLibraryRepository` 拆分 `readRoots` 与 `writableRoot`。
- Private Library 同 ID 永远覆盖 Shared Pack。
- Shared Pack 顺序决定 Pack 间优先级。
- Demo 仅在没有真实数据源时启用。

## 新增规范与示例

- `schemas/shared-pack-manifest.schema.json`
- `examples/shared-packs/starter-community-pack/`

## 新增 ADR

- ADR-019：网页设置 + 环境变量最高优先级。
- ADR-020：Shared Base 只读 + Local Override。

## 下一步

V1-10 进入 Asset、MediaFile 与 Presentation Preference：实现头像/封面本地偏好优先，同时不妨碍社区事实资料更新。

## 额外设计冻结

- 新增社区稳定实体 ID 设计说明，禁止用可变姓名/标题作为长期共享身份。
- 新增 Presentation Preference 架构说明，为 V1-10 的本地优先头像/封面选择冻结语义。
- 明确 V1 Shared Pack 采用 whole-entity local override，不进行隐式字段 deep merge。
- 新增 Local-First 管理接口安全边界文档：V1 不应直接暴露到不受信任公网。
- `library:init` 默认只初始化空私人库；`library:init:demo` 才显式复制教学 Demo。
