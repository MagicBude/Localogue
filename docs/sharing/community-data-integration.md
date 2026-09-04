# Localogue 与 localogue-community-data 对接

正式 Community Data 仓库：

```text
https://github.com/MagicBude/localogue-community-data
```

## 结论：继续独立仓库维护

`Localogue` 与 `localogue-community-data` 应继续分成两个仓库：

```text
MagicBude/Localogue
└─ 程序、Schema、协议、Validator、虚构 Fixture、UI

MagicBude/localogue-community-data
└─ 可共享的公共事实元数据
```

不建议把真实 Community Data 直接复制回 Localogue 主仓库。

原因：

- 程序代码与公共数据的更新频率不同；
- Community Data 可以单独接受资料贡献，不要求贡献者参与应用开发；
- 数据仓库采用 CC0，共享许可边界可以保持清晰；
- 应用安装包不会随着公共资料持续增长；
- 同一个 Community Pack 可以被多个 Library Profile 选择性挂载；
- `Private Library > Shared Pack` 的覆盖语义保持自然。

## 当前已经可以直接接入

Community Data 本身已经输出 Localogue Shared Pack：

```text
localogue-community-data/
├─ localogue-pack.json
└─ library/
   ├─ people/
   ├─ works/
   ├─ organizations/
   ├─ series/
   └─ genres/
```

因此开发阶段最直接的使用方式仍然是 Git 目录挂载：

```bash
git clone https://github.com/MagicBude/localogue-community-data.git D:/Localogue-Packs/localogue-community-data
```

然后 Desktop：

```text
设置
→ 当前 Library Profile
→ 只读共享资料
→ 挂载资料包
→ D:/Localogue-Packs/localogue-community-data
→ 保存桌面设置
```

Localogue 会读取根目录 `localogue-pack.json`，并把 `library/` 作为只读数据层。

## 与 Library Profile 的关系

Shared Pack 现在属于 Library Profile。

例如：

```text
资料库 1
├─ Private: D:/Localogue/Libraries/library-1
└─ Shared:  community-pack-a

资料库 2
├─ Private: D:/Localogue/Libraries/library-2
└─ Shared:  localogue-community-data
```

这些只是中性示例；Localogue 不根据名称推断内容类型。

也可以让多个 Profile 共用同一个 Community Pack；共享的是只读公共事实，不会让两个 Private Library 自动合并。

## 两种接入方式

### Git 目录挂载

最适合开发与高频更新。

更新时：

```bash
cd D:/Localogue-Packs/localogue-community-data
git pull
```

然后 Localogue 刷新资料即可。

### Portable Pack 安装

适合普通用户和离线转发。Shared Library Archive 使用 `.localogue-pack` 传输，安装后仍按 Shared Pack 只读规则消费。

## 下一步：从“能挂载”升级成“一键社区资料”

长期不应该要求普通用户自己学 Git。

更适合的产品路线是：

```text
Community Pack Registry
        ↓
Localogue 显示官方/第三方 Pack
        ↓
一键下载 / 安装 / 更新
        ↓
绑定到当前 Library Profile
```

Registry 至少记录：

- Pack ID；
- 名称与描述；
- 当前版本；
- 下载地址；
- SHA-256；
- 许可；
- 兼容的 Localogue / Schema 版本；
- 更新时间。

这样 `localogue-community-data` 仍独立维护，而 Localogue 的用户体验可以做到“像内置资料源一样安装”。

## Validator 对齐

主项目 Community Validator 与 Community Data 的核心规则保持一致：

- 稳定 Community ID；
- Person 至少一个日文 primary name；
- Work 日文原题与番号；
- 人物、Maker/Label、Series、Genre 引用完整；
- 正式实体需要来源 / Evidence 记录；
- Community Data 不允许 MediaFile、Presentation Preference、用户 Tag、私人 Evidence；
- 图片只有在许可明确时才适合进入共享数据，不因“网页可见”自动获得再分发权。

Community 仓库自己的 `pnpm check` 仍然是发布前最终权威；主项目 Validator 是安装前防线，不取代数据仓库 CI。
