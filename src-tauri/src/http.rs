//! Native HTTP engine.
//!
//! All network work happens here in Rust rather than in the webview: a single
//! pooled `reqwest::Client` is shared across every request (connection reuse,
//! HTTP/2, transparent gzip/brotli), keeping the UI thread free and memory low.

use std::time::{Duration, Instant};

use base64::Engine as _;
use reqwest::{
    header::{HeaderMap, HeaderName, HeaderValue},
    redirect::Policy,
    Client, Method,
};
use serde::{Deserialize, Serialize};

/// A single header entry. `enabled` mirrors the UI checkbox so the frontend can
/// keep a row around without sending it.
#[derive(Debug, Clone, Deserialize)]
pub struct KeyValue {
    pub key: String,
    pub value: String,
    #[serde(default = "default_true")]
    pub enabled: bool,
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HttpRequest {
    pub method: String,
    pub url: String,
    #[serde(default)]
    pub headers: Vec<KeyValue>,
    #[serde(default)]
    pub query: Vec<KeyValue>,
    /// Raw request body (JSON, text, XML, ...). Ignored for methods without a body.
    #[serde(default)]
    pub body: Option<String>,
    /// Per-request timeout in milliseconds. Falls back to a sane default.
    #[serde(default)]
    pub timeout_ms: Option<u64>,
    /// Whether to follow 3xx redirects.
    #[serde(default = "default_true")]
    pub follow_redirects: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HttpResponse {
    pub status: u16,
    pub status_text: String,
    pub headers: Vec<(String, String)>,
    /// Body as UTF-8 text when possible, otherwise base64 (see `body_encoding`).
    pub body: String,
    pub body_encoding: String, // "utf8" | "base64"
    pub content_type: Option<String>,
    /// Size of the response body in bytes (after decompression).
    pub size_bytes: u64,
    /// Total round-trip time in milliseconds.
    pub time_ms: u128,
    pub final_url: String,
}

/// Build a shared client. Redirect policy is a client-level setting in reqwest,
/// so we keep two pooled clients and pick per request. Both live for the whole
/// app lifetime in Tauri managed state and reuse connections across requests.
fn build_client(follow_redirects: bool) -> Client {
    let policy = if follow_redirects {
        Policy::limited(10)
    } else {
        Policy::none()
    };
    Client::builder()
        .user_agent(concat!("namtsop/", env!("CARGO_PKG_VERSION")))
        .pool_max_idle_per_host(8)
        .redirect(policy)
        .build()
        .expect("failed to build reqwest client")
}

pub struct HttpState {
    pub following: Client,
    pub no_redirect: Client,
}

impl Default for HttpState {
    fn default() -> Self {
        Self {
            following: build_client(true),
            no_redirect: build_client(false),
        }
    }
}

fn parse_method(m: &str) -> Result<Method, String> {
    Method::from_bytes(m.trim().to_uppercase().as_bytes())
        .map_err(|_| format!("invalid HTTP method: {m}"))
}

#[tauri::command]
pub async fn send_request(
    state: tauri::State<'_, HttpState>,
    req: HttpRequest,
) -> Result<HttpResponse, String> {
    let method = parse_method(&req.method)?;

    // Build the URL and merge in enabled query params.
    let mut url = reqwest::Url::parse(req.url.trim())
        .map_err(|e| format!("invalid URL: {e}"))?;
    {
        let mut pairs = url.query_pairs_mut();
        for q in req.query.iter().filter(|q| q.enabled && !q.key.is_empty()) {
            pairs.append_pair(&q.key, &q.value);
        }
    }

    // Redirect policy is client-level in reqwest; pick the matching pooled client.
    let client = if req.follow_redirects {
        &state.following
    } else {
        &state.no_redirect
    };

    let mut builder = client
        .request(method.clone(), url)
        .timeout(Duration::from_millis(req.timeout_ms.unwrap_or(30_000)));

    // Headers.
    let mut headers = HeaderMap::new();
    for h in req.headers.iter().filter(|h| h.enabled && !h.key.is_empty()) {
        let name = HeaderName::from_bytes(h.key.as_bytes())
            .map_err(|_| format!("invalid header name: {}", h.key))?;
        let value = HeaderValue::from_str(&h.value)
            .map_err(|_| format!("invalid header value for {}", h.key))?;
        headers.append(name, value);
    }
    builder = builder.headers(headers);

    // Body (only for methods that carry one).
    if let Some(body) = req.body {
        if !body.is_empty() && method_allows_body(&method) {
            builder = builder.body(body);
        }
    }

    let started = Instant::now();
    let resp = builder.send().await.map_err(|e| classify_error(&e))?;

    let status = resp.status();
    let final_url = resp.url().to_string();
    let content_type = resp
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .map(str::to_owned);

    let headers: Vec<(String, String)> = resp
        .headers()
        .iter()
        .map(|(k, v)| (k.to_string(), v.to_str().unwrap_or("").to_string()))
        .collect();

    let bytes = resp.bytes().await.map_err(|e| format!("failed reading body: {e}"))?;
    let time_ms = started.elapsed().as_millis();
    let size_bytes = bytes.len() as u64;

    // Prefer UTF-8 text; fall back to base64 for binary payloads so the
    // frontend always receives valid JSON.
    let (body, body_encoding) = match std::str::from_utf8(&bytes) {
        Ok(s) => (s.to_owned(), "utf8".to_string()),
        Err(_) => (
            base64::engine::general_purpose::STANDARD.encode(&bytes),
            "base64".to_string(),
        ),
    };

    Ok(HttpResponse {
        status: status.as_u16(),
        status_text: status
            .canonical_reason()
            .unwrap_or("")
            .to_string(),
        headers,
        body,
        body_encoding,
        content_type,
        size_bytes,
        time_ms,
        final_url,
    })
}

fn method_allows_body(method: &Method) -> bool {
    !matches!(*method, Method::GET | Method::HEAD | Method::TRACE)
}

/// Turn reqwest errors into short, user-facing messages.
fn classify_error(e: &reqwest::Error) -> String {
    if e.is_timeout() {
        "Request timed out".to_string()
    } else if e.is_connect() {
        format!("Could not connect: {e}")
    } else if e.is_redirect() {
        "Too many redirects".to_string()
    } else {
        e.to_string()
    }
}
