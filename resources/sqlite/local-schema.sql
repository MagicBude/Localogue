PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;

CREATE TABLE local_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
) STRICT;

CREATE TABLE private_entities (
  collection TEXT NOT NULL,
  id TEXT NOT NULL,
  display_key TEXT,
  updated_at TEXT,
  json TEXT NOT NULL CHECK (json_valid(json)),
  PRIMARY KEY (collection, id)
) STRICT;
CREATE INDEX private_entities_collection_display_idx ON private_entities(collection, display_key);

CREATE VIEW works AS SELECT id, display_key AS code, updated_at, json FROM private_entities WHERE collection = 'works';
CREATE VIEW people AS SELECT id, display_key AS primary_name, updated_at, json FROM private_entities WHERE collection = 'people';
CREATE VIEW organizations AS SELECT id, display_key AS name, updated_at, json FROM private_entities WHERE collection = 'organizations';
CREATE VIEW series AS SELECT id, display_key AS name, updated_at, json FROM private_entities WHERE collection = 'series';
CREATE VIEW genres AS SELECT id, display_key AS name, updated_at, json FROM private_entities WHERE collection = 'genres';
CREATE VIEW tags AS SELECT id, display_key AS name, updated_at, json FROM private_entities WHERE collection = 'tags';
CREATE VIEW assets AS SELECT id, display_key AS storage_path, updated_at, json FROM private_entities WHERE collection = 'assets';

CREATE TABLE media_files (
  id TEXT PRIMARY KEY,
  path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  work_id TEXT,
  scan_root TEXT,
  match_method TEXT,
  modified_at TEXT,
  json TEXT NOT NULL CHECK (json_valid(json))
) STRICT;
CREATE INDEX media_files_work_idx ON media_files(work_id);
CREATE INDEX media_files_scan_root_idx ON media_files(scan_root);
CREATE UNIQUE INDEX media_files_path_idx ON media_files(path);

CREATE TABLE presentation_preferences (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  favorite INTEGER CHECK (favorite IN (0, 1) OR favorite IS NULL),
  rating INTEGER CHECK (rating BETWEEN 1 AND 5 OR rating IS NULL),
  preferred_asset_id TEXT,
  updated_at TEXT NOT NULL,
  json TEXT NOT NULL CHECK (json_valid(json))
) STRICT;
CREATE UNIQUE INDEX presentation_subject_idx ON presentation_preferences(entity_type, entity_id);

CREATE TABLE evidence (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL,
  source_name TEXT NOT NULL,
  imported_at TEXT NOT NULL,
  target_hint TEXT,
  json TEXT NOT NULL CHECK (json_valid(json))
) STRICT;
CREATE INDEX evidence_source_idx ON evidence(source_type, source_name);

CREATE TABLE audit_records (
  collection TEXT NOT NULL,
  id TEXT NOT NULL,
  subject_id TEXT,
  occurred_at TEXT,
  json TEXT NOT NULL CHECK (json_valid(json)),
  PRIMARY KEY (collection, id)
) STRICT;
CREATE INDEX audit_records_subject_idx ON audit_records(collection, subject_id);

CREATE TABLE migration_receipts (
  id INTEGER PRIMARY KEY,
  migrated_at TEXT NOT NULL,
  source_path TEXT NOT NULL,
  source_digest TEXT NOT NULL,
  entity_count INTEGER NOT NULL,
  media_count INTEGER NOT NULL,
  preference_count INTEGER NOT NULL,
  evidence_count INTEGER NOT NULL,
  audit_count INTEGER NOT NULL
) STRICT;

PRAGMA user_version = 1;

