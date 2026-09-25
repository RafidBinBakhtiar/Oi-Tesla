import type { Zone } from '@/lib/types';

interface Props {
  id: string;
  label: string;
  zones: Zone[];
  value: string;
  onChange: (id: string) => void;
  exclude?: string;
  disabled?: boolean;
}

/** Sub-locations grouped by zone — the zone is what pooling matches on. */
export function LocationSelect({ id, label, zones, value, onChange, exclude, disabled }: Props) {
  return (
    <label className="field" htmlFor={id}>
      {label}
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} required>
        <option value="" disabled>
          Choose an area…
        </option>
        {zones.map((zone) => (
          <optgroup key={zone.id} label={zone.name}>
            {zone.subLocations
              .filter((s) => s.id !== exclude)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}
