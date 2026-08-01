"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  completeApprovedAccountPairingByCode,
  normalizePairingCode
} from "@/lib/account-pairing";
import { ACCOUNT_SESSION_COOKIE, accountSessionCookieOptions } from "@/lib/account-session-cookie";

export interface LinkAccountActionState {
  status: "idle" | "error";
  message: string;
}

export const INITIAL_LINK_ACCOUNT_STATE: LinkAccountActionState = {
  status: "idle",
  message: ""
};

export async function approveBrowserLink(
  _previous: LinkAccountActionState,
  formData: FormData
): Promise<LinkAccountActionState> {
  const code = normalizePairingCode(String(formData.get("code") ?? ""));
  if (code.length !== 8) {
    return { status: "error", message: "Open a new connection link from RuneLite." };
  }

  let result;
  try {
    result = await completeApprovedAccountPairingByCode(code);
  } catch {
    return { status: "error", message: "Scapestack could not connect this browser. Try a new link." };
  }
  if (result.status !== "connected") {
    return {
      status: "error",
      message: result.status === "expired"
        ? "This link expired. Open a new one from RuneLite."
        : "This link has already been used or does not match RuneLite."
    };
  }

  const cookieStore = await cookies();
  cookieStore.set(
    ACCOUNT_SESSION_COOKIE,
    result.sessionToken,
    accountSessionCookieOptions(result.expiresAt)
  );
  redirect(`/p/${encodeURIComponent(result.account.displayName || result.account.rsn)}`);
}
