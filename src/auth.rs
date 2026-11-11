use serde::{Deserialize, Serialize};

const DEFAULT_REGISTRY_URL: &str = "https://my-share.clarynx.tech/api";

#[derive(Debug, Clone)]
pub struct RegistryClient {
    base_url: String,
    http: reqwest::Client,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OtpRequestResponse {
    pub ok: bool,
    pub expires_in_sec: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VerifyOtpResponse {
    pub access_token: String,
    pub user_id: String,
    pub device_id: String,
    pub email: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DevicePayload<'a> {
    name: &'a str,
    fingerprint_hash: &'a str,
    peer_id: &'a str,
    multiaddrs: &'a [String],
    os: &'a str,
}

#[derive(Debug, Deserialize)]
struct ApiErrorBody {
    error: Option<String>,
}

impl RegistryClient {
    pub fn from_env() -> Self {
        let base_url = std::env::var("MY_SHARE_REGISTRY_URL")
            .unwrap_or_else(|_| DEFAULT_REGISTRY_URL.to_string());
        Self::new(base_url)
    }

    pub fn new(base_url: impl Into<String>) -> Self {
        Self {
            base_url: normalize_registry_url(base_url.into()),
            http: reqwest::Client::new(),
        }
    }

    pub async fn request_otp(&self, email: &str) -> Result<OtpRequestResponse, String> {
        let url = format!("{}/auth/request-otp", self.base_url);
        let res = self
            .http
            .post(&url)
            .json(&serde_json::json!({ "email": email }))
            .send()
            .await
            .map_err(|e| format!("Could not reach auth server: {e}"))?;

        if !res.status().is_success() {
            return Err(api_error(res).await);
        }

        res.json::<OtpRequestResponse>()
            .await
            .map_err(|e| format!("Invalid OTP response: {e}"))
    }

    pub async fn verify_otp(
        &self,
        email: &str,
        otp: &str,
        device_name: &str,
        fingerprint_hash: &str,
        peer_id: &str,
        multiaddrs: &[String],
        os: &str,
    ) -> Result<VerifyOtpResponse, String> {
        let url = format!("{}/auth/verify-otp", self.base_url);
        let res = self
            .http
            .post(&url)
            .json(&serde_json::json!({
                "email": email,
                "otp": otp,
                "device": DevicePayload {
                    name: device_name,
                    fingerprint_hash,
                    peer_id,
                    multiaddrs,
                    os,
                }
            }))
            .send()
            .await
            .map_err(|e| format!("Could not reach auth server: {e}"))?;

        if !res.status().is_success() {
            return Err(api_error(res).await);
        }

        res.json::<VerifyOtpResponse>()
            .await
            .map_err(|e| format!("Invalid verify response: {e}"))
    }
}

async fn api_error(res: reqwest::Response) -> String {
    let status = res.status();
    let body = res.text().await.unwrap_or_default();
    if let Ok(parsed) = serde_json::from_str::<ApiErrorBody>(&body) {
        if let Some(error) = parsed.error {
            return error;
        }
    }
    if body.trim().is_empty() {
        format!("Auth request failed ({status})")
    } else {
        body
    }
}

pub fn device_fingerprint(seed: &str) -> String {
    blake3::hash(seed.as_bytes()).to_hex().to_string()
}

fn normalize_registry_url(url: String) -> String {
    let trimmed = url.trim().trim_end_matches('/').to_string();
    if trimmed.ends_with("/api") {
        trimmed
    } else {
        // Accept either the site origin or the /api base.
        format!("{trimmed}/api")
    }
}
