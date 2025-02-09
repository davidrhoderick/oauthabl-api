import { FORGOTPASSWORDCODE_PREFIX } from "../common/constants";

export const verifyForgotPasswordCode = async ({
  code,
  clientId,
  kv,
  userId,
}: { code: string; clientId: string; userId: string; kv: KVNamespace }) => {
  const verificationCode = await kv.get(
    `${FORGOTPASSWORDCODE_PREFIX}:${clientId}:${userId}`,
  );

  if (verificationCode === code) {
    await kv.delete(`${FORGOTPASSWORDCODE_PREFIX}:${clientId}:${userId}`);

    return true;
  }

  return false;
};
