"use client";

import { ChevronDownIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";

type Entity = { id: string; name: string };

export function EntityCombobox<T extends Entity>({
  label,
  value,
  onChange,
  search,
  preload = [],
  disabled,
}: {
  label: string;
  value: string;
  onChange: (id: string) => void;
  search?: (query: string) => Promise<T[]>;
  preload?: T[];
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [selected, setSelected] = useState<T>();
  const term = query.trim();

  useEffect(() => {
    if (!open || !search || term.length < 2) return;
    let active = true;
    const timer = setTimeout(async () => {
      try {
        const found = await search(term);
        if (active) {
          setResults(found.slice(0, 20));
          setError(false);
          setLoading(false);
        }
      } catch {
        if (active) {
          setError(true);
          setLoading(false);
        }
      }
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [open, search, term, retry]);

  const options =
    term.length >= 2 && search
      ? results
      : preload
          .filter((item) =>
            `${item.name} ${item.id}`.toLowerCase().includes(term.toLowerCase()),
          )
          .slice(0, 20);
  const display =
    selected?.id === value
      ? selected
      : [...preload, ...results].find((item) => item.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            aria-label={label}
            aria-expanded={open}
            className="w-full justify-between"
            disabled={disabled}
            type="button"
            variant="outline"
          >
            {display?.name ?? (value || `Select ${label}`)}
            <ChevronDownIcon aria-hidden="true" />
          </Button>
        }
      />
      <PopoverContent align="start" className="w-(--anchor-width) gap-0 p-0">
        <Command shouldFilter={false}>
          <CommandInput
            aria-label={`Search ${label} by name or ID`}
            ref={(node) => node?.focus()}
            placeholder="Search name or ID…"
            value={query}
            onValueChange={(next) => {
              setQuery(next);
              setResults([]);
              setError(false);
              setLoading(next.trim().length >= 2 && !!search);
            }}
          />
          <CommandList>
            {loading ? (
              <output className="block space-y-2 p-3" aria-label="Searching">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
              </output>
            ) : error ? (
              <div className="p-3 text-sm" role="alert">
                Search failed.{" "}
                <Button
                  type="button"
                  variant="link"
                  onClick={() => {
                    setLoading(true);
                    setRetry((count) => count + 1);
                  }}
                >
                  Retry
                </Button>
              </div>
            ) : options.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">
                No matches — refine or paste full ID
              </p>
            ) : (
              options.map((item) => (
                <CommandItem
                  key={item.id}
                  value={item.id}
                  onSelect={() => {
                    setSelected(item);
                    onChange(item.id);
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  <span className="flex flex-col">
                    <span>{item.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {item.id}
                    </span>
                  </span>
                </CommandItem>
              ))
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
