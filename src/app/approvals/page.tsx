import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";
import { ApprovalRow } from "./approval-row";

export const dynamic = "force-dynamic";

type PendingRow = {
  id: number;
  requested_by: number;
  requested_by_name: string;
  entity: string;
  entity_id: number | null;
  action: string;
  before_json: string | null;
  after_json: string;
  requested_at: string;
};

export default async function ApprovalsPage() {
  const session = await getSession();
  if (!session.user || session.user.role !== "admin") notFound();

  const db = getDb();
  const rows = db
    .prepare(
      `SELECT p.id, p.requested_by, u.username AS requested_by_name,
              p.entity, p.entity_id, p.action, p.before_json, p.after_json, p.requested_at
         FROM pending_changes p
         JOIN users u ON u.id = p.requested_by
        WHERE p.status = 'pending'
        ORDER BY p.requested_at DESC`,
    )
    .all() as PendingRow[];

  const decided = db
    .prepare(
      `SELECT p.id, u.username AS requested_by_name, p.entity, p.entity_id,
              p.status, p.decided_at, p.decision_notes,
              du.username AS decided_by_name
         FROM pending_changes p
         JOIN users u ON u.id = p.requested_by
         LEFT JOIN users du ON du.id = p.decided_by
        WHERE p.status != 'pending'
        ORDER BY p.decided_at DESC
        LIMIT 20`,
    )
    .all() as {
    id: number;
    requested_by_name: string;
    entity: string;
    entity_id: number | null;
    status: string;
    decided_at: string;
    decision_notes: string | null;
    decided_by_name: string | null;
  }[];

  return (
    <div className="space-y-8 fade-in">
      <section className="panel px-7 py-7">
        <div className="label">Admin review</div>
        <h1 className="mt-3 text-[2.5rem] font-medium leading-[1.05] tracking-[-0.02em] text-[var(--color-ink)]">
          Approvals{" "}
          <span className="serif text-[2.5rem] text-[var(--color-accent)]">
            · {rows.length}
          </span>
        </h1>
        <p className="mt-3 text-[0.9375rem] text-[var(--color-ink-2)]">
          Changes from staff waiting on your review.
        </p>
      </section>

      {rows.length === 0 ? (
        <section className="panel px-7 py-10 text-center text-[var(--color-muted)]">
          Nothing pending.
        </section>
      ) : (
        <div className="space-y-4">
          {rows.map((r) => (
            <ApprovalRow key={r.id} row={r} />
          ))}
        </div>
      )}

      {decided.length > 0 ? (
        <section className="panel overflow-x-auto">
          <div className="px-7 pt-6">
            <div className="label">Recent decisions</div>
          </div>
          <table className="grid mt-4">
            <thead>
              <tr>
                <th>When</th>
                <th>By</th>
                <th>Requester</th>
                <th>Entity</th>
                <th>Status</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {decided.map((d) => (
                <tr key={d.id}>
                  <td className="text-[var(--color-ink-2)]">{d.decided_at}</td>
                  <td className="text-[var(--color-ink-2)]">{d.decided_by_name ?? "—"}</td>
                  <td className="text-[var(--color-ink-2)]">{d.requested_by_name}</td>
                  <td className="text-[var(--color-ink-2)]">
                    {d.entity} #{d.entity_id}
                  </td>
                  <td>
                    <span
                      className={`chip ${d.status === "approved" ? "chip-positive" : "chip-negative"}`}
                    >
                      {d.status}
                    </span>
                  </td>
                  <td className="text-[var(--color-muted)]">{d.decision_notes ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
    </div>
  );
}
