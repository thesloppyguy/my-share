use std::collections::{HashMap, HashSet};
use std::time::{Duration, SystemTime};

use super::device::{Device, DeviceId};

pub type PeerIdString = String;

// ----------------------------------
// Peer identity
// ----------------------------------

/// libp2p network identity and capabilities.
#[derive(Debug, Clone)]
pub struct Peer {
    pub peer_id: PeerIdString,
    pub public_key: Option<String>,

    pub protocol_version: String,
    pub agent_version: String,

    /// Protocols advertised via Identify (capabilities, not active streams).
    pub supported_protocols: HashSet<String>,
    pub is_relay: bool,

    pub first_seen: SystemTime,
    pub last_seen: Option<SystemTime>,
}

// ----------------------------------
// Discovery and addresses
// ----------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum DiscoverySource {
    Mdns,
    Kademlia,
    Bootstrap,
    Relay,
    Identify,
    Manual,
}

#[derive(Debug, Default, Clone, Copy, PartialEq, Eq)]
pub enum AddressType {
    Lan,
    Public,
    Relay,
    #[default]
    Unknown,
}

/// One known way to reach a peer. Relay is an address type, not a separate list.
#[derive(Debug, Clone)]
pub struct PeerAddress {
    pub multiaddr: String,
    pub address_type: AddressType,

    /// A peer may be discovered via multiple mechanisms over time.
    pub sources: HashSet<DiscoverySource>,

    pub last_success: Option<SystemTime>,
    pub last_failure: Option<SystemTime>,
    pub failure_count: u32,

    pub is_verified: bool,
}

// ----------------------------------
// Active connections (runtime)
// ----------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConnectionDirection {
    Inbound,
    Outbound,
}

#[derive(Debug, Default, Clone, Copy, PartialEq, Eq)]
pub enum Transport {
    Tcp,
    Quic,
    WebSocket,
    #[default]
    Other,
}

/// Live connection information owned conceptually by a ConnectionManager.
#[derive(Debug, Clone)]
pub struct Connection {
    pub connection_id: String,
    pub peer_id: PeerIdString,

    pub address: String,
    pub direction: ConnectionDirection,
    pub transport: Transport,

    pub connected_at: SystemTime,
    pub last_ping: Option<SystemTime>,
    pub rtt: Option<Duration>,

    pub bytes_sent: u64,
    pub bytes_received: u64,
}

// ----------------------------------
// Registry (persistent + runtime indexes)
// ----------------------------------

/// Indexes devices, peers, addresses, and connections.
///
/// Dialing, retries, NAT traversal, and connection monitoring belong in a
/// separate `ConnectionManager` — not here.
#[derive(Debug, Default)]
pub struct PeerRegistry {
    pub devices: HashMap<DeviceId, Device>,

    pub peers: HashMap<PeerIdString, Peer>,

    /// A device can have multiple peer identities over time (key rotation).
    pub device_peers: HashMap<DeviceId, HashSet<PeerIdString>>,

    /// Multiple addresses per peer.
    pub addresses: HashMap<PeerIdString, Vec<PeerAddress>>,

    /// Multiple simultaneous connections per peer.
    pub connections: HashMap<PeerIdString, Vec<Connection>>,
}
