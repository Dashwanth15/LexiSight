// NEW CODE — WebRTC signaling layer via Convex
// Handles SDP offer/answer and ICE candidate exchange
// Media NEVER passes through Convex — only signaling metadata
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// INTEGRATION POINT — Called from useWebRTC.js to send SDP/ICE signals
export const sendSignal = mutation({
  args: {
    roomId: v.id("rooms"),
    fromUserId: v.string(),
    type: v.string(),     // "offer" | "answer" | "ice-candidate"
    data: v.string(),     // JSON-stringified SDP or ICE candidate
  },
  handler: async (ctx, { roomId, fromUserId, type, data }) => {
    await ctx.db.insert("signals", {
      roomId,
      fromUserId,
      type,
      data,
      createdAt: Date.now(),
    });
  },
});

// INTEGRATION POINT — Reactive subscription in useWebRTC.js
// Returns signals for a room that were NOT sent by the current user
export const getSignals = query({
  args: {
    roomId: v.optional(v.id("rooms")),
    userId: v.string(),
  },
  handler: async (ctx, { roomId, userId }) => {
    if (!roomId) return [];

    const signals = await ctx.db
      .query("signals")
      .withIndex("by_roomId", (q) => q.eq("roomId", roomId))
      .collect();

    // Only return signals from the OTHER user (not our own)
    return signals.filter((s) => s.fromUserId !== userId);
  },
});

// INTEGRATION POINT — Called during cleanup to remove processed signals
export const clearSignals = mutation({
  args: {
    roomId: v.id("rooms"),
  },
  handler: async (ctx, { roomId }) => {
    const signals = await ctx.db
      .query("signals")
      .withIndex("by_roomId", (q) => q.eq("roomId", roomId))
      .collect();

    for (const signal of signals) {
      await ctx.db.delete(signal._id);
    }
  },
});
