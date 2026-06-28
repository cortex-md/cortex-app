use std::cmp::Ordering;
use std::collections::BinaryHeap;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::sync::db::{QueueRow, SyncDb};
use crate::sync::state::ConflictResolution;

#[derive(Debug, Clone)]
pub enum SyncOp {
    Upload {
        path: String,
    },
    Download {
        path: String,
        version: u64,
    },
    Delete {
        path: String,
    },
    Rename {
        old_path: String,
        new_path: String,
    },
    DeleteRemote {
        path: String,
    },
    RenameRemote {
        old_path: String,
        new_path: String,
    },
    ResolveConflict {
        path: String,
        resolution: Option<ConflictResolution>,
    },
    LookupCreationMetadata {
        path: String,
    },
    InitialSync,
    Reconcile,
}

impl SyncOp {
    fn op_type(&self) -> &str {
        match self {
            SyncOp::Upload { .. } => "upload",
            SyncOp::Download { .. } => "download",
            SyncOp::Delete { .. } => "delete",
            SyncOp::DeleteRemote { .. } => "delete_remote",
            SyncOp::Rename { .. } => "rename",
            SyncOp::RenameRemote { .. } => "rename_remote",
            SyncOp::ResolveConflict { .. } => "resolve_conflict",
            SyncOp::LookupCreationMetadata { .. } => "lookup_creation_metadata",
            SyncOp::InitialSync => "initial_sync",
            SyncOp::Reconcile => "reconcile",
        }
    }

    fn path(&self) -> &str {
        match self {
            SyncOp::Upload { path } => path,
            SyncOp::Download { path, .. } => path,
            SyncOp::Delete { path } => path,
            SyncOp::DeleteRemote { path } => path,
            SyncOp::Rename { old_path, .. } => old_path,
            SyncOp::RenameRemote { old_path, .. } => old_path,
            SyncOp::ResolveConflict { path, .. } => path,
            SyncOp::LookupCreationMetadata { path } => path,
            SyncOp::InitialSync => "",
            SyncOp::Reconcile => "",
        }
    }

    fn extra_data(&self) -> Option<String> {
        match self {
            SyncOp::Download { version, .. } => Some(version.to_string()),
            SyncOp::Rename { new_path, .. } => Some(new_path.clone()),
            SyncOp::RenameRemote { new_path, .. } => Some(new_path.clone()),
            SyncOp::ResolveConflict { resolution, .. } => resolution
                .as_ref()
                .and_then(|r| serde_json::to_string(r).ok()),
            _ => None,
        }
    }

    fn from_row(row: &QueueRow) -> Option<Self> {
        match row.op_type.as_str() {
            "upload" => Some(SyncOp::Upload {
                path: row.path.clone(),
            }),
            "download" => {
                let version = row
                    .extra_data
                    .as_ref()
                    .and_then(|s| s.parse::<u64>().ok())
                    .unwrap_or(1);
                Some(SyncOp::Download {
                    path: row.path.clone(),
                    version,
                })
            }
            "delete" => Some(SyncOp::Delete {
                path: row.path.clone(),
            }),
            "delete_remote" => Some(SyncOp::DeleteRemote {
                path: row.path.clone(),
            }),
            "rename_remote" => {
                let new_path = row.extra_data.clone().unwrap_or_default();
                Some(SyncOp::RenameRemote {
                    old_path: row.path.clone(),
                    new_path,
                })
            }
            "rename" => {
                let new_path = row.extra_data.clone().unwrap_or_default();
                Some(SyncOp::Rename {
                    old_path: row.path.clone(),
                    new_path,
                })
            }
            "resolve_conflict" => {
                let resolution = row
                    .extra_data
                    .as_ref()
                    .and_then(|s| serde_json::from_str(s).ok());
                Some(SyncOp::ResolveConflict {
                    path: row.path.clone(),
                    resolution,
                })
            }
            "lookup_creation_metadata" => Some(SyncOp::LookupCreationMetadata {
                path: row.path.clone(),
            }),
            "initial_sync" => Some(SyncOp::InitialSync),
            "reconcile" => Some(SyncOp::Reconcile),
            _ => None,
        }
    }
}

