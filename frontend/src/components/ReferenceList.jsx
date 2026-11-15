import { REFERENCES, isDoi } from '../references.js';

export default function ReferenceList() {
  return (
    <ol className="ref-list">
      {REFERENCES.map((reference) => (
        <li key={reference.id}>
          <span className="ref-citation">{reference.citation}</span>{' '}
          {isDoi(reference.doi) ? (
            <a
              className="ref-doi"
              href={`https://doi.org/${reference.doi}`}
              target="_blank"
              rel="noreferrer"
            >
              https://doi.org/{reference.doi}
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          ) : (
            <span className="ref-doi placeholder">{reference.doi}</span>
          )}
        </li>
      ))}
    </ol>
  );
}
