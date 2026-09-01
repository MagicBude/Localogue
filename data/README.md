# 数据目录

V1 明确区分“公开演示资料”和“用户私人资料”。

## `demo-library/`

仓库自带、可以提交 Git 的虚构示例资料。

```text
data/demo-library/
├── works/
├── people/
├── organizations/
├── series/
├── genres/
├── tags/
├── assets/
├── evidence/
└── indexes/
```

这里的 `DEMO-*` 作品、人物、厂商、系列全部是虚构内容，只用于开发、测试和学习。

## `library/`

为真实个人资料预留的默认本地目录，已经通过 `.gitignore` 排除。

使用真实资料时，可把 `.env.example` 复制为 `.env.local`：

```bash
LOCALOGUE_LIBRARY_PATH=./data/library
```

也可以指向仓库之外的绝对路径，例如 NAS 或独立数据盘。

## 为什么要分开

源码仓库通常会推送到 GitHub，而个人资料库不应该因为一次 `git add .` 被误提交。

因此 Localogue 从 V1 起就把：

```text
代码 / Demo 数据
```

和：

```text
真实个人资料
```

物理隔离。