#[derive(Debug, Clone)]
pub struct QueueItem {
    pub id: String,
    pub priority: u32,
    pub op: SyncOp,
    pub source_event_id: Option<String>,
    pub retry_count: u32,
    pub max_retries: u32,
}

impl PartialEq for QueueItem {
    fn eq(&self, other: &Self) -> bool {
        self.priority == other.priority
    }
}

impl Eq for QueueItem {}

impl PartialOrd for QueueItem {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for QueueItem {
    fn cmp(&self, other: &Self) -> Ordering {
        self.priority.cmp(&other.priority)
    }
}

fn now_secs() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64
}

fn new_id() -> String {
    use std::time::SystemTime;
    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    format!("{:x}-{:04x}", ts, rand::random::<u16>())
}

fn parse_source_event_id(event_id: &str) -> Result<u64, String> {
    event_id
        .parse::<u64>()
        .map_err(|_| format!("source event ID is not numeric: {}", event_id))
}

fn highest_source_event_id(
    left: Option<String>,
    right: Option<String>,
) -> Result<Option<String>, String> {
    match (left, right) {
        (Some(left), Some(right)) => {
            let left_id = parse_source_event_id(&left)?;
            let right_id = parse_source_event_id(&right)?;
            if left_id >= right_id {
                Ok(Some(left))
            } else {
                Ok(Some(right))
            }
        }
        (Some(event_id), None) | (None, Some(event_id)) => {
            parse_source_event_id(&event_id)?;
            Ok(Some(event_id))
        }
        (None, None) => Ok(None),
    }
}

pub fn retry_backoff_secs(retry_count: u32) -> i64 {
    let base_secs: i64 = match retry_count {
        0 => 30,
        1 => 120,
        2 => 600,
        3 => 1800,
        4 => 7200,
        _ => 21600,
    };
    base_secs
}

pub struct SyncQueue {
    heap: BinaryHeap<QueueItem>,
    db: Option<Arc<SyncDb>>,
}

impl SyncQueue {
    pub fn new() -> Self {
        Self {
            heap: BinaryHeap::new(),
            db: None,
        }
    }

    #[allow(dead_code)]
    pub fn with_db(db: Arc<SyncDb>) -> Self {
        Self {
            heap: BinaryHeap::new(),
            db: Some(db),
        }
    }

    pub fn set_db(&mut self, db: Arc<SyncDb>) {
        self.db = Some(db);
    }

    pub fn load_from_db(&mut self) -> Result<usize, String> {
        let db = match &self.db {
            Some(db) => db,
            None => return Ok(0),
        };
        let now = now_secs();
        let rows = db.load_pending_queue(now)?;
        let count = rows.len();
        for row in &rows {
            if let Some(op) = SyncOp::from_row(row) {
                self.heap.push(QueueItem {
                    id: row.id.clone(),
                    priority: row.priority,
                    op,
                    source_event_id: row.source_event_id.clone(),
                    retry_count: row.retry_count,
                    max_retries: row.max_retries,
                });
            }
        }
        Ok(count)
    }

    pub fn push(&mut self, op: SyncOp, priority: u32) {
        let _ = self.push_internal(op, priority, None);
    }

    pub fn push_from_event(
        &mut self,
        op: SyncOp,
        priority: u32,
        event_id: String,
    ) -> Result<(), String> {
        self.push_internal(op, priority, Some(event_id))
    }

