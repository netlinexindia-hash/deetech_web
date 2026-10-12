"use client";

import { useState } from "react";

/**
 * The media URL, with one-click copy.
 *
 * `navigator.clipboard` is unavailable on insecure origins and can be denied
 * by permissions policy, so selecting the text is kept as the fallback
 * rather than assuming the copy worked.
 */
export function CopyableUrl({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="mt-3">
      <label className="block text-xs font-semibold text-navy-700">
        URL to paste into content
        <div className="mt-1 flex gap-1.5">
          <input
            readOnly
            value={url}
            onFocus={(event) => event.currentTarget.select()}
            className="w-full min-w-0 rounded border border-navy-200 px-2 py-1.5 font-mono text-xs"
          />
          <button
            type="button"
            onClick={copy}
            className="shrink-0 rounded border border-navy-200 px-2.5 text-xs font-semibold text-navy-800 hover:border-brand-400 hover:bg-brand-50"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </label>
    </div>
  );
}
