"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CopyButtonProps {
  value: string;
  /** Accessible label, e.g. "Copy IP address" */
  label?: string;
}

export function CopyButton({ value, label = "Copy" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-5 w-5 text-muted-foreground hover:text-foreground"
      onClick={handleCopy}
      aria-label={label}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-green-500" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </Button>
  );
}

interface CopyableValueProps {
  value: string;
  label?: string;
}

/**
 * Renders a monospace value that copies to clipboard when clicked anywhere.
 * Shows a copy icon on hover that turns into a checkmark on success.
 */
export function CopyableValue({ value, label = "Copy" }: CopyableValueProps) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={label}
      className="group flex items-center gap-1 cursor-pointer rounded px-1 -mx-1 hover:bg-muted transition-colors"
    >
      <span className="font-medium font-mono text-sm">{value}</span>
      {copied ? (
        <Check className="h-3.5 w-3.5 text-green-500 shrink-0" />
      ) : (
        <Copy className="h-3.5 w-3.5 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
    </button>
  );
}
