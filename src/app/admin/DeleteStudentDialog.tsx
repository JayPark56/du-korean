"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Spinner, StatusText, buttonClass, inputClass } from "@/components/ui";
import { AVATAR_BUCKET } from "@/lib/avatar";
import { createClient } from "@/lib/supabase/client";

const DIALOG_STYLE = {
  margin: "auto",
  padding: 0,
  width: "calc(100% - 2rem)",
  maxWidth: "26rem",
  maxHeight: "calc(100dvh - 2rem)",
} as const;
const BACKDROP_CSS =
  ".delete-student-modal::backdrop{background:rgba(28,25,23,.4);-webkit-backdrop-filter:blur(2px);backdrop-filter:blur(2px)}";

/** Irreversible: removes the account, their schedule, requests and photo. Asks for the name first. */
export default function DeleteStudentDialog({
  studentId,
  studentName,
  avatarPath,
  onClose,
}: {
  studentId: string;
  studentName: string;
  avatarPath: string | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  const confirmed = typed.trim() === studentName.trim();

  async function deleteStudent() {
    setDeleting(true);
    setError(null);
    const supabase = createClient();
    try {
      // Photos first: the row is gone after the RPC, and files are not cascaded.
      const { data: files } = await supabase.storage.from(AVATAR_BUCKET).list(studentId);
      const paths = (files ?? []).map((file) => `${studentId}/${file.name}`);
      if (avatarPath && !paths.includes(avatarPath)) paths.push(avatarPath);
      if (paths.length > 0) await supabase.storage.from(AVATAR_BUCKET).remove(paths);

      const { error } = await supabase.rpc("delete_student", { student_id: studentId });
      if (error) throw new Error(error.message);
      onClose();
      router.refresh();
    } catch (e) {
      setError(`삭제 실패: ${(e as Error).message}`);
      setDeleting(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      lang="ko"
      aria-labelledby="delete-student-title"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          if (!deleting) onClose();
        }
      }}
      onCancel={(e) => {
        e.preventDefault();
        if (!deleting) onClose();
      }}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget && !deleting) onClose();
      }}
      style={DIALOG_STYLE}
      className="delete-student-modal overflow-y-auto rounded-2xl bg-white text-stone-900 shadow-2xl"
    >
      <style>{BACKDROP_CSS}</style>
      <div className="p-6">
        <h2 id="delete-student-title" className="text-lg font-bold tracking-tight">
          {studentName} 학생 삭제
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-stone-600">
          계정과 함께 스케줄, 수업 요청, 프로필 사진이 모두 삭제돼요. 되돌릴 수 없어요.
        </p>
        <label className="mt-4 block">
          <span className="mb-1.5 block text-sm font-medium text-stone-700">
            확인을 위해 <strong className="font-semibold">{studentName}</strong> 을(를) 입력하세요
          </span>
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            className={inputClass}
            placeholder={studentName}
            autoComplete="off"
          />
        </label>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <StatusText status={null} />

        <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
          <button type="button" onClick={onClose} disabled={deleting} className={buttonClass.secondary}>
            취소
          </button>
          <button
            type="button"
            onClick={deleteStudent}
            disabled={!confirmed || deleting}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {deleting && <Spinner />}
            영구 삭제
          </button>
        </div>
      </div>
    </dialog>
  );
}
