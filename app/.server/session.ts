import { env } from "cloudflare:workers";
import { createCookie, createSessionStorage } from "react-router";
import { drizzle } from "drizzle-orm/d1";
import { eq, lt } from "drizzle-orm";
import { sessions } from "~/db/schema";
import { nanoid } from "nanoid";

const sessionCookie = createCookie("__session", {
	secrets: [env.SESSION_SECRET],
	sameSite: true,
});

type SessionData = {
	email: string;
};

function getDb() {
	return drizzle(env.DB);
}

const { getSession, commitSession, destroySession } =
	createSessionStorage<SessionData>({
		cookie: sessionCookie,
		async createData(data, expires) {
			const db = getDb();
			const id = nanoid(32);
			await db.insert(sessions).values({
				id,
				data: JSON.stringify(data),
				expiresAt: expires ? Math.floor(expires.getTime() / 1000) : null,
			});
			return id;
		},
		async readData(id) {
			const db = getDb();
			const row = await db
				.select()
				.from(sessions)
				.where(eq(sessions.id, id))
				.get();
			if (!row) return null;
			if (row.expiresAt && row.expiresAt < Math.floor(Date.now() / 1000)) {
				await db.delete(sessions).where(eq(sessions.id, id));
				return null;
			}
			return JSON.parse(row.data);
		},
		async updateData(id, data, expires) {
			const db = getDb();
			await db
				.update(sessions)
				.set({
					data: JSON.stringify(data),
					expiresAt: expires ? Math.floor(expires.getTime() / 1000) : null,
				})
				.where(eq(sessions.id, id));
		},
		async deleteData(id) {
			const db = getDb();
			await db.delete(sessions).where(eq(sessions.id, id));
		},
	});

export { getSession, commitSession, destroySession };
