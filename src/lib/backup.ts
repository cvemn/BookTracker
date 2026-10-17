import { exportBackup } from './store';

const LAST = 'dogear:lastBackup';

export function lastBackupAt(): number | null {
  try {
    const v = localStorage.getItem(LAST);
    return v ? Number(v) : null;
  } catch {
    return null;
  }
}

/**
 * Save the whole shelf as a file. In the Android app this opens the share
 * sheet, so it can go to Google Drive, email, or Files; on the web it downloads.
 */
export async function saveBackup(): Promise<'saved' | 'cancelled'> {
  const json = exportBackup();
  const name = `dogear-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const { Capacitor } = await import('@capacitor/core');
  if (Capacitor.isNativePlatform()) {
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
    const { Share } = await import('@capacitor/share');
    const { uri } = await Filesystem.writeFile({ path: name, data: json, directory: Directory.Cache, encoding: Encoding.UTF8 });
    try {
      await Share.share({ title: 'Dogear backup', text: 'My Dogear bookshelf', files: [uri], dialogTitle: 'Save your backup' });
    } catch {
      return 'cancelled';
    }
  } else {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  try {
    localStorage.setItem(LAST, String(Date.now()));
  } catch {
    // only used for the "last backup" hint
  }
  return 'saved';
}
