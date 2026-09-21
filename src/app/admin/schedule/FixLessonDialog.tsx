"use client";

import { useEffect, useRef, useState } from "react";
import { buttonClass } from "@/components/ui";

type Student = { id: string; name: string };

// Inline layout so the dialog is centered even with a stale stylesheet.
const DIALOG_STYLE = {
  margin: "auto",
  padding: 0,
  width: "calc(100% - 2rem)",
  maxWidth: "24rem",
  maxHeight: "calc(100dvh - 2rem)",
} as const;
const BACKDROP_CSS =
  ".fix-lesson-modal::backdrop{background:rgba(28,25,23,.4);-webkit-backdrop-filter:blur(2px);backdrop-filter:blur(2px)}";

/** Picks which of the overlapping students this lesson is actually for. */
export default function FixLessonDialog({
  title,
  candidates,
  initialSelected,
  confirmLabel = "픽스",
  onCancel,
  onConfirm,
}: {
  title: string;
  candidates: Student[];
  initialSelected: string[];
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: (studentIds: string[]) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState<string[]>(initialSelected);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  const toggle = (id: string) =>
    setSelected((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));

  return (
    <dialog
      ref={dialogRef}
      lang="ko"
      aria-labelledby="fix-lesson-title"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onCancel();
        }
      }}
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      onClose={onCancel}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
      style={DIALOG_STYLE}
      className="fix-lesson-modal overflow-y-auto rounded-2xl bg-white text-stone-900 shadow-2xl"
    >
      <style>{BACKDROP_CSS}</style>
      <div className="p-6">
        <h2 id="fix-lesson-title" className="text-lg font-bold tracking-tight">
          수업할 학생 선택
        </h2>
        <p className="mt-1 text-sm text-stone-500">{title}</p>

        <ul className="mt-4 space-y-2" data-picker-list="">
          {candidates.map((student) => {
            const checked = selected.includes(student.id);
            return (
              <li key={student.id}>
                <label
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
                    checked
                      ? "border-brand-600 bg-brand-50 text-stone-900"
                      : "border-stone-200 bg-white text-stone-600 hover:border-stone-300"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(student.id)}
                    className="size-4 accent-brand-600"
                  />
                  {student.name}
                </label>
              </li>
            );
          })}
        </ul>

        <p className="mt-3 text-xs text-stone-500">
          선택한 학생만 이 수업을 볼 수 있어요. 나머지 학생에게는 표시되지 않아요.
        </p>

        <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
          <button type="button" onClick={onCancel} className={buttonClass.secondary}>
            취소
          </button>
          <button
            type="button"
            onClick={() => onConfirm(selected)}
            disabled={selected.length === 0}
            className={buttonClass.primary}
          >
            {confirmLabel}
            {selected.length > 0 && ` (${selected.length}명)`}
          </button>
        </div>
      </div>
    </dialog>
  );
}
