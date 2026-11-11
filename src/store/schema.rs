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

    let mut version = current.map(|(v,)| v).unwrap_or(0);
    if version < 1 {
        migrate_v1(pool).await?;
        version = 1;
        set_schema_version(pool, current.is_none(), version).await?;
    }
    if version < 2 {
        migrate_v2(pool).await?;
        version = 2;
        set_schema_version(pool, false, version).await?;
    }
    if version < 3 {
        migrate_v3(pool).await?;
        version = 3;
        set_schema_version(pool, false, version).await?;
    }
    if version < 4 {
        migrate_v4(pool).await?;
        version = 4;
        set_schema_version(pool, false, version).await?;
    }

    let _ = version;
    Ok(())
}

async fn set_schema_version(
    pool: &SqlitePool,
    insert: bool,
    version: i64,
) -> Result<(), StoreError> {
    if insert {
        sqlx::query("INSERT INTO schema_version (version) VALUES (?)")
            .bind(version)
            .execute(pool)
            .await?;
    } else {
        sqlx::query("UPDATE schema_version SET version = ?")
            .bind(version)
            .execute(pool)
            .await?;
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

async fn migrate_v2(pool: &SqlitePool) -> Result<(), StoreError> {
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS peers (
            peer_id TEXT PRIMARY KEY,
            payload TEXT NOT NULL,
            updated_at INTEGER NOT NULL
         )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS peer_addresses (
            peer_id TEXT NOT NULL,
            multiaddr TEXT NOT NULL,
            payload TEXT NOT NULL,
            PRIMARY KEY (peer_id, multiaddr)
         )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS device_peers (
            device_id TEXT NOT NULL,
            peer_id TEXT NOT NULL,
            PRIMARY KEY (device_id, peer_id)
         )",
    )
    .execute(pool)
    .await?;

    Ok(())
}

async fn migrate_v3(pool: &SqlitePool) -> Result<(), StoreError> {
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS auth_session (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            email TEXT NOT NULL,
            logged_in INTEGER NOT NULL DEFAULT 0
         )",
    )
    .execute(pool)
    .await?;

    Ok(())
}

async fn migrate_v4(pool: &SqlitePool) -> Result<(), StoreError> {
    // Expand local login session with registry token fields.
    let _ = sqlx::query("ALTER TABLE auth_session ADD COLUMN access_token TEXT")
        .execute(pool)
        .await;
    let _ = sqlx::query("ALTER TABLE auth_session ADD COLUMN user_id TEXT")
        .execute(pool)
        .await;
    let _ = sqlx::query("ALTER TABLE auth_session ADD COLUMN device_id TEXT")
        .execute(pool)
        .await;

    Ok(())
}
