import type { ReactElement } from "react";
import type { Swp08Info } from "../../shared/swp08Config";
import { SWP08_DEFAULT_PORT } from "../../shared/swp08";

export interface Swp08SetupGuideProps {
  info: Swp08Info | null;
}

/** Values to type into Blue Pill → Probel SW-P-08 → Configurable Model. */
export function bluePillSwp08Fields(info: Swp08Info | null): {
  ip: string;
  port: number;
  matrixId: number;
  sources: number;
  destinations: number;
  levels: number;
  focusDestination: number;
} {
  return {
    ip: info?.host && info.host !== "0.0.0.0" ? info.host : "YOUR_MAC_LAN_IP",
    port: info?.port ?? SWP08_DEFAULT_PORT,
    matrixId: info?.matrix ?? 0,
    sources: info?.sources ?? 64,
    destinations: info?.destinations ?? 1,
    levels: info?.levels ?? 1,
    focusDestination: info?.focusDestination ?? 1
  };
}

export function Swp08SetupGuide({ info }: Swp08SetupGuideProps): ReactElement {
  const fields = bluePillSwp08Fields(info);
  const listening = Boolean(info?.listening);

  return (
    <div className="swp08-setup-guide" aria-label="Blue Pill SW-P-08 setup guide">
      <div className="tools-section-header">
        <span>Blue Pill setup guide</span>
        <strong>{listening ? "Ready" : "Enable server first"}</strong>
      </div>

      <ol className="swp08-setup-steps">
        <li>
          In DIT Browse, turn on <strong>Enable SW-P-08 server</strong> above
          {listening ? (
            <>
              {" "}
              (listening on <code>{fields.ip}:{fields.port}</code>).
            </>
          ) : (
            <>.</>
          )}
        </li>
        <li>
          On the Blue Pill: <strong>Packages</strong> → install{" "}
          <strong>Probel SW-P-08</strong> if it is not already there.
        </li>
        <li>
          <strong>Home</strong> → <strong>Add device</strong> → choose{" "}
          <strong>Probel SW-P-08</strong> → model <strong>Configurable Model</strong>.
        </li>
        <li>
          Open the device settings (same screen as Parameter List / Core Settings) and
          enter the values in the table below. Then click <strong>Save</strong>.
        </li>
        <li>
          On the Blue Pill <strong>Home</strong> page, open this core&apos;s device-core
          settings and set source / destination / level <em>counts</em> to match the
          table (the Configurable Model dialog only has MatrixID).
        </li>
        <li>
          In Reactor: Camera Select <strong>Route Index</strong> = camera number →
          Routing Triggers → this SW-P-08 device, destination{" "}
          <code>{fields.focusDestination}</code> (Focus).
        </li>
      </ol>

      <div className="swp08-setup-table-wrap">
        <table className="swp08-setup-table">
          <caption>Configurable Model fields (match Blue Pill exactly)</caption>
          <thead>
            <tr>
              <th scope="col">Blue Pill field</th>
              <th scope="col">Enter this</th>
              <th scope="col">Notes</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Active</th>
              <td>
                <code>checked</code>
              </td>
              <td>Leave on while using DIT Browse.</td>
            </tr>
            <tr>
              <th scope="row">IP</th>
              <td>
                <code>{fields.ip}</code>
              </td>
              <td>Mac LAN address running DIT Browse (not the Blue Pill IP).</td>
            </tr>
            <tr>
              <th scope="row">Port</th>
              <td>
                <code>{fields.port}</code>
              </td>
              <td>
                Do <strong>not</strong> leave <code>0</code> — use the SW-P-08 port above
                (default <code>{SWP08_DEFAULT_PORT}</code>).
              </td>
            </tr>
            <tr>
              <th scope="row">Name</th>
              <td>
                <code>DIT Browse</code>
              </td>
              <td>Optional label in Reactor.</td>
            </tr>
            <tr>
              <th scope="row">Device Id</th>
              <td>
                <code>1</code>
              </td>
              <td>Any unique id among your devices is fine.</td>
            </tr>
            <tr>
              <th scope="row">Model Id</th>
              <td>
                <code>Configurable Model</code>
              </td>
              <td>Keep the configurable SW-P-08 model.</td>
            </tr>
            <tr>
              <th scope="row">MatrixID</th>
              <td>
                <code>{fields.matrixId}</code>
              </td>
              <td>
                Protocol matrix id (usually <code>0</code>). Must match DIT Browse.
              </td>
            </tr>
            <tr>
              <th scope="row">Sources (Home / core settings)</th>
              <td>
                <code>{fields.sources}</code>
              </td>
              <td>Camera numbers 1…N map to SW-P-08 sources.</td>
            </tr>
            <tr>
              <th scope="row">Destinations (Home / core settings)</th>
              <td>
                <code>{fields.destinations}</code>
              </td>
              <td>
                Dest <code>{fields.focusDestination}</code> = Focus in DIT Browse.
              </td>
            </tr>
            <tr>
              <th scope="row">Levels (Home / core settings)</th>
              <td>
                <code>{fields.levels}</code>
              </td>
              <td>One video level is enough.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="swp08-setup-footnote">
        Routing source <code>N</code> → destination <code>{fields.focusDestination}</code>{" "}
        focuses camera <code>N</code>. You can still add a second Routing Trigger row for
        ATEM Aux / Videohub for the video path.
      </p>
    </div>
  );
}
