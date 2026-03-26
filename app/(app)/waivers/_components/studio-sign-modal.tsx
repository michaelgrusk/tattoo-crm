"use client";

import { X } from "lucide-react";
import { WaiverSignForm } from "@/components/waiver-sign-form";
import type { WaiverTemplate } from "../types";

export function StudioSignModal({
  template,
  userId,
  onClose,
  onSigned,
}: {
  template: WaiverTemplate;
  userId: string;
  onClose: () => void;
  onSigned: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center overflow-y-auto py-6 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-white rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              {template.name}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              In-studio signing — client fills out below
            </p>
          </div>
          <button
            onClick={onClose}
            className="size-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <div className="px-6 py-6">
          <WaiverSignForm
            template={template}
            userId={userId}
            onSuccess={() => {
              onSigned();
              onClose();
            }}
          />
        </div>
      </div>
    </div>
  );
}
