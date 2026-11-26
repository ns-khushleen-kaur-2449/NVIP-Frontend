import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { getTimezones } from '@/lib/api';

// GET /api/v1/timezones, read once per session and shared by every form ([{ id, label, offset_minutes, common }],
// common zones first). A failed read is not kept, so the next form that opens asks again.
let cached = null;

export function loadTimezones() {
  if (!cached) {
    cached = Promise.resolve()
      .then(() => getTimezones())
      .then((response) => {
        if (!Array.isArray(response?.data)) throw new Error('The timezone list could not be read.');
        return response.data;
      })
      .catch((error) => {
        cached = null;
        throw error;
      });
  }
  return cached;
}

/** For tests: forget the session's list. */
export function resetTimezoneCache() {
  cached = null;
}

/** The timezone list: { zones, error, loading, retry }. */
export function useTimezones() {
  const [state, setState] = useState({ zones: null, error: null });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    loadTimezones()
      .then((zones) => live && setState({ zones, error: null }))
      .catch(() => live && setState({ zones: null, error: 'The timezone list could not be loaded.' }));
    return () => { live = false; };
  }, [attempt]);
  const retry = useCallback(() => {
    setState({ zones: null, error: null });
    setAttempt((n) => n + 1);
  }, []);
  return { ...state, loading: !state.zones && !state.error, retry };
}

// Search on the label and the id, ignoring case, "_" and "/": "los angeles", "pacific" and "dubai" all match.
const normalise = (text) => String(text || '').toLowerCase().replace(/[_/]/g, ' ');
const matches = (value, search, keywords = []) => {
  const wanted = normalise(search).trim();
  if (!wanted) return 1;
  return [value, ...keywords].some((text) => normalise(text).includes(wanted)) ? 1 : 0;
};

/**
 * One searchable timezone picker for every form. Shows each zone's label and hands `onChange` its IANA id only.
 * A `value` missing from the list (an old stored one) stays shown as selected. When the list cannot be loaded the
 * current value is shown read-only with the error: never a free-text box.
 *
 * `clearLabel`: offer an entry that clears the value (onChange('')), e.g. "Company default".
 */
export default function TimezoneSelect({
  value, onChange, disabled = false, required = false, placeholder = 'Select a timezone', clearLabel,
  id, className, 'aria-label': ariaLabel = 'Timezone', 'aria-invalid': ariaInvalid,
}) {
  const { zones, error, loading, retry } = useTimezones();
  const [open, setOpen] = useState(false);
  const current = value || '';
  const known = useMemo(() => zones?.find((zone) => zone.id === current) || null, [zones, current]);
  const groups = useMemo(() => ({
    common: (zones || []).filter((zone) => zone.common),
    other: (zones || []).filter((zone) => !zone.common),
  }), [zones]);

  if (error) {
    return (
      <div className={cn('space-y-1', className)} data-testid="timezone-select-error">
        <div id={id} aria-label={ariaLabel} aria-readonly="true"
          className="flex h-9 items-center rounded-md border border-border bg-muted/40 px-3 text-sm text-muted-foreground">
          {current || clearLabel || 'Not set'}
        </div>
        <p role="alert" className="text-xs text-destructive">
          {error}{' '}
          <button type="button" onClick={retry} className="underline underline-offset-2">Try again</button>
        </p>
      </div>
    );
  }

  const shown = known?.label || current || (clearLabel && !required ? clearLabel : '');
  const pick = (next) => {
    onChange?.(next);
    setOpen(false);
  };
  const item = (zone) => (
    <CommandItem key={zone.id} value={zone.id} keywords={[zone.label]} onSelect={() => pick(zone.id)}>
      <Check className={cn('h-4 w-4', zone.id === current ? 'opacity-100' : 'opacity-0')} aria-hidden="true" />
      <span className="truncate">{zone.label}</span>
    </CommandItem>
  );

  return (
    <Popover open={open} onOpenChange={(next) => !disabled && setOpen(next)}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" id={id} aria-label={ariaLabel} aria-expanded={open}
          aria-required={required || undefined} aria-invalid={ariaInvalid} disabled={disabled || loading}
          data-value={current} className={cn('w-full justify-between font-normal', !shown && 'text-muted-foreground', className)}>
          <span className="truncate">{loading && !shown ? 'Loading timezones…' : shown || placeholder}</span>
          {loading ? <Loader2 className="ml-2 h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
            : <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" aria-hidden="true" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[280px] p-0" align="start">
        <Command filter={matches} label="Search timezones">
          <CommandInput placeholder="Search city, region or offset…" />
          <CommandList>
            <CommandEmpty>No timezone found.</CommandEmpty>
            {(clearLabel && !required) || (current && !known) ? (
              <CommandGroup heading="Current">
                {clearLabel && !required && (
                  <CommandItem value="__clear__" keywords={[clearLabel]} onSelect={() => pick('')}>
                    <Check className={cn('h-4 w-4', !current ? 'opacity-100' : 'opacity-0')} aria-hidden="true" />
                    {clearLabel}
                  </CommandItem>
                )}
                {current && !known && (
                  <CommandItem value={current} onSelect={() => pick(current)}>
                    <Check className="h-4 w-4" aria-hidden="true" />{current}
                  </CommandItem>
                )}
              </CommandGroup>
            ) : null}
            <CommandGroup heading="Common">{groups.common.map(item)}</CommandGroup>
            <CommandGroup heading="All timezones">{groups.other.map(item)}</CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
