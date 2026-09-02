# V1 JSON Snapshot 与恢复策略

## 目标

JSON 文件没有跨文件 ACID Transaction。V1-07 用最小 Snapshot 提高可恢复性，同时明确它不是数据库事务的等价替代品。

## 最小 Snapshot

每次 Commit 只保存**本次即将触碰的文件**，不复制整个 Library。

例如更新一个已有 Work：

```text
snapshots/snapshot_xxx.json
├── works/work_demo_001.json          existed=true
├── provenance/work_demo_001.json     existed=true/false
└── evidence-lifecycle/evidence_x.json existed=true/false
```

如果本次还准备新建演员、Maker、Series，则相应实体文件也进入 Snapshot，并记录 `existed=false`。

## before-image

数据库领域常把“修改之前的旧值”称为 before-image。

Snapshot Entry：

```json
{
  "relativePath": "works/work_demo_001.json",
  "existed": true,
  "content": "...提交前完整 JSON 文本..."
}
```

新建文件则：

```json
{
  "relativePath": "people/person_new_x.json",
  "existed": false
}
```

恢复时：

- `existed=true` → 写回旧内容；
- `existed=false` → 删除 Commit 新建的文件。

## 两种恢复模式

### 自动失败回滚

Commit 还没有成功，因此应尽量让系统回到“这次操作从未发生”的状态。

包括恢复 Provenance。

### 用户主动历史恢复

成功 Commit 是真实历史，不能删除审计记录。

因此：

- Canonical Entity 恢复；
- Evidence 生命周期回到 pending；
- 原 Provenance 保留；
- 追加 `restored` Provenance Event；
- 新建 Restore Receipt。

## 路径安全

Snapshot 只允许相对路径，并拒绝：

- 绝对路径；
- `..` 路径穿越；
- 越过私人 Library Root 的目标。

这避免被篡改的 Snapshot 写到资料库以外。

## 当前局限

1. 多文件恢复仍然不是单一原子操作；
2. 极端磁盘故障仍可能打断恢复过程；
3. Snapshot 目前没有压缩；
4. 目前只处理 Localogue Canonical JSON，不处理媒体大文件。

这些局限会在 V2 SQLite 和后续备份策略中继续解决。


## 恢复操作自身也需要保护

V1-07 在执行“用户主动恢复”之前，还会针对同一组文件在内存中捕获一份临时 guard snapshot。它与持久化的 Canonical Snapshot 用途不同：

- 持久化 Snapshot 是某次 Canonical Commit 的 before-image，用于以后主动恢复；
- guard snapshot 只服务于当前恢复动作，如果恢复过程中写文件、更新 Lifecycle 或写 Restore Receipt 失败，就用它把“恢复动作开始前”的状态补偿回来；
- guard snapshot 不写入长期历史目录，因为它不是用户资料版本，只是一次命令执行期间的安全网。

这仍然不能把 JSON 文件系统变成真正的 ACID Transaction，但可以显著降低“恢复到一半失败”留下半完成状态的概率。V2 SQLite 会把这类跨文件补偿逻辑收敛到真正的数据库事务。
