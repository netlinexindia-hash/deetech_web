import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Media upload handling.
 *
 * Section 8 of the plan: validate file size and type, generate safe file
 * names, and prevent executable uploads. Each of those is a separate control
 * here, because any one of them alone is bypassable.
 */

/**
 * Allowed types, keyed by MIME, with the magic bytes that must be present.
 *
 * The declared `Content-Type` of a multipart part is attacker-controlled, so
 * it is checked AND the actual leading bytes are checked. A .php renamed to
 * .png passes the first test and fails the second.
 *
 * SVG is deliberately absent: it is an XML document that can carry script,
 * and serving one from our own origin would be a stored-XSS vector.
 */
const ALLOWED: Record<string, { ext: string; magic: number[][] }> = {
  "image/png": { ext: "png", magic: [[0x89, 0x50, 0x4e, 0x47]] },
  "image/jpeg": { ext: "jpg", magic: [[0xff, 0xd8, 0xff]] },
  "image/webp": { ext: "webp", magic: [[0x52, 0x49, 0x46, 0x46]] },
  "image/gif": { ext: "gif", magic: [[0x47, 0x49, 0x46, 0x38]] },
  "application/pdf": { ext: "pdf", magic: [[0x25, 0x50, 0x44, 0x46]] },
};

export const ALLOWED_MIME_TYPES = Object.keys(ALLOWED);

export class UploadRejected extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadRejected";
  }
}

function matchesMagic(buffer: Buffer, signatures: number[][]): boolean {
  return signatures.some((signature) =>
    signature.every((byte, index) => buffer[index] === byte),
  );
}

export interface AcceptedUpload {
  storagePath: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
}

/**
 * Reads the intrinsic size of PNG, GIF and JPEG without a decoding library.
 *
 * Only used to record dimensions for the media library; returns nulls rather
 * than throwing when a format is not understood, because a missing width is
 * not a reason to reject a valid image.
 */
function readDimensions(
  buffer: Buffer,
  mimeType: string,
): { width: number | null; height: number | null } {
  try {
    if (mimeType === "image/png" && buffer.length > 24) {
      return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
    }
    if (mimeType === "image/gif" && buffer.length > 10) {
      return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
    }
    if (mimeType === "image/jpeg") {
      let offset = 2;
      while (offset + 9 < buffer.length) {
        if (buffer[offset] !== 0xff) break;
        const marker = buffer[offset + 1]!;
        const length = buffer.readUInt16BE(offset + 2);
        // SOF0..SOF3 and SOF5..SOF15 carry the frame dimensions.
        if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
          return {
            height: buffer.readUInt16BE(offset + 5),
            width: buffer.readUInt16BE(offset + 7),
          };
        }
        offset += 2 + length;
      }
    }
  } catch {
    // Malformed header; dimensions are optional metadata.
  }
  return { width: null, height: null };
}

/**
 * Builds a storage name that cannot escape the media directory or be
 * interpreted as code.
 *
 * The original name is used only to derive a readable stem, and even that is
 * aggressively stripped. The extension comes from the verified MIME type,
 * never from the upload — so a file called `shell.php.png` is stored with a
 * `.png` extension and a random name.
 */
function safeStorageName(originalName: string, ext: string): string {
  const stem = path
    .basename(originalName)
    .replace(/\.[^.]*$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  const random = randomBytes(8).toString("hex");
  const now = new Date();
  const folder = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

  return `${folder}/${stem || "file"}-${random}.${ext}`;
}

export async function acceptUpload(options: {
  buffer: Buffer;
  originalName: string;
  declaredMimeType: string;
  maxBytes: number;
  storageRoot: string;
}): Promise<AcceptedUpload> {
  const { buffer, originalName, declaredMimeType, maxBytes, storageRoot } = options;

  if (buffer.length === 0) {
    throw new UploadRejected("That file is empty.");
  }
  if (buffer.length > maxBytes) {
    const mb = (maxBytes / 1_048_576).toFixed(1);
    throw new UploadRejected(`That file is larger than the ${mb} MB limit.`);
  }

  const spec = ALLOWED[declaredMimeType];
  if (!spec) {
    throw new UploadRejected(
      `That file type is not allowed. Accepted: ${ALLOWED_MIME_TYPES.join(", ")}.`,
    );
  }

  // The decisive check. A declared type is a claim; the bytes are evidence.
  if (!matchesMagic(buffer, spec.magic)) {
    throw new UploadRejected(
      "That file's contents do not match its type. It may be renamed or corrupt.",
    );
  }

  const storagePath = safeStorageName(originalName, spec.ext);
  const absolute = path.join(storageRoot, storagePath);

  // Defence in depth: even with the sanitising above, refuse anything that
  // resolves outside the storage root.
  const resolvedRoot = path.resolve(storageRoot);
  if (!path.resolve(absolute).startsWith(resolvedRoot + path.sep)) {
    throw new UploadRejected("Invalid file name.");
  }

  await mkdir(path.dirname(absolute), { recursive: true });
  // `wx` fails rather than overwriting, so a name collision can never
  // silently replace an existing file.
  await writeFile(absolute, buffer, { flag: "wx" });

  return {
    storagePath,
    fileName: path.basename(originalName).slice(0, 200),
    mimeType: declaredMimeType,
    sizeBytes: buffer.length,
    ...readDimensions(buffer, declaredMimeType),
  };
}
