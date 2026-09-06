/**
 * Desktop 页面共享的纯展示组件。
 *
 * 这里只收纳跨页面重复、且语义已经稳定的标题、信息卡和治理状态块。
 * 组件不读取 Repository、不调用 Native Bridge，也不持有业务状态；这样复用样式时，
 * 不会把不同页面的查询和写入流程意外耦合到一个“万能组件”里。
 */

export function PageTitle({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <section className="page-title"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></section>;
}

export function InfoCard({ label, value }: { label: string; value?: string }) {
  return <article className="info-card"><span>{label}</span><strong>{value && value !== "—" ? value : "—"}</strong></article>;
}

export function GovernanceTitle({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return <header className="governance-title"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{body}</p></header>;
}

export function GovernanceEmpty({ title, body }: { title: string; body: string }) {
  return <section className="settings-card governance-empty"><h2>{title}</h2><p className="muted">{body}</p></section>;
}

export function GovernanceMetric({ label, value }: { label: string; value: number }) {
  return <div className="governance-metric"><span>{label}</span><strong>{value}</strong></div>;
}
