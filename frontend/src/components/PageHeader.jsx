export default function PageHeader({ title, lede }) {
  return (
    <header className="page-head">
      <h1 id="page-title" tabIndex={-1}>{title}</h1>
      {lede ? <p className="lede">{lede}</p> : null}
    </header>
  );
}
