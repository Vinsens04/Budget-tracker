"use client";
import { Check } from "lucide-react";
import type { CSSProperties } from "react";
import { visualThemes, type VisualTheme } from "@/lib/themes";
export function ThemePicker({
  value,
  busy,
  onChange,
}: {
  value: VisualTheme;
  busy: boolean;
  onChange: (theme: VisualTheme) => void;
}) {
  return (
    <div className="theme-options" role="group" aria-label="Choose theme">
      {visualThemes.map((theme) => (
        <button
          type="button"
          className={`theme-option ${value === theme.id ? "selected" : ""}`}
          key={theme.id}
          aria-label={`${theme.name} theme`}
          aria-pressed={value === theme.id}
          disabled={busy}
          onClick={() => onChange(theme.id)}
        >
          <span
            className="theme-preview"
            aria-hidden="true"
            style={
              {
                "--preview-bg": theme.background,
                "--preview-surface": theme.surface,
                "--preview-ink": theme.ink,
                "--preview-accent": theme.accent,
              } as CSSProperties
            }
          >
            <span className="theme-preview-sidebar">
              <i />
              <i />
              <i />
            </span>
            <span className="theme-preview-content">
              <span className="theme-preview-title" />
              <span className="theme-preview-balance" />
              <span className="theme-preview-panels">
                <i />
                <i />
              </span>
            </span>
          </span>
          <span className="theme-option-label">
            <strong>{theme.name}</strong>
            <span className="theme-check">
              {value === theme.id && <Check size={14} />}
            </span>
          </span>
          <small>{theme.description}</small>
        </button>
      ))}
    </div>
  );
}
