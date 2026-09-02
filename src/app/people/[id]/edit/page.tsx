import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getPreferredPersonName } from "@/application/services/localization-service";
import { PersonEditForm } from "@/components/person-edit-form";
import { isPrivateLibraryConfigured, libraryRepository } from "@/infrastructure/repositories/repository-provider";
import { getUserPreferences } from "@/lib/preferences";

interface PersonEditPageProps { params: Promise<{ id: string }> }

export const metadata: Metadata = { title: "编辑人物资料" };

export default async function PersonEditPage({ params }: PersonEditPageProps) {
  const [{ id }, preferences] = await Promise.all([params, getUserPreferences()]);
  const person = await libraryRepository.findPersonById(id);
  if (!person) notFound();
  const name = getPreferredPersonName(person, preferences.metadataLanguage);

  return (
    <div className="page-stack">
      <section className="page-title-row">
        <div>
          <span className="eyebrow">CURATION · PERSON EDITOR</span>
          <h1>{name}</h1>
          <p className="muted">{person.id}</p>
        </div>
        <Link className="secondary-button" href={`/people/${encodeURIComponent(person.id)}`}>← Profile</Link>
      </section>
      <PersonEditForm person={person} uiLanguage={preferences.uiLanguage} writable={isPrivateLibraryConfigured()} />
    </div>
  );
}
