"use client";

const RELATIONSHIP_OPTIONS = [
  "Mother",
  "Father",
  "Brother",
  "Sister",
  "Spouse",
  "Son",
  "Daughter",
  "Other",
];

/**
 * Renders a relationship <select>. When the underlying value doesn't match
 * one of the fixed options (or the person picked "Other"), it also renders
 * a free-text input so the specific relationship can be captured - the
 * final stored value is always the plain relationship string either way.
 */
export default function RelationshipField({
  value,
  onChange,
  required = true,
}: {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  const isKnownOption = RELATIONSHIP_OPTIONS.slice(0, -1).includes(value);
  const isOther = value !== "" && !isKnownOption;
  const selectValue = isOther ? "Other" : value;

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-semibold text-ink mb-1.5">Relationship</label>
        <select
          required={required}
          value={selectValue}
          onChange={(e) => {
            const next = e.target.value;
            onChange(next === "Other" ? "" : next);
          }}
          className="w-full rounded-full border border-line bg-white px-5 py-3 text-base text-ink focus:border-brand-500 focus:outline-none"
        >
          <option value="">Select a relationship…</option>
          {RELATIONSHIP_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>

      {selectValue === "Other" && (
        <div>
          <label className="block text-sm font-semibold text-ink mb-1.5">Specify relationship</label>
          <input
            required
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="e.g. Grandmother"
            className="w-full rounded-full border border-line bg-white px-5 py-3 text-base text-ink placeholder:text-body/60 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </div>
      )}
    </div>
  );
}
