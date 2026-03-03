"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Server, Cpu, MemoryStick, HardDrive, ChevronLeft, ChevronRight } from "lucide-react";

type Instance = {
  id: string;
  ramMb: number;
  cpuCores: number;
  diskGb: number;
};

type Group = {
  id: string;
  name: string;
  isAdmin: boolean;
  maxInstances: number;
  maxRamMb: number;
  maxCpuCores: number;
  maxDiskGb: number;
  instances: Instance[];
};

interface GroupStatsPaginationProps {
  groups: Group[];
}

export function GroupStatsPagination({ groups }: GroupStatsPaginationProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const groupsPerPage = 3;
  const totalPages = Math.ceil(groups.length / groupsPerPage);

  const startIndex = currentPage * groupsPerPage;
  const endIndex = startIndex + groupsPerPage;
  const currentGroups = groups.slice(startIndex, endIndex);

  const goToNextPage = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1);
    }
  };

  const goToPreviousPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto">
        <div className="space-y-5 pb-2">
          {currentGroups.map((group) => {
            const instances = group.instances;
            const usedRam = instances.reduce((s, i) => s + i.ramMb, 0);
            const usedCpu = instances.reduce((s, i) => s + i.cpuCores, 0);
            const usedDisk = instances.reduce((s, i) => s + i.diskGb, 0);

            const stats = [
              { label: "Instances", used: instances.length, max: group.maxInstances, icon: Server, unit: "" },
              { label: "RAM", used: usedRam, max: group.maxRamMb, icon: MemoryStick, unit: " MB" },
              { label: "CPU Cores", used: usedCpu, max: group.maxCpuCores, icon: Cpu, unit: "" },
              { label: "Disk", used: usedDisk, max: group.maxDiskGb, icon: HardDrive, unit: " GB" },
            ];

            return (
              <div key={group.id}>
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-sm font-semibold">{group.name}</p>
                  {group.isAdmin && <Badge>Admin</Badge>}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                  {stats.map(({ label, used, max, icon: Icon, unit }) => {
                    const pct = max > 0 ? Math.round((used / max) * 100) : 0;
                    return (
                      <Card key={label}>
                        <CardHeader className="flex flex-row items-center justify-between pb-1">
                          <CardTitle className="text-sm font-medium">{label}</CardTitle>
                          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                        </CardHeader>
                        <CardContent className="pb-2.5">
                          <p className="text-lg font-bold">
                            {used}
                            {unit}
                            <span className="text-xs font-normal text-muted-foreground">
                              {" "}/ {max}
                              {unit}
                            </span>
                          </p>
                          <div className="mt-1 h-1 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full bg-primary transition-all"
                              style={{ width: `${Math.min(pct, 100)}%` }}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{pct}% used</p>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 py-4 border-t bg-background shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={goToPreviousPage}
            disabled={currentPage === 0}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>
          <span className="text-sm text-muted-foreground px-2">
            Page {currentPage + 1} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={goToNextPage}
            disabled={currentPage === totalPages - 1}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}
