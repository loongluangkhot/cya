export function Toasts({
  items,
  marqueeActive = false,
}: {
  items: { id: string; text: string }[];
  marqueeActive?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <div className={`toasts${marqueeActive ? ' is-with-marquee' : ''}`}>
      {items.map((t) => (
        <div key={t.id} className="toast">{t.text}</div>
      ))}
    </div>
  );
}
