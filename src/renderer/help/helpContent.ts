import cameraListImage from "./assets/camera-list.png";
import cameraRowImage from "./assets/camera-row.png";
import cameraSessionImage from "./assets/camera-session.png";
import mainLayoutImage from "./assets/main-layout.png";
import mainNavigationImage from "./assets/main-navigation.png";
import mainTabsImage from "./assets/main-tabs.png";
import mainWorkspaceImage from "./assets/main-workspace.png";
import passwordSettingsImage from "./assets/password-settings.png";
import signInImage from "./assets/sign-in.png";

export interface HelpTroubleshootingItem {
  symptom: string;
  cause: string;
  action: string;
}

export interface HelpCallout {
  number: number;
  text: string;
  destructive?: boolean;
}

export interface HelpImage {
  src: string;
  alt: string;
  caption: string;
  callouts: HelpCallout[];
}

export type HelpControlScope = "Selected camera" | "All cameras" | "Workspace";

export interface HelpControl {
  label: string;
  outcome: string;
  scope: HelpControlScope;
  availability?: string;
}

export interface HelpControlGroup {
  title: string;
  controls: HelpControl[];
}

export interface HelpSection {
  id: "quick-start" | "main-controls" | "camera-setup" | "passwords" | "troubleshooting";
  title: string;
  introduction: string;
  steps?: string[];
  notes?: string[];
  troubleshooting?: HelpTroubleshootingItem[];
  images?: HelpImage[];
  controlGroups?: HelpControlGroup[];
}

