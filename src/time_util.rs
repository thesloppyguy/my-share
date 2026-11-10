use std::time::{Duration, SystemTime, UNIX_EPOCH};

pub fn system_time_to_millis(time: SystemTime) -> i64 {
    time.duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}

pub fn system_time_from_millis(millis: i64) -> SystemTime {
    let millis = millis.max(0) as u64;
    UNIX_EPOCH + Duration::from_millis(millis)
}
