declare const google: {
  accounts: {
    oauth2: {
      initTokenClient(config: {
        client_id: string;
        scope: string;
        callback: (response: { access_token?: string; expires_in?: number }) => void;
        error_callback?: (error: { type: string; message: string }) => void;
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

export function requestDriveToken(clientId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      callback: (resp) => {
        if (resp.access_token) resolve(resp.access_token);
        else reject(new Error('No access token returned'));
      },
      error_callback: (err) => reject(new Error(err.message || 'Sign-in was cancelled or failed')),
    });
    client.requestAccessToken({ prompt: 'consent' });
  });
}

function loadGapi(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof gapi !== 'undefined') {
      resolve();
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://apis.google.com/js/api.js';
    s.onload = () => resolve();
    document.head.appendChild(s);
  });
}

export function showFolderPicker(token: string, apiKey: string): Promise<string> {
  return new Promise((resolve, reject) => {
    loadGapi().then(() => {
      gapi.load('picker', () => {
        const picker = new google.picker.PickerBuilder()
          .addView(
            new google.picker.DocsView(google.picker.ViewId.FOLDERS)
              .setSelectFolderEnabled(true)
          )
          .setOAuthToken(token)
          .setDeveloperKey(apiKey)
          .setCallback((data) => {
            if (data.action === google.picker.Action.PICKED) {
              resolve(data.docs[0].id);
            } else if (data.action === google.picker.Action.CANCEL) {
              reject(new Error('Folder selection cancelled'));
            }
          })
          .build();
        picker.setVisible(true);
      });
    });
  });
}

export async function createDriveFolder(token: string, name: string, parentId?: string): Promise<string> {
  const body: Record<string, unknown> = { name, mimeType: FOLDER_MIME };
  if (parentId) body.parents = [parentId];

  const res = await fetch(`${BASE_URL}/files`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`createFolder failed: ${await res.text()}`);
  return (await res.json()).id;
}

export async function uploadDriveFile(token: string, blob: Blob, name: string, parentId: string): Promise<void> {
  const metadata = { name, parents: [parentId] };
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('media', blob, name);

  const res = await fetch(`${UPLOAD_URL}/files?uploadType=multipart`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) throw new Error(`uploadFile failed for ${name}: ${await res.text()}`);
}

export function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
