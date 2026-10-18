// Panel pickers: lists from the server instead of typed names. Adapt fetchNui and the texts to the resource.
import { useEffect, useState } from 'react';
import { MriSelect } from '@mriqbox/ui-kit';
import { fetchNui } from '../utils/fetchNui';

export type Option = { value: string; label: string; [key: string]: unknown };
export type GroupOption = Option & { kind: 'job' | 'gang'; grades: { value: number; label: string }[] };

const cache: Record<string, Option[]> = {};

// Fetched once per NUI session: the lists don't change while the panel is open.
export const useOptions = <T extends Option = Option>(event: string) => {
  const [options, setOptions] = useState<T[]>((cache[event] as T[]) ?? []);
  const [loading, setLoading] = useState(!cache[event]);

  useEffect(() => {
    if (cache[event]) return;
    fetchNui<T[]>(event).then((data) => {
      cache[event] = Array.isArray(data) ? data : [];
      setOptions(cache[event] as T[]);
      setLoading(false);
    });
  }, [event]);

  return { options, loading };
};

// Saved values missing from the list (item or character deleted) still show, so they can be removed.
export const withMissing = (options: Option[], chosen: string[]) => [
  ...options,
  ...chosen.filter((value) => !options.some((o) => o.value === value)).map((value) => ({ value, label: value })),
];

type Access = { name: string; grade: number }[];

// Jobs and gangs in one searchable list; each chosen group gets its minimum grade by name.
export const GroupPicker = ({ value, onChange }: { value: Access; onChange: (v: Access) => void }) => {
  const { options, loading } = useOptions<GroupOption>('getGroupOptions');
  const chosen = value.map((g) => g.name);

  return (
    <div className="flex flex-col gap-2">
      <MriSelect
        multiple
        value={chosen}
        isLoading={loading}
        options={withMissing(options.map((g) => ({ value: g.value, label: `${g.label} (${g.kind === 'job' ? 'emprego' : 'gangue'})` })), chosen)}
        placeholder="Nenhum grupo"
        searchPlaceholder="Buscar emprego ou gangue"
        emptyMessage="Nada encontrado"
        onChange={(names) => onChange(names.map(String).map((name) => value.find((g) => g.name === name) ?? { name, grade: 0 }))}
      />
      {value.map((g) => {
        const option = options.find((o) => o.value === g.name);
        if (!option || option.grades.length < 2) return null;
        return (
          <div key={g.name} className="flex items-center gap-2 pl-1">
            <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">Cargo mínimo em {option.label}</span>
            <div className="w-48 shrink-0">
              <MriSelect
                size="sm"
                searchable={false}
                value={String(g.grade)}
                options={option.grades.map((grade) => ({ value: String(grade.value), label: grade.label }))}
                onChange={(v) => onChange(value.map((x) => (x.name === g.name ? { ...x, grade: Number(v) || 0 } : x)))}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};
