import { useEffect, useState } from "react";
import { Permissions, PermissionUtils } from "@discord/embedded-app-sdk";
import { getDiscordSdk } from "./discord";

/**
 * Whether to *show* the settings button — a client-side hint only, using the SDK's own
 * getChannelPermissions() + PermissionUtils rather than hand-rolled bit math.
 *
 * This is never the real authorization boundary: every settings read/write is independently
 * re-verified server-side against real guild-member permissions (see ActivityServer's
 * isGuildManager). A stale or spoofed hint here can only ever produce a visible button that
 * the server then refuses — never actual access.
 *
 * @param authenticated Whether useActivitySync's full connect sequence (SDK handshake, OAuth
 *   authorize + token exchange, authenticate()) has finished — getChannelPermissions() rejects
 *   with "Not authenticated or invalid scope" (RPC error 4006) if called any earlier, so this
 *   must wait for the same milestone useActivitySync itself reaches before opening the socket.
 *   Confirmed via a live "4006 · Not authenticated or invalid scope" error, not assumed.
 */
export function useCanManageGuild(authenticated: boolean): boolean {
  const [canManage, setCanManage] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!authenticated) return;

    // getChannelPermissions() always returns 0n outside a guild context — per its own doc
    // comment, unnecessary (and would just resolve falsy) when guildId is null.
    if (!getDiscordSdk().guildId) return;

    getDiscordSdk().commands
      .getChannelPermissions()
      .then(({ permissions }) => {
        if (!cancelled) setCanManage(PermissionUtils.can(Permissions.MANAGE_GUILD, permissions));
      })
      .catch(() => {
        // A denied/unsupported call just means the button stays hidden — never treated as
        // "assume permitted."
      });

    return () => {
      cancelled = true;
    };
  }, [authenticated]);

  return canManage;
}
