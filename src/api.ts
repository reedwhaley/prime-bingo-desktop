import type {
  CreateRoomResponse,
  DesktopAuthRequestCreateResponse,
  DesktopAuthRequestStatusResponse,
  EventResponse,
  LiveEvent,
  BoardSquare,
  RoomListResponse,
  RoomSnapshot,
  ViewerSettingsResponse
} from "./types";

type ConnectionConfig = {
  baseUrl: string;
  roomCode: string;
  sessionToken: string;
};

export type BoardDvrReplay = {
  room_code: string;
  requested_version: number;
  live_version: number;
  initial_state: unknown;
  events: Array<{
    version?: number;
    type?: string;
    summary?: string;
    occurred_at_utc?: string;
    elapsed_seconds?: number;
  }>;
  projection?: {
    state: string;
    variant: string;
    board_size: number;
    boards: Array<{
      board_id: string;
      team_name: string;
      board: BoardSquare[];
    }>;
  };
};

const jsonHeaders = (sessionToken: string) => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${sessionToken}`
});

export async function fetchSnapshot(config: ConnectionConfig): Promise<RoomSnapshot> {
  const response = await fetch(`${config.baseUrl}/api/bingo/rooms/${config.roomCode}/snapshot`, {
    headers: {
      Authorization: `Bearer ${config.sessionToken}`
    }
  });
  if (!response.ok) {
    throw new Error(`Snapshot request failed with HTTP ${response.status}`);
  }
  return response.json() as Promise<RoomSnapshot>;
}

export async function fetchBoardDvrReplay(config: ConnectionConfig, version: number): Promise<BoardDvrReplay> {
  const query = new URLSearchParams({ version: String(version) });
  const response = await fetch(`${config.baseUrl}/api/bingo/rooms/${config.roomCode}/staff/replay?${query}`, {
    headers: {
      Authorization: `Bearer ${config.sessionToken}`
    }
  });
  if (!response.ok) {
    throw new Error(`Board DVR request failed with HTTP ${response.status}`);
  }
  return response.json() as Promise<BoardDvrReplay>;
}

export async function fetchRooms(config: Omit<ConnectionConfig, "roomCode">): Promise<RoomSnapshot[]> {
  const response = await fetch(`${config.baseUrl}/api/bingo/rooms`, {
    headers: {
      Authorization: `Bearer ${config.sessionToken}`
    }
  });
  if (!response.ok) {
    throw new Error(`Room list request failed with HTTP ${response.status}`);
  }
  const payload = (await response.json()) as RoomListResponse;
  return payload.rooms;
}

export async function createRoom(
  config: Omit<ConnectionConfig, "roomCode">,
  payload: {
    variant?: string;
    board_size?: number;
    practice_mode: string;
    game_type: string;
    algorithm: string;
    visibility: string;
    fog_of_war?: boolean;
    show_actual_goal_to_opponents?: boolean;
  }
): Promise<CreateRoomResponse> {
  const response = await fetch(`${config.baseUrl}/api/bingo/rooms`, {
    method: "POST",
    headers: jsonHeaders(config.sessionToken),
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    throw new Error(`Create room request failed with HTTP ${response.status}`);
  }
  return response.json() as Promise<CreateRoomResponse>;
}

async function postRoomAction(
  config: ConnectionConfig,
  path: string,
  payload?: Record<string, unknown>
): Promise<EventResponse> {
  const response = await fetch(`${config.baseUrl}/api/bingo/rooms/${config.roomCode}/${path}`, {
    method: "POST",
    headers: jsonHeaders(config.sessionToken),
    body: JSON.stringify(payload ?? {})
  });
  return response.json() as Promise<EventResponse>;
}

export async function createDesktopAuthRequest(baseUrl: string, deviceName: string): Promise<DesktopAuthRequestCreateResponse> {
  const body = new URLSearchParams();
  body.set("device_name", deviceName);
  const response = await fetch(`${baseUrl}/api/bingo/desktop/auth/requests`, {
    method: "POST",
    body
  });
  if (!response.ok) {
    throw new Error(`Desktop sign-in request failed with HTTP ${response.status}`);
  }
  return response.json() as Promise<DesktopAuthRequestCreateResponse>;
}

export async function fetchDesktopAuthRequest(baseUrl: string, requestId: string): Promise<DesktopAuthRequestStatusResponse> {
  const response = await fetch(`${baseUrl}/api/bingo/desktop/auth/requests/${requestId}`);
  if (!response.ok) {
    throw new Error(`Desktop sign-in status failed with HTTP ${response.status}`);
  }
  return response.json() as Promise<DesktopAuthRequestStatusResponse>;
}

export async function saveViewerSettings(
  config: Omit<ConnectionConfig, "roomCode">,
  payload: { user_color_hex: string }
): Promise<ViewerSettingsResponse> {
  const response = await fetch(`${config.baseUrl}/api/bingo/viewer/settings`, {
    method: "POST",
    headers: jsonHeaders(config.sessionToken),
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    throw new Error(`Viewer settings request failed with HTTP ${response.status}`);
  }
  return response.json() as Promise<ViewerSettingsResponse>;
}

export async function fetchViewerSettings(
  config: Omit<ConnectionConfig, "roomCode">
): Promise<ViewerSettingsResponse> {
  const response = await fetch(`${config.baseUrl}/api/bingo/viewer/settings`, {
    headers: {
      Authorization: `Bearer ${config.sessionToken}`
    }
  });
  if (!response.ok) {
    throw new Error(`Viewer settings request failed with HTTP ${response.status}`);
  }
  return response.json() as Promise<ViewerSettingsResponse>;
}

export async function sendBoardAction(
  config: ConnectionConfig,
  squareId: string,
  actionType: "goal.toggle" | "goal.star.toggle" | "goal.counter.increment" | "goal.counter.decrement"
): Promise<EventResponse> {
  const response = await fetch(`${config.baseUrl}/api/bingo/rooms/${config.roomCode}/events`, {
    method: "POST",
    headers: jsonHeaders(config.sessionToken),
    body: JSON.stringify({
      event_id: crypto.randomUUID(),
      square_id: squareId,
      action_type: actionType
    })
  });
  return response.json() as Promise<EventResponse>;
}

export async function sendChatMessage(config: ConnectionConfig, message: string): Promise<EventResponse> {
  const response = await fetch(`${config.baseUrl}/api/bingo/rooms/${config.roomCode}/chat`, {
    method: "POST",
    headers: jsonHeaders(config.sessionToken),
    body: JSON.stringify({ message })
  });
  return response.json() as Promise<EventResponse>;
}

export function joinRoom(config: ConnectionConfig, slot: "p1" | "p2") {
  return postRoomAction(config, "join", { slot });
}

export function joinRoomTarget(config: ConnectionConfig, payload: { board_id: string; slot: "p1" | "p2" }) {
  return postRoomAction(config, "join", payload);
}

export function joinRoomGeneric(config: ConnectionConfig) {
  return postRoomAction(config, "join");
}

export function leaveRoom(config: ConnectionConfig) {
  return postRoomAction(config, "leave");
}

export function updateTeamName(config: ConnectionConfig, payload: { action: "generate" } | { action: "set"; team_name: string }) {
  return postRoomAction(config, "team-name", payload as Record<string, unknown>);
}

export function setReady(config: ConnectionConfig, ready: boolean) {
  return postRoomAction(config, "ready", { ready });
}

export function startRoom(config: ConnectionConfig) {
  return postRoomAction(config, "start");
}

export function finishRoom(config: ConnectionConfig) {
  return postRoomAction(config, "finish");
}

export function rerollRoom(config: ConnectionConfig) {
  return postRoomAction(config, "reroll");
}

export function regenerateRoomInvite(config: ConnectionConfig) {
  return postRoomAction(config, "invite");
}

export function reportRoomResult(config: ConnectionConfig, result: "done" | "forfeit") {
  return postRoomAction(config, "result", { result });
}

export function connectLive(
  config: ConnectionConfig,
  lastSeenVersion: number,
  handlers: {
    onOpen?: () => void;
    onEvent?: (event: LiveEvent | { type: "room.snapshot"; version: number; payload: RoomSnapshot }) => void;
    onClose?: () => void;
    onError?: () => void;
  }
): WebSocket {
  const wsUrl = new URL(`${config.baseUrl.replace(/^http/, "ws")}/api/bingo/rooms/${config.roomCode}/live`);
  wsUrl.searchParams.set("session_token", config.sessionToken);
  wsUrl.searchParams.set("last_seen_version", String(lastSeenVersion));
  const socket = new WebSocket(wsUrl);
  socket.addEventListener("open", () => {
    socket.send(JSON.stringify({ type: "hello", last_seen_version: lastSeenVersion }));
    handlers.onOpen?.();
  });
  socket.addEventListener("message", (message) => {
    const payload = JSON.parse(String(message.data));
    handlers.onEvent?.(payload);
  });
  socket.addEventListener("close", () => handlers.onClose?.());
  socket.addEventListener("error", () => handlers.onError?.());
  return socket;
}
