export interface ViewportSize {
  width: number;
  height: number;
}

export interface CameraEntry {
  id: string;
  name: string;
  url: string;
  suffix: string;
  prefixOverride: string;
  usesListPrefix?: boolean;
  cameraType: string;
  lens: string;
  displayNote: string;
  notes: string;
  viewportOverride: ViewportSize | null;
  zoomOverride: number | null;
}

export interface CameraList {
  id: string;
  jobId: string;
  name: string;
  defaultPrefix: string;
  cameras: CameraEntry[];
}

export interface Job {
  id: string;
  name: string;
  listIds: string[];
}

export interface TileState {
  id: string;
  cameraId: string | null;
  url: string;
  title: string;
  partition: string;
  viewport: ViewportSize;
  zoom: number;
}

export interface PasswordRecord {
  id: string;
  jobId: string;
  cameraListId: string;
  cameraId: string | null;
  url: string;
  username: string;
  password: string;
}

export interface CredentialPreset {
  id: string;
  username: string;
  password: string;
  cameraType: string;
}

export interface WorkspaceState {
  jobs: Job[];
  cameraLists: CameraList[];
  passwordRecords: PasswordRecord[];
  credentialPresets: CredentialPreset[];
  tiles: TileState[];
  selectedTileId: string | null;
  activeJobId: string | null;
  activeCameraListId: string | null;
  gridColumns: number;
  defaultViewport: ViewportSize;
  defaultZoom: number;
  globalZoom: number;
  pingIntervalSeconds: number;
}
