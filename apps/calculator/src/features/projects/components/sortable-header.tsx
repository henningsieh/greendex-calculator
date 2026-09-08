import type { SortingState } from "@tanstack/react-table";
import type { VariantProps } from "class-variance-authority";
import {
  ArrowDown10Icon,
  ArrowDownZAIcon,
  ArrowUp01Icon,
  ArrowUpAZIcon,
  ArrowUpDownIcon,
} from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SortableColumn {
  id: string;
  getIsSorted: () => "asc" | "desc" | false;
  toggleSorting: (desc: boolean) => void;
}

interface SortableHeaderProps {
  column: SortableColumn;
  sorting: SortingState;
  title: string;
  isNumeric?: boolean;
  className?: string;
  buttonVariant: VariantProps<typeof buttonVariants>["variant"];
}

const getSortIcon = (state: "asc" | "desc" | false, numeric: boolean) => {
  if (state === "asc") {
    return numeric ? (
      <ArrowUp01Icon className="ml-2 size-5 text-secondary group-hover:text-foreground" />
    ) : (
      <ArrowUpAZIcon className="ml-2 size-5 text-secondary group-hover:text-foreground" />
    );
  }

  if (state === "desc") {
    return numeric ? (
      <ArrowDown10Icon className="ml-2 size-5 text-secondary group-hover:text-foreground" />
    ) : (
      <ArrowDownZAIcon className="ml-2 size-5 text-secondary group-hover:text-foreground" />
    );
  }

  return <ArrowUpDownIcon className="ml-2 size-4 opacity-50" />;
};

/**
 * Renders a table column header button that displays the header label, shows the current sort icon/state, and toggles sorting for the column when activated.
 *
 * @param column - Column descriptor used to read and toggle this column's sorting state.
 * @param table - Table instance providing current sorting state.
 * @param title - Visible label for the header button.
 * @param isNumeric - If true, use numeric sort icons instead of alphabetical ones.
 * @param className - Optional additional CSS classes applied to the header button.
 * @returns A button element that shows the header title and appropriate sort icon and toggles the column's sort state when clicked.
 */
export function SortableHeader({
  column,
  sorting,
  title,
  isNumeric = false,
  className,
  buttonVariant,
}: SortableHeaderProps) {
  // Get the current sorting state for this column
  const currentSort = sorting.find((sort) => sort.id === column.id);
  let sortState: "asc" | "desc" | false = false;
  if (currentSort) {
    sortState = currentSort.desc ? "desc" : "asc";
  }

  // Compute accessible sort state
  let sortDirection: "ascending" | "descending" | "none";
  if (sortState === "asc") {
    sortDirection = "ascending";
  } else if (sortState === "desc") {
    sortDirection = "descending";
  } else {
    sortDirection = "none";
  }

  return (
    <Button
      aria-label={
        sortDirection === "none" ? title : `${title}, sorted ${sortDirection}`
      }
      aria-sort={sortDirection}
      className={cn(
        "group -ml-4 h-8",
        sortState && "font-medium text-foreground",
        className,
      )}
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      variant={buttonVariant}
    >
      {title}
      {getSortIcon(sortState, isNumeric)}
    </Button>
  );
}
