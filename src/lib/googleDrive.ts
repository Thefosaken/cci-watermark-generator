declare const google: {
  accounts: {
    oauth2: {
      initTokenClient(config: {
        client_id: string;
        scope: string;
        callback: (response: {
          access_token?: string;
          expires_in?: number;
          error?: string;
          error_description?: string;
        }) => void;
        error_callback?: (error: { type: string; message?: string }) => void;
      }): { requestAccessToken: (hint?: { prompt?: string; hint?: string }) => void };
    };
  };
  picker: {
    PickerBuilder: new () => PickerBuilder;
    DocsView: new (viewId: string) => DocsView;
    ViewId: { FOLDERS: string };
    Action: { PICKED: string; CANCEL: string };
  };
};

declare const gapi: {
  load: (name: string, callback: () => void) => void;
};

interface PickerBuilder {
  addView(view: DocsView): PickerBuilder;
  setOAuthToken(token: string): PickerBuilder;
  setDeveloperKey(key: string): PickerBuilder;
  setCallback(cb: (data: PickerResult) => void): PickerBuilder;
  build(): Picker;
}

interface Picker {
  setVisible(visible: boolean): void;
}

interface DocsView {
  setSelectFolderEnabled(enabled: boolean): DocsView;
}

interface PickerResult {
  action: string;
  docs: Array<{ id: string; name: string }>;
}

const FOLDER_MIME = 'application/vnd.google-apps.folder';
const BASE_URL = 'https://www.googleapis.com/drive/v3';
const UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3';
const SCOPE = 'https://www.googleapis.com/auth/drive.file';

/**
 * A Drive-related failure carrying a plain-English `message` (safe to show the
 * user directly) plus a machine-readable `code`. `userCancelled` is true when
 * the user deliberately backed out (e.g. closed the folder picker) so callers
 * can treat it as a soft abort rather than a hard error.
 */
export class DriveError extends Error {
  readonly code: string;
  readonly userCancelled: boolean;

  constructor(code: string, message: string, userCancelled = false) {
    super(message);
    this.name = 'DriveError';
    this.code = code;
    this.userCancelled = userCancelled;
  }
}

export interface GoogleConfig {
  clientId: string;
  apiKey: string;
}

/**
 * Reads the Google credentials and fails loudly with an actionable message if
 * either is missing or malformed. NEXT_PUBLIC_* values are inlined at build
 * time, so an empty value here means the variable was absent when Vercel built
 * the app — fixing it requires setting it in Vercel and redeploying.
 */
export function getGoogleConfig(): GoogleConfig {
  const clientId = (process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? '').trim();
  const apiKey = (process.env.NEXT_PUBLIC_GOOGLE_API_KEY ?? '').trim();

  const missing: string[] = [];
  if (!clientId) missing.push('NEXT_PUBLIC_GOOGLE_CLIENT_ID');
  if (!apiKey) missing.push('NEXT_PUBLIC_GOOGLE_API_KEY');

  if (missing.length > 0) {
    throw new DriveError(
      'config-missing',
      "Google Drive export isn't set up for this site.\n" +
        `Missing build setting(s): ${missing.join(' and ')}.\n` +
        'Add them in Vercel → Settings → Environment Variables ' +
        '(Production), then redeploy — environment changes only take effect on ' +
        'a fresh deployment.',
    );
  }

  if (!clientId.endsWith('.apps.googleusercontent.com')) {
    throw new DriveError(
      'config-invalid',
      'The Google client ID looks wrong — it should end in ' +
        '".apps.googleusercontent.com".\nCheck NEXT_PUBLIC_GOOGLE_CLIENT_ID in ' +
        'Vercel → Settings → Environment Variables.',
    );
  }

  return { clientId, apiKey };
}

export function loadGisScript(): void {
  if (typeof document === 'undefined') return;
  if (document.querySelector('script[src="https://accounts.google.com/gsi/client"]')) return;
  const s = document.createElement('script');
  s.src = 'https://accounts.google.com/gsi/client';
  s.async = true;
  document.head.appendChild(s);
}

export function isGisLoaded(): boolean {
  return typeof google !== 'undefined' && !!google.accounts;
}

/** Plain-English explanation for a Google Identity Services `error_callback` type. */
function describeAuthError(type: string | undefined): string {
  switch (type) {
    case 'popup_failed_to_open':
      return (
        "The Google sign-in window couldn't open.\n" +
        'Allow pop-ups for this site, then disable any ad blocker or privacy ' +
        'extension (uBlock, Brave Shields, etc.) and try again.'
      );
    case 'popup_closed':
      return (
        'The Google sign-in window closed before sign-in finished. Usual causes:\n' +
        "• This exact web address isn't listed under \"Authorized JavaScript " +
        'origins" on the OAuth client in Google Cloud Console.\n' +
        "• Your Google account isn't allowed on the app's consent screen — add " +
        'it as a Test user, or publish the app.\n' +
        '• A browser extension or a strict privacy / third-party-cookie setting ' +
        'closed the popup — try a normal Chrome window with extensions off.'
      );
    default:
      return `Google sign-in failed (${type || 'unknown'}). Please try again.`;
  }
}

