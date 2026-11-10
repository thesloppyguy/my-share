use std::collections::{HashMap, HashSet};
use std::time::{Duration, SystemTime};

use serde::{Deserialize, Serialize};

use super::device::{Device, DeviceId, DeviceStatus, device_status};
use crate::time_util::{system_time_from_millis, system_time_to_millis};

pub type PeerIdString = String;

// ----------------------------------
// Peer identity
// ----------------------------------

/// libp2p network identity and capabilities.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Peer {
    pub peer_id: PeerIdString,
    pub public_key: Option<String>,

    pub protocol_version: String,
    pub agent_version: String,

    /// Protocols advertised via Identify (capabilities, not active streams).
    pub supported_protocols: HashSet<String>,
    pub is_relay: bool,

    #[serde(
        serialize_with = "serialize_system_time",
        deserialize_with = "deserialize_system_time"
    )]
    pub first_seen: SystemTime,
    #[serde(default, with = "option_system_time")]
    pub last_seen: Option<SystemTime>,
}

impl Peer {
    pub fn new(peer_id: impl Into<PeerIdString>) -> Self {
        Self {
            peer_id: peer_id.into(),
            public_key: None,
            protocol_version: String::new(),
            agent_version: String::new(),
            supported_protocols: HashSet::new(),
            is_relay: false,
            first_seen: SystemTime::now(),
            last_seen: Some(SystemTime::now()),
        }
    }

    pub fn touch(&mut self) {
        self.last_seen = Some(SystemTime::now());
    }
}

// ----------------------------------
// Discovery and addresses
// ----------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DiscoverySource {
    Mdns,
    Kademlia,
    Bootstrap,
    Relay,
    Identify,
    Manual,
}

#[derive(Debug, Default, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AddressType {
    Lan,
    Public,
    Relay,
    #[default]
    Unknown,
}

/// One known way to reach a peer. Relay is an address type, not a separate list.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PeerAddress {
    pub multiaddr: String,
    pub address_type: AddressType,

    /// A peer may be discovered via multiple mechanisms over time.
    pub sources: HashSet<DiscoverySource>,

    #[serde(default, with = "option_system_time")]
    pub last_success: Option<SystemTime>,
    #[serde(default, with = "option_system_time")]
    pub last_failure: Option<SystemTime>,
    pub failure_count: u32,

    pub is_verified: bool,
}

impl PeerAddress {
    pub fn new(multiaddr: impl Into<String>, source: DiscoverySource) -> Self {
        Self {
            multiaddr: multiaddr.into(),
            address_type: AddressType::Unknown,
            sources: HashSet::from([source]),
            last_success: None,
            last_failure: None,
            failure_count: 0,
            is_verified: false,
        }
    }
}

// ----------------------------------
// Active connections (runtime)
// ----------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ConnectionDirection {
    Inbound,
    Outbound,
}

#[derive(Debug, Default, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Transport {
    Tcp,
    Quic,
    WebSocket,
    #[default]
    Other,
}

/// Live connection information owned conceptually by a ConnectionManager.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Connection {
    pub connection_id: String,
    pub peer_id: PeerIdString,

    pub address: String,
    pub direction: ConnectionDirection,
    pub transport: Transport,

    #[serde(
        serialize_with = "serialize_system_time",
        deserialize_with = "deserialize_system_time"
    )]
    pub connected_at: SystemTime,
    #[serde(default, with = "option_system_time")]
    pub last_ping: Option<SystemTime>,
    #[serde(with = "option_duration_millis")]
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
#[derive(Debug, Default, Clone)]
pub struct PeerRegistry {
    pub devices: HashMap<DeviceId, Device>,

    pub peers: HashMap<PeerIdString, Peer>,

    /// A device can have multiple peer identities over time (key rotation).
    pub device_peers: HashMap<DeviceId, HashSet<PeerIdString>>,

    /// Multiple addresses per peer.
    pub addresses: HashMap<PeerIdString, Vec<PeerAddress>>,

    /// Multiple simultaneous connections per peer (runtime only).
    pub connections: HashMap<PeerIdString, Vec<Connection>>,
}

impl PeerRegistry {
    pub fn upsert_device(&mut self, device: Device) {
        self.devices.insert(device.id.clone(), device);
    }

    pub fn upsert_peer(&mut self, peer: Peer) {
        self.peers.insert(peer.peer_id.clone(), peer);
    }

