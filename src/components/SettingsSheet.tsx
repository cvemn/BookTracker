import { useState } from 'react';
import { lastBackupAt, saveBackup } from '../lib/backup';
import { books, importBackup, setMe, useStore } from '../lib/store';
import { CRITTERS } from '../lib/types';
import { tick } from '../lib/feel';
import { Sheet } from './Sheet';

export function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const me = useStore((s) => s.me);
  return (
    <Sheet open={open} onClose={onClose} label="Me" wide>
      <h2 className="sheet-title">Me</h2>
      {me && <ProfileCard />}
      <SafeCard />
      {!isNativeApp() && <InstallCard />}
    </Sheet>
  );
}

function isNativeApp() {
  return !!(window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.();
}

function ProfileCard() {
  const me = useStore((s) => s.me)!;
  return (
    <section className="card">
      <h3>My reading buddy</h3>
      <div className="critters small">
        {CRITTERS.map((c) => (
          <button key={c} className={c === me.critter ? 'on' : ''} onClick={() => (setMe(me.name, c), tick())} aria-label={`Pick ${c}`}>
            {c}
          </button>
        ))}
      </div>
    </section>
  );
}

function SafeCard() {
  const entries = useStore((s) => s.entries);
  const count = books({ entries }).length;
  const [msg, setMsg] = useState('');
  const [last, setLast] = useState(lastBackupAt());
  const days = last ? Math.floor((Date.now() - last) / 86400000) : null;

  return (
    <section className="card safe-card">
      <h3>My books are safe 🛟</h3>
      <p>
        Everything saves on this phone as you go{isNativeApp() ? ', and Android backs it up with the rest of your phone' : ''}. For extra peace of mind, save a
        backup file now and then (to Google Drive, email or Files). It brings all {count} book{count === 1 ? '' : 's'} back on any phone.
      </p>
      <p className="muted small">
        {days === null ? 'No backup saved yet.' : days === 0 ? 'Last backup: today ✓' : `Last backup: ${days} day${days === 1 ? '' : 's'} ago`}
      </p>
      <div className="row-start">
        <button
          className="btn primary press"
          onClick={async () => {
            tick();
            try {
              if ((await saveBackup()) === 'saved') {
                setLast(Date.now());
                setMsg('Backup saved 🎉');
              }
            } catch {
              setMsg('Couldn’t save the backup. Try again?');
            }
          }}
        >
          Save a backup
        </button>
        <label className="btn ghost press">
          Restore from a backup
          <input
            type="file"
            accept="application/json,.json"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                const n = importBackup(await f.text());
                setMsg(`Restored ${n} book${n === 1 ? '' : 's'} 🎉`);
              } catch {
                setMsg('That file isn’t a Dogear backup.');
              }
              e.target.value = '';
            }}
          />
        </label>
      </div>
      {msg && <p className="muted">{msg}</p>}
    </section>
  );
}

function InstallCard() {
  return (
    <section className="card">
      <h3>Put Dogear on my phone 📱</h3>
      <p>
        <b>Android:</b> get the app from the <a href="./get.html">download page</a>, or open Dogear in Chrome and tap <b>⋮</b> then <b>Install app</b>.
      </p>
      <p>
        <b>iPhone:</b> open it in Safari, tap <b>Share</b> then <b>Add to Home Screen</b>.
      </p>
    </section>
  );
}
