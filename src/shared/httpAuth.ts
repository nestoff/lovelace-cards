export interface HttpAuthRequest {
  requestId: string;
  url: string;
  host: string;
  port: number;
  realm?: string;
  scheme?: string;
  isProxy?: boolean;
  webContentsId?: number;
}

export interface HttpAuthResponse {
  username?: string;
  password?: string;
}