    /// Remember that `device_id` currently (or previously) uses `peer_id`.
    pub fn link_device_peer(&mut self, device_id: DeviceId, peer_id: PeerIdString) {
        self.device_peers
            .entry(device_id)
            .or_default()
            .insert(peer_id);
    }

    /// Insert or merge an address for a peer (sources are unioned).
    pub fn upsert_address(&mut self, peer_id: PeerIdString, address: PeerAddress) {
        let list = self.addresses.entry(peer_id).or_default();
        if let Some(existing) = list
            .iter_mut()
            .find(|a| a.multiaddr == address.multiaddr)
        {
            existing.sources.extend(address.sources);
            if address.address_type != AddressType::Unknown {
                existing.address_type = address.address_type;
            }
            if address.is_verified {
                existing.is_verified = true;
            }
            if address.last_success.is_some() {
                existing.last_success = address.last_success;
            }
            if address.last_failure.is_some() {
                existing.last_failure = address.last_failure;
                existing.failure_count = address.failure_count;
            }
        } else {
            list.push(address);
        }
    }

    pub fn upsert_connection(&mut self, connection: Connection) {
        let peer_id = connection.peer_id.clone();
        let list = self.connections.entry(peer_id.clone()).or_default();
        if let Some(existing) = list
            .iter_mut()
            .find(|c| c.connection_id == connection.connection_id)
        {
            *existing = connection;
        } else {
            list.push(connection);
        }
        if let Some(peer) = self.peers.get_mut(&peer_id) {
            peer.touch();
        }
    }

    pub fn remove_connection(&mut self, peer_id: &str, connection_id: &str) {
        if let Some(list) = self.connections.get_mut(peer_id) {
            list.retain(|c| c.connection_id != connection_id);
            if list.is_empty() {
                self.connections.remove(peer_id);
            }
        }
    }

    pub fn clear_connections(&mut self) {
        self.connections.clear();
    }

    pub fn peers_for_device(&self, device_id: &str) -> Vec<&Peer> {
        self.device_peers
            .get(device_id)
            .into_iter()
            .flat_map(|ids| ids.iter())
            .filter_map(|peer_id| self.peers.get(peer_id))
            .collect()
    }

    pub fn device_for_peer(&self, peer_id: &str) -> Option<&Device> {
        self.device_peers
            .iter()
            .find_map(|(device_id, peers)| peers.contains(peer_id).then_some(device_id))
            .and_then(|device_id| self.devices.get(device_id))
    }

    pub fn connection_count_for_peer(&self, peer_id: &str) -> usize {
        self.connections
            .get(peer_id)
            .map(|c| c.len())
            .unwrap_or(0)
    }

    pub fn connection_count_for_device(&self, device_id: &str) -> usize {
        self.device_peers
            .get(device_id)
            .into_iter()
            .flat_map(|ids| ids.iter())
            .map(|peer_id| self.connection_count_for_peer(peer_id))
            .sum()
    }

    pub fn status_for_device(&self, device_id: &str, is_dialing: bool) -> DeviceStatus {
        device_status(self.connection_count_for_device(device_id), is_dialing)
    }

