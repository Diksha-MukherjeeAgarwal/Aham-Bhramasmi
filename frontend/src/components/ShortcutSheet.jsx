const SHORTCUTS = [
  ['Space', 'Play the piece'],
  ['← →', 'Step through regions'],
  ['L', 'Play the legend'],
  ['E', 'Speak the explanation'],
  ['S', 'Stop'],
  ['A', 'Accessibility mode'],
  ['?', 'All shortcuts'],
];

export default function ShortcutSheet() {
  return (
    <section className="shortcut-sheet" aria-label="Keyboard shortcuts">
      <div className="wrap">
        <ul>
          {SHORTCUTS.map(([key, action]) => (
            <li key={key}>
              <kbd>{key}</kbd>
              <span>{action}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
