import { describe, expect, it } from "vitest";
import {
  cameraBaseAddressFromUrl,
  cameraBaseFromCommittedUrl,
  cameraRootFromUrl,
  resolveCameraAddress,
  resolveCameraAddressWithStablePath,
  stableCameraGuiPathFromUrl
} from "./url";

describe("cameraBaseAddressFromUrl", () => {
  it("returns an HTTP camera origin with an explicit root slash", () => {
    expect(cameraBaseAddressFromUrl("http://10.20.100.108/rmt.html?mode=1")).toEqual({
      origin: "http://10.20.100.108",
      baseUrl: "http://10.20.100.108/"
    });
  });

  it("preserves HTTPS, ports, and typed host text", () => {
    expect(cameraBaseAddressFromUrl("https://10.20.100.05:8443/index.html")).toEqual({
      origin: "https://10.20.100.05:8443",
      baseUrl: "https://10.20.100.05:8443/"
    });
  });

  it("rejects invalid and non-web URLs", () => {
    expect(cameraBaseAddressFromUrl("about:blank")).toBeNull();
    expect(cameraBaseAddressFromUrl("not a url")).toBeNull();
  });
});

describe("resolveCameraAddress", () => {
  it("keeps full http URLs unchanged", () => {
    expect(resolveCameraAddress("http://192.168.1.", "http://10.0.0.12")).toBe(
      "http://10.0.0.12"
    );
  });

  it("keeps full https URLs unchanged", () => {
    expect(resolveCameraAddress("http://192.168.1.", "https://camera.local")).toBe(
      "https://camera.local"
    );
  });

  it("adds http to bare LAN addresses instead of treating them as shortcuts", () => {
    expect(resolveCameraAddress("http://192.168.1.", "10.20.100.2")).toBe(
      "http://10.20.100.2"
    );
  });

  it("keeps explicit LAN camera paths unchanged", () => {
    expect(resolveCameraAddress("http://192.168.1.", "10.20.100.2/rmt.html")).toBe(
      "http://10.20.100.2/rmt.html"
    );
  });

  it("adds http to bare hostname addresses", () => {
    expect(resolveCameraAddress("http://192.168.1.", "camera.local/login")).toBe(
      "http://camera.local/login"
    );
  });

  it("appends shortcuts to the list prefix", () => {
    expect(resolveCameraAddress("http://192.168.1.", "42")).toBe("http://192.168.1.42");
  });

  it("adds http to bare LAN prefixes before appending shortcuts", () => {
    expect(resolveCameraAddress("10.20.100.", "2")).toBe("http://10.20.100.2");
  });

  it("keeps non-http schemes unchanged", () => {
    expect(resolveCameraAddress("http://192.168.1.", "about:blank")).toBe("about:blank");
  });

  it("trims spaces before resolving", () => {
    expect(resolveCameraAddress("http://192.168.1.", "  42  ")).toBe(
      "http://192.168.1.42"
    );
  });
});

describe("cameraBaseFromCommittedUrl", () => {
  it("keeps a corrected HTTPS origin without the redirected login path", () => {
    expect(cameraBaseFromCommittedUrl("https://10.20.100.2/login")).toBe(
      "https://10.20.100.2"
    );
  });

  it("keeps a corrected camera GUI path as the stable page URL", () => {
    expect(cameraBaseFromCommittedUrl("http://10.20.100.105/rmt.html")).toBe(
      "http://10.20.100.105/rmt.html"
    );
  });

  it("keeps a corrected camera GUI path with query parameters", () => {
    expect(cameraBaseFromCommittedUrl("http://10.20.100.105/rmt.html?view=main")).toBe(
      "http://10.20.100.105/rmt.html?view=main"
    );
  });

  it("keeps camera index landing pages as stable page URLs", () => {
    expect(cameraBaseFromCommittedUrl("http://10.20.100.107/index")).toBe(
      "http://10.20.100.107/index"
    );
    expect(cameraBaseFromCommittedUrl("http://10.20.100.107/index.html")).toBe(
      "http://10.20.100.107/index.html"
    );
  });

  it("preserves the host text instead of shortening two-digit camera addresses", () => {
    expect(cameraBaseFromCommittedUrl("http://10.20.100.05/rmt.html")).toBe(
      "http://10.20.100.05/rmt.html"
    );
    expect(cameraBaseFromCommittedUrl("http://10.20.100.05/text")).toBe(
      "http://10.20.100.05"
    );
  });

  it("drops unknown camera helper paths back to the camera origin", () => {
    expect(cameraBaseFromCommittedUrl("http://10.20.100.105/text")).toBe(
      "http://10.20.100.105"
    );
    expect(cameraBaseFromCommittedUrl("http://10.20.100.105/slash")).toBe(
      "http://10.20.100.105"
    );
  });

  it("preserves non-http browser URLs unchanged", () => {
    expect(cameraBaseFromCommittedUrl("about:blank")).toBe("about:blank");
  });
});

describe("stableCameraGuiPathFromUrl", () => {
  it("returns known stable camera GUI paths", () => {
    expect(stableCameraGuiPathFromUrl("http://10.20.100.105/rmt.html?view=main")).toBe(
      "/rmt.html?view=main"
    );
    expect(stableCameraGuiPathFromUrl("http://10.20.100.107/index.html")).toBe(
      "/index.html"
    );
  });

  it("ignores unknown camera paths", () => {
    expect(stableCameraGuiPathFromUrl("http://10.20.100.105/text")).toBe("");
  });
});

describe("resolveCameraAddressWithStablePath", () => {
  it("keeps stable camera GUI paths when changing the prefix", () => {
    expect(
      resolveCameraAddressWithStablePath(
        "http://10.10.20.",
        "05",
        "http://192.168.1.05/rmt.html"
      )
    ).toBe("http://10.10.20.05/rmt.html");
  });

  it("does not carry temporary camera paths when changing the prefix", () => {
    expect(
      resolveCameraAddressWithStablePath(
        "http://10.10.20.",
        "05",
        "http://192.168.1.05/text"
      )
    ).toBe("http://10.10.20.05");
  });

  it("keeps camera index landing pages when changing the prefix", () => {
    expect(
      resolveCameraAddressWithStablePath(
        "http://10.10.20.",
        "07",
        "http://10.20.100.107/index.html"
      )
    ).toBe("http://10.10.20.07/index.html");
  });
});

describe("cameraRootFromUrl", () => {
  it("returns the origin for HTTP camera page URLs", () => {
    expect(cameraRootFromUrl("http://10.20.100.105/rmt.html")).toBe("http://10.20.100.105");
    expect(cameraRootFromUrl("https://10.20.100.105/index.html?mode=setup")).toBe(
      "https://10.20.100.105"
    );
  });

  it("keeps non-http URLs unchanged", () => {
    expect(cameraRootFromUrl("about:blank")).toBe("about:blank");
  });

  it("preserves the typed camera host text on reload", () => {
    expect(cameraRootFromUrl("http://10.20.100.05/rmt.html")).toBe("http://10.20.100.05");
  });
});
