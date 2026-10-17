import { useState } from 'react';
import { setMe } from '../lib/store';
import { readInvite } from '../lib/invite';
import { CRITTERS, type SyncConfig } from '../lib/types';
import { Mascot } from './Mascot';

export function Onboarding({ invited, onInvite }: { invited: boolean; onInvite: (cfg: SyncConfig) => void }) {
  const [name, setName] = useState('');
  const [pasting, setPasting] = useState(false);
  const [link, setLink] = useState('');
  const pasted = readInvite(link);
  const [critter, setCritter] = useState(CRITTERS[1]);
  return (
    <main className="onboarding">
      <form
        className="onboard-card"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          if (pasted) onInvite(pasted);
          setMe(name, critter);
        }}
      >
        <Mascot size={120} />
        <h1>
          Hi, I’m Biscuit! <span aria-hidden="true">🐾</span>
        </h1>
        <p className="lead">
          {invited
            ? 'Someone saved you a spot on their shelf 💞 Tell me who you are and I’ll fetch all your books together.'
            : 'I keep track of every book you read, how much you loved it, and what you thought. Who’s reading?'}
        </p>
        <label className="field big">
          <span>Your name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sam" autoFocus maxLength={30} />
        </label>
        <fieldset className="critters">
          <legend>Pick your reading buddy</legend>
          {CRITTERS.map((c) => (
            <button type="button" key={c} className={c === critter ? 'on' : ''} onClick={() => setCritter(c)} aria-label={`Pick ${c}`} aria-pressed={c === critter}>
              {c}
            </button>
          ))}
        </fieldset>
        {!invited && (pasting ? (
          <label className="field">
            <span>Invite link from your person</span>
            <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Paste it here" />
            {link && !pasted && <small className="error">That doesn’t look like a Dogear invite link.</small>}
            {pasted && <small className="ok">Got it! You’ll join their shelf. 💞</small>}
          </label>
        ) : (
          <button type="button" className="link-btn invite-toggle" onClick={() => setPasting(true)}>
            Got an invite link from your person?
          </button>
        ))}
        <button className="btn primary big press" disabled={!name.trim()}>
          {invited || pasted ? 'Join the shelf' : 'Start my shelf'} →
        </button>
      </form>
    </main>
  );
}
