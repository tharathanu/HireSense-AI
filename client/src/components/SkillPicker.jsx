import { useMemo, useState } from 'react';
import { X } from 'lucide-react';

// Searchable multi-select for skills. `value` is an array of skill ids.
export default function SkillPicker({ id, skills, value, onChange, exclude = [] }) {
  const [query, setQuery] = useState('');
  const selected = skills.filter((s) => value.includes(s.id));
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return skills
      .filter((s) => !value.includes(s.id) && !exclude.includes(s.id))
      .filter((s) => s.name.toLowerCase().includes(q))
      .slice(0, 12);
  }, [skills, value, exclude, query]);

  return (
    <div className="stack-sm">
      {selected.length > 0 && (
        <div className="chips">
          {selected.map((s) => (
            <span key={s.id} className="chip chip-good">
              {s.name}
              <button
                type="button"
                className="icon-btn"
                style={{ width: 24, height: 24 }}
                aria-label={`Remove ${s.name}`}
                onClick={() => onChange(value.filter((v) => v !== s.id))}
              >
                <X size={14} />
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        id={id}
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search skills"
        placeholder="Type to search skills"
        autoComplete="off"
      />
      {query.trim() && matches.length === 0 && <span className="field-hint">No matching skill.</span>}
      {matches.length > 0 && (
        <div className="chips">
          {matches.map((s) => (
            <button
              key={s.id}
              type="button"
              className="chip"
              style={{ border: '1px solid var(--rule)', cursor: 'pointer', minHeight: 32 }}
              onClick={() => {
                onChange([...value, s.id]);
                setQuery('');
              }}
            >
              + {s.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
