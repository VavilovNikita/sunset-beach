"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addMaintenanceTaskBlock,
  createMaintenanceTask,
  updateMaintenanceTaskStatus,
} from "@/lib/maintenanceTaskClient";
import type { MaintenanceTask, MaintenanceTaskBlockResult, MaintenanceTaskStatus, RoomUnit } from "@/lib/types";

const STATUS_LABEL: Record<MaintenanceTaskStatus, string> = { OPEN: "Open", IN_PROGRESS: "In progress", DONE: "Done" };
const STATUS_CLASS: Record<MaintenanceTaskStatus, string> = {
  OPEN: "bg-coral/15 text-coral",
  IN_PROGRESS: "bg-amber-400/15 text-amber-400",
  DONE: "bg-sea/15 text-sea",
};

type Filter = "open" | "done" | "all";

// Designed for a phone first - the person who notices a problem is standing in the room. Real
// thumb targets (buttons stay at least ~44px tall, no hover-only affordances - every action is a
// visible tap target, not a reveal-on-hover icon like the desktop-oriented admin screens use),
// one component tree shared by every screen size rather than a second /pos-style surface. Not
// role-gated at the page level (any authenticated role can file/read - see the page itself);
// canBlock/canProgress hide only the specific actions those roles/functions can't take, the same
// "hide, don't show a form that 403s" rule as the rest of the admin UI.
export default function MaintenanceTaskBoard({
  initialTasks,
  roomUnits,
  canBlock,
  canProgress,
}: {
  initialTasks: MaintenanceTask[];
  roomUnits: RoomUnit[];
  canBlock: boolean;
  canProgress: boolean;
}) {
  const router = useRouter();
  const [filing, setFiling] = useState(false);
  const [filter, setFilter] = useState<Filter>("open");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const sortedUnits = [...roomUnits].filter((u) => u.isActive).sort((a, b) => a.label.localeCompare(b.label));
  const unitLabelById = new Map(roomUnits.map((u) => [u.id, u.label]));

  const visibleTasks = initialTasks.filter((t) => {
    if (filter === "open") return t.status !== "DONE";
    if (filter === "done") return t.status === "DONE";
    return true;
  });

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <button
          type="button"
          onClick={() => setFiling((v) => !v)}
          className="w-full rounded-xl bg-coral hover:bg-coraldeep transition-colors px-5 py-4 text-base font-medium"
        >
          {filing ? "Cancel" : "+ Report a problem"}
        </button>
        {filing && (
          <FileTaskForm
            roomUnits={sortedUnits}
            onFiled={() => {
              setFiling(false);
              router.refresh();
            }}
          />
        )}
      </div>

      <div className="flex gap-2">
        {(["open", "done", "all"] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`flex-1 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
              filter === f ? "bg-cream/15 text-cream" : "bg-ink2/40 text-cream/50 border border-cream/10"
            }`}
          >
            {f === "open" ? "Open" : f === "done" ? "Done" : "All"}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {visibleTasks.length === 0 && <p className="text-sm text-cream/50">No tasks here.</p>}
        {visibleTasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            unitLabel={unitLabelById.get(task.roomUnitId) ?? task.unitLabel}
            expanded={expandedId === task.id}
            onToggle={() => setExpandedId((id) => (id === task.id ? null : task.id))}
            canBlock={canBlock}
            canProgress={canProgress}
            onChanged={() => router.refresh()}
          />
        ))}
      </div>
    </div>
  );
}

