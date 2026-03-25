"use client";

import { Button } from "@/components/ui/button";
import type { TattooRequest } from "../page";
import { formatDistanceToNow } from "@/lib/date-utils";

const COLUMNS: {
  status: TattooRequest["status"];
  label: string;
  dotColor: string;
}[] = [
  { status: "new request", label: "New Request", dotColor: "bg-sky-400" },
  { status: "quote sent", label: "Quote Sent", dotColor: "bg-amber-400" },
  { status: "deposit paid", label: "Deposit Paid", dotColor: "bg-emerald-400" },
];

function actionButton(status: TattooRequest["status"]) {
  if (status === "new request") {
    return (
      <Button size="sm" className="bg-[#1A8FAF] hover:bg-[#157a97] text-white">
        Quote + Book
      </Button>
    );
  }
  if (status === "quote sent") {
    return (
      <Button size="sm" variant="outline">
        Follow Up
      </Button>
    );
  }
  return (
    <Button
      size="sm"
      className="bg-emerald-500 hover:bg-emerald-600 text-white"
    >
      Schedule
    </Button>
  );
}

function RequestCard({ request }: { request: TattooRequest }) {
  return (
    <div className="bg-white rounded-xl border border-[#D6EAF0] p-4 space-y-3 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-sm text-gray-900">
            {request.client_name}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">{request.client_email}</p>
        </div>
        <span className="inline-flex items-center rounded-full bg-[#E8F5FA] px-2 py-0.5 text-xs font-medium text-[#1A8FAF] shrink-0">
          {request.style}
        </span>
      </div>

      <p className="text-sm text-gray-600 line-clamp-2">{request.description}</p>

      <div className="flex items-center justify-between pt-1">
        <span className="text-xs text-gray-400">
          {formatDistanceToNow(request.created_at)}
        </span>
        {actionButton(request.status)}
      </div>
    </div>
  );
}

export function IntakeQueue({ requests }: { requests: TattooRequest[] }) {
  return (
    <section>
      <h2 className="text-base font-semibold text-gray-800 mb-4">
        Intake Queue
      </h2>
      <div className="grid grid-cols-3 gap-5">
        {COLUMNS.map(({ status, label, dotColor }) => {
          const cards = requests.filter((r) => r.status === status);
          return (
            <div key={status}>
              <div className="flex items-center gap-2 mb-3">
                <span className={`size-2 rounded-full ${dotColor}`} />
                <span className="text-sm font-medium text-gray-700">
                  {label}
                </span>
                <span className="ml-auto text-xs font-medium text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
                  {cards.length}
                </span>
              </div>
              <div className="space-y-3">
                {cards.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-[#D6EAF0] p-6 text-center text-sm text-gray-400">
                    No requests
                  </div>
                ) : (
                  cards.map((req) => (
                    <RequestCard key={req.id} request={req} />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
