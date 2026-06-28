use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;
use std::path::Path;
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncState {
    pub file_path: String,
    pub local_hash: Option<String>,
    pub remote_hash: Option<String>,
    pub ancestor_hash: Option<String>,
    pub local_mtime: Option<i64>,
    pub remote_mtime: Option<i64>,
    pub sync_status: String,
    pub last_synced_at: Option<i64>,
    pub server_version_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NoteSyncMetadata {
    pub created_at: Option<String>,
    pub created_by: Option<String>,
    pub last_edited_at: Option<String>,
    pub last_edited_by: Option<String>,
    pub last_device_id: Option<String>,
    pub synced: bool,
    #[serde(skip_serializing)]
    pub creation_lookup_complete: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QueueRow {
    pub id: String,
    pub op_type: String,
    pub path: String,
    pub extra_data: Option<String>,
    pub source_event_id: Option<String>,
    pub priority: u32,
    pub retry_count: u32,
    pub max_retries: u32,
    pub created_at: i64,
    pub next_retry_at: Option<i64>,
    pub last_error: Option<String>,
    pub status: String,
}

pub struct SyncDb {
    conn: Mutex<Connection>,
}

impl SyncDb {
    pub fn open(vault_path: &str) -> Result<Self, String> {
        let db_path = Path::new(vault_path).join(".cortex").join("sync.db");
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS sync_state (
                file_path TEXT PRIMARY KEY,
                local_hash TEXT,
                remote_hash TEXT,
                ancestor_hash TEXT,
                local_mtime INTEGER,
                remote_mtime INTEGER,
                sync_status TEXT NOT NULL DEFAULT 'unknown',
                last_synced_at INTEGER,
                server_version_id TEXT
            );

            CREATE TABLE IF NOT EXISTS sync_queue (
                id TEXT PRIMARY KEY,
                op_type TEXT NOT NULL,
                path TEXT NOT NULL,
                extra_data TEXT,
                source_event_id TEXT,
                priority INTEGER NOT NULL DEFAULT 60,
                retry_count INTEGER NOT NULL DEFAULT 0,
                max_retries INTEGER NOT NULL DEFAULT 10,
                created_at INTEGER NOT NULL,
                next_retry_at INTEGER,
                last_error TEXT,
                status TEXT NOT NULL DEFAULT 'pending'
            );

            CREATE TABLE IF NOT EXISTS sync_metadata (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS sync_note_metadata (
                file_path TEXT PRIMARY KEY,
                created_at TEXT,
                created_by TEXT,
                last_edited_at TEXT,
                last_edited_by TEXT,
                last_device_id TEXT,
                creation_lookup_complete INTEGER NOT NULL DEFAULT 0
            );",
        )
        .map_err(|e| e.to_string())?;
        let has_creation_lookup_complete = {
            let mut statement = conn
                .prepare("PRAGMA table_info(sync_note_metadata)")
                .map_err(|error| error.to_string())?;
            let columns = statement
                .query_map([], |row| row.get::<_, String>(1))
                .map_err(|error| error.to_string())?;
            let mut found = false;
            for column in columns {
                if column.map_err(|error| error.to_string())? == "creation_lookup_complete" {
                    found = true;
                    break;
                }
            }
            found
        };
        if !has_creation_lookup_complete {
            conn.execute(
                "ALTER TABLE sync_note_metadata
                 ADD COLUMN creation_lookup_complete INTEGER NOT NULL DEFAULT 0",
                [],
            )
            .map_err(|error| error.to_string())?;
        }
        let has_source_event_id = {
            let mut statement = conn
                .prepare("PRAGMA table_info(sync_queue)")
                .map_err(|error| error.to_string())?;
            let columns = statement
                .query_map([], |row| row.get::<_, String>(1))
                .map_err(|error| error.to_string())?;
            let mut found = false;
            for column in columns {
                if column.map_err(|error| error.to_string())? == "source_event_id" {
                    found = true;
                    break;
                }
            }
            found
        };
        if !has_source_event_id {
            conn.execute(
                "ALTER TABLE sync_queue
                 ADD COLUMN source_event_id TEXT",
                [],
            )
            .map_err(|error| error.to_string())?;
        }
        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    pub fn get_sync_state(&self, file_path: &str) -> Result<Option<SyncState>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.query_row(
            "SELECT file_path, local_hash, remote_hash, ancestor_hash, local_mtime, remote_mtime, sync_status, last_synced_at, server_version_id FROM sync_state WHERE file_path = ?1",
            params![file_path],
            |row| {
                Ok(SyncState {
                    file_path: row.get(0)?,
                    local_hash: row.get(1)?,
                    remote_hash: row.get(2)?,
                    ancestor_hash: row.get(3)?,
                    local_mtime: row.get(4)?,
                    remote_mtime: row.get(5)?,
                    sync_status: row.get(6)?,
                    last_synced_at: row.get(7)?,
                    server_version_id: row.get(8)?,
                })
            },
        )
        .optional()
        .map_err(|e| e.to_string())
    }

    pub fn upsert_sync_state(&self, state: &SyncState) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO sync_state (file_path, local_hash, remote_hash, ancestor_hash, local_mtime, remote_mtime, sync_status, last_synced_at, server_version_id)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
             ON CONFLICT(file_path) DO UPDATE SET
                local_hash = excluded.local_hash,
                remote_hash = excluded.remote_hash,
                ancestor_hash = excluded.ancestor_hash,
                local_mtime = excluded.local_mtime,
                remote_mtime = excluded.remote_mtime,
                sync_status = excluded.sync_status,
                last_synced_at = excluded.last_synced_at,
                server_version_id = excluded.server_version_id",
            params![
                state.file_path,
                state.local_hash,
                state.remote_hash,
                state.ancestor_hash,
                state.local_mtime,
                state.remote_mtime,
                state.sync_status,
                state.last_synced_at,
                state.server_version_id,
            ],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn list_all_sync_states(&self) -> Result<Vec<SyncState>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare("SELECT file_path, local_hash, remote_hash, ancestor_hash, local_mtime, remote_mtime, sync_status, last_synced_at, server_version_id FROM sync_state")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| {
                Ok(SyncState {
                    file_path: row.get(0)?,
                    local_hash: row.get(1)?,
                    remote_hash: row.get(2)?,
                    ancestor_hash: row.get(3)?,
                    local_mtime: row.get(4)?,
                    remote_mtime: row.get(5)?,
                    sync_status: row.get(6)?,
                    last_synced_at: row.get(7)?,
                    server_version_id: row.get(8)?,
                })
            })
            .map_err(|e| e.to_string())?;
        let mut states = Vec::new();
        for row in rows {
            states.push(row.map_err(|e| e.to_string())?);
        }
        Ok(states)
    }

    pub fn delete_sync_state(&self, file_path: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "DELETE FROM sync_state WHERE file_path = ?1",
            params![file_path],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn get_note_metadata(&self, file_path: &str) -> Result<Option<NoteSyncMetadata>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.query_row(
            "SELECT created_at, created_by, last_edited_at, last_edited_by, last_device_id,
                    creation_lookup_complete
             FROM sync_note_metadata WHERE file_path = ?1",
            params![file_path],
            |row| {
                Ok(NoteSyncMetadata {
                    created_at: row.get(0)?,
                    created_by: row.get(1)?,
                    last_edited_at: row.get(2)?,
                    last_edited_by: row.get(3)?,
                    last_device_id: row.get(4)?,
                    synced: true,
                    creation_lookup_complete: row.get::<_, i64>(5)? != 0,
                })
            },
        )
        .optional()
        .map_err(|e| e.to_string())
    }

    pub fn upsert_note_metadata(
        &self,
        file_path: &str,
        metadata: &NoteSyncMetadata,
    ) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO sync_note_metadata (
                file_path, created_at, created_by, last_edited_at, last_edited_by, last_device_id,
                creation_lookup_complete
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
             ON CONFLICT(file_path) DO UPDATE SET
                created_at = COALESCE(sync_note_metadata.created_at, excluded.created_at),
                created_by = COALESCE(sync_note_metadata.created_by, excluded.created_by),
                last_edited_at = COALESCE(excluded.last_edited_at, sync_note_metadata.last_edited_at),
                last_edited_by = COALESCE(excluded.last_edited_by, sync_note_metadata.last_edited_by),
                last_device_id = COALESCE(excluded.last_device_id, sync_note_metadata.last_device_id),
                creation_lookup_complete = MAX(
                    sync_note_metadata.creation_lookup_complete,
                    excluded.creation_lookup_complete
                )",
            params![
                file_path,
                metadata.created_at,
                metadata.created_by,
                metadata.last_edited_at,
                metadata.last_edited_by,
                metadata.last_device_id,
                metadata.creation_lookup_complete,
            ],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn list_incomplete_creation_metadata(&self) -> Result<Vec<String>, String> {
        let conn = self.conn.lock().map_err(|error| error.to_string())?;
        let mut statement = conn
            .prepare(
                "SELECT file_path
                 FROM sync_note_metadata
                 WHERE creation_lookup_complete = 0
                 ORDER BY file_path",
            )
            .map_err(|error| error.to_string())?;
        let rows = statement
            .query_map([], |row| row.get::<_, String>(0))
            .map_err(|error| error.to_string())?;
        let mut paths = Vec::new();
        for row in rows {
            paths.push(row.map_err(|error| error.to_string())?);
        }
        Ok(paths)
    }

    pub fn rename_note_metadata(&self, old_path: &str, new_path: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "UPDATE sync_note_metadata SET file_path = ?2 WHERE file_path = ?1",
            params![old_path, new_path],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn enqueue_op(&self, row: &QueueRow) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO sync_queue (id, op_type, path, extra_data, source_event_id, priority, retry_count, max_retries, created_at, next_retry_at, last_error, status)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
             ON CONFLICT(id) DO UPDATE SET
                source_event_id = excluded.source_event_id,
                retry_count = excluded.retry_count,
                next_retry_at = excluded.next_retry_at,
                last_error = excluded.last_error,
                status = excluded.status",
            params![
                row.id,
                row.op_type,
                row.path,
                row.extra_data,
                row.source_event_id,
                row.priority,
                row.retry_count,
                row.max_retries,
                row.created_at,
                row.next_retry_at,
                row.last_error,
                row.status,
            ],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn load_pending_queue(&self, now: i64) -> Result<Vec<QueueRow>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare(
                "SELECT id, op_type, path, extra_data, source_event_id, priority, retry_count, max_retries, created_at, next_retry_at, last_error, status
                 FROM sync_queue
                 WHERE status = 'pending' AND (next_retry_at IS NULL OR next_retry_at <= ?1)
                 ORDER BY priority DESC, created_at ASC",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![now], |row| {
                Ok(QueueRow {
                    id: row.get(0)?,
                    op_type: row.get(1)?,
                    path: row.get(2)?,
                    extra_data: row.get(3)?,
                    source_event_id: row.get(4)?,
                    priority: row.get(5)?,
                    retry_count: row.get(6)?,
                    max_retries: row.get(7)?,
                    created_at: row.get(8)?,
                    next_retry_at: row.get(9)?,
                    last_error: row.get(10)?,
                    status: row.get(11)?,
                })
            })
            .map_err(|e| e.to_string())?;
        let mut result = Vec::new();
        for row in rows {
            result.push(row.map_err(|e| e.to_string())?);
        }
        Ok(result)
    }

    pub fn load_duplicate_queue_ops(
        &self,
        op_type: &str,
        path: &str,
    ) -> Result<Vec<QueueRow>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare(
                "SELECT id, op_type, path, extra_data, source_event_id, priority, retry_count, max_retries, created_at, next_retry_at, last_error, status
                 FROM sync_queue
                 WHERE op_type = ?1 AND path = ?2",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![op_type, path], |row| {
                Ok(QueueRow {
                    id: row.get(0)?,
                    op_type: row.get(1)?,
                    path: row.get(2)?,
                    extra_data: row.get(3)?,
                    source_event_id: row.get(4)?,
                    priority: row.get(5)?,
                    retry_count: row.get(6)?,
                    max_retries: row.get(7)?,
                    created_at: row.get(8)?,
                    next_retry_at: row.get(9)?,
                    last_error: row.get(10)?,
                    status: row.get(11)?,
                })
            })
            .map_err(|e| e.to_string())?;
        let mut result = Vec::new();
        for row in rows {
            result.push(row.map_err(|e| e.to_string())?);
        }
        Ok(result)
    }

    pub fn list_queued_source_event_ids(&self) -> Result<Vec<String>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare(
                "SELECT source_event_id
                 FROM sync_queue
                 WHERE source_event_id IS NOT NULL",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| row.get::<_, String>(0))
            .map_err(|e| e.to_string())?;
        let mut result = Vec::new();
        for row in rows {
            result.push(row.map_err(|e| e.to_string())?);
        }
        Ok(result)
    }

    pub fn mark_queue_completed(&self, id: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM sync_queue WHERE id = ?1", params![id])
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn mark_queue_failed(
        &self,
        id: &str,
        error: &str,
        next_retry_at: Option<i64>,
    ) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "UPDATE sync_queue SET retry_count = retry_count + 1, last_error = ?2, next_retry_at = ?3, status = CASE WHEN retry_count + 1 >= max_retries THEN 'dead' ELSE 'pending' END WHERE id = ?1",
            params![id, error, next_retry_at],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn mark_queue_dead(&self, id: &str, error: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "UPDATE sync_queue SET status = 'dead', last_error = ?2 WHERE id = ?1",
            params![id, error],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn remove_duplicate_queue_op(&self, op_type: &str, path: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "DELETE FROM sync_queue WHERE op_type = ?1 AND path = ?2",
            params![op_type, path],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn remove_queue_ops_by_type(&self, op_type: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "DELETE FROM sync_queue WHERE op_type = ?1",
            params![op_type],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    #[allow(dead_code)]
    pub fn clear_queue(&self) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM sync_queue", [])
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    #[allow(dead_code)]
    pub fn dead_letter_count(&self) -> Result<usize, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sync_queue WHERE status = 'dead'",
                [],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;
        Ok(count as usize)
    }

    pub fn get_metadata(&self, key: &str) -> Result<Option<String>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.query_row(
            "SELECT value FROM sync_metadata WHERE key = ?1",
            params![key],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())
    }

    pub fn set_metadata(&self, key: &str, value: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO sync_metadata (key, value) VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![key, value],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    #[allow(dead_code)]
    pub fn delete_metadata(&self, key: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM sync_metadata WHERE key = ?1", params![key])
            .map_err(|e| e.to_string())?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    #[test]
    fn note_metadata_preserves_creation_and_updates_last_edit() {
        let directory =
            std::env::temp_dir().join(format!("cortex-sync-metadata-{}", Uuid::new_v4()));
        let db = SyncDb::open(directory.to_str().unwrap()).unwrap();
        db.upsert_note_metadata(
            "note.md",
            &NoteSyncMetadata {
                created_at: Some("2026-01-01T00:00:00Z".to_string()),
                created_by: Some("user-1".to_string()),
                last_edited_at: Some("2026-01-02T00:00:00Z".to_string()),
                last_edited_by: Some("user-1".to_string()),
                last_device_id: Some("device-1".to_string()),
                synced: true,
                creation_lookup_complete: true,
            },
        )
        .unwrap();
        db.upsert_note_metadata(
            "note.md",
            &NoteSyncMetadata {
                created_at: Some("2026-02-01T00:00:00Z".to_string()),
                created_by: Some("user-2".to_string()),
                last_edited_at: Some("2026-02-02T00:00:00Z".to_string()),
                last_edited_by: Some("user-2".to_string()),
                last_device_id: Some("device-2".to_string()),
                synced: true,
                creation_lookup_complete: true,
            },
        )
        .unwrap();

        let metadata = db.get_note_metadata("note.md").unwrap().unwrap();
        assert_eq!(metadata.created_at.as_deref(), Some("2026-01-01T00:00:00Z"));
        assert_eq!(metadata.created_by.as_deref(), Some("user-1"));
        assert_eq!(
            metadata.last_edited_at.as_deref(),
            Some("2026-02-02T00:00:00Z")
        );
        assert_eq!(metadata.last_edited_by.as_deref(), Some("user-2"));

        db.rename_note_metadata("note.md", "renamed.md").unwrap();
        assert!(db.get_note_metadata("note.md").unwrap().is_none());
        assert!(db.get_note_metadata("renamed.md").unwrap().is_some());
        drop(db);
        std::fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn migrates_legacy_note_metadata_and_tracks_incomplete_creation() {
        let directory =
            std::env::temp_dir().join(format!("cortex-sync-metadata-legacy-{}", Uuid::new_v4()));
        let cortex_directory = directory.join(".cortex");
        std::fs::create_dir_all(&cortex_directory).unwrap();
        let connection = Connection::open(cortex_directory.join("sync.db")).unwrap();
        connection
            .execute_batch(
                "CREATE TABLE sync_note_metadata (
                    file_path TEXT PRIMARY KEY,
                    created_at TEXT,
                    created_by TEXT,
                    last_edited_at TEXT,
                    last_edited_by TEXT,
                    last_device_id TEXT
                );
                INSERT INTO sync_note_metadata (
                    file_path, last_edited_at, last_edited_by
                ) VALUES (
                    'legacy.md', '2026-06-14T00:00:00Z', 'user-2'
                );",
            )
            .unwrap();
        drop(connection);

        let db = SyncDb::open(directory.to_str().unwrap()).unwrap();

        assert_eq!(
            db.list_incomplete_creation_metadata().unwrap(),
            vec!["legacy.md"]
        );
        let metadata = db.get_note_metadata("legacy.md").unwrap().unwrap();
        assert!(!metadata.creation_lookup_complete);
        drop(db);
        std::fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn completed_creation_metadata_is_not_scheduled_again() {
        let directory =
            std::env::temp_dir().join(format!("cortex-sync-metadata-complete-{}", Uuid::new_v4()));
        let db = SyncDb::open(directory.to_str().unwrap()).unwrap();
        db.upsert_note_metadata(
            "note.md",
            &NoteSyncMetadata {
                created_at: Some("2026-01-01T00:00:00Z".to_string()),
                created_by: Some("user-1".to_string()),
                last_edited_at: None,
                last_edited_by: None,
                last_device_id: None,
                synced: true,
                creation_lookup_complete: true,
            },
        )
        .unwrap();

        assert!(db.list_incomplete_creation_metadata().unwrap().is_empty());
        drop(db);
        std::fs::remove_dir_all(directory).unwrap();
    }
}
