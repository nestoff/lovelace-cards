import http from "node:http";

export interface MockCameraRequest {
  url: string;
  cookie: string;
  authorization: string;
}

export interface MockCameraOptions {
  landingPath: "/rmt.html" | "/index.html";
  requireBasicAuth?: boolean;
  username?: string;
  password?: string;
}

export interface MockCameraServer {
  url: string;
  requests: MockCameraRequest[];
  close: () => Promise<void>;
}

export async function startMockCameraServer(
  options: MockCameraOptions = { landingPath: "/index.html" }
): Promise<MockCameraServer> {
  const requests: MockCameraRequest[] = [];
  const expectedAuthorization = `Basic ${Buffer.from(
    `${options.username ?? "admin"}:${options.password ?? "secret"}`
  ).toString("base64")}`;
  const server = http.createServer((request, response) => {
    const url = request.url ?? "/";
    const authorization = request.headers.authorization ?? "";
    requests.push({
      url,
      cookie: request.headers.cookie ?? "",
      authorization
    });

    if (url === "/favicon.ico") {
      response.writeHead(204);
      response.end();
      return;
    }

    if (url === "/") {
      if (options.requireBasicAuth && authorization !== expectedAuthorization) {
        response.writeHead(401, {
          "content-type": "text/plain",
          "www-authenticate": 'Basic realm="DITBrowse test"'
        });
        response.end("Authentication required");
        return;
      }

      response.writeHead(302, {
        location: options.landingPath,
        "set-cookie": "camera-session=active; Path=/; HttpOnly; SameSite=Lax"
      });
      response.end();
      return;
    }

    response.writeHead(200, { "content-type": "text/html" });
    response.end(`
      <!doctype html>
      <html>
        <head><title>Mock Camera</title></head>
        <body>
          <h1>Mock Camera GUI</h1>
          <button>Menu</button>
          <input aria-label="camera setting" value="5600K" />
          <script>
            localStorage.setItem("mock-camera-local", "active");
            sessionStorage.setItem("mock-camera-session", "active");
            const request = indexedDB.open("mock-camera-db", 1);
            request.onupgradeneeded = () => request.result.createObjectStore("settings");
          </script>
        </body>
      </html>
    `);
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Mock camera server did not return a TCP address");
  }

  return {
    url: `http://127.0.0.1:${address.port}`,
    requests,
    close: () => new Promise<void>((resolve) => server.close(() => resolve()))
  };
}
