import { OpenAPIHono } from "@hono/zod-openapi";
import { type Bindings, CLIENT_PREFIX } from "../common/types";
import {
  createClientRoute,
  deleteClientRoute,
  getClientRoute,
  listClientRoute,
  updateClientRoute,
} from "./routes";
import { ClientMetadata, ClientValue } from "./types";
import hyperid from "hyperid";
import { splitMetadata } from "./utils";

const app = new OpenAPIHono<{ Bindings: Bindings }>();

app
  .openapi(getClientRoute, async (c) => {
    const { clientId } = c.req.valid("param");

    try {
      const response = await c.env.OAUTHABL.getWithMetadata<
        ClientValue,
        ClientMetadata
      >(`client:${clientId}`, "json");

      if (response.value === null || response.metadata === null)
        return c.json({ code: 404, message: "Not found" }, 404);

      // @ts-expect-error these have to not be null by now
      return c.json(combineMetadata(response), 200);
    } catch (error) {
      console.error(error);
      return c.json({ code: 500, message: "Internal server error" }, 500);
    }
  })
  .openapi(createClientRoute, async (c) => {
    const idInstance = hyperid({ urlSafe: true });
    const secretInstance = hyperid();
    const id = idInstance();
    const secret = secretInstance();

    const newClient = { ...c.req.valid("json"), id, secret };

    try {
      const { value, options } = splitMetadata(newClient);
      await c.env.OAUTHABL.put(`client:${id}`, value, options);

      return c.json(newClient, 200);
    } catch (error) {
      console.error(error);
      return c.json({ code: 500, message: "Internal server error" }, 500);
    }
  })
  .openapi(listClientRoute, async (c) => {
    try {
      const clients = await c.env.OAUTHABL.list<ClientMetadata>({
        prefix: CLIENT_PREFIX,
      });

      return c.json(
        clients.keys.map(({ name: id, metadata }) => ({
          // @ts-expect-error metadata.name is always defined
          name: metadata.name,
          id: id.substring(CLIENT_PREFIX.length),
          // @ts-expect-error metadata.secret is always defined
          secret: metadata.secret,
        })),
        200
      );
    } catch (error) {
      console.error(error);
      return c.json({ code: 500, message: "Internal server error" }, 500);
    }
  })
  .openapi(updateClientRoute, async (c) => {
    const { clientId } = c.req.valid("param");

    const clientUpdates = c.req.valid("json");

    try {
      const response = await c.env.OAUTHABL.getWithMetadata<
        ClientValue,
        ClientMetadata
      >(`client:${clientId}`, "json");

      if (response.value === null || response.metadata === null)
        return c.json({ code: 404, message: "Not found" }, 404);

      // @ts-expect-error these have to not be null by now
      const oldClient = combineMetadata(response);

      try {
        const newClient = {
          ...oldClient,
          ...clientUpdates,
        };

        const { value, options } = splitMetadata(newClient);

        await c.env.OAUTHABL.put(`client:${clientId}`, value, options);

        return c.json(newClient, 200);
      } catch (error) {
        console.error(error);
        return c.json({ code: 500, message: "Internal server error" }, 500);
      }
    } catch (error) {
      console.error(error);
      return c.json({ code: 500, message: "Internal server error" }, 500);
    }
  })
  .openapi(deleteClientRoute, async (c) => {
    const { clientId } = c.req.valid("param");
    try {
      await c.env.OAUTHABL.delete(`client:${clientId}`);

      return c.json({ code: 200, message: "Client deleted" });
    } catch (error) {
      console.error(error);
      return c.json({ code: 500, message: "Internal server error" }, 500);
    }
  });

export default app;
