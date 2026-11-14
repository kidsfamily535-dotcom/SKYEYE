// A quiet empty state: a dashed runway and one aircraft silhouette. Server component, no data.
export default function EyeEmpty({ title, body }: { title: string; body: string }) {
  return (
    <section className="eye-empty-card" role="status">
      <svg viewBox="0 0 240 90" aria-hidden="true">
        <line x1="10" y1="64" x2="230" y2="64" stroke="rgba(244,239,227,.25)" strokeWidth="2" strokeDasharray="8 8" strokeLinecap="round" />
        <g transform="translate(120 34) rotate(90)" fill="rgba(255,255,255,.05)" stroke="rgba(227,185,100,.7)" strokeWidth="1.4" strokeLinejoin="round">
          <path d="M0 -26C4 -26 5 -18 5 -10V14C5 20 3 24 0 27C-3 24 -5 20 -5 14V-10C-5 -18 -4 -26 0 -26Z" />
          <path d="M-5 -2L-24 10V14L-5 8Z" /><path d="M5 -2L24 10V14L5 8Z" />
        </g>
      </svg>
      <h2>{title}</h2>
      <p>{body}</p>
    </section>
  );
}
