import { useEffect, useRef } from 'react';

const SHORTCUTS = [
  ['Space', 'Play the whole piece. When a button has focus, Space presses that button.'],
  ['←', 'Previous region'],
  ['→', 'Next region'],
  ['L', 'Play the legend'],
  ['E', 'Speak the explanation'],
  ['S', 'Stop audio and speech'],
  ['A', 'Turn accessibility mode on or off'],
  ['?', 'Open or close this dialog'],
  ['Esc', 'Close this dialog'],
];

export default function ShortcutsDialog({ open, onClose }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="shortcuts"
      aria-labelledby="shortcuts-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={() => {
        if (open) onClose();
      }}
    >
      <div className="dialog-head">
        <h2 id="shortcuts-title">Keyboard shortcuts</h2>
        <button type="button" className="btn btn--small" onClick={onClose}>Close</button>
      </div>
      <div className="dialog-body">
        <table className="shortcut-table">
          <caption>Shortcuts work everywhere except while typing in a field.</caption>
          <thead>
            <tr>
              <th scope="col">Key</th>
              <th scope="col">Action</th>
            </tr>
          </thead>
          <tbody>
            {SHORTCUTS.map(([key, action]) => (
              <tr key={key}>
                <th scope="row"><kbd>{key}</kbd></th>
                <td>{action}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="hint">
          On a focused button, Space activates the button instead of starting the piece.
          The shortcut dialog keeps focus inside it until you close it.
        </p>
      </div>
    </dialog>
  );
}
