PRAGMA foreign_keys = ON;

CREATE TABLE catalog_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
) STRICT;

CREATE TABLE works (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  original_language TEXT,
  title_ja TEXT,
  title_zh_cn TEXT,
  title_en TEXT,
  release_date TEXT,
  maker_id TEXT,
  label_id TEXT,
  json TEXT NOT NULL
) STRICT;
CREATE UNIQUE INDEX works_code_normalized_idx ON works(upper(replace(replace(code, '-', ''), '_', '')));
CREATE INDEX works_release_date_idx ON works(release_date);

CREATE TABLE people (
  id TEXT PRIMARY KEY,
  primary_name TEXT,
  activity_status TEXT,
  birth_date TEXT,
  json TEXT NOT NULL
) STRICT;

CREATE TABLE organizations (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  name_ja TEXT,
  name_zh_cn TEXT,
  name_en TEXT,
  parent_organization_id TEXT,
  json TEXT NOT NULL
) STRICT;
CREATE INDEX organizations_kind_idx ON organizations(kind);

CREATE TABLE series (
  id TEXT PRIMARY KEY,
  name_ja TEXT,
  name_zh_cn TEXT,
  name_en TEXT,
  maker_id TEXT,
  label_id TEXT,
  json TEXT NOT NULL
) STRICT;

CREATE TABLE genres (
  id TEXT PRIMARY KEY,
  facet TEXT,
  name_ja TEXT,
  name_zh_cn TEXT,
  name_en TEXT,
  status TEXT,
  json TEXT NOT NULL
) STRICT;

CREATE TABLE work_type_definitions (
  id TEXT PRIMARY KEY,
  name_ja TEXT NOT NULL,
  name_zh_cn TEXT NOT NULL,
  name_en TEXT NOT NULL,
  json TEXT NOT NULL
) STRICT;

CREATE TABLE source_only_classifications (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  name_ja TEXT NOT NULL,
  name_zh_cn TEXT NOT NULL,
  name_en TEXT NOT NULL,
  json TEXT NOT NULL
) STRICT;

CREATE TABLE classification_crosswalk (
  community_id TEXT PRIMARY KEY,
  target_kind TEXT NOT NULL,
  target_id TEXT NOT NULL,
  decision TEXT NOT NULL,
  json TEXT NOT NULL
) STRICT;

CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  name_ja TEXT,
  name_zh_cn TEXT,
  name_en TEXT,
  json TEXT NOT NULL
) STRICT;

CREATE TABLE assets (
  id TEXT PRIMARY KEY,
  asset_type TEXT,
  subject_type TEXT,
  subject_id TEXT,
  storage_path TEXT,
  json TEXT NOT NULL
) STRICT;

CREATE TABLE localized_names (
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  language TEXT NOT NULL,
  name_kind TEXT NOT NULL,
  value TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (entity_type, entity_id, language, name_kind, value)
) STRICT;
CREATE INDEX localized_names_lookup_idx ON localized_names(value);

CREATE TABLE work_people (
  work_id TEXT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  person_id TEXT NOT NULL,
  role TEXT NOT NULL,
  billing_order INTEGER,
  PRIMARY KEY (work_id, person_id, role)
) STRICT;

CREATE TABLE work_genres (
  work_id TEXT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  genre_id TEXT NOT NULL,
  PRIMARY KEY (work_id, genre_id)
) STRICT;

CREATE TABLE work_tags (
  work_id TEXT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL,
  PRIMARY KEY (work_id, tag_id)
) STRICT;

CREATE TABLE work_types (
  work_id TEXT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  work_type_id TEXT NOT NULL,
  PRIMARY KEY (work_id, work_type_id)
) STRICT;

CREATE TABLE work_source_classifications (
  work_id TEXT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  source_only_id TEXT NOT NULL REFERENCES source_only_classifications(id),
  PRIMARY KEY (work_id, source_only_id)
) STRICT;

CREATE TABLE work_unmapped_classifications (
  work_id TEXT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  source_classification_id TEXT NOT NULL,
  PRIMARY KEY (work_id, source_classification_id)
) STRICT;

CREATE TABLE work_series (
  work_id TEXT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  series_id TEXT NOT NULL,
  PRIMARY KEY (work_id, series_id)
) STRICT;

CREATE TABLE provider_entities (
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  PRIMARY KEY (provider, provider_id, entity_type)
) STRICT;
CREATE INDEX provider_entities_target_idx ON provider_entities(entity_type, entity_id);

PRAGMA user_version = 1;
