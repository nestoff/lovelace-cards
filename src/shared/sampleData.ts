import type { WorkspaceState } from "./types.js";
import { formatCameraLabel } from "./cameraLabel.js";
import { cameraDefaultsFromNumber } from "./cameraIndex.js";
import { resolveCameraAddress } from "./url.js";
import { DEFAULT_VIEWPORT } from "./viewport.js";

const prefix = "http://192.168.1.";

export const sampleWorkspace: WorkspaceState = {
  jobs: [{ id: "job-sample", name: "Sample Job", listIds: ["list-sample"] }],
  cameraLists: [
    {
      id: "list-sample",
      jobId: "job-sample",
      name: "Camera LAN",
      defaultPrefix: prefix,
      cameras: Array.from({ length: 12 }, (_, index) => {
        const { index: cameraIndex, suffix } = cameraDefaultsFromNumber(index + 1);
        const idSuffix = String(41 + index);
        return {
          id: `camera-${idSuffix}`,
          name: cameraIndex,
          url: resolveCameraAddress(prefix, suffix),
          suffix,
          prefixOverride: "",
          usesListPrefix: true,
          cameraType: "",
          lens: "",
          displayNote: "",
          notes: "",
          viewportOverride: null,
          zoomOverride: null
        };
      })
    }
  ],
  passwordRecords: [],
  credentialPresets: [],
  tiles: Array.from({ length: 12 }, (_, index) => {
    const { index: cameraIndex, suffix } = cameraDefaultsFromNumber(index + 1);
    const idSuffix = String(41 + index);
    const camera = {
      id: `camera-${idSuffix}`,
      name: cameraIndex,
      url: resolveCameraAddress(prefix, suffix),
      suffix,
      prefixOverride: "",
      usesListPrefix: true,
      cameraType: "",
      lens: "",
      displayNote: "",
      notes: "",
      viewportOverride: null,
      zoomOverride: null
    };
    return {
      id: `tile-${idSuffix}`,
      cameraId: `camera-${idSuffix}`,
      url: resolveCameraAddress(prefix, suffix),
      title: formatCameraLabel(camera),
      partition: "persist:ditbrowse-job-sample-list-sample",
      viewport: DEFAULT_VIEWPORT,
      zoom: 1
    };
  }),
  selectedTileId: "tile-41",
  activeJobId: "job-sample",
  activeCameraListId: "list-sample",
  gridColumns: 4,
  defaultViewport: DEFAULT_VIEWPORT,
  defaultZoom: 1,
  globalZoom: 1,
  pingIntervalSeconds: 5
};
