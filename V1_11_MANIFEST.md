# Localogue V1-11 Manifest

## 阶段主题

**MediaFile Binding Governance + Portable Packs + Community Validator Integration**

## 新增页面

- `/media/[id]`：单个 MediaFile 绑定治理；
- `/packs`：Shared / Personal Pack 导出、预览、安装与迁移。

## 新增 Domain / Service

- `MediaBindingCandidate`
- `MediaBindingReceipt`
- `PortablePackManifest / Envelope / Preview / ImportResult`
- `MediaBindingService`
- `PortablePackService`
- `PortablePackCodec`
- `CommunityPackValidator`

## 新增 API

- `GET /api/media/[id]/candidates`
- `PUT /api/media/[id]/binding`
- `GET /api/packs/export`
- `POST /api/packs/import`

## 数据目录

新增私人审计目录：

```text
media-binding-receipts/
```

Shared Portable Pack 默认安装到 Git 忽略目录：

```text
.localogue/packs/
```

## 关键不变量

1. Candidate != 自动绑定；
2. 手工绑定需要 Receipt；
3. Personal Import 默认不覆盖；
4. Shared Install 先临时校验再正式可见；
5. Pack path 禁止目录穿越；
6. 文件必须通过 size + SHA-256；
7. Community Data 与私人运行数据继续严格隔离。

## 与 Community Data 的对接

主项目 Validator 对齐：

```text
https://github.com/MagicBude/localogue-community-data
```

当前 V0-01 核心协议：typed UUIDv4、Source Record、稳定引用、Community Work 不携带私人 MediaFile / Tag / 未授权 Asset。

## 验证

- Personal Pack 实际 export → preview → import；
- Community Data V0-01 fixture 实际 validate → export → install；
- MediaFile candidate → bind → unbind；
- Media Binding Receipt 实际生成，并验证 MediaFile 后续不存在时审计记录仍可自解释；
- Backend / UI 严格类型子集检查；
- 全部 TS / TSX 语法检查；
- Canonical / Audit 默认数据检查；
- ZIP 完整性检查。

- 修复 Next.js Pack 导出 API 在新版 TypeScript / DOM 类型下 `Uint8Array<ArrayBufferLike>` 无法直接作为 `BodyInit` 的兼容问题，导出响应显式转换为标准 `ArrayBuffer`。
