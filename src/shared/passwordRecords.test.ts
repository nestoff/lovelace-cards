import { describe, expect, it } from "vitest";
import {
  findPasswordRecord,
  forgetCameraCredential,
  forgetCameraListCredentials
} from "./passwordRecords";
import type { PasswordRecord } from "./types";

const records: PasswordRecord[] = [
  {
    id: "p1",
    jobId: "job-a",
    cameraListId: "list-a",
    cameraId: "camera-42",
    url: "http://192.168.1.42",
    username: "admin",
    password: "alpha"
  },
  {
    id: "p2",
    jobId: "job-b",
    cameraListId: "list-b",
    cameraId: "camera-42",
    url: "http://192.168.1.42",
    username: "admin",
    password: "beta"
  }
];

describe("findPasswordRecord", () => {
  it("scopes identical camera URLs by job and list", () => {
    expect(
      findPasswordRecord(records, {
        jobId: "job-b",
        cameraListId: "list-b",
        url: "http://192.168.1.42",
        username: "admin"
      })?.password
    ).toBe("beta");
  });

  it("returns null when the job/list scope does not match", () => {
    expect(
      findPasswordRecord(records, {
        jobId: "job-a",
        cameraListId: "list-b",
        url: "http://192.168.1.42",
        username: "admin"
      })
    ).toBeNull();
  });
});

describe("forgetCameraCredential", () => {
  const recordsWithSharedOrigins: PasswordRecord[] = [
    {
      id: "matching-linked-camera",
      jobId: "job-a",
      cameraListId: "list-a",
      cameraId: "camera-42",
      url: "http://192.168.1.42",
      username: "admin",
      password: "linked"
    },
    {
      id: "matching-legacy-origin",
      jobId: "job-a",
      cameraListId: "list-a",
      cameraId: null,
      url: "http://192.168.1.42/login.html",
      username: "admin",
      password: "legacy"
    },
    {
      id: "other-linked-camera",
      jobId: "job-a",
      cameraListId: "list-a",
      cameraId: "camera-43",
      url: "http://192.168.1.42",
      username: "admin",
      password: "shared-origin"
    },
    {
      id: "other-list",
      jobId: "job-a",
      cameraListId: "list-b",
      cameraId: "camera-42",
      url: "http://192.168.1.42",
      username: "admin",
      password: "other-scope"
    }
  ];

  it("forgets the linked camera and legacy records at its normalized origin", () => {
    expect(
      forgetCameraCredential(recordsWithSharedOrigins, {
        jobId: "job-a",
        cameraListId: "list-a",
        cameraId: "camera-42",
        url: "http://192.168.1.42/rmt.html"
      }).map((record) => record.id)
    ).toEqual(["other-linked-camera", "other-list"]);
  });

  it("does not remove linked records when only a legacy origin is available", () => {
    expect(
      forgetCameraCredential(recordsWithSharedOrigins, {
        jobId: "job-a",
        cameraListId: "list-a",
        cameraId: null,
        url: "http://192.168.1.42/rmt.html"
      }).map((record) => record.id)
    ).toEqual(["matching-linked-camera", "other-linked-camera", "other-list"]);
  });
});

describe("forgetCameraListCredentials", () => {
  it("forgets only records captured in the requested job and camera list", () => {
    const recordsWithMultipleScopes: PasswordRecord[] = [
      {
        id: "job-a-list-a-linked",
        jobId: "job-a",
        cameraListId: "list-a",
        cameraId: "camera-42",
        url: "http://192.168.1.42",
        username: "admin",
        password: "linked"
      },
      {
        id: "job-a-list-a-legacy",
        jobId: "job-a",
        cameraListId: "list-a",
        cameraId: null,
        url: "http://192.168.1.43",
        username: "admin",
        password: "legacy"
      },
      {
        id: "job-b-list-b",
        jobId: "job-b",
        cameraListId: "list-b",
        cameraId: "camera-42",
        url: "http://192.168.1.42",
        username: "admin",
        password: "other-scope"
      }
    ];

    expect(
      forgetCameraListCredentials(recordsWithMultipleScopes, {
        jobId: "job-a",
        cameraListId: "list-a"
      }).map((record) => record.id)
    ).toEqual(["job-b-list-b"]);
  });
});