    /// UI / IPC projection of the registry (connections included as counts).
    pub fn snapshot(&self) -> RegistrySnapshot {
        let devices = self
            .devices
            .values()
            .map(|device| {
                let peer_ids = self
                    .device_peers
                    .get(&device.id)
                    .map(|ids| ids.iter().cloned().collect())
                    .unwrap_or_default();
                DeviceSnapshot {
                    id: device.id.clone(),
                    name: device.name.clone(),
                    hardware: device.hardware,
                    platform: device.platform,
                    app_version: device.app_version.clone(),
                    peer_ids,
                    status: format!("{:?}", self.status_for_device(&device.id, false)),
                    connection_count: self.connection_count_for_device(&device.id),
                }
            })
            .collect();

        let peers = self
            .peers
            .values()
            .map(|peer| PeerSnapshot {
                peer_id: peer.peer_id.clone(),
                agent_version: peer.agent_version.clone(),
                protocol_version: peer.protocol_version.clone(),
                is_relay: peer.is_relay,
                supported_protocols: peer.supported_protocols.iter().cloned().collect(),
                address_count: self
                    .addresses
                    .get(&peer.peer_id)
                    .map(|a| a.len())
                    .unwrap_or(0),
                connection_count: self.connection_count_for_peer(&peer.peer_id),
                last_seen_ms: peer.last_seen.map(system_time_to_millis),
                device_id: self.device_for_peer(&peer.peer_id).map(|d| d.id.clone()),
            })
            .collect();

        RegistrySnapshot {
            device_count: self.devices.len(),
            peer_count: self.peers.len(),
            address_count: self.addresses.values().map(|v| v.len()).sum(),
            connection_count: self.connections.values().map(|v| v.len()).sum(),
            devices,
            peers,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegistrySnapshot {
    pub device_count: usize,
    pub peer_count: usize,
    pub address_count: usize,
    pub connection_count: usize,
    pub devices: Vec<DeviceSnapshot>,
    pub peers: Vec<PeerSnapshot>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceSnapshot {
    pub id: DeviceId,
    pub name: String,
    pub hardware: super::device::Hardware,
    pub platform: super::device::Platform,
    pub app_version: String,
    pub peer_ids: Vec<PeerIdString>,
    pub status: String,
    pub connection_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PeerSnapshot {
    pub peer_id: PeerIdString,
    pub agent_version: String,
    pub protocol_version: String,
    pub is_relay: bool,
    pub supported_protocols: Vec<String>,
    pub address_count: usize,
    pub connection_count: usize,
    pub last_seen_ms: Option<i64>,
    pub device_id: Option<DeviceId>,
}

fn serialize_system_time<S>(value: &SystemTime, serializer: S) -> Result<S::Ok, S::Error>
where
    S: serde::Serializer,
{
    serializer.serialize_i64(system_time_to_millis(*value))
}

fn deserialize_system_time<'de, D>(deserializer: D) -> Result<SystemTime, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let millis = i64::deserialize(deserializer)?;
    Ok(system_time_from_millis(millis))
}

mod option_system_time {
    use super::*;
    use serde::{Deserializer, Serializer};

    pub fn serialize<S>(value: &Option<SystemTime>, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        match value {
            Some(time) => serializer.serialize_some(&system_time_to_millis(*time)),
            None => serializer.serialize_none(),
        }
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<Option<SystemTime>, D::Error>
    where
        D: Deserializer<'de>,
    {
        let millis = Option::<i64>::deserialize(deserializer)?;
        Ok(millis.map(system_time_from_millis))
    }
}

mod option_duration_millis {
    use super::*;
    use serde::{Deserializer, Serializer};

    pub fn serialize<S>(value: &Option<Duration>, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        match value {
            Some(duration) => serializer.serialize_some(&(duration.as_millis() as u64)),
            None => serializer.serialize_none(),
        }
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<Option<Duration>, D::Error>
    where
        D: Deserializer<'de>,
    {
        let millis = Option::<u64>::deserialize(deserializer)?;
        Ok(millis.map(Duration::from_millis))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::device::{Hardware, Platform};

    #[test]
    fn links_device_peer_and_merges_addresses() {
        let mut registry = PeerRegistry::default();
        let device = Device {
            id: "dev-1".into(),
            name: "Laptop".into(),
            hardware: Hardware::Computer,
            platform: Platform::MacOs,
            app_version: "0.1.0".into(),
        };
        registry.upsert_device(device);
        registry.upsert_peer(Peer::new("peer-1"));
        registry.link_device_peer("dev-1".into(), "peer-1".into());

        registry.upsert_address(
            "peer-1".into(),
            PeerAddress::new("/ip4/127.0.0.1/tcp/4001", DiscoverySource::Mdns),
        );
        let mut again =
            PeerAddress::new("/ip4/127.0.0.1/tcp/4001", DiscoverySource::Kademlia);
        again.is_verified = true;
        registry.upsert_address("peer-1".into(), again);

        let addrs = registry.addresses.get("peer-1").unwrap();
        assert_eq!(addrs.len(), 1);
        assert!(addrs[0].sources.contains(&DiscoverySource::Mdns));
        assert!(addrs[0].sources.contains(&DiscoverySource::Kademlia));
        assert!(addrs[0].is_verified);
        assert_eq!(registry.peers_for_device("dev-1").len(), 1);
        assert_eq!(
            registry.device_for_peer("peer-1").map(|d| d.id.as_str()),
            Some("dev-1")
        );
    }
}
