import { FORMULA_FUNCTIONS } from '../../core';

function prefix(value: string): string | null {
  const match = /^=([a-z]*)/i.exec(value.trim());
  return match === null ? null : (match[1] ?? '').toUpperCase();
}

export function FormulaSuggestions(props: {
  readonly value: string;
  readonly onSelect: (value: string) => void;
}) {
  const query = prefix(props.value);
  if (query === null) return null;
  const suggestions = Object.keys(FORMULA_FUNCTIONS)
    .filter(name => name.startsWith(query))
    .slice(0, 8);
  if (suggestions.length === 0) return null;
  return (
    <div className="tego-sheet__formula-suggestions" role="listbox" aria-label="Formula suggestions">
      {suggestions.map(name => (
        <button
          type="button"
          role="option"
          key={name}
          onMouseDown={event => event.preventDefault()}
          onClick={() => props.onSelect(`=${name}()`)}
        >{name}</button>
      ))}
    </div>
  );
}
