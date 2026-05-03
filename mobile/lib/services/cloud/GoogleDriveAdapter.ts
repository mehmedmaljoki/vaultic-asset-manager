import type { CloudAdapter, CloudFile } from '../CloudBackupService';

const APPDATA_SCOPE   = 'https://www.googleapis.com/auth/drive.appdata';
const FILES_ENDPOINT  = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD_ENDPOINT = 'https://www.googleapis.com/upload/drive/v3/files';
const TOKEN_ENDPOINT  = 'https://oauth2.googleapis.com/token';

export interface DriveTokens {
  accessToken:  string;
  refreshToken: string;
  expiresAt:    number;
}

function getWebBrowser() {
  try {
    // Guard against dev builds that don't include the native module.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { NativeModules } = require('react-native') as typeof import('react-native');
    if (!NativeModules.ExpoWebBrowser) return null;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-web-browser') as typeof import('expo-web-browser');
  } catch { return null; }
}
function getCrypto() {
  try { return require('expo-crypto') as typeof import('expo-crypto'); } catch { return null; }
}

async function base64URLFromBytes(bytes: Uint8Array): Promise<string> {
  // btoa works in RN; replace URL-unsafe chars and strip padding
  const bin = Array.from(bytes).map(b => String.fromCharCode(b)).join('');
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function pkceChallenge(verifier: string): Promise<string> {
  const Crypto = getCrypto()!;
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    verifier,
    { encoding: Crypto.CryptoEncoding.BASE64 },
  );
  return hash.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export class GoogleDriveAdapter implements CloudAdapter {
  readonly name = 'gdrive' as const;
  private tokens: DriveTokens | null = null;
  private clientId: string | null = null;
  onTokensRefreshed: ((t: DriveTokens) => void) | null = null;

  async isAvailable(): Promise<boolean> {
    return !!getWebBrowser() && !!getCrypto();
  }

  /**
   * Full PKCE OAuth sign-in via the system browser.
   * Returns the tokens on success, null on cancel/failure.
   * The caller (useCloudBackup) is responsible for persisting tokens.
   */
  async signIn(options: { clientId: string; redirectUri: string }): Promise<DriveTokens | null> {
    if (!(await this.isAvailable())) return null;
    const WB     = getWebBrowser()!;
    const Crypto = getCrypto()!;

    // Generate PKCE code verifier (32 random bytes → base64url)
    const randBytes    = await Crypto.getRandomBytesAsync(32);
    const verifier     = await base64URLFromBytes(randBytes);
    const challenge    = await pkceChallenge(verifier);

    const params = new URLSearchParams({
      client_id:             options.clientId,
      redirect_uri:          options.redirectUri,
      response_type:         'code',
      scope:                 APPDATA_SCOPE,
      access_type:           'offline',
      prompt:                'consent',
      code_challenge:        challenge,
      code_challenge_method: 'S256',
    });
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    const result = await WB.openAuthSessionAsync(authUrl, options.redirectUri);
    if (result.type !== 'success') return null;

    const code = new URL(result.url).searchParams.get('code');
    if (!code) return null;

    const tokenRes = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id:     options.clientId,
        redirect_uri:  options.redirectUri,
        grant_type:    'authorization_code',
        code_verifier: verifier,
      }).toString(),
    });
    if (!tokenRes.ok) return null;
    const data = await tokenRes.json() as { access_token: string; refresh_token?: string; expires_in?: number };
    if (!data.access_token) return null;

    const tokens: DriveTokens = {
      accessToken:  data.access_token,
      refreshToken: data.refresh_token ?? '',
      expiresAt:    Date.now() + (data.expires_in ?? 3600) * 1000,
    };
    this.tokens   = tokens;
    this.clientId = options.clientId;
    return tokens;
  }

  private async authHeader(): Promise<Record<string, string>> {
    if (!this.tokens?.accessToken) throw new Error('not_signed_in');
    // Refresh if expired or about to expire within 60 s
    if (Date.now() >= this.tokens.expiresAt - 60_000) {
      if (!this.tokens.refreshToken || !this.clientId) throw new Error('not_signed_in');
      const res = await fetch(TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          refresh_token: this.tokens.refreshToken,
          client_id:     this.clientId,
          grant_type:    'refresh_token',
        }).toString(),
      });
      if (!res.ok) throw new Error('not_signed_in');
      const data = await res.json() as { access_token: string; expires_in?: number };
      this.tokens = { ...this.tokens, accessToken: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 };
      this.onTokensRefreshed?.(this.tokens);
    }
    return { Authorization: `Bearer ${this.tokens!.accessToken}` };
  }

  async upload(filename: string, json: string): Promise<void> {
    const headers  = await this.authHeader();
    const boundary = `oam${Math.random().toString(36).slice(2)}`;
    const metadata = JSON.stringify({ name: filename, parents: ['appDataFolder'] });
    const body =
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${metadata}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: application/json\r\n\r\n` +
      `${json}\r\n` +
      `--${boundary}--`;
    const r = await fetch(`${UPLOAD_ENDPOINT}?uploadType=multipart`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    });
    if (!r.ok) throw new Error(`gdrive_upload_failed:${r.status}`);
  }

  async list(): Promise<CloudFile[]> {
    const headers = await this.authHeader();
    const r = await fetch(
      `${FILES_ENDPOINT}?spaces=appDataFolder&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc`,
      { headers },
    );
    if (!r.ok) throw new Error(`gdrive_list_failed:${r.status}`);
    const data = await r.json() as { files?: { id: string; name: string; modifiedTime: string }[] };
    return (data.files ?? []).map(f => ({ id: f.id, name: f.name, modifiedAt: f.modifiedTime }));
  }

  async download(id: string): Promise<string> {
    const headers = await this.authHeader();
    const r = await fetch(`${FILES_ENDPOINT}/${id}?alt=media`, { headers });
    if (!r.ok) throw new Error(`gdrive_download_failed:${r.status}`);
    return await r.text();
  }

  // Test seam — lets unit tests inject a fresh token without going through OAuth.
  __setTokens(t: DriveTokens, clientId = '') {
    this.tokens   = t;
    this.clientId = clientId;
  }

  static readonly APPDATA_SCOPE = APPDATA_SCOPE;
}