export const helpSections: HelpSection[] = [
  {
    id: "quick-start",
    title: "Quick Start",
    introduction:
      "Set up the camera list first, then save a reusable login or sign in to each camera when prompted.",
    steps: [
      "Open Camera List from the top-right of the main tab row.",
      "Select or create the job and camera list for the current setup.",
      "Set the shared URL prefix, add camera rows, and verify every resolved Full URL.",
      "Save the camera list and confirm each camera number appears centered in its tile header.",
      "Add a password preset or use the sign-in prompt when a camera requests credentials."
    ],
    images: [
      {
        src: mainWorkspaceImage,
        alt: "Main DITBrowse workspace with four numbered camera tiles and annotated controls",
        caption: "The main workspace keeps camera identity and session controls visible.",
        callouts: [
          { number: 1, text: "Open Camera List to configure the job, cameras, and passwords." },
          { number: 2, text: "The centered CAM number is the camera's normal integer identity." },
          { number: 3, text: "Camera Session contains reload and sign-out controls." }
        ]
      }
    ]
  },
  {
    id: "main-controls",
    title: "Main Page Controls",
    introduction:
      "These controls run left to right across the tab row and camera toolbar.",
    controlGroups: [
      {
        title: "Tabs and workspace",
        controls: [
          { label: "Camera tab", outcome: "Selects that camera without reloading it; drag the tab to change tab and grid order.", scope: "Workspace" },
          { label: "Close tab", outcome: "Removes the camera from the open grid without deleting its camera-list row.", scope: "Workspace" },
          { label: "Add tile", outcome: "Opens a new blank camera browser tile.", scope: "Workspace" },
          { label: "Help", outcome: "Opens this bundled offline guide.", scope: "Workspace" },
          { label: "Camera List", outcome: "Opens camera-list editing and Workspace Settings.", scope: "Workspace" }
        ]
      },
      {
        title: "Navigation and address",
        controls: [
          { label: "Back", outcome: "Returns the selected camera to its previous page.", scope: "Selected camera" },
          { label: "Forward", outcome: "Moves the selected camera to its next page.", scope: "Selected camera" },
          { label: "Camera Session", outcome: "Opens reload and sign-out actions.", scope: "Workspace" },
          { label: "Address", outcome: "Shows or edits the selected camera's live URL.", scope: "Selected camera" },
          { label: "Open address", outcome: "Loads the typed address in the selected camera.", scope: "Selected camera" },
          { label: "Open address in new tile", outcome: "Creates a blank tile and loads the typed address there.", scope: "Workspace" },
          { label: "Save current URL to camera list", outcome: "Stores the selected camera's live address in its camera-list row.", scope: "Selected camera", availability: "Enabled only when the live address differs from the saved row." },
          { label: "Use list address", outcome: "Restores shared-prefix plus camera-number addressing.", scope: "Selected camera", availability: "Shown only while the camera uses a full-address override." }
        ]
      },
      {
        title: "Layout, zoom, and resolution",
        controls: [
          { label: "Focus selected page / Show all pages", outcome: "Switches between one enlarged camera and the complete grid without reloading.", scope: "Workspace", availability: "Disabled when no camera is selected or Companion expansion mode is off." },
          { label: "Cols", outcome: "Sets the camera grid column count.", scope: "All cameras" },
          { label: "Selected camera zoom", outcome: "Changes the selected camera's zoom with the slider.", scope: "Selected camera" },
          { label: "Selected zoom percentage / reset", outcome: "Sets a precise selected-camera zoom; double-click % to reset to 100%.", scope: "Selected camera" },
          { label: "All", outcome: "Opens relative zoom controls for every camera.", scope: "All cameras" },
          { label: "All relative zoom", outcome: "Adjusts every camera relative to its own saved zoom.", scope: "All cameras" },
          { label: "All relative percentage / reset", outcome: "Sets the precise global factor; double-click % to reset it to 100%.", scope: "All cameras" },
          { label: "Resolution", outcome: "Changes the selected camera's viewport resolution.", scope: "Selected camera", availability: "Disabled when no camera viewport is selected." },
          { label: "Apply to All", outcome: "Copies the selected resolution to every open camera.", scope: "All cameras", availability: "Disabled when no camera viewport is selected." }
        ]
      }
    ],
    images: [
      {
        src: mainTabsImage,
        alt: "Main tab row annotated at a camera tab, close, Add tile, Help, and Camera List",
        caption: "The tab row selects and organizes cameras, then opens workspace tools.",
        callouts: [
          { number: 1, text: "Camera tab: select the camera; drag the tab to change tab and grid order." },
          { number: 2, text: "Close tab: remove this open camera without deleting its camera-list row." },
          { number: 3, text: "Add tile: open a new blank camera browser tile." },
          { number: 4, text: "Help: open this bundled offline guide." },
          { number: 5, text: "Camera List: edit the camera list and Workspace Settings." }
        ]
      },
      {
        src: mainNavigationImage,
        alt: "Navigation and address toolbar annotated at Back, Forward, Camera Session, Address, open, save, and list-address controls",
        caption: "Navigation and address controls act on the selected camera unless noted.",
        callouts: [
          { number: 1, text: "Back: return the selected camera to its previous page." },
          { number: 2, text: "Forward: move the selected camera to its next page." },
          { number: 3, text: "Camera Session: open reload and sign-out actions." },
          { number: 4, text: "Address: view or edit the selected camera's live URL." },
          { number: 5, text: "Open address: load the typed address in the selected camera." },
          { number: 6, text: "Open address in new tile: create a tile and load the typed address there." },
          { number: 7, text: "Save current URL: store a differing live URL in the camera list." },
          { number: 8, text: "Use list address: restore shared-prefix plus camera-number addressing." }
        ]
      },
      {
        src: mainLayoutImage,
        alt: "Layout toolbar annotated at focus, columns, selected and all-camera zoom, resolution, and Apply to All",
        caption: "Layout controls distinguish selected-camera changes from all-camera changes.",
        callouts: [
          { number: 1, text: "Focus selected page / Show all pages: switch between one camera and the grid." },
          { number: 2, text: "Cols: set the grid column count for all cameras." },
          { number: 3, text: "Selected zoom: adjust the slider or exact percentage; double-click % to reset." },
          { number: 4, text: "All: open the relative zoom controls for every camera." },
          { number: 5, text: "All relative zoom: adjust every camera from its own saved zoom; double-click % to reset." },
          { number: 6, text: "Resolution: change the selected camera's viewport resolution." },
          { number: 7, text: "Apply to All: copy the selected resolution to every open camera." }
        ]
      }
    ]
  },
  {
    id: "camera-setup",
    title: "Camera Setup",
    introduction:
      "A camera number is a positive whole number such as 1, 2, or 12. DITBrowse uses that number as the camera identity.",
    steps: [
      "Open Camera List and choose the correct job and camera list.",
      "Enter the shared URL prefix used by cameras in this list.",
      "Add the required rows and enter each Camera # as a positive whole number.",
      "Leave Follow Prefix on when the camera uses the shared prefix. DITBrowse derives a two-digit network suffix, so camera 1 resolves with suffix 01 while its displayed number remains 1.",
      "Turn Follow Prefix off and enter Full URL when that camera uses a different address pattern.",
      "Optionally enter Type, Lens, Display Note, Resolution, and Zoom.",
      "Read the resolved Full URL in every row, save, and confirm the numbered tiles appear in the grid."
    ],
    notes: [
      "If a camera opens at the wrong address, correct Camera # or enter a Full URL before changing passwords.",
      "Camera numbers are integers only; do not enter labels, spaces, decimals, or punctuation."
    ],
    images: [
      {
        src: cameraListImage,
        alt: "Camera List editor showing a shared prefix, camera count, and four camera rows",
        caption: "Start with the shared address pattern and the number of cameras.",
        callouts: [
          { number: 1, text: "List Prefix is the shared beginning of each camera address." },
          { number: 2, text: "Camera count adds or removes rows for the current list." },
          { number: 3, text: "Each row stores one camera's number, address, and metadata." }
        ]
      },
      {
        src: cameraRowImage,
        alt: "Camera table rows annotated at Camera number, Follow Prefix, Full URL, Type, Lens, and Display Note",
        caption: "Verify the required fields in each camera row before saving.",
        callouts: [
          { number: 1, text: "Camera # is the positive integer used to identify the camera." },
          { number: 2, text: "Follow Prefix builds this camera's address from the shared prefix." },
          { number: 3, text: "Full URL shows the address DITBrowse will open." },
          { number: 4, text: "Type can match a password preset to this camera." },
          { number: 5, text: "Lens is optional production metadata." },
          { number: 6, text: "Display Note adds a short note to the camera label." }
        ]
      }
    ]
  },
  {
    id: "passwords",
    title: "Passwords and Sign-In",
    introduction:
      "Password presets are reusable suggestions. A saved camera login is tied to one camera in the active job and camera list.",
    steps: [
      "Open Camera List, scroll to Workspace Settings, and add a Password Preset with username, password, and optional camera type.",
      "When a camera requests credentials, use the matching Use … login & Sign In button to fill both fields and submit once.",
      "Leave Save for this camera checked to reuse that login for this camera in the active job and list.",
      "Use Camera Session > Reload selected or Reload all for a normal non-destructive refresh.",
      "Use Camera Session > Sign out, forget login & reload selected when the saved login is wrong or the camera must request credentials again.",
      "Use Sign out, forget active-list logins & reload all… only when every saved login in the current list should be cleared."
    ],
    notes: [
      "Signing out and forgetting a camera login does not delete the reusable Password Preset.",
      "Saved Camera Passwords in Workspace Settings can remove one stored camera login directly."
    ],
    images: [
      {
        src: passwordSettingsImage,
        alt: "Workspace Settings showing masked Password Presets and Saved Camera Passwords",
        caption: "Reusable presets and camera-specific saved logins are managed separately.",
        callouts: [
          { number: 1, text: "Password Presets provide reusable sign-in suggestions." },
          { number: 2, text: "Saved Camera Passwords are tied to individual cameras." }
        ]
      },
      {
        src: signInImage,
        alt: "Camera sign-in dialog annotated at the automatic saved-login button and Save for this camera option",
        caption: "A matching preset can fill both fields and submit the sign-in in one action.",
        callouts: [
          { number: 1, text: "Use Studio Camera login & Sign In fills the username and password, then signs in." },
          { number: 2, text: "Save for this camera reuses the accepted login for this camera." }
        ]
      },
      {
        src: cameraSessionImage,
        alt: "Camera Session menu with safe reload actions and red destructive sign-out actions",
        caption: "Reload normally unless a saved login must be forgotten.",
        callouts: [
          { number: 1, text: "Reload selected" },
          { number: 2, text: "Reload all" },
          {
            number: 3,
            text: "Sign out, forget login & reload selected",
            destructive: true
          },
          {
            number: 4,
            text: "Sign out, forget active-list logins & reload all…",
            destructive: true
          }
        ]
      }
    ]
  },
  {
    id: "troubleshooting",
    title: "Troubleshooting",
    introduction: "Start with the address, then check the saved login.",
    troubleshooting: [
      {
        symptom: "The tile is blank.",
        cause: "The camera address is unreachable or resolves to the wrong host.",
        action:
          "Open Camera List and verify the resolved Full URL, network connection, and camera power."
      },
      {
        symptom: "Camera 1 opens the wrong address.",
        cause: "The shared prefix or derived 01 suffix does not match this network.",
        action:
          "Correct the prefix, or turn off Follow Prefix and enter that camera's Full URL."
      },
      {
        symptom: "The authentication prompt keeps returning.",
        cause: "The saved camera login is no longer accepted.",
        action:
          "Use Sign out, forget login & reload selected, then sign in again with the correct credentials."
      },
      {
        symptom: "The expected preset is not recommended.",
        cause: "Its optional camera type does not match the Type value in Camera List.",
        action: "Correct the camera Type or use a preset without a type match."
      }
    ]
  }
];
