import { describe, expect, it } from "vitest";
import { parseCameraCsv } from "./csv";

describe("parseCameraCsv", () => {
  it("parses camera rows and keeps full URL over suffix", () => {
    const result = parseCameraCsv(
      "number,url,type,lens,display_note,notes\n04,http://10.0.0.2,ALEXA 35,50mm,Handheld,main"
    );

    expect(result.validRows).toEqual([
      {
        rowNumber: 2,
        name: "D",
        url: "http://10.0.0.2",
        suffix: "04",
        cameraType: "ALEXA 35",
        lens: "50mm",
        displayNote: "Handheld",
        notes: "main"
      }
    ]);
    expect(result.errors).toEqual([]);
  });

  it("reports rows with neither URL nor suffix", () => {
    const result = parseCameraCsv("number,url,type,lens,display_note,notes\n,,,,,main");
    expect(result.validRows).toEqual([]);
    expect(result.errors).toEqual([
      { rowNumber: 2, message: "Row must include url or suffix" }
    ]);
  });

  it("still accepts old suffix and name headers without credential columns", () => {
    const result = parseCameraCsv("name,url,suffix,notes\nCamera 8,,8,main");
    expect(result.validRows[0]).toMatchObject({
      name: "Camera 8",
      suffix: "08",
      notes: "main"
    });
    expect(result.errors).toEqual([]);
  });

  it("accepts index as the label column", () => {
    const result = parseCameraCsv("index,url,number,notes\nD,,4,main");
    expect(result.validRows[0]).toMatchObject({
      name: "D",
      suffix: "04",
      notes: "main"
    });
    expect(result.errors).toEqual([]);
  });
});
