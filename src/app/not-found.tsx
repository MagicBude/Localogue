import Link from "next/link";

export default function NotFound() {
  return (
    <section className="empty-state">
      <h1>没有找到这条资料</h1>
      <p>它可能尚未进入 Localogue，或者 ID 已发生变化。</p>
      <Link className="primary-button" href="/">
        返回首页
      </Link>
    </section>
  );
}
