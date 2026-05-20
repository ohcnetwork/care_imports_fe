import { useQuery } from "@tanstack/react-query";
import { ChevronsUpDown } from "lucide-react";
import React, { useState } from "react";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { NavTabs } from "@/components/ui/nav-tabs";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import userApi from "@/types/user/userApi";
import query from "@/Utils/request/query";

export type ExportTabId =
  | "users"
  | "departments"
  | "locations"
  | "charge-item-definition"
  | "product-knowledge"
  | "product"
  | "observation-definition"
  | "activity-definition"
  | "specimen-definitions"
  | "valuesets";

interface ExportsLayoutProps {
  activeTab: ExportTabId;
  children: React.ReactNode;
}

interface FacilityOption {
  id: string;
  name: string;
}

const getTabConfig = () => [
  {
    id: "users" as const,
    label: "Users",
    path: "/admin/export/users",
  },
  {
    id: "departments" as const,
    label: "Departments",
    path: "/admin/export/departments",
  },
  {
    id: "locations" as const,
    label: "Locations",
    path: "/admin/export/locations",
  },
  {
    id: "charge-item-definition" as const,
    label: "Charge Item Definitions",
    path: "/admin/export/charge-item-definition",
  },
  {
    id: "product-knowledge" as const,
    label: "Product Knowledge",
    path: "/admin/export/product-knowledge",
  },
  {
    id: "product" as const,
    label: "Products",
    path: "/admin/export/product",
  },
  {
    id: "specimen-definitions" as const,
    label: "Specimen Definitions",
    path: "/admin/export/specimen-definitions",
  },
  {
    id: "observation-definition" as const,
    label: "Observation Definitions",
    path: "/admin/export/observation-definition",
  },
  {
    id: "activity-definition" as const,
    label: "Activity Definitions",
    path: "/admin/export/activity-definition",
  },
  {
    id: "valuesets" as const,
    label: "Value Sets",
    path: "/admin/export/valuesets",
  },
];

export default function ExportsLayout({
  activeTab,
  children,
}: ExportsLayoutProps) {
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>("");
  const [open, setOpen] = useState(false);

  const {
    data: facilities = [],
    isLoading: loadingFacilities,
    error: facilityError,
  } = useQuery({
    queryKey: ["currentUser", "facilities"],
    queryFn: query(userApi.currentUser),
    select: (data: { facilities?: FacilityOption[] }) => data.facilities ?? [],
  });

  const tabs = getTabConfig();
  const requiresFacility =
    activeTab !== "users" &&
    activeTab !== "valuesets" &&
    activeTab !== "product-knowledge";
  const canRenderContent = !requiresFacility || Boolean(selectedFacilityId);
  const content = React.isValidElement(children)
    ? React.cloneElement(
        children as React.ReactElement<{ facilityId?: string }>,
        { facilityId: selectedFacilityId || undefined },
      )
    : children;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div>
        <div className="px-6 pt-4 space-y-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700">
              Select Facility
            </label>
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  disabled={loadingFacilities}
                  className="flex h-9 w-full items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2 text-sm shadow-xs disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span
                    className={
                      selectedFacilityId ? "text-gray-950" : "text-gray-500"
                    }
                  >
                    {loadingFacilities
                      ? "Loading facilities..."
                      : selectedFacilityId
                        ? facilities.find((f) => f.id === selectedFacilityId)
                            ?.name
                        : "Select a facility"}
                  </span>
                  <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
                </button>
              </PopoverTrigger>
              <PopoverContent
                className="!w-[var(--radix-popover-trigger-width)] p-0"
                align="start"
              >
                <Command>
                  <CommandInput
                    placeholder="Search facilities..."
                    className="outline-hidden border-none ring-0 shadow-none"
                    autoFocus
                  />
                  <CommandList>
                    <CommandEmpty>No facilities found.</CommandEmpty>
                    <CommandGroup>
                      {facilities.map((facility) => (
                        <CommandItem
                          key={facility.id}
                          value={facility.name}
                          onSelect={() => {
                            setSelectedFacilityId(facility.id);
                            setOpen(false);
                          }}
                          className="cursor-pointer"
                        >
                          {facility.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {facilityError && (
              <p className="text-sm text-red-600">Unable to load facilities</p>
            )}
          </div>
          <NavTabs
            tabs={tabs.map((tab) => ({
              key: tab.id,
              label: tab.label,
              href: tab.path,
            }))}
            currentTab={activeTab}
          />
        </div>

        <div className="px-6 py-6">
          {!canRenderContent ? (
            <div className="rounded-md border border-dashed border-gray-200 bg-white p-6 text-sm text-gray-600">
              Select a facility to start exporting data.
            </div>
          ) : (
            content
          )}
        </div>
      </div>
    </div>
  );
}
