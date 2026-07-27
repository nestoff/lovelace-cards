import { describe, expect, it } from "vitest";
import { findCredentialRecord, normalizeCredentialUrl } from "./credentials";
import type { PasswordRecord } from "./types";

const records: PasswordRecord[] = [
  {
    id: "p1",
    jobId: "job-a",
    cameraListId: "list-a",
    cameraId: "camera-4",
    url: "http://192.168.1.4",
    username: "admin",
    password: "alpha"
  },
  {
    id: "p2",
    jobId: "job-a",
    cameraListId: "list-a",
    cameraId: "camera-5",
    url: "http://192.168.1.5",
    username: "admin",
    password: "beta"
  }
];

describe("credentials", () => {
  it("normalizes login paths to the camera origin", () => {
    expect(normalizeCredentialUrl("http://192.168.1.4/login.html")).toBe("http://192.168.1.4");
  });

  it("finds a saved credential by job, list, and camera id", () => {
    expect(
      findCredentialRecord(records, {
        jobId: "job-a",
        cameraListId: "list-a",
        cameraId: "camera-5",
        url: "http://192.168.1.5/login"
      })?.password
    ).toBe("beta");
  });

  it("uses the newest saved credential when duplicates exist", () => {
    const duplicateRecords: PasswordRecord[] = [
      {
        id: "old",
        jobId: "job-1",
        cameraListId: "list-1",
        cameraId: "camera-1",
        url: "http://10.20.100.104",
        username: "admin",
        password: "old"
      },
      {
        id: "new",
        jobId: "job-1",
        cameraListId: "list-1",
        cameraId: "camera-1",
        url: "http://10.20.100.104/rmt.html",
        username: "admin",
        password: "new"
      }
    ];

    expect(
      findCredentialRecord(duplicateRecords, {
        jobId: "job-1",
        cameraListId: "list-1",
        cameraId: "camera-1",
        url: "http://10.20.100.104/rmt.html"
      })
    ).toMatchObject({ id: "new", password: "new" });
  });
});
