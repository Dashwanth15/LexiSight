// NEW CODE — Convex room management mutations and queries
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Generate a short random room code (6 chars)
function generateRoomCode() {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// INTEGRATION POINT — Called from CallRoom.jsx when user clicks "Create Room"
export const createRoom = mutation({
  args: {
    userId: v.string(),
    userName: v.string(),
  },
  handler: async (ctx, { userId, userName }) => {
    // Generate a unique room code (retry if collision)
    let roomCode = generateRoomCode();
    let existing = await ctx.db
      .query("rooms")
      .withIndex("by_roomCode", (q) => q.eq("roomCode", roomCode))
      .first();

    let attempts = 0;
    while (existing && attempts < 5) {
      roomCode = generateRoomCode();
      existing = await ctx.db
        .query("rooms")
        .withIndex("by_roomCode", (q) => q.eq("roomCode", roomCode))
        .first();
      attempts++;
    }

    const roomId = await ctx.db.insert("rooms", {
      roomCode,
      ownerId: userId,
      ownerName: userName,
      participants: [
        {
          userId,
          userName,
          joinedAt: Date.now(),
        },
      ],
      status: "waiting",
      createdAt: Date.now(),
    });

    return { roomId, roomCode };
  },
});

// INTEGRATION POINT — Called from CallRoom.jsx when user joins via code/URL
export const joinRoom = mutation({
  args: {
    roomCode: v.string(),
    userId: v.string(),
    userName: v.string(),
  },
  handler: async (ctx, { roomCode, userId, userName }) => {
    const room = await ctx.db
      .query("rooms")
      .withIndex("by_roomCode", (q) => q.eq("roomCode", roomCode))
      .first();

    if (!room) {
      throw new Error("Room not found");
    }

    if (room.status === "ended") {
      throw new Error("Room has ended");
    }

    // Check if user is already in the room
    const alreadyIn = room.participants.some((p) => p.userId === userId);
    if (alreadyIn) {
      return { roomId: room._id, roomCode: room.roomCode };
    }

    // MVP: 1-to-1 only — max 2 participants
    if (room.participants.length >= 2) {
      throw new Error("Room is full (1-to-1 calls only)");
    }

    await ctx.db.patch(room._id, {
      participants: [
        ...room.participants,
        {
          userId,
          userName,
          joinedAt: Date.now(),
        },
      ],
      status: "active",
    });

    return { roomId: room._id, roomCode: room.roomCode };
  },
});

// INTEGRATION POINT — Called on disconnect/leave/cleanup
export const leaveRoom = mutation({
  args: {
    roomCode: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, { roomCode, userId }) => {
    const room = await ctx.db
      .query("rooms")
      .withIndex("by_roomCode", (q) => q.eq("roomCode", roomCode))
      .first();

    if (!room) return;

    const remaining = room.participants.filter((p) => p.userId !== userId);

    if (remaining.length === 0) {
      // No participants left — mark room as ended
      await ctx.db.patch(room._id, {
        participants: [],
        status: "ended",
      });

      // Clean up signals for this room
      const signals = await ctx.db
        .query("signals")
        .withIndex("by_roomId", (q) => q.eq("roomId", room._id))
        .collect();

      for (const signal of signals) {
        await ctx.db.delete(signal._id);
      }
    } else {
      await ctx.db.patch(room._id, {
        participants: remaining,
        status: "waiting",
      });
    }
  },
});

// INTEGRATION POINT — Reactive subscription in CallRoom.jsx
export const getRoom = query({
  args: {
    roomCode: v.string(),
  },
  handler: async (ctx, { roomCode }) => {
    if (!roomCode) return null;

    const room = await ctx.db
      .query("rooms")
      .withIndex("by_roomCode", (q) => q.eq("roomCode", roomCode))
      .first();

    return room;
  },
});
