/**
 * Miso, Kaila's pup: ginger coat, black saddle, a grizzled chin, and big ears.
 * One ear folds over at the tip like a dog-eared page.
 */
export function Mascot({ size = 56, mood = 'happy' }: { size?: number; mood?: 'happy' | 'sleepy' | 'curious' }) {
  return (
    <svg className={`mascot mascot-${mood}`} width={size} height={size} viewBox="0 0 120 120" aria-hidden="true">
      <g stroke="#2b1a12" strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round">
        {/* black saddle and ginger chest */}
        <path d="M24 118 C24 100 38 90 60 90 C82 90 96 100 96 118 Z" fill="#2b1f1a" />
        <path d="M44 118 C44 104 50 96 60 96 C70 96 76 104 76 118 Z" fill="#c8662c" stroke="none" />
        {/* big upright ear, tip flopping outward */}
        <g className="ear-left">
          <path d="M33 54 C24 42 18 28 19 16 C20 10 27 9 31 13 C40 21 49 30 53 40 Z" fill="#b8571f" />
          <path d="M34 47 C28 38 24 28 24 20 C30 22 40 30 46 39 Z" fill="#eaa477" stroke="none" />
          <path d="M22 12 C16 11 10 15 8 22 C14 25 21 22 26 17 Z" fill="#9c4718" />
        </g>
        {/* the dog-eared one: out to the side, tip folded down */}
        <g className="ear-right">
          <path d="M67 40 C77 28 92 24 104 28 C108 30 108 35 104 39 C96 46 88 52 84 56 Z" fill="#b8571f" />
          <path d="M72 41 C80 33 90 30 99 31 C94 38 87 44 82 48 Z" fill="#eaa477" stroke="none" />
          <path d="M104 28 C111 32 112 42 108 48 C104 46 101 40 102 33 Z" fill="#9c4718" />
        </g>
        {/* head */}
        <path d="M26 63 C26 44 41 34 60 34 C79 34 94 44 94 63 C94 82 79 99 60 100 C41 99 26 82 26 63 Z" fill="#c8662c" />
      </g>
      {/* dark brow marks */}
      <path d="M38 50 q8 -7 16 -1" stroke="#2b1f1a" strokeWidth="4" fill="none" strokeLinecap="round" opacity=".55" />
      <path d="M66 49 q8 -6 16 1" stroke="#2b1f1a" strokeWidth="4" fill="none" strokeLinecap="round" opacity=".55" />
      {/* muzzle and grizzled chin */}
      <path d="M45 76 C45 67 52 62 60 62 C68 62 75 67 75 76 C75 87 68 95 60 95 C52 95 45 87 45 76 Z" fill="#dc9361" />
      <path d="M51 88 C53 93 56 95.5 60 95.5 C64 95.5 67 93 69 88 C65 90.5 55 90.5 51 88 Z" fill="#d8cfc4" />
      {mood === 'sleepy' ? (
        <>
          <path d="M40 60 q6 5 12 0" stroke="#2a170e" strokeWidth="3.5" fill="none" strokeLinecap="round" />
          <path d="M68 60 q6 5 12 0" stroke="#2a170e" strokeWidth="3.5" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle className="eye" cx="46" cy="59" r="6" fill="#2a170e" />
          <circle className="eye" cx="74" cy="59" r="6" fill="#2a170e" />
          <circle cx="48" cy="57" r="2" fill="#fff" />
          <circle cx="76" cy="57" r="2" fill="#fff" />
        </>
      )}
      <circle cx="38" cy="75" r="5.5" fill="#ff8a7a" opacity=".5" />
      <circle cx="82" cy="75" r="5.5" fill="#ff8a7a" opacity=".5" />
      <ellipse cx="60" cy="72" rx="7.5" ry="5.5" fill="#1f130d" />
      <ellipse cx="57.5" cy="70.5" rx="2.2" ry="1.3" fill="#fff" opacity=".5" />
      <path d="M60 77 v4 M60 81 q-5 5 -10 0 M60 81 q5 5 10 0" stroke="#2b1a12" strokeWidth="2.8" fill="none" strokeLinecap="round" />
      {mood !== 'sleepy' && <path d="M57 83.5 q3 8 6 0 Z" fill="#ff6b6b" stroke="#2b1a12" strokeWidth="2" strokeLinejoin="round" />}
    </svg>
  );
}
