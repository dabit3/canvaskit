import { useEffect, useRef, useState, useCallback } from "react";
import { Collaborator } from "../types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function throttle<T extends (...args: any[]) => void>(func: T, limit: number): T {
  let inThrottle: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function(this: any, ...args: any[]) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  } as T;
}

const PRESENCE_THROTTLE = 50; // ms

export function useMultiplayer() {
  const [collaborators, setCollaborators] = useState<Map<string, Collaborator>>(new Map());
  const [myProfile, setMyProfile] = useState<{ name: string; color: string } | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Store collaborators in a ref to avoid re-renders on every message
  const collaboratorsRef = useRef<Map<string, Collaborator>>(new Map());

  // My assigned ID from server
  const myIdRef = useRef<string>("");

  useEffect(() => {
    // Initialize profile
    const stored = localStorage.getItem("canvas-profile");
    if (stored) {
      try {
        setMyProfile(JSON.parse(stored));
      } catch {}
    } else {
      const colors = ["#f87171", "#fbbf24", "#34d399", "#60a5fa", "#a78bfa", "#f472b6"];
      const newProfile = {
        name: "Guest " + Math.floor(Math.random() * 1000),
        color: colors[Math.floor(Math.random() * colors.length)],
      };
      setMyProfile(newProfile);
      localStorage.setItem("canvas-profile", JSON.stringify(newProfile));
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!myProfile) return;

    // Use current host for WS
    const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
    const wsUrl = `${protocol}${window.location.host}/multiplayer`;

    const connect = () => {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
            console.log("Connected to multiplayer server");
        };

        ws.onmessage = (event) => {
            try {
                // Determine if data is Blob (binary) or text
                if (event.data instanceof Blob) {
                  // If we use binary later
                  return;
                }

                const msg = JSON.parse(event.data);

                if (msg.type === 'init') {
                  myIdRef.current = msg.id;
                  return;
                }

                if (msg.type === 'presence') {
                    if (msg.id === myIdRef.current) return; // Ignore self

                    // Update the ref only
                    collaboratorsRef.current.set(msg.id, msg);
                }
            } catch {
                // Ignore
            }
        };

        ws.onclose = () => {
             // Reconnect logic could go here
        };
    };

    connect();

    // Animation frame loop to sync ref to state at optimal framerate
    let animationFrameId: number;
    const syncState = () => {
      setCollaborators(new Map(collaboratorsRef.current));
      animationFrameId = requestAnimationFrame(syncState);
    };
    animationFrameId = requestAnimationFrame(syncState);

    return () => {
        wsRef.current?.close();
        cancelAnimationFrame(animationFrameId);
    };
  }, [myProfile]);

  // Clean up stale collaborators
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const next = collaboratorsRef.current;
      let changed = false;

      for (const [id, c] of next) {
        if (now - c.lastSeen > 30000) { // 30s timeout
          next.delete(id);
          changed = true;
        }
      }

      // If changed, the next requestAnimationFrame will pick it up
      // or we can force it here if strictly necessary, but the loop handles it.
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const sendPresence = useCallback((x: number, y: number) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || !myProfile || !myIdRef.current) return;

    const msg: Collaborator & { type: 'presence' } = {
        type: 'presence',
        id: myIdRef.current, // Use the server-assigned ID
        name: myProfile.name,
        color: myProfile.color,
        x,
        y,
        lastSeen: Date.now()
    };
    wsRef.current.send(JSON.stringify(msg));
  }, [myProfile]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const throttledSendPresence = useCallback(throttle(sendPresence, PRESENCE_THROTTLE), [sendPresence]);

  const updateProfile = (name: string, color: string) => {
      const newProfile = { name, color };
      setMyProfile(newProfile);
      localStorage.setItem("canvas-profile", JSON.stringify(newProfile));
  };

  return {
    collaborators,
    myProfile,
    updateProfile,
    updatePresence: throttledSendPresence
  };
}