function FileTaskForm({ roomUnits, onFiled }: { roomUnits: RoomUnit[]; onFiled: () => void }) {
  const [roomUnitId, setRoomUnitId] = useState(roomUnits[0]?.id ?? "");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!roomUnitId || !description.trim()) return;
    setSaving(true);
    setError(null);

    const result = await createMaintenanceTask(roomUnitId, description.trim(), photos);

    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDescription("");
    setPhotos([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    onFiled();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-4 bg-ink2/40 border border-cream/10 rounded-xl p-5">
      <div>
        <label className="eyebrow text-cream/60 block mb-1">Room</label>
        <select
          value={roomUnitId}
          onChange={(e) => setRoomUnitId(e.target.value)}
          className="w-full bg-ink2 border border-cream/20 rounded-lg px-3 py-3 text-base"
        >
          {roomUnits.map((u) => (
            <option key={u.id} value={u.id}>
              {u.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="eyebrow text-cream/60 block mb-1">What&rsquo;s wrong</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          rows={3}
          placeholder="e.g. AC is leaking onto the floor"
          className="w-full bg-transparent border border-cream/20 rounded-lg px-3 py-3 text-base placeholder:text-cream/30 focus:outline-none focus:border-coral"
        />
      </div>

      <div>
        <label className="eyebrow text-cream/60 block mb-1">Photos (optional)</label>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          capture="environment"
          onChange={(e) => setPhotos(Array.from(e.target.files ?? []))}
          className="w-full text-sm text-cream/70 file:mr-3 file:rounded-full file:border-0 file:bg-cream/10 file:text-cream file:px-4 file:py-3 file:text-sm file:font-medium file:cursor-pointer"
        />
        {photos.length > 0 && <p className="text-xs text-cream/40 mt-1">{photos.length} photo(s) selected</p>}
      </div>

      {error && <p className="text-sm text-coral">{error}</p>}

      <button
        type="submit"
        disabled={saving || !roomUnitId || !description.trim()}
        className="w-full rounded-xl bg-coral hover:bg-coraldeep transition-colors py-4 text-base font-medium disabled:opacity-60"
      >
        {saving ? "Filing…" : "File task"}
      </button>
    </form>
  );
}

function TaskCard({
  task,
  unitLabel,
  expanded,
  onToggle,
  canBlock,
  canProgress,
  onChanged,
}: {
  task: MaintenanceTask;
  unitLabel: string;
  expanded: boolean;
  onToggle: () => void;
  canBlock: boolean;
  canProgress: boolean;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blockResult, setBlockResult] = useState<MaintenanceTaskBlockResult | null>(null);
  const [blockForm, setBlockForm] = useState(false);

  async function handleStatusChange(status: MaintenanceTaskStatus) {
    setBusy(true);
    setError(null);
    const result = await updateMaintenanceTaskStatus(task.id, status);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onChanged();
  }

  const nextActions: { label: string; status: MaintenanceTaskStatus }[] = [];
  if (canProgress && task.status === "OPEN") {
    nextActions.push({ label: "Start", status: "IN_PROGRESS" });
    nextActions.push({ label: "Mark done", status: "DONE" });
  } else if (canProgress && task.status === "IN_PROGRESS") {
    nextActions.push({ label: "Mark done", status: "DONE" });
  }

  return (
    <div className="bg-ink2/40 border border-cream/10 rounded-xl overflow-hidden">
      <button type="button" onClick={onToggle} className="w-full text-left px-4 py-4 flex items-center gap-3">
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CLASS[task.status]}`}>
          {STATUS_LABEL[task.status]}
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-medium truncate">{unitLabel}</span>
          <span className="block text-xs text-cream/50 truncate">{task.description}</span>
        </span>
        {task.blockId && <span className="shrink-0 w-2 h-2 rounded-full bg-coral" title="Room is blocked" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-cream/10 pt-4">
          <p className="text-sm text-cream/80">{task.description}</p>

          {task.photos.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {task.photos.map((path) => (
                <a key={path} href={`/api/admin-proxy${path}`} target="_blank" rel="noreferrer" className="block aspect-square rounded-lg overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element -- staff-only, backend-served photo, not eligible for next/image's public-asset optimization */}
                  <img src={`/api/admin-proxy${path}`} alt="" className="w-full h-full object-cover" />
                </a>
              ))}
            </div>
          )}

          <p className="text-xs text-cream/40">
            Reported by {task.reportedByEmail} · {task.createdAt.slice(0, 10)}
            {task.closedAt && ` · Closed ${task.closedAt.slice(0, 10)}`}
          </p>

          {error && <p className="text-sm text-coral">{error}</p>}

          {blockResult?.blockResult.warning && (
            <div className="bg-amber-400/10 border border-amber-400/40 rounded-lg p-3 space-y-2">
              <p className="text-sm text-amber-400">{blockResult.blockResult.warning}</p>
              {[...blockResult.blockResult.affectedBookings, ...blockResult.blockResult.affectedUnassignedBookings].map((b) => (
                <p key={b.bookingId} className="text-xs text-cream/60">
                  {b.guestName} · {b.checkIn} → {b.checkOut}
                </p>
              ))}
            </div>
          )}

          {(nextActions.length > 0 || (canBlock && !task.blockId)) && (
            <div className="flex flex-wrap gap-2">
              {nextActions.map((a) => (
                <button
                  key={a.status}
                  type="button"
                  disabled={busy}
                  onClick={() => handleStatusChange(a.status)}
                  className="rounded-xl border border-cream/25 hover:border-cream/50 transition-colors px-4 py-3 text-sm font-medium disabled:opacity-50"
                >
                  {busy ? "…" : a.label}
                </button>
              ))}
              {canBlock && !task.blockId && (
                <button
                  type="button"
                  onClick={() => setBlockForm((v) => !v)}
                  className="rounded-xl border border-coral/40 text-coral hover:bg-coral/10 transition-colors px-4 py-3 text-sm font-medium"
                >
                  {blockForm ? "Cancel" : "Block this room"}
                </button>
              )}
            </div>
          )}

          {blockForm && (
            <BlockRoomForm
              taskId={task.id}
              onDone={(result) => {
                setBlockForm(false);
                setBlockResult(result);
                onChanged();
              }}
              onError={setError}
            />
          )}
        </div>
      )}
    </div>
  );
}

function BlockRoomForm({
  taskId,
  onDone,
  onError,
}: {
  taskId: string;
  onDone: (result: MaintenanceTaskBlockResult) => void;
  onError: (error: string) => void;
}) {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fromDate || !toDate || !reason.trim()) return;
    setSaving(true);
    onError("");

    const result = await addMaintenanceTaskBlock(taskId, { fromDate, toDate, reason: reason.trim() });

    setSaving(false);
    if (!result.ok) {
      onError(result.error);
      return;
    }
    onDone(result.result);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 bg-ink2/60 border border-cream/10 rounded-lg p-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="eyebrow text-cream/60 block mb-1">From</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-full bg-transparent border-b border-cream/25 py-2 text-sm focus:outline-none focus:border-coral"
          />
        </div>
        <div>
          <label className="eyebrow text-cream/60 block mb-1">Best-guess end date</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="w-full bg-transparent border-b border-cream/25 py-2 text-sm focus:outline-none focus:border-coral"
          />
        </div>
      </div>
      <div>
        <label className="eyebrow text-cream/60 block mb-1">Reason</label>
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. AC repair"
          className="w-full bg-transparent border-b border-cream/25 py-2 text-sm placeholder:text-cream/30 focus:outline-none focus:border-coral"
        />
      </div>
      <button
        type="submit"
        disabled={saving || !fromDate || !toDate || !reason.trim()}
        className="w-full rounded-xl bg-coral hover:bg-coraldeep transition-colors py-3 text-sm font-medium disabled:opacity-60"
      >
        {saving ? "Blocking…" : "Block room"}
      </button>
    </form>
  );
}
