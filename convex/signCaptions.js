// Sign caption sync — text-only payloads for sign language mode during calls
// Media and landmarks never pass through Convex; only stabilized caption strings.
//
// Deploy with `npx convex dev` to enable dedicated signCaptions table sync.
// Until then, the client uses signaling.sendSignal (type: "sign-caption") via useSignCaptionSync.
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const publishSignCaption = mutation({
  args: {
    roomId: v.id("rooms"),
    userId: v.string(),
    stable: v.string(),
    interim: v.string(),
  },
  handler: async (ctx, { roomId, userId, stable, interim }) => {
    const existing = await ctx.db
      .query("signCaptions")
      .withIndex("by_roomId_userId", (q) =>
        q.eq("roomId", roomId).eq("userId", userId)
      )
      .unique();

    const payload = {
      roomId,
      userId,
      stable: stable.slice(0, 500),
      interim: interim.slice(0, 120),
      updatedAt: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return existing._id;
    }
    return await ctx.db.insert("signCaptions", payload);
  },
});

export const getPeerSignCaption = query({
  args: {
    roomId: v.optional(v.id("rooms")),
    userId: v.string(),
  },
  handler: async (ctx, { roomId, userId }) => {
    if (!roomId) return null;

    const rows = await ctx.db
      .query("signCaptions")
      .withIndex("by_roomId", (q) => q.eq("roomId", roomId))
      .collect();

    const peer = rows
      .filter((r) => r.userId !== userId)
      .sort((a, b) => b.updatedAt - a.updatedAt)[0];

    if (!peer) return { stable: "", interim: "" };

    // Stale captions expire after 8s of silence
    if (Date.now() - peer.updatedAt > 8000 && !peer.interim) {
      return { stable: "", interim: "" };
    }

    return { stable: peer.stable, interim: peer.interim };
  },
});

export const clearRoomSignCaptions = mutation({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => {
    const rows = await ctx.db
      .query("signCaptions")
      .withIndex("by_roomId", (q) => q.eq("roomId", roomId))
      .collect();
    for (const row of rows) {
      await ctx.db.delete(row._id);
    }
  },
});
