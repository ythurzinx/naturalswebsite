"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  label: string;
  onProcessing: (pending: boolean) => void;
  value: string;
  onChange: (value: string) => void;
};

export default function AdminImage({
  label,
  value,
  onChange,
  onProcessing,
}: Props) {
  const version = useRef(0);
  const [status, setStatus] = useState("");
  const [processing, setProcessing] = useState(false);
  useEffect(
    () => () => {
      version.current++;
      onProcessing(false);
    },
    [onProcessing],
  );

  async function load(file: File) {
    const requested = ++version.current;
    let bitmap: ImageBitmap | undefined;
    setStatus("");
    setProcessing(true);
    onProcessing(true);
    try {
      if (
        !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
        file.size > 10 * 1024 * 1024
      )
        throw Error("Selecione um JPG, PNG ou WebP de até 10 MB.");
      bitmap = await createImageBitmap(file);
      const scale = Math.min(1, 700 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d");
      if (!context) throw Error("Falha ao preparar imagem.");
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const encoded = canvas.toDataURL("image/webp", 0.75);
      if (
        !encoded.startsWith("data:image/webp;base64,") ||
        encoded.length > 330000
      )
        throw Error("Selecione uma imagem menor.");
      if (version.current === requested) onChange(encoded);
    } catch (error) {
      if (version.current === requested)
        setStatus(
          error instanceof Error ? error.message : "Falha ao abrir imagem.",
        );
    } finally {
      bitmap?.close();
      if (version.current === requested) {
        setProcessing(false);
        onProcessing(false);
      }
    }
  }
  return (
    <div className="mn-panel">
      <label>
        {label}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void load(file);
          }}
        />
      </label>
      {value && (
        <div className="actions">
          <img
            alt={label}
            src={value}
            width={96}
            height={72}
            style={{ objectFit: "contain" }}
          />
          <button
            type="button"
            onClick={() => {
              version.current++;
              setProcessing(false);
              onProcessing(false);
              onChange("");
            }}
          >
            Remover imagem
          </button>
        </div>
      )}
      {(status || processing) && (
        <p role="status">{processing ? "Preparando imagem…" : status}</p>
      )}
    </div>
  );
}
