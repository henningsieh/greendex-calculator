import {
  filterFn_includesString,
  sortFn_text,
  useTable,
} from "@tanstack/react-table";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { projectsTableFeatures } from "@/features/projects/components/dashboard/projects-table-features";

describe("projectsTableFeatures", () => {
  it("registers the automatic name sort and filter functions", () => {
    function TableProbe() {
      const filteredTable = useTable({
        features: projectsTableFeatures,
        data: [{ name: "Zulu" }, { name: "Alpha" }],
        columns: [{ accessorKey: "name" }],
        state: {
          columnFilters: [{ id: "name", value: "alpha" }],
        },
      });
      const unfilteredTable = useTable({
        features: projectsTableFeatures,
        data: [{ name: "Zulu" }, { name: "Alpha" }],
        columns: [{ accessorKey: "name" }],
        state: {
          sorting: [{ id: "name", desc: false }],
        },
      });

      const nameColumn = filteredTable.getColumn("name");
      const nameFilterFn: unknown = nameColumn?.getFilterFn();
      const nameSortFn: unknown = unfilteredTable.getColumn("name")?.getSortFn();
      const filteredNames = filteredTable
        .getFilteredRowModel()
        .rows.map((row) => row.original.name);
      const sortedNames = unfilteredTable
        .getSortedRowModel()
        .rows.map((row) => row.original.name);

      return (
        <output
          data-filter-fn-matches={
            nameFilterFn === filterFn_includesString ? "true" : "false"
          }
          data-filtered={filteredNames.join("|")}
          data-sort-fn-matches={nameSortFn === sortFn_text ? "true" : "false"}
          data-sorted={sortedNames.join("|")}
        />
      );
    }

    const html = renderToStaticMarkup(<TableProbe />);

    expect(html).toContain('data-filter-fn-matches="true"');
    expect(html).toContain('data-sort-fn-matches="true"');
    expect(html).toContain('data-filtered="Alpha"');
    expect(html).toContain('data-sorted="Alpha|Zulu"');
  });
});
