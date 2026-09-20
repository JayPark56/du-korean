"use client";

import { useState } from "react";
import DeleteStudentDialog from "./DeleteStudentDialog";

/** "삭제" button on a student card; opens the confirmation dialog. */
export default function StudentCardActions({
  studentId,
  studentName,
  avatarPath,
}: {
  studentId: string;
  studentName: string;
  avatarPath: string | null;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg px-2 py-1 text-xs font-medium text-stone-400 transition hover:bg-red-50 hover:text-red-700"
      >
        학생 삭제
      </button>
      {open && (
        <DeleteStudentDialog
          studentId={studentId}
          studentName={studentName}
          avatarPath={avatarPath}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
