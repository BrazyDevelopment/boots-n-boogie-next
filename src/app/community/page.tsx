"use client";

import { CommunityChat } from "@/components/CommunityChat";

export default function CommunityPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <CommunityChat standalone />
    </div>
  );
}
