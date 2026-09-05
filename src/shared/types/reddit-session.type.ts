export interface RedditSession {
  accessToken: string;
  expiresAt: number;
  deviceId: string;
  userAgent: string;
  loid: string | undefined;
  session: string | undefined;
}
