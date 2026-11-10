export type AutoAccept = "never" | "my_devices" | "all_devices";

export type Hardware = "phone" | "tablet" | "computer" | "other";
export type Platform =
  | "android"
  | "ios"
  | "windows"
  | "mac_os"
  | "linux"
  | "other";

export type Profile = {
  name: string;
  email: string;
  avatar_path: string | null;
};

export type Settings = {
  launch_on_login: boolean;
  play_sound: boolean;
  auto_accept: AutoAccept;
  save_path: string;
  save_photos_to_gallery: boolean;
  upload_limit_mb: number;
  download_limit_mb: number;
};

export type ClipboardSettings = {
  enabled: boolean;
  history_limit: number;
  text_recognition: boolean;
  disabled_applications: string[];
};

export type WatchSettings = {
  enabled: boolean;
  ignored: string[];
};

export type WatchedFolder = {
  path: string;
  recursive: boolean;
  enabled: boolean;
};

export type Device = {
  id: string;
  name: string;
  hardware: Hardware;
  platform: Platform;
  app_version: string;
};

export type DeviceSnapshot = {
  id: string;
  name: string;
  hardware: Hardware;
  platform: Platform;
  app_version: string;
  peer_ids: string[];
  status: string;
  connection_count: number;
};

export type PeerSnapshot = {
  peer_id: string;
  agent_version: string;
  protocol_version: string;
  is_relay: boolean;
  supported_protocols: string[];
  address_count: number;
  connection_count: number;
  last_seen_ms: number | null;
  device_id: string | null;
};

export type RegistrySnapshot = {
  device_count: number;
  peer_count: number;
  address_count: number;
  connection_count: number;
  devices: DeviceSnapshot[];
  peers: PeerSnapshot[];
};

export type ClipboardEntryView = {
  id: string;
  kind: string;
  preview: string;
  source_device: string | null;
  created_at_ms: number;
};

export type OtpChallenge = {
  email: string;
  expires_in_secs: number;
  dev_code: string | null;
};

export type AppSnapshot = {
  authenticated: boolean;
  store_path: string;
  local_device: Device;
  profile: Profile;
  settings: Settings;
  clipboard: ClipboardSettings;
  watch: WatchSettings;
  clipboard_count: number;
  clipboard_entries: ClipboardEntryView[];
  watched_folders: WatchedFolder[];
  registry: RegistrySnapshot;
};

export type AppRoute = "clipboard" | "watch" | "share" | "settings";

export type SettingsTab =
  | "general"
  | "profile"
  | "clipboard"
  | "watch"
  | "devices"
  | "others";