/** Plain-English explanation for an error returned inside the token-client callback. */
function describeTokenError(error: string, description?: string): string {
  if (error === 'access_denied') {
    return (
      'Google denied access to Drive.\n' +
      "Either the permission was declined, or your account isn't allowed on " +
      "the app's consent screen (add it as a Test user, or publish the app)." +
      (description ? `\nDetails: ${description}` : '')
    );
  }
  return `Google sign-in error: ${error}${description ? ` — ${description}` : ''}.`;
}

export function requestDriveToken(clientId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!isGisLoaded()) {
      reject(
        new DriveError(
          'gis-not-loaded',
          "Google's sign-in library didn't load.\n" +
            'It is usually blocked by an ad blocker or privacy extension. ' +
            'Disable those for this site and refresh the page.',
        ),
      );
      return;
    }

    // GIS can fire both callbacks in edge cases; settle the promise only once.
    let settled = false;

    const client = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      callback: (resp) => {
        if (settled) return;
        settled = true;
        if (resp.error) {
          reject(new DriveError('token-error', describeTokenError(resp.error, resp.error_description)));
        } else if (resp.access_token) {
          resolve(resp.access_token);
        } else {
          reject(new DriveError('no-token', 'Google did not return an access token. Please try again.'));
        }
      },
      error_callback: (err) => {
        if (settled) return;
        settled = true;
        reject(new DriveError(err.type || 'auth-error', describeAuthError(err.type)));
      },
    });

    client.requestAccessToken({ prompt: 'consent' });
  });
}

function loadGapi(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof gapi !== 'undefined') {
      resolve();
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://apis.google.com/js/api.js';
    s.onload = () => resolve();
    s.onerror = () =>
      reject(
        new DriveError(
          'gapi-blocked',
          "Google's picker library (apis.google.com) couldn't load — it is " +
            'likely blocked by an ad blocker or privacy extension. Disable it ' +
            'for this site and try again.',
        ),
      );
    document.head.appendChild(s);
  });
}

export function showFolderPicker(token: string, apiKey: string): Promise<string> {
  return new Promise((resolve, reject) => {
    loadGapi()
      .then(() => {
        gapi.load('picker', () => {
          try {
            const picker = new google.picker.PickerBuilder()
              .addView(
                new google.picker.DocsView(google.picker.ViewId.FOLDERS).setSelectFolderEnabled(true),
              )
              .setOAuthToken(token)
              .setDeveloperKey(apiKey)
              .setCallback((data) => {
                if (data.action === google.picker.Action.PICKED) {
                  resolve(data.docs[0].id);
                } else if (data.action === google.picker.Action.CANCEL) {
                  reject(new DriveError('picker-cancelled', 'Folder selection was cancelled.', true));
                }
              })
              .build();
            picker.setVisible(true);
          } catch {
            reject(
              new DriveError(
                'picker-failed',
                "Couldn't open the Google Drive folder picker.\n" +
                  'Make sure the Google Picker API is enabled in your Google ' +
                  'Cloud project and that NEXT_PUBLIC_GOOGLE_API_KEY is valid.',
              ),
            );
          }
        });
      })
      .catch(reject);
  });
}

export async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
  let attempt = 0;
  while (attempt <= maxRetries) {
    const res = await fetch(url, options);
    // 429 Too Many Requests, 403 Rate Limit, or 50x Server Error
    if (res.status === 429 || res.status === 403 || (res.status >= 500 && res.status < 600)) {
      if (attempt === maxRetries) return res;
      // Exponential backoff: 1s, 2s, 4s plus jitter
      const delayMs = Math.pow(2, attempt) * 1000 + Math.random() * 500;
      await delay(delayMs);
      attempt++;
      continue;
    }
    return res;
  }
  return fetch(url, options);
}

export async function createDriveFolder(token: string, name: string, parentId?: string): Promise<string> {
  const body: Record<string, unknown> = { name, mimeType: FOLDER_MIME };
  if (parentId) body.parents = [parentId];

  const res = await fetchWithRetry(`${BASE_URL}/files`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new DriveError('folder-failed', `Couldn't create the Drive folder "${name}": ${await res.text()}`);
  }
  return (await res.json()).id;
}

export async function uploadDriveFile(token: string, blob: Blob, name: string, parentId: string): Promise<void> {
  const metadata = { name, parents: [parentId] };
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('media', blob, name);

  const res = await fetchWithRetry(`${UPLOAD_URL}/files?uploadType=multipart`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) {
    throw new DriveError('upload-failed', `Couldn't upload "${name}" to Drive: ${await res.text()}`);
  }
}

export function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
