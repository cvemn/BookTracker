/** Biscuit, the Dogear pup. One ear is folded down like a dog-eared page. */
export function Mascot({ size = 56, mood = 'happy' }: { size?: number; mood?: 'happy' | 'sleepy' | 'curious' }) {
  return (
    <svg className={`mascot mascot-${mood}`} width={size} height={size} viewBox="0 0 120 120" aria-hidden="true">
      <ellipse cx="60" cy="112" rx="34" ry="5" fill="#3b2a20" opacity=".12" />
      {/* perky ear */}
      <path className="ear-left" d="M30 44 C18 22 26 8 40 14 C48 18 50 32 48 42 Z" fill="#c9875b" stroke="#3b2a20" strokeWidth="3.5" strokeLinejoin="round" />
      {/* dog-eared ear: a folded page corner */}
      <path className="ear-right" d="M72 40 L96 26 L100 58 Z" fill="#fff6e6" stroke="#3b2a20" strokeWidth="3.5" strokeLinejoin="round" />
      <path d="M96 26 L100 58 L84 46 Z" fill="#e8b48a" stroke="#3b2a20" strokeWidth="3.5" strokeLinejoin="round" />
      {/* head */}
      <path d="M22 70 C22 44 40 32 60 32 C80 32 98 44 98 70 C98 92 82 104 60 104 C38 104 22 92 22 70 Z" fill="#f3c999" stroke="#3b2a20" strokeWidth="3.5" />
      {/* eye patch */}
      <path d="M34 58 C38 48 52 48 54 60 C54 70 40 74 34 66 Z" fill="#c9875b" opacity=".85" />
      {mood === 'sleepy' ? (
        <>
          <path d="M40 64 q5 4 10 0" stroke="#3b2a20" strokeWidth="3.5" fill="none" strokeLinecap="round" />
          <path d="M70 64 q5 4 10 0" stroke="#3b2a20" strokeWidth="3.5" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle className="eye" cx="45" cy="63" r="5" fill="#3b2a20" />
          <circle className="eye" cx="75" cy="63" r="5" fill="#3b2a20" />
          <circle cx="47" cy="61" r="1.6" fill="#fff" />
          <circle cx="77" cy="61" r="1.6" fill="#fff" />
        </>
      )}
      <circle cx="36" cy="78" r="6" fill="#ff8a7a" opacity=".55" />
      <circle cx="84" cy="78" r="6" fill="#ff8a7a" opacity=".55" />
      <ellipse cx="60" cy="74" rx="7" ry="5" fill="#3b2a20" />
      <path d="M60 79 v6 M60 85 q-7 6 -12 0 M60 85 q7 6 12 0" stroke="#3b2a20" strokeWidth="3" fill="none" strokeLinecap="round" />
      {mood !== 'sleepy' && <path d="M56 88 q4 10 8 0 Z" fill="#ff6b6b" stroke="#3b2a20" strokeWidth="2.5" strokeLinejoin="round" />}
    </svg>
  );
}
