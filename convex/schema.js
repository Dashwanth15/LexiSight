// NEW CODE — Convex schema for WebRTC calling rooms and signaling
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Rooms table — stores active call rooms
  rooms: defineTable({
    roomCode: v.string(),        // Short unique code for sharing (e.g., "abc123")
    ownerId: v.string(),         // Clerk user ID of room creator
    ownerName: v.string(),       // Display name of room creator
    participants: v.array(       // Array of users currently in the room
      v.object({
        userId: v.string(),
        userName: v.string(),
        joinedAt: v.number(),
      })
    ),
    status: v.string(),          // "waiting" | "active" | "ended"
    createdAt: v.number(),
  })
    .index("by_roomCode", ["roomCode"])
    .index("by_ownerId", ["ownerId"])
    .index("by_status", ["status"]),

  // Signals table — WebRTC SDP offers/answers and ICE candidates
  signals: defineTable({
    roomId: v.id("rooms"),       // Reference to rooms table
    fromUserId: v.string(),      // Clerk user ID of signal sender
    type: v.string(),            // "offer" | "answer" | "ice-candidate"
    data: v.string(),            // JSON-stringified SDP or ICE candidate
    createdAt: v.number(),
  })
    .index("by_roomId", ["roomId"])
    .index("by_roomId_type", ["roomId", "type"]),

  // Sign captions — text-only sync for sign language mode (no media/landmarks)
  signCaptions: defineTable({
    roomId: v.id("rooms"),
    userId: v.string(),
    stable: v.string(),
    interim: v.string(),
    updatedAt: v.number(),
  })
    .index("by_roomId", ["roomId"])
    .index("by_roomId_userId", ["roomId", "userId"]),
});
