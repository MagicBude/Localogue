import Link from "next/link";

import { PackImportWorkbench } from "@/components/pack-workbench";
import { getEffectiveLibraryConfiguration } from "@/infrastructure/repositories/library-path";
import { validateCommunityPackRoot } from "@/infrastructure/packs/community-pack-validator";
import { getUserPreferences } from "@/lib/preferences";
import { getUiDictionary } from "@/i18n/ui";

export const metadata = { title: "资料包" };

export default async function PacksPage() {
  const preferences = await getUserPreferences();
  const dictionary = getUiDictionary(preferences.uiLanguage);
  const config = getEffectiveLibraryConfiguration();
  const packRows = await Promise.all(config.sharedPacks.map(async (pack) => ({
    pack,
    validation: pack.valid ? await validateCommunityPackRoot(pack.absolutePath) : null,
  })));

  return <div className="page-stack">
    <section className="page-title-row"><div><span className="eyebrow">SHARED · PERSONAL · PORTABLE</span><h1>{dictionary.navPacks}</h1><p className="muted">管理 Community Shared Pack 与私人迁移包。Portable Pack 是传输容器，不改变 Shared Base / Private Override 的优先级。</p></div><Link className="secondary-button" href="/settings">{dictionary.navSettings}</Link></section>

    <section className="settings-card"><span className="eyebrow">PERSONAL BACKUP</span><h2>导出私人迁移包</h2><p className="muted">包含 Private Library 的 Canonical JSON、Evidence/History、Presentation Preference 与本地 Asset 文件；故意不包含 MediaFile 路径和实例设置，因为换电脑后这些路径通常已经失效。</p>{config.privateLibraryPath ? <a className="primary-button" href="/api/packs/export?kind=personal">导出 Personal Pack</a> : <p className="warning-text">请先配置 Private Library。</p>}</section>

    <PackImportWorkbench />

    <section className="detail-section"><div className="section-heading-row"><div><span className="eyebrow">MOUNTED SHARED PACKS</span><h2>当前共享资料包</h2></div></div>
      <div className="pack-list">{packRows.length ? packRows.map(({ pack, validation }) => <article className="settings-card" key={pack.configuredPath}>
        <div className="section-heading-row"><div><strong>{pack.manifest?.name ?? pack.configuredPath}</strong><p className="muted">{pack.manifest ? `${pack.manifest.id} · ${pack.manifest.version}` : pack.error}</p></div>{pack.valid && validation?.valid ? <span className="status-chip status-chip--ok">VALID</span> : <span className="status-chip status-chip--warn">CHECK</span>}</div>
        {validation ? <><p className="muted">people {validation.counts.people} · works {validation.counts.works} · organizations {validation.counts.organizations} · series {validation.counts.series} · genres {validation.counts.genres}</p>{validation.errors.slice(0,5).map((item)=><p className="error-text" key={item}>{item}</p>)}{validation.warnings.slice(0,3).map((item)=><p className="warning-text" key={item}>{item}</p>)}</> : null}
        {pack.valid && validation?.valid ? <a className="secondary-button" href={`/api/packs/export?kind=shared&path=${encodeURIComponent(pack.configuredPath)}`}>导出便携 Shared Pack</a> : null}
      </article>) : <p className="muted">当前没有配置 Shared Pack。你可以在设置页挂载 localogue-community-data，或者导入一个 `.localogue-pack`。</p>}</div>
    </section>
  </div>;
}
