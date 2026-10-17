import { joinRoom } from "@trystero-p2p/nostr";
import type { Room, RoomHandlers, Transport } from "./transport";

/** The name of the app for the signaling: only peers with the same one meet. */
export const APP_ID = "six-seks";

/** The name of the channel of the texts of a match inside the room. */
const CHANNEL = "m";

/**
 * The transport of the page: WebRTC straight between the browsers, with the
 * handshake going through public Nostr relays (the library's default list;
 * Trystero 0.26, strategy `@trystero-p2p/nostr`). After the handshake the
 * texts go peer to peer, not through the relays. Without a TURN server some
 * pairs of networks never connect: the interface then offers play by correspondence.
 */
export const trysteroTransport: Transport = {
  join(roomId: string, handlers: RoomHandlers): Room {
    const peers = new Set<string>();
    let left = false;
    const room = joinRoom({ appId: APP_ID }, roomId, {
      onJoinError: (details) => {
        if (!left) handlers.onError?.(String(details.error));
      },
    });
    const channel = room.makeAction<string>(CHANNEL);
    channel.onMessage = (text) => {
      if (!left && typeof text === "string") handlers.onMessage(text);
    };
    room.onPeerJoin = (peerId) => {
      if (left) return;
      peers.add(peerId);
      handlers.onJoin();
    };
    room.onPeerLeave = (peerId) => {
      if (left || !peers.delete(peerId)) return;
      handlers.onLeave();
    };
    return {
      get peers() {
        return peers.size;
      },
      send(text) {
        if (left || peers.size === 0) return;
        void channel.send(text).catch(() => undefined);
      },
      leave() {
        if (left) return;
        left = true;
        peers.clear();
        void room.leave();
      },
    };
  },
};
