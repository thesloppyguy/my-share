use sqlx::SqlitePool;

use crate::errors::StoreError;

/// Apply the current schema. Idempotent via `IF NOT EXISTS`.
pub async fn migrate(pool: &SqlitePool) -> Result<(), StoreError> {
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS schema_version (
            version INTEGER NOT NULL
         )",
    )
    .execute(pool)
    .await?;

    let current: Option<(i64,)> = sqlx::query_as("SELECT version FROM schema_version LIMIT 1")
        .fetch_optional(pool)
        .await?;

    let version = current.map(|(v,)| v).unwrap_or(0);
    if version < 1 {
        migrate_v1(pool).await?;
        if current.is_none() {
            sqlx::query("INSERT INTO schema_version (version) VALUES (1)")
                .execute(pool)
                .await?;
        } else {
            sqlx::query("UPDATE schema_version SET version = 1")
                .execute(pool)
                .await?;
        }
    }

    Ok(())
}

async fn migrate_v1(pool: &SqlitePool) -> Result<(), StoreError> {
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS account (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            payload TEXT NOT NULL
         )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS devices (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            payload TEXT NOT NULL,
            is_local INTEGER NOT NULL DEFAULT 0,
            updated_at INTEGER NOT NULL
         )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS watched_folders (
            path TEXT PRIMARY KEY,
            recursive INTEGER NOT NULL,
            enabled INTEGER NOT NULL
         )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS clipboard_entries (
            id TEXT PRIMARY KEY,
            content_json TEXT NOT NULL,
            source_device TEXT,
            created_at INTEGER NOT NULL
         )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_clipboard_created_at
         ON clipboard_entries (created_at DESC)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS watch_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            path TEXT NOT NULL,
            renamed_from TEXT,
            kind TEXT NOT NULL,
            at INTEGER NOT NULL
         )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_watch_events_at
         ON watch_events (at DESC)",
    )
    .execute(pool)
    .await?;

    Ok(())
}
