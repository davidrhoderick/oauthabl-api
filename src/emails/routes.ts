import { createRoute } from "@hono/zod-openapi";
import {
  BadRequestSchema,
  InternalServerErrorSchema,
  UnauthorizedSchema,
  ClientIdParamSchema,
} from "../common/schemas";
import {
  EmailVerificationBodySchema,
  ResendVerificationEmailBodySchema,
} from "./schemas";

const tags = ["OAuth"];

export const emailVerificationRoute = createRoute({
  tags,
  method: "post",
  path: "/{clientId}/verify-email",
  request: {
    params: ClientIdParamSchema,
    body: {
      content: {
        "application/json": {
          schema: EmailVerificationBodySchema,
        },
      },
    },
  },
  security: [
    {
      Client: [],
    },
  ],
  responses: {
    200: {
      description: "Email sent",
    },
    400: {
      content: {
        "application/json": {
          schema: BadRequestSchema,
        },
      },
      description: "Bad Request",
    },
    401: {
      content: {
        "application/json": {
          schema: UnauthorizedSchema,
        },
      },
      description: "Unauthorized",
    },
    500: {
      content: {
        "application/json": {
          schema: InternalServerErrorSchema,
        },
      },
      description: "Internal server error",
    },
  },
});

export const resendVerificationEmailRoute = createRoute({
  tags,
  method: "post",
  path: "/{clientId}/resend-email-verification",
  request: {
    params: ClientIdParamSchema,
    body: {
      content: {
        "application/json": {
          schema: ResendVerificationEmailBodySchema,
        },
      },
    },
  },
  security: [
    {
      Client: [],
    },
  ],
  responses: {
    200: {
      description: "Code resent",
    },
    400: {
      content: {
        "application/json": {
          schema: BadRequestSchema,
        },
      },
      description: "Bad Request",
    },
    401: {
      content: {
        "application/json": {
          schema: UnauthorizedSchema,
        },
      },
      description: "Unauthorized",
    },
    500: {
      content: {
        "application/json": {
          schema: InternalServerErrorSchema,
        },
      },
      description: "Internal server error",
    },
  },
});