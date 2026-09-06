import { DesktopCurationPage } from "./desktop-curation-page";
import { DesktopHistoryPage } from "./desktop-history-page";
import { GovernanceEmpty } from "./desktop-page-primitives";
import { DesktopReviewPage } from "./desktop-review-page";
import type { TauriLibraryRepository } from "./platform/tauri-library-repository";

export type GovernanceSection = "review" | "curation" | "history";

interface GovernanceProps {
  repository: TauriLibraryRepository;
  privateRoot: string | null;
  section: GovernanceSection;
  openWork: (id: string) => void;
  openPerson: (id: string) => void;
  onLibraryChanged: () => void;
  setMessage: (message: string) => void;
}

/**
 * Governance 是治理区域的薄路由层。
 *
 * 它只做两件事：统一检查 Private Library 写入前提，再把参数交给对应页面。
 * Review、Curation 与 History 各自拥有不同的业务用例，因此这里不保存它们的局部状态，
 * 也不直接读写任何审计集合。这样的入口可以让新增治理页面只修改路由组合。
 */
export function DesktopGovernance({
  repository,
  privateRoot,
  section,
  openWork,
  openPerson,
  onLibraryChanged,
  setMessage,
}: GovernanceProps) {
  if (!privateRoot) {
    return <GovernanceEmpty title="治理工作台" body="Governance 只允许写入 Private Library。请先在设置中配置私人资料库。" />;
  }
  if (section === "curation") {
    return <DesktopCurationPage repository={repository} openWork={openWork} openPerson={openPerson} onLibraryChanged={onLibraryChanged} setMessage={setMessage} />;
  }
  if (section === "history") {
    return <DesktopHistoryPage privateRoot={privateRoot} onLibraryChanged={onLibraryChanged} setMessage={setMessage} openWork={openWork} />;
  }
  return <DesktopReviewPage repository={repository} onLibraryChanged={onLibraryChanged} setMessage={setMessage} openWork={openWork} />;
}
