import { isJidGroup, jidDecode } from "@whiskeysockets/baileys";
import { Database } from "better-sqlite3";

export type Resolution =
	| { ok: true; jid: string; label: string }
	| { ok: false; error: "not-found" }
	| {
			ok: false;
			error: "ambiguous";
			candidates: { jid: string; label: string }[];
	  };

/** Resolve a user-typed name (or raw JID / phone) to exactly one chat JID,
 *  using the local DB. Groups match by name; direct chats by stored name,
 *  phone digits, or last-4 of their identifier. */
export function resolveChat(db: Database, input: string): Resolution {
	const rows = db
		.prepare(`
SELECT 
  c.jid, 
  COALESCE(c.name, ct.name, s.name, sct.name) AS name, 
  c.type, 
  c.last_message_at 
FROM chats c
LEFT JOIN contacts ct  ON ct.jid  = c.jid
LEFT JOIN chats s      ON s.jid   = c.alt_jid
LEFT JOIN contacts sct ON sct.jid = c.alt_jid
    `)
		.all() as {
		jid: string;
		name: string | null;
		type: string;
		last_message_at: string | null;
	}[];
	const needle = input.trim().toLowerCase();
	const digits = needle.replace(/\D/g, ""); // phone digits if any

	const matches = rows.filter((r) => {
		if (r.name && r.name.toLowerCase().includes(needle)) return true;
		const user = r.jid.split("@")[0]?.split(":")[0] ?? "";
		if (digits.length >= 4 && digits === user) return true; // exact phone JID
		if (digits.length >= 4 && digits.endsWith(user)) return true; // phone with country code
		if (digits.length === 4 && user.endsWith(digits)) return true; // "6400"-style tail
		return false;
	});

	// Exact name match wins instantly over any partial match — "Dev" vs "Developers"
	const exact = matches.filter((r) => r.name?.toLowerCase() === needle);
	const chosen = exact.length === 1 ? exact : matches;

	const toCandidate = (r: { jid: string; name: string | null }) => ({
		jid: r.jid,
		label: r.name ?? jidLabel(r.jid),
	});

	if (chosen.length === 0) return { ok: false, error: "not-found" };
	if (chosen.length > 1) {
		// recency order: most recently active candidate first
		const sorted = [...chosen].sort((a, b) =>
			(b.last_message_at ?? "").localeCompare(a.last_message_at ?? ""),
		);
		return {
			ok: false,
			error: "ambiguous",
			candidates: sorted.map(toCandidate),
		};
	}
	const pick = toCandidate(chosen[0]!);
	return { ok: true, jid: pick.jid, label: pick.label };
}

export const isGroupChat = isJidGroup;

export function isLid(jid: string): boolean {
	return jidDecode(jid)?.server === "lid";
}

export function phoneFromJid(jid: string): string {
	const decoded = jidDecode(jid);
	const user = decoded?.user ?? "";
	if (!user) return jid;
	if (isLid(jid)) return `lid …${user.slice(-4)}`;
	return `+${user}`;
}

export const groupTail = (jid: string): string =>
	(jidDecode(jid)?.user ?? "").slice(-4);

export function jidLabel(jid: string): string {
	return isGroupChat(jid) ? `group …${groupTail(jid)}` : phoneFromJid(jid);
}