    fn push_internal(
        &mut self,
        mut op: SyncOp,
        priority: u32,
        source_event_id: Option<String>,
    ) -> Result<(), String> {
        let mut source_event_id = source_event_id;
        let op_type = op.op_type().to_string();
        let path = op.path().to_string();
        let mut existing_download_version = None;

        for item in self
            .heap
            .iter()
            .filter(|item| item.op.op_type() == op_type && item.op.path() == path)
        {
            source_event_id =
                highest_source_event_id(source_event_id, item.source_event_id.clone())?;
            if let SyncOp::Download { version, .. } = &item.op {
                existing_download_version =
                    Some(existing_download_version.unwrap_or(0).max(*version));
            }
        }

        if let Some(ref db) = self.db {
            if let Ok(rows) = db.load_duplicate_queue_ops(&op_type, &path) {
                for row in rows {
                    source_event_id =
                        highest_source_event_id(source_event_id, row.source_event_id)?;
                    if op_type == "download" {
                        if let Some(version) = row
                            .extra_data
                            .as_ref()
                            .and_then(|extra_data| extra_data.parse::<u64>().ok())
                        {
                            existing_download_version =
                                Some(existing_download_version.unwrap_or(0).max(version));
                        }
                    }
                }
            }
        }

        if let SyncOp::Download { path, version } = &mut op {
            if let Some(existing_download_version) = existing_download_version {
                let _ = path;
                *version = (*version).max(existing_download_version);
            }
        }
        self.heap
            .retain(|item| item.op.op_type() != op_type || item.op.path() != path);
        let id = new_id();

        if let Some(ref db) = self.db {
            let _ = db.remove_duplicate_queue_op(&op_type, &path);

            let row = QueueRow {
                id: id.clone(),
                op_type: op.op_type().to_string(),
                path: op.path().to_string(),
                extra_data: op.extra_data(),
                source_event_id: source_event_id.clone(),
                priority,
                retry_count: 0,
                max_retries: 10,
                created_at: now_secs(),
                next_retry_at: None,
                last_error: None,
                status: "pending".to_string(),
            };
            let _ = db.enqueue_op(&row);
        }

        self.heap.push(QueueItem {
            id,
            priority,
            op,
            source_event_id,
            retry_count: 0,
            max_retries: 10,
        });
        Ok(())
    }

    pub fn pop(&mut self) -> Option<QueueItem> {
        self.heap.pop()
    }

    pub fn mark_completed(&self, item: &QueueItem) {
        if let Some(ref db) = self.db {
            let _ = db.mark_queue_completed(&item.id);
        }
    }

    pub fn mark_failed(&mut self, item: QueueItem, error: &str, retriable: bool) {
        if !retriable || item.retry_count + 1 >= item.max_retries {
            if let Some(ref db) = self.db {
                let _ = db.mark_queue_dead(&item.id, error);
            }
            return;
        }

        let next_retry = now_secs() + retry_backoff_secs(item.retry_count);

        if let Some(ref db) = self.db {
            let _ = db.mark_queue_failed(&item.id, error, Some(next_retry));
        }
    }

    #[allow(dead_code)]
    pub fn is_empty(&self) -> bool {
        self.heap.is_empty()
    }

    #[allow(dead_code)]
    pub fn len(&self) -> usize {
        self.heap.len()
    }

    #[allow(dead_code)]
    pub fn clear(&mut self) {
        self.heap.clear();
        if let Some(ref db) = self.db {
            let _ = db.clear_queue();
        }
    }

    pub fn reload_ready(&mut self) -> Result<usize, String> {
        let db = match &self.db {
            Some(db) => db,
            None => return Ok(0),
        };
        let now = now_secs();
        let rows = db.load_pending_queue(now)?;
        let mut loaded = 0;
        let existing_ids: std::collections::HashSet<String> =
            self.heap.iter().map(|item| item.id.clone()).collect();

        for row in &rows {
            if existing_ids.contains(&row.id) {
                continue;
            }
            if let Some(op) = SyncOp::from_row(row) {
                self.heap.push(QueueItem {
                    id: row.id.clone(),
                    priority: row.priority,
                    op,
                    source_event_id: row.source_event_id.clone(),
                    retry_count: row.retry_count,
                    max_retries: row.max_retries,
                });
                loaded += 1;
            }
        }
        Ok(loaded)
    }

    pub fn upload(path: String) -> (SyncOp, u32) {
        (SyncOp::Upload { path }, 60)
    }

    pub fn download(path: String, version: u64) -> (SyncOp, u32) {
        (SyncOp::Download { path, version }, 80)
    }

    pub fn delete_remote(path: String) -> (SyncOp, u32) {
        (SyncOp::DeleteRemote { path }, 60)
    }

