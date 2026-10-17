import { useState } from 'react';
import schemaSql from '../../supabase/schema.sql?raw';
import { makeInviteLink, readInvite } from '../lib/invite';
import { connect, disconnect, exportBackup, importBackup, newShelfCode, setMe, syncNow, useStore } from '../lib/store';
import { CRITTERS } from '../lib/types';
import { Sheet } from './Sheet';

export const APP_URL: string = import.meta.env.VITE_APP_URL || (location.protocol.startsWith('http') ? location.href.split('#')[0] : '');

export function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const me = useStore((s) => s.me);
  return (
    <Sheet open={open} onClose={onClose} label="Settings" wide>
      <h2 className="sheet-title">Settings</h2>
      {me && <ProfileCard />}
      <ShareCard />
      <InstallCard />
      <BackupCard />
    </Sheet>
  );
}

function ProfileCard() {
  const me = useStore((s) => s.me)!;
  const [name, setName] = useState(me.name);
  return (
    <section className="card">
      <h3>You</h3>
      <div className="critters small">
        {CRITTERS.map((c) => (
          <button key={c} className={c === me.critter ? 'on' : ''} onClick={() => setMe(name || me.name, c)} aria-label={`Pick ${c}`}>
            {c}
          </button>
        ))}
      </div>
      <label className="field">
        <span>Your name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && name !== me.name && setMe(name, me.critter)} />
      </label>
    </section>
  );
}

function ShareCard() {
  const sync = useStore((s) => s.sync);
  const syncState = useStore((s) => s.syncState);
  const syncError = useStore((s) => s.syncError);
  const lastSynced = useStore((s) => s.lastSynced);
  const [copied, setCopied] = useState(false);

  if (sync) {
    const link = makeInviteLink(APP_URL, sync);
    const share = async () => {
      if (navigator.share) {
        try {
          await navigator.share({ title: 'Join my Dogear shelf', text: 'Come read with me 📚🐶', url: link });
          return;
        } catch {
          // cancelled; fall back to copying
        }
      }
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };
    return (
      <section className="card share-card">
        <h3>Shared shelf 💞</h3>
        <p>Send this link to your person. Opening it puts them on this shelf, on any phone or computer.</p>
        <div className="invite">
          <input readOnly value={link} onFocus={(e) => e.target.select()} aria-label="Invite link" />
          <button className="btn primary" onClick={share}>{copied ? 'Copied!' : 'Share link'}</button>
        </div>
        <p className="muted small">
          {syncState === 'syncing' && 'Syncing…'}
          {syncState === 'idle' && lastSynced && `Synced ${new Date(lastSynced).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`}
          {syncState === 'error' && <span className="error">Couldn’t sync: {syncError}</span>}
        </p>
        <div className="row-end">
          <button className="btn ghost" onClick={() => syncNow()}>Sync now</button>
          <button className="btn ghost" onClick={() => confirm('Stop syncing on this device? Your books stay here.') && disconnect()}>
            Leave shelf
          </button>
        </div>
      </section>
    );
  }
  return <ConnectCard />;
}

function ConnectCard() {
  const [mode, setMode] = useState<'choose' | 'create' | 'join'>('choose');
  const [url, setUrl] = useState<string>(import.meta.env.VITE_SUPABASE_URL ?? '');
  const [key, setKey] = useState<string>(import.meta.env.VITE_SUPABASE_ANON_KEY ?? '');
  const [invite, setInvite] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setErr('');
    try {
      await fn();
    } catch (e) {
      setErr((e as Error).message.includes('404') || (e as Error).message.includes('PGRST')
        ? 'Connected, but the shelf tables aren’t there yet. Did the SQL step run?'
        : (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card share-card">
      <h3>Read together 💞</h3>
      <p>Right now your shelf lives on this device only. Make it a shared shelf and your person sees your books, ratings and scribbles (and you see theirs).</p>
      {mode === 'choose' && (
        <div className="row-start">
          <button className="btn primary" onClick={() => setMode('create')}>Start a shared shelf</button>
          <button className="btn ghost" onClick={() => setMode('join')}>I have an invite link</button>
        </div>
      )}
      {mode === 'join' && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const cfg = readInvite(invite);
            if (!cfg) return setErr('That doesn’t look like a Dogear invite link.');
            run(() => connect(cfg));
          }}
        >
          <label className="field">
            <span>Invite link</span>
            <input value={invite} onChange={(e) => setInvite(e.target.value)} placeholder="https://…#join=…" />
          </label>
          <div className="row-end">
            <button type="button" className="btn ghost" onClick={() => setMode('choose')}>Back</button>
            <button className="btn primary" disabled={busy}>{busy ? 'Joining…' : 'Join shelf'}</button>
          </div>
        </form>
      )}
      {mode === 'create' && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(() => connect({ url: url.trim(), key: key.trim(), shelf: newShelfCode() }));
          }}
        >
          <ol className="steps">
            <li>
              Make a free project at <a href="https://supabase.com/dashboard/new" target="_blank" rel="noreferrer">supabase.com</a> (one time only, takes a minute).
            </li>
            <li>
              Open <b>SQL Editor</b>, paste this and press <b>Run</b>.{' '}
              <button
                type="button"
                className="btn tiny"
                onClick={async () => {
                  await navigator.clipboard.writeText(schemaSql);
                  setCopied(true);
                }}
              >
                {copied ? 'Copied ✓' : 'Copy SQL'}
              </button>
            </li>
            <li>
              From <b>Project Settings → API</b>, paste the Project URL and the <code>anon</code> public key:
            </li>
          </ol>
          <label className="field">
            <span>Project URL</span>
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://abcd.supabase.co" required />
          </label>
          <label className="field">
            <span>anon public key</span>
            <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="eyJhbGciOi…" required />
          </label>
          <div className="row-end">
            <button type="button" className="btn ghost" onClick={() => setMode('choose')}>Back</button>
            <button className="btn primary" disabled={busy}>{busy ? 'Connecting…' : 'Create our shelf'}</button>
          </div>
        </form>
      )}
      {err && <p className="error">{err}</p>}
    </section>
  );
}

function InstallCard() {
  return (
    <section className="card">
      <h3>Put Dogear on your phone 📱</h3>
      <p>
        <b>Android:</b> open Dogear in Chrome, tap <b>⋮</b> then <b>Install app</b> (or <b>Add to Home screen</b>). It opens full screen like any other app and works offline.
      </p>
      <p>
        <b>iPhone:</b> open it in Safari, tap <b>Share</b> then <b>Add to Home Screen</b>.
      </p>
    </section>
  );
}

function BackupCard() {
  const [msg, setMsg] = useState('');
  const download = () => {
    const blob = new Blob([exportBackup()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `dogear-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <section className="card">
      <h3>Backup</h3>
      <p>Save your whole shelf as a file, or bring one back.</p>
      <div className="row-start">
        <button className="btn ghost" onClick={download}>Download backup</button>
        <label className="btn ghost">
          Restore from file
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
