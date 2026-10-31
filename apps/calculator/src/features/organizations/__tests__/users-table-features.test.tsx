import {
  filterFn_includesString,
  sortFn_text,
  useTable,
} from "@tanstack/react-table";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { usersTableFeatures } from "@/features/organizations/components/users-table-features";

describe("usersTableFeatures", () => {
  it("registers the automatic person sort and filter functions", () => {
    function TableProbe() {
      const filteredTable = useTable({
        features: usersTableFeatures,
        data: [{ member: "Zulu" }, { member: "Alpha" }],
        columns: [{ accessorKey: "member" }],
        state: {
          columnFilters: [{ id: "member", value: "alpha" }],
        },
      });
      const unfilteredTable = useTable({
        features: usersTableFeatures,
        data: [{ member: "Zulu" }, { member: "Alpha" }],
        columns: [{ accessorKey: "member" }],
        state: {
          sorting: [{ id: "member", desc: false }],
        },
      });

      const memberColumn = filteredTable.getColumn("member");
      const memberFilterFn: unknown = memberColumn?.getFilterFn();
      const memberSortFn: unknown = unfilteredTable
        .getColumn("member")
        ?.getSortFn();
      const filteredMembers = filteredTable
        .getFilteredRowModel()
        .rows.map((row) => row.original.member);
      const sortedMembers = unfilteredTable
        .getSortedRowModel()
        .rows.map((row) => row.original.member);

      return (
        <output
          data-filter-fn-matches={
            memberFilterFn === filterFn_includesString ? "true" : "false"
          }
          data-filtered={filteredMembers.join("|")}
          data-sort-fn-matches={memberSortFn === sortFn_text ? "true" : "false"}
          data-sorted={sortedMembers.join("|")}
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