    pub fn rename_remote(old_path: String, new_path: String) -> (SyncOp, u32) {
        (SyncOp::RenameRemote { old_path, new_path }, 60)
    }

    pub fn conflict(path: String) -> (SyncOp, u32) {
        (
            SyncOp::ResolveConflict {
                path,
                resolution: None,
            },
            100,
        )
    }

    pub fn lookup_creation_metadata(path: String) -> (SyncOp, u32) {
        (SyncOp::LookupCreationMetadata { path }, 10)
    }

    #[allow(dead_code)]
    pub fn initial_sync() -> (SyncOp, u32) {
        (SyncOp::InitialSync, 20)
    }

    #[allow(dead_code)]
    pub fn reconcile() -> (SyncOp, u32) {
        (SyncOp::Reconcile, 90)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    fn test_db() -> (std::path::PathBuf, Arc<SyncDb>) {
        let directory = std::env::temp_dir().join(format!("cortex-sync-queue-{}", Uuid::new_v4()));
        let db = Arc::new(SyncDb::open(directory.to_str().unwrap()).unwrap());
        (directory, db)
    }

    #[test]
    fn readiness_helpers_track_pushes_and_pops() {
        let mut queue = SyncQueue::new();

        assert!(queue.is_empty());
        assert_eq!(queue.len(), 0);

        let (upload, upload_priority) = SyncQueue::upload("first.md".to_string());
        queue.push(upload, upload_priority);
        let (download, download_priority) = SyncQueue::download("second.md".to_string(), 1);
        queue.push(download, download_priority);

        assert!(!queue.is_empty());
        assert_eq!(queue.len(), 2);

        queue.pop().unwrap();
        assert!(!queue.is_empty());
        assert_eq!(queue.len(), 1);

        queue.pop().unwrap();
        assert!(queue.is_empty());
        assert_eq!(queue.len(), 0);
    }

    #[test]
    fn deduplicates_uploads_in_memory_and_sqlite() {
        let (directory, db) = test_db();
        let mut queue = SyncQueue::with_db(db.clone());
        let (first, priority) = SyncQueue::upload("note.md".to_string());
        queue.push(first, priority);
        let (second, priority) = SyncQueue::upload("note.md".to_string());
        queue.push(second, priority);

        assert_eq!(queue.len(), 1);
        assert_eq!(db.load_pending_queue(now_secs()).unwrap().len(), 1);
        drop(queue);
        drop(db);
        std::fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn keeps_only_the_latest_download_version() {
        let (directory, db) = test_db();
        let mut queue = SyncQueue::with_db(db.clone());
        let (older, priority) = SyncQueue::download("note.md".to_string(), 2);
        queue.push(older, priority);
        let (stale, priority) = SyncQueue::download("note.md".to_string(), 1);
        queue.push(stale, priority);
        let (newer, priority) = SyncQueue::download("note.md".to_string(), 5);
        queue.push(newer, priority);

        assert_eq!(queue.len(), 1);
        let item = queue.pop().unwrap();
        assert!(matches!(item.op, SyncOp::Download { version: 5, .. }));
        let rows = db.load_pending_queue(now_secs()).unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].extra_data.as_deref(), Some("5"));
        drop(queue);
        drop(db);
        std::fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn loads_legacy_queue_rows_without_source_event_id() {
        let directory =
            std::env::temp_dir().join(format!("cortex-sync-queue-legacy-{}", Uuid::new_v4()));
        let cortex_directory = directory.join(".cortex");
        std::fs::create_dir_all(&cortex_directory).unwrap();
        let connection = rusqlite::Connection::open(cortex_directory.join("sync.db")).unwrap();
        connection
            .execute_batch(
                "CREATE TABLE sync_queue (
                    id TEXT PRIMARY KEY,
                    op_type TEXT NOT NULL,
                    path TEXT NOT NULL,
                    extra_data TEXT,
                    priority INTEGER NOT NULL DEFAULT 60,
                    retry_count INTEGER NOT NULL DEFAULT 0,
                    max_retries INTEGER NOT NULL DEFAULT 10,
                    created_at INTEGER NOT NULL,
                    next_retry_at INTEGER,
                    last_error TEXT,
                    status TEXT NOT NULL DEFAULT 'pending'
                );
                INSERT INTO sync_queue (
                    id, op_type, path, extra_data, priority, retry_count, max_retries,
                    created_at, status
                ) VALUES (
                    'legacy-download', 'download', 'note.md', '3', 80, 0, 10, 1, 'pending'
                );",
            )
            .unwrap();
        drop(connection);

        let db = Arc::new(SyncDb::open(directory.to_str().unwrap()).unwrap());
        let rows = db.load_pending_queue(now_secs()).unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].source_event_id, None);

        let mut queue = SyncQueue::with_db(db.clone());
        assert_eq!(queue.load_from_db().unwrap(), 1);
        let item = queue.pop().unwrap();
        assert_eq!(item.source_event_id, None);
        drop(queue);
        drop(db);
        std::fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn persists_and_reloads_remote_download_source_event_id() {
        let (directory, db) = test_db();
        let mut queue = SyncQueue::with_db(db.clone());
        let (operation, priority) = SyncQueue::download("note.md".to_string(), 7);
        queue
            .push_from_event(operation, priority, "42".to_string())
            .unwrap();

        let rows = db.load_pending_queue(now_secs()).unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].source_event_id.as_deref(), Some("42"));

        let mut reloaded = SyncQueue::with_db(db.clone());
        assert_eq!(reloaded.load_from_db().unwrap(), 1);
        let item = reloaded.pop().unwrap();
        assert_eq!(item.source_event_id.as_deref(), Some("42"));
        drop(reloaded);
        drop(queue);
        drop(db);
        std::fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn deduplicating_downloads_keeps_highest_source_event_id() {
        let (directory, db) = test_db();
        let mut queue = SyncQueue::with_db(db.clone());
        let (older, priority) = SyncQueue::download("note.md".to_string(), 5);
        queue
            .push_from_event(older, priority, "8".to_string())
            .unwrap();
        let (stale, priority) = SyncQueue::download("note.md".to_string(), 2);
        queue
            .push_from_event(stale, priority, "12".to_string())
            .unwrap();

        assert_eq!(queue.len(), 1);
        let item = queue.pop().unwrap();
        assert!(matches!(item.op, SyncOp::Download { version: 5, .. }));
        assert_eq!(item.source_event_id.as_deref(), Some("12"));

        let rows = db.load_pending_queue(now_secs()).unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].extra_data.as_deref(), Some("5"));
        assert_eq!(rows[0].source_event_id.as_deref(), Some("12"));
        drop(queue);
        drop(db);
        std::fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn deduplicates_creation_metadata_lookups() {
        let mut queue = SyncQueue::new();
        let (first, priority) = SyncQueue::lookup_creation_metadata("note.md".to_string());
        queue.push(first, priority);
        let (second, priority) = SyncQueue::lookup_creation_metadata("note.md".to_string());
        queue.push(second, priority);

        assert_eq!(queue.len(), 1);
    }

    #[test]
    fn retry_remains_single_in_memory_and_sqlite() {
        let (directory, db) = test_db();
        let mut queue = SyncQueue::with_db(db.clone());
        let (operation, priority) = SyncQueue::upload("note.md".to_string());
        queue.push(operation, priority);
        let item = queue.pop().unwrap();
        queue.mark_failed(item, "temporary", true);

        assert!(db.load_pending_queue(now_secs()).unwrap().is_empty());
        assert_eq!(
            db.load_pending_queue(now_secs() + retry_backoff_secs(0) + 1)
                .unwrap()
                .len(),
            1
        );

        let (replacement, priority) = SyncQueue::upload("note.md".to_string());
        queue.push(replacement, priority);

        assert_eq!(queue.len(), 1);
        assert_eq!(db.load_pending_queue(now_secs()).unwrap().len(), 1);
        drop(queue);
        drop(db);
        std::fs::remove_dir_all(directory).unwrap();
    }
}
