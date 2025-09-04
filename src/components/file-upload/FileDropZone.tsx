import React, { useCallback, useState } from "react";
import type { SelectedFile } from "../../lib/files/types";
import { makeFileValidator } from "../../lib/files/validate";

export interface FileDropZoneProps {
  id: string;
  label: string;
  description: string;
  accept: string[];
  required?: boolean;
  value?: SelectedFile;
  onSelect: (file: SelectedFile | undefined) => void;
}

export const FileDropZone: React.FC<FileDropZoneProps> = ({
  id,
  label,
  description,
  accept,
  required,
  value,
  onSelect,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const validate = makeFileValidator(accept);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) {
      onSelect(undefined);
      return;
    }
    const f = files[0];
    if (!validate(f)) {
      alert(`Invalid file type: ${f.name}. Allowed: ${accept.join(", ")}`);
      return;
    }
    onSelect({
      file: f,
      name: f.name,
      size: f.size,
      lastModified: f.lastModified,
      type: f.type,
    });
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };
  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    handleFiles(e.dataTransfer.files);
  };
  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
  };

  const clear = useCallback(() => onSelect(undefined), [onSelect]);

  return (
    <div className="card bg-base-200  shadow-md flex-1/3">
      <div className="card-body gap-4">
        <h2 className="card-title flex items-center gap-2">
          {label}
          {required ? (
            <span className="badge badge-primary badge-sm">Required</span>
          ) : (
            <span className="badge badge-ghost badge-sm">Optional</span>
          )}
        </h2>
        <p className="text-sm opacity-80">{description}</p>

        <div
          className={[
            "rounded-md border-2 border-dashed p-6 transition-colors min-h-24",
            dragActive
              ? "border-primary bg-primary/10"
              : "border-base-300 hover:border-primary",
            "flex flex-col items-center justify-center gap-3 text-center",
          ].join(" ")}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          role="button"
          tabIndex={0}
          aria-describedby={`${id}-desc`}
        >
          <span className="text-sm">
            Drag & drop file or{" "}
            <label className="link link-primary cursor-pointer">
              <input
                id={id}
                type="file"
                className="hidden"
                accept={accept.join(",")}
                onChange={onChange}
              />
              browse
            </label>
          </span>
          {/* <span id={`${id}-desc`} className="text-xs opacity-70 min-h-12">
            Accepts: {accept.join(", ")}
          </span> */}
          {value && (
            <div className="mt-2 flex flex-col items-center gap-1">
              <div className="badge badge-info badge-outline">{value.name}</div>
              <div className="text-xs opacity-60">
                {(value.size / 1024).toFixed(1)} KB •{" "}
                {new Date(value.lastModified).toLocaleString()}
              </div>
              <button
                type="button"
                onClick={clear}
                className="btn btn-xs btn-ghost"
              >
                Remove
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
