export default function TextField({ id, label, type = 'text', value, onChange, error, hint, autoComplete, required = true }) {
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {!required && <span className="muted" style={{ fontWeight: 400 }}> (optional)</span>}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        required={required}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
      />
      {error ? (
        <span id={`${id}-error`} className="field-error">{error}</span>
      ) : hint ? (
        <span id={`${id}-hint`} className="field-hint">{hint}</span>
      ) : null}
    </div>
  );
}
