export const metadata = {
  title: "设计说明",
};

export default function AboutPage() {
  return (
    <article className="prose-page">
      <span className="eyebrow">DESIGN BASELINE</span>
      <h1>Localogue 为什么这样设计？</h1>
      <p>
        Localogue 当前的第一原则是：<strong>Canonical Library 是最终真相源</strong>。
        NFO、JSON、CSV、XLSX、人工录入以及未来的外部 API 都只是输入或交换方式。
      </p>
      <h2>V1 为什么先用 JSON？</h2>
      <p>
        因为 JSON 能让你直接打开文件理解实体结构，也能在 Git 中清楚看到 Diff。
        业务代码通过 Repository 隔离持久化细节，因此 V2 改用 SQLite 时，页面不应该整体推倒重写。
      </p>
      <h2>代码从哪里开始读？</h2>
      <ol>
        <li><code>src/domain/</code>：先理解“作品、人物是什么”。</li>
        <li><code>src/domain/repositories/</code>：理解页面为什么不直接读 JSON。</li>
        <li><code>src/infrastructure/repositories/</code>：看 JSON Repository 如何实现接口。</li>
        <li><code>src/application/services/</code>：看业务数据如何转换成页面所需结构。</li>
        <li><code>src/app/</code>：最后看 Next.js 页面如何组合这些能力。</li>
      </ol>
      <p>
        更完整的设计原因已经记录在 <code>docs/</code>，尤其是
        <code>docs/decisions/</code> 和 <code>docs/development/</code>。
      </p>
    </article>
  );
}
