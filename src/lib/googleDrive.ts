declare const google: {
  accounts: {
    oauth2: {
      initTokenClient(config: {
        client_id: string;
        scope: string;
        callback: (response: { access_token?: string; expires_in?: number }) => void;
      error_callback?: (error: { type: string; message: string }) => void;
    }): { requestAccessToken: (hint: { prompt: string }) => void };
    };
  };
};

const FOLDER_MIME = 'application/vnd.google-apps.folder';
const BASE_URL = 'https://www.googleapis.com/drive/v3';
const UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3';
const SCOPE = 'https://www.googleapis.com/auth/drive.file';

export async function requestDriveToken(clientId: string): Promise<string> {
  await loadGis();
  return new Promise((resolve, reject) => {
    try {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPE,
        callback: (resp) => {
          if (resp.access_token) resolve(resp.access_token);
          else reject(new Error('No access token returned'));
        },
        error_callback: (err) => reject(err),
      });
      client.requestAccessToken({ prompt: '' });
    } catch (err) {
      reject(err);
    }
  });
}

function loadGis(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof google !== 'undefined' && google.accounts) {
      resolve();
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.onload = () => resolve();
    document.head.appendChild(s);
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
