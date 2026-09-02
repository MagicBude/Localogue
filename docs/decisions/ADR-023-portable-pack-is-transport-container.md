# ADR-023：Portable Pack 是传输容器，不是新的资料模型

## 决策

V1-11 使用 gzip 压缩的版本化 JSON Envelope 作为 `.localogue-pack`；Shared/Personal 的实际资料结构仍然是现有文件化模型。

## 原因

- V1 不增加额外 ZIP 依赖；
- 每个文件都可记录 SHA-256；
- 安全路径规则易于审计；
- 未来换成流式 ZIP/TAR 不影响 Domain 与 Import Plan。

## 约束

Personal 导入默认不覆盖已存在文件；Shared 安装必须先完整校验再进入正式安装目录。
