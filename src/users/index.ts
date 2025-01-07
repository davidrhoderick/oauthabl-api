import { OpenAPIHono } from "@hono/zod-openapi";
import hyperid from "hyperid";
import {
	EMAIL_PREFIX,
	SESSION_PREFIX,
	USERNAME_PREFIX,
	USER_PREFIX,
} from "../common/constants";
import type { Bindings } from "../common/types";
import { generateEmailVerificationCode, hashPassword } from "../common/utils";
import { clientAuthentication } from "../middleware/client-authentication";
import type { SessionMetadata } from "../tokens/types";
import { archiveSession, createOrUpdateSession } from "../tokens/utils";
import {
	deleteUserRoute,
	getUserRoute,
	listUsersRoute,
	registrationRoute,
	updateUserRoute,
} from "./routes";
import type { User, UserMetadata, UserValue } from "./types";

const app = new OpenAPIHono<{ Bindings: Bindings }>();

app.use("/:clientId/*", clientAuthentication);

app
	.openapi(registrationRoute, async (c) => {
		const { password: rawPassword, ...rest } = c.req.valid("json");

		const clientId = c.req.param("clientId");
		const id = hyperid({ urlSafe: true })();

		const emailVerified = false;

		const response: {
			id: string;
			username?: string;
			emailAddresses?: Array<string>;
			code?: string;
			emailVerified: boolean;
		} = { id, emailVerified };

		const options: {
			metadata: {
				username?: string;
				emailAddresses?: Array<string>;
				emailVerified: boolean;
			};
		} = { metadata: { emailVerified } };

		if (!rest.username?.length && !rest.email?.length)
			return c.json({ code: 400, message: "Bad Request" }, 400);

		if (rest.username) {
			const existingUserByUsername = await c.env.KV.get(
				`${USERNAME_PREFIX}:${clientId}:${rest.username}`,
			);

			if (existingUserByUsername)
				return c.json({ code: 422, message: "Unprocessable Entity" }, 422);
		}

		if (rest.email) {
			const existingUserByEmail = await c.env.KV.get(
				`${EMAIL_PREFIX}:${clientId}:${rest.email}`,
			);

			if (existingUserByEmail)
				return c.json({ code: 422, message: "Unprocessable Entity" }, 422);
		}

		const password = await hashPassword(rawPassword);

		if (rest.email) {
			const { email } = rest;
			const emailAddresses = [email];
			response.emailAddresses = emailAddresses;
			options.metadata.emailAddresses = emailAddresses;
			await c.env.KV.put(`${EMAIL_PREFIX}:${clientId}:${email}`, id, {
				metadata: { emailVerified },
			});

			if (rest.verifyEmail) {
				response.code = await generateEmailVerificationCode({
					kv: c.env.KV,
					clientId,
					id,
				});
			}
		}

		if (rest.username) {
			const { username } = rest;
			response.username = username;
			options.metadata.username = username;
			await c.env.KV.put(`${USERNAME_PREFIX}:${clientId}:${username}`, id);
		}

		await c.env.KV.put(
			`${USER_PREFIX}:${clientId}:${id}`,
			JSON.stringify({ password }),
			options,
		);

		if (!rest.verifyEmail)
			await createOrUpdateSession({
				clientId,
				userId: id,
				c,
				forceNew: true,
			});

		return c.json(response, 200);
	})
	.openapi(listUsersRoute, async (c) => {
		const clientId = c.req.param("clientId");
		const prefix = `${USER_PREFIX}:${clientId}:`;

		const users = await c.env.KV.list<UserMetadata>({
			prefix,
		});

		return c.json(
			(users.keys as Array<{ name: string; metadata: UserMetadata }>).map(
				({
					name: id,
					metadata: { emailAddresses, username, emailVerified },
				}) => {
					return {
						emailAddresses: (emailAddresses ?? []).filter(
							(emailAddress) =>
								typeof emailAddress !== "undefined" || emailAddress !== null,
						),
						username,
						id: id.substring(prefix.length),
						emailVerified,
					};
				},
			) as Array<User>,
			200,
		);
	})
	.openapi(deleteUserRoute, async (c) => {
		const { clientId, userId } = c.req.param();

		const userResponse = await c.env.KV.getWithMetadata<
			UserMetadata,
			UserValue
		>(`${USER_PREFIX}:${clientId}:${userId}`, "json");

		if (userResponse.value?.emailAddresses?.length) {
			await Promise.all(
				userResponse.value.emailAddresses.map(async (emailAddress) => {
					await c.env.KV.delete(`${EMAIL_PREFIX}:${clientId}:${emailAddress}`);
				}),
			);
		}

		if (userResponse.value?.username?.length) {
			await c.env.KV.delete(
				`${USERNAME_PREFIX}:${clientId}:${userResponse.value.username}`,
			);
		}

		await c.env.KV.delete(`${USER_PREFIX}:${clientId}:${userId}`);

		const sessions = await c.env.KV.list<SessionMetadata>({
			prefix: `${SESSION_PREFIX}:${clientId}:${userId}`,
		});

		if (sessions.keys.length)
			for (const session of sessions.keys) {
				await archiveSession({
					env: c.env,
					clientId,
					userId,
					sessionId: session.name,
				});
			}

		return c.json({ code: 200, message: "User deleted successfully" }, 200);
	})
	.openapi(getUserRoute, async (c) => {
		const { clientId, userProperty, userIdentifier } = c.req.param();

		let id: string | null = userProperty === "id" ? userIdentifier : "";
		if (!id.length) {
			if (userProperty === "username")
				id = await c.env.KV.get(
					`${USERNAME_PREFIX}:${clientId}:${userIdentifier}`,
				);
			else
				id = await c.env.KV.get(
					`${EMAIL_PREFIX}:${clientId}:${userIdentifier}`,
				);
		}

		if (!id) return c.json({ message: "Not found", code: 404 }, 404);

		const user = await c.env.KV.getWithMetadata<UserValue, UserMetadata>(
			`${USER_PREFIX}:${clientId}:${id}`,
			"json",
		);

		const sessions = await c.env.KV.list<SessionMetadata>({
			prefix: `${SESSION_PREFIX}:${clientId}:${id}`,
		});

		if (!user.value || !user.metadata)
			return c.json({ message: "Not found", code: 404 }, 404);

		return c.json(
			{
				id,
				emailAddresses: user.metadata.emailAddresses,
				username: user.metadata.username,
				emailVerified: user.metadata.emailVerified,
				sessions: sessions.keys.length,
			},
			200,
		);
	})
	// TODO Update completely for patch user
	.openapi(updateUserRoute, async (c) => {
		// Validate the input

		// Check that usernames and emails

		// Look up the user ID

		// Update the user data

		// Return the new user
		return c.json({}, 200);
	});

export default app;
