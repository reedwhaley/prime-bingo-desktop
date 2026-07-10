import "./styles.css";
import { invoke } from "@tauri-apps/api/core";
import {
  connectLive,
  createDesktopAuthRequest,
  createRoom,
  finishRoom,
  fetchDesktopAuthRequest,
  fetchRooms,
  fetchSnapshot,
  joinRoomGeneric,
  joinRoomTarget,
  leaveRoom,
  reportRoomResult,
  saveViewerSettings,
  sendBoardAction,
  sendChatMessage,
  setReady,
  startRoom,
  updateTeamName
} from "./api";
import { mockRooms, mockSnapshot } from "./mockData";
import type {
  ActivityEntry,
  BoardSquare,
  ChatMessage,
  DesktopAuthRequestStatusResponse,
  Entrant,
  LiveEvent,
  PlayerSlot,
  RoomFeedEntry,
  RoomSnapshot
} from "./types";

type ConnectionState = "idle" | "mock" | "connecting" | "connected" | "offline" | "error";
type SnapshotEvent = { type: "room.snapshot"; version: number; payload: RoomSnapshot };

const PRODUCTION_BASE_URL = "https://mprandomizer.com";
const deviceName = "Prime Bingo Desktop";
const USER_COLOR_STORAGE_KEY = "prime-bingo:user-color";
const DEFAULT_USER_COLOR = "#4BCEA2";
const GAME_OPTIONS = [
  { value: "mpr", label: "Metroid Prime Randomizer" },
  { value: "mp2r", label: "Metroid Prime 2: Echoes Randomizer" },
  { value: "mpcgr", label: "Metroid Prime 1&2 Crossgame Randomizer" }
] as const;
const PRACTICE_MODE_OPTIONS = [
  { value: "singles", label: "Singles" },
  { value: "team", label: "Team" }
] as const;
const VARIANT_OPTIONS = [
  { value: "classic", label: "Classic Bingo" },
  { value: "central_dynamo", label: "Central Dynamo Bingo" }
] as const;
const CENTRAL_DYNAMO_BOARD_SIZE_OPTIONS = [7, 9, 11, 13] as const;
const ALGORITHM_OPTIONS = [
  { value: "random", label: "Random" },
  { value: "srlv5", label: "SRLv5" },
  { value: "isaac", label: "Isaac's" }
] as const;

const root = document.querySelector<HTMLDivElement>("#app");

if (!(root instanceof HTMLDivElement)) {
  throw new Error("Missing app root.");
}

const app = root;
const cloneSnapshot = (snapshot: RoomSnapshot) => structuredClone(snapshot) as RoomSnapshot;

function normalizeHexColor(value: string) {
  const trimmed = value.trim();
  const shortMatch = /^#?([0-9a-fA-F]{3})$/.exec(trimmed);
  if (shortMatch) {
    const expanded = shortMatch[1]
      .split("")
      .map((char) => `${char}${char}`)
      .join("")
      .toUpperCase();
    return `#${expanded}`;
  }
  const fullMatch = /^#?([0-9a-fA-F]{6})$/.exec(trimmed);
  if (fullMatch) {
    return `#${fullMatch[1].toUpperCase()}`;
  }
  return null;
}

function loadStoredUserColor() {
  const stored =
    typeof window !== "undefined" && "localStorage" in window
      ? window.localStorage.getItem(USER_COLOR_STORAGE_KEY)
      : null;
  return normalizeHexColor(stored ?? "") ?? DEFAULT_USER_COLOR;
}

const state = {
  snapshot: null as RoomSnapshot | null,
  rooms: [] as RoomSnapshot[],
  connectionState: "idle" as ConnectionState,
  baseUrl: PRODUCTION_BASE_URL,
  roomCode: "",
  sessionToken: "",
  authRequestId: "",
  authExpiresAtUtc: "",
  authViewerId: "",
  authViewerName: "",
  authPollHandle: 0 as number | 0,
  visualTimerHandle: 0 as number | 0,
  roomPollHandle: 0 as number | 0,
  socket: null as WebSocket | null,
  liveSocketConnected: false,
  syncMessage: "Start Discord sign-in to link the desktop app.",
  pendingActions: 0,
  pendingSquareIds: new Set<string>(),
  pendingChat: false,
  createFormOpen: false,
  settingsOpen: false,
  userColorHex: loadStoredUserColor(),
  userColorDraft: loadStoredUserColor(),
  teamNameDraft: "",
  chatDraft: "",
  chatInputFocused: false,
  chatSelectionStart: 0,
  chatSelectionEnd: 0,
  roomFeedScrollTop: 0,
  roomFeedStickBottom: true,
  forceRoomFeedScrollBottom: false,
  skipTransientCaptureOnce: false
};

const formatTime = (value: string | null | undefined) => {
  if (!value) {
    return "Not set";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    day: "numeric"
  }).format(date);
};

const formatPracticeModeLabel = (value: string | null | undefined) => {
  const normalized = String(value || "singles").toLowerCase();
  return normalized === "team" ? "Team" : "Singles";
};

const formatLocalDateTime = (value: string | null | undefined) => {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
};

const formatDuration = (totalSeconds: number) => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[char] as string));

const currentSnapshot = () => state.snapshot;
const currentVariant = () => currentSnapshot()?.room.variant || "classic";
const isCentralDynamo = () => currentVariant() === "central_dynamo";
const currentBoardSize = () => {
  const snapshot = currentSnapshot();
  if (!snapshot) {
    return 5;
  }
  const numeric = Number(snapshot.room.board_size || snapshot.rules.board_size || 0);
  if (Number.isFinite(numeric) && numeric > 0) {
    return numeric;
  }
  const formatMatch = /^(\d+)x\1$/i.exec(String(snapshot.room.board_format || ""));
  if (formatMatch) {
    return Number(formatMatch[1]);
  }
  return snapshot.room.variant === "central_dynamo" ? 7 : 5;
};
const currentParticipants = () => currentSnapshot()?.participants ?? [];
const currentJoinedEntrants = () => {
  const snapshot = currentSnapshot();
  if (!snapshot) {
    return [] as Entrant[];
  }
  if (snapshot.entrants?.length) {
    return snapshot.entrants.filter((entrant) => Boolean(entrant.discord_user_id));
  }
  return snapshot.participants
    .filter((participant) => participant.discord_user_id)
    .map((participant) => ({
      discord_user_id: participant.discord_user_id,
      display_name: participant.display_name,
      team_name: participant.team_name,
      slot: participant.slot,
      joined_at_utc: participant.joined_at_utc,
      ready: Boolean(participant.ready),
      result_status: participant.result_status || "",
      result_at_utc: participant.result_at_utc || null
    }));
};
const currentViewerEntrant = () => {
  const snapshot = currentSnapshot();
  if (!snapshot?.viewer_joined) {
    return null;
  }
  const entrants = currentJoinedEntrants();
  if (state.authViewerId) {
    const byId = entrants.find((entrant) => entrant.discord_user_id === state.authViewerId);
    if (byId) {
      return byId;
    }
  }
  if (state.authViewerName) {
    const byName = entrants.find((entrant) => entrant.display_name === state.authViewerName);
    if (byName) {
      return byName;
    }
  }
  if (snapshot.viewer_slot) {
    const bySlot = entrants.find((entrant) => entrant.slot === snapshot.viewer_slot);
    if (bySlot) {
      return bySlot;
    }
  }
  return null;
};
const isSignedIn = () => Boolean(state.sessionToken.trim()) || state.connectionState === "mock";
const hasLoadedRoom = () => Boolean(state.snapshot);
const isBrowserMode = () => isSignedIn() && !hasLoadedRoom();
const isMockMode = () => state.connectionState === "mock";
const currentViewerSlot = () => currentSnapshot()?.viewer_slot ?? null;
const isViewerSlot = (slot: PlayerSlot | string | null | undefined) => slot === currentViewerSlot();

function storeUserColor(colorHex: string) {
  state.userColorHex = colorHex;
  if (typeof window !== "undefined" && "localStorage" in window) {
    window.localStorage.setItem(USER_COLOR_STORAGE_KEY, colorHex);
  }
}

function viewerChatColor(item: RoomFeedEntry) {
  if (isViewerSlot(item.actor_slot)) {
    return true;
  }
  return Boolean(state.authViewerName) && item.actor_name === state.authViewerName;
}

function participantCompletionColor(participant: RoomSnapshot["participants"][number]) {
  return isViewerSlot(participant.slot) ? state.userColorHex : participant.completion_color;
}

function participantStarColor(participant: RoomSnapshot["participants"][number]) {
  return isViewerSlot(participant.slot) ? state.userColorHex : participant.star_color;
}

function feedAccentColor(item: RoomFeedEntry) {
  if (item.actor_color) {
    return item.actor_color;
  }
  return viewerChatColor(item) ? state.userColorHex : "";
}

function feedActorLabel(item: RoomFeedEntry) {
  const actorName = String(item.actor_name || "").trim();
  if (actorName) {
    return actorName;
  }
  const actorSlot = String(item.actor_slot || "").trim();
  if (actorSlot) {
    return actorSlot.toUpperCase();
  }
  return "System";
}

const connectionTone = () =>
  state.connectionState === "connected"
    ? "is-live"
    : state.connectionState === "connecting"
      ? "is-warn"
      : state.connectionState === "error"
        ? "is-error"
        : "is-idle";

function cancelAuthPolling() {
  if (state.authPollHandle) {
    window.clearTimeout(state.authPollHandle);
    state.authPollHandle = 0;
  }
}

function clearVisualTimer() {
  if (state.visualTimerHandle) {
    window.clearInterval(state.visualTimerHandle);
    state.visualTimerHandle = 0;
  }
}

function clearRoomPolling() {
  if (state.roomPollHandle) {
    window.clearInterval(state.roomPollHandle);
    state.roomPollHandle = 0;
  }
}

function startRoomPolling() {
  clearRoomPolling();
  if (!state.sessionToken.trim() || !state.roomCode.trim() || isMockMode()) {
    return;
  }
  state.roomPollHandle = window.setInterval(() => {
    const variant = currentSnapshot()?.room.variant || "classic";
    if (state.liveSocketConnected && variant !== "central_dynamo") {
      return;
    }
    if (state.pendingSquareIds.size || state.pendingChat) {
      return;
    }
    void refreshCurrentRoomSnapshot("Room state refreshed.");
  }, 2000);
}

function clearDesktopAuthState() {
  cancelAuthPolling();
  state.authRequestId = "";
  state.authExpiresAtUtc = "";
  state.authViewerId = "";
  state.authViewerName = "";
}

function closeSocket() {
  state.socket?.close();
  state.socket = null;
  state.liveSocketConnected = false;
}

async function openExternalUrl(url: string) {
  const isTauriRuntime = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

  if (!isTauriRuntime) {
    const popup = window.open(url, "_blank", "noopener");
    if (popup) {
      return;
    }
    throw new Error("Failed to open the Discord sign-in browser window.");
  }

  await invoke("open_external_url", { url });
}

function upsertRoom(snapshot: RoomSnapshot) {
  const existingIndex = state.rooms.findIndex((room) => room.room.room_code === snapshot.room.room_code);
  if (existingIndex >= 0) {
    state.rooms[existingIndex] = cloneSnapshot(snapshot);
  } else {
    state.rooms = [cloneSnapshot(snapshot), ...state.rooms];
  }
}

function sortRoomFeed(feed: RoomFeedEntry[]) {
  feed.sort((left, right) => {
    const leftKey = `${left.occurred_at_utc ?? ""}|${left.id}`;
    const rightKey = `${right.occurred_at_utc ?? ""}|${right.id}`;
    return leftKey.localeCompare(rightKey);
  });
}

function applySnapshot(snapshot: RoomSnapshot, message?: string) {
  state.snapshot = cloneSnapshot(snapshot);
  state.roomCode = snapshot.room.room_code;
  state.teamNameDraft = snapshot.viewer_team_name ?? "";
  upsertRoom(snapshot);
  if (message) {
    state.syncMessage = message;
  }
  render();
}

function appendActivity(entry: ActivityEntry) {
  const snapshot = currentSnapshot();
  if (!snapshot) {
    return;
  }
  snapshot.activity_feed = [...snapshot.activity_feed, entry].slice(-120);
}

function appendChat(message: ChatMessage) {
  const snapshot = currentSnapshot();
  if (!snapshot) {
    return;
  }
  snapshot.chat_messages = [...snapshot.chat_messages, message].slice(-150);
}

function appendRoomFeedEntry(entry: RoomFeedEntry) {
  const snapshot = currentSnapshot();
  if (!snapshot) {
    return;
  }
  snapshot.room_feed = [...snapshot.room_feed, entry];
  sortRoomFeed(snapshot.room_feed);
  snapshot.room_feed = snapshot.room_feed.slice(-240);
}

function updateSquareByEvent(event: LiveEvent) {
  const snapshot = currentSnapshot();
  if (!snapshot) {
    return;
  }
  const squareId = String(event.payload.square_id ?? "");
  const playerSlot = String(event.payload.player_slot ?? "") as PlayerSlot;
  const square = snapshot.board.find((item) => item.square_id === squareId);
  if (!square || (playerSlot !== "p1" && playerSlot !== "p2")) {
    return;
  }
  if (event.type === "square.completed") {
    square[`${playerSlot}_completed_at_utc`] = String(event.payload.completed_at_utc ?? "");
  } else if (event.type === "square.cleared") {
    square[`${playerSlot}_completed_at_utc`] = null;
  } else if (event.type === "square.starred") {
    square[`${playerSlot}_starred`] = true;
  } else if (event.type === "square.unstarred") {
    square[`${playerSlot}_starred`] = false;
  }
}

function updateScoreByEvent(event: LiveEvent) {
  const snapshot = currentSnapshot();
  if (!snapshot || (event.type !== "line.awarded" && event.type !== "line.revoked")) {
    return;
  }
  const lineType = String(event.payload.line_type ?? "row") as "row" | "column" | "diagonal";
  const lineIndex = Number(event.payload.line_index ?? 0);
  const lineKey = `${lineType}:${lineIndex}`;
  const remainingLines = snapshot.score.awarded_lines.filter(
    (line) => `${line.line_type}:${line.line_index}` !== lineKey
  );

  if (event.type === "line.awarded") {
    const slot = String(event.payload.awarded_to_slot ?? "") as PlayerSlot;
    if (slot !== "p1" && slot !== "p2") {
      return;
    }
    remainingLines.push({
      line_type: lineType,
      line_index: lineIndex,
      display_label:
        lineType === "column"
          ? `Column ${lineIndex + 1}`
          : lineType === "diagonal"
            ? lineIndex === 0
              ? "Diagonal 1"
              : "Diagonal 2"
            : `Row ${lineIndex + 1}`,
      awarded_to_slot: slot,
      awarded_at_utc: String(event.payload.awarded_at_utc ?? new Date().toISOString())
    });
  } else if (event.type !== "line.revoked") {
    return;
  }
  snapshot.score.awarded_lines = remainingLines;
  snapshot.score.p1_points = remainingLines.filter((line) => line.awarded_to_slot === "p1").length;
  snapshot.score.p2_points = remainingLines.filter((line) => line.awarded_to_slot === "p2").length;
}

function isSnapshotEvent(event: LiveEvent | SnapshotEvent): event is SnapshotEvent {
  return event.type === "room.snapshot" && typeof event.payload === "object" && event.payload !== null && "room" in event.payload;
}

function applyLiveEvent(event: LiveEvent | SnapshotEvent) {
  if (isSnapshotEvent(event)) {
    applySnapshot(event.payload, "Snapshot refreshed from live room state.");
    return;
  }
  const snapshot = currentSnapshot();
  if (!snapshot) {
    return;
  }
  snapshot.room.version = Math.max(snapshot.room.version, event.version ?? snapshot.room.version);
  if (event.type === "room.activated" && typeof event.payload.activated_at_utc === "string") {
    snapshot.room.state = "active";
    snapshot.room.activated_at_utc = event.payload.activated_at_utc;
    snapshot.board_visible = true;
  } else if (event.type === "room.finished" && typeof event.payload.finished_at_utc === "string") {
    snapshot.room.state = "finished";
    snapshot.room.finished_at_utc = event.payload.finished_at_utc;
  } else if (event.type.startsWith("square.")) {
    updateSquareByEvent(event);
  } else if (event.type === "chat.message") {
    const chat: ChatMessage = {
      message_id: event.event_id ?? crypto.randomUUID(),
      sender_display_name: String(event.payload.sender_display_name ?? event.actor_name ?? "Unknown"),
      sender_slot: (event.payload.sender_slot as string | null) ?? null,
      sender_role: "participant",
      body: String(event.payload.body ?? ""),
      sent_at_utc: String(event.occurred_at_utc ?? new Date().toISOString())
    };
    appendChat(chat);
    appendRoomFeedEntry({
      kind: "chat",
      id: chat.message_id,
      actor_slot: chat.sender_slot,
      actor_name: chat.sender_display_name,
      actor_color: typeof event.actor_color === "string" ? event.actor_color : undefined,
      body: chat.body,
      occurred_at_utc: chat.sent_at_utc
    });
  }

  if (event.type !== "chat.message") {
    appendActivity({
      id: event.event_id ?? crypto.randomUUID(),
      type: event.type,
      actor_slot: event.actor_slot ?? null,
      actor_name: event.actor_name ?? "System",
      summary: event.summary ?? event.type,
      occurred_at_utc: event.occurred_at_utc
    });
    appendRoomFeedEntry({
      kind: "activity",
      id: event.event_id ?? crypto.randomUUID(),
      actor_slot: event.actor_slot ?? null,
      actor_name: event.actor_name ?? "System",
      actor_color: typeof event.actor_color === "string" ? event.actor_color : undefined,
      summary: event.summary ?? event.type,
      occurred_at_utc: event.occurred_at_utc ?? new Date().toISOString()
    });
  }

  updateScoreByEvent(event);
  state.syncMessage = `Live update applied at version ${snapshot.room.version}.`;
  render();
}

async function refreshCurrentRoomSnapshot(message: string) {
  if (!state.sessionToken.trim() || !state.roomCode.trim() || isMockMode()) {
    return;
  }
  const snapshot = await fetchSnapshot({
    baseUrl: state.baseUrl,
    roomCode: state.roomCode,
    sessionToken: state.sessionToken
  });
  const currentVersion = state.snapshot?.room.version ?? -1;
  if (snapshot.room.version === currentVersion) {
    return;
  }
  applySnapshot(snapshot, message);
}

async function handleLiveEvent(event: LiveEvent | SnapshotEvent) {
  if (!isSnapshotEvent(event) && event.type.startsWith("square.")) {
    const squareId = String(event.payload.square_id ?? "");
    if (squareId && state.pendingSquareIds.has(squareId)) {
      return;
    }
  }
  applyLiveEvent(event);
  if (isSnapshotEvent(event) || !state.sessionToken.trim() || !state.roomCode.trim() || isMockMode()) {
    return;
  }
  if (event.type.startsWith("room.")) {
    try {
      await refreshCurrentRoomSnapshot(`Live room state synced at version ${event.version}.`);
    } catch (error) {
      state.syncMessage = error instanceof Error ? error.message : "Failed to refresh room state.";
      render();
    }
  }
}

function setMockPreview() {
  clearDesktopAuthState();
  clearRoomPolling();
  closeSocket();
  state.connectionState = "mock";
  state.rooms = mockRooms.map((room) => cloneSnapshot(room));
  state.sessionToken = "mock-session";
  state.authViewerId = "";
  state.authViewerName = "Mock Preview";
  state.createFormOpen = false;
  state.settingsOpen = false;
  state.userColorDraft = state.userColorHex;
  state.snapshot = null;
  state.roomCode = "";
  state.syncMessage = "Mock preview loaded from local data.";
  render();
}

function leaveRoomView() {
  clearRoomPolling();
  closeSocket();
  state.snapshot = null;
  state.roomCode = "";
  state.connectionState = state.sessionToken ? "connected" : "idle";
  state.syncMessage = "Room browser ready.";
  state.teamNameDraft = "";
  render();
}

function clearDesktopSession() {
  clearDesktopAuthState();
  clearVisualTimer();
  clearRoomPolling();
  closeSocket();
  state.sessionToken = "";
  state.rooms = [];
  state.snapshot = null;
  state.roomCode = "";
  state.authViewerId = "";
  state.authViewerName = "";
  state.connectionState = "idle";
  state.syncMessage = "Desktop session cleared.";
  state.createFormOpen = false;
  state.settingsOpen = false;
  state.userColorDraft = state.userColorHex;
  state.teamNameDraft = "";
  render();
}

async function connectToLiveRoom(roomCode = state.roomCode) {
  if (!state.sessionToken.trim() || !roomCode.trim()) {
    state.connectionState = "error";
    state.syncMessage = "Desktop sign-in must complete before a room can be opened.";
    render();
    return;
  }
  state.connectionState = "connecting";
  state.syncMessage = `Loading ${roomCode}...`;
  state.roomCode = roomCode;
  render();
  try {
    const snapshot = await fetchSnapshot({
      baseUrl: state.baseUrl,
      roomCode,
      sessionToken: state.sessionToken
    });
    applySnapshot(snapshot, "Room snapshot loaded from the website API.");
    state.connectionState = "connected";
    startRoomPolling();
    closeSocket();
    state.socket = connectLive(
      {
        baseUrl: state.baseUrl,
        roomCode,
        sessionToken: state.sessionToken
      },
      snapshot.room.version,
      {
        onOpen: () => {
          state.liveSocketConnected = true;
          state.connectionState = "connected";
          if ((currentSnapshot()?.room.variant || "classic") !== "central_dynamo") {
            clearRoomPolling();
          }
          state.syncMessage = `Live feed connected for ${roomCode}.`;
          render();
        },
        onEvent: (event) => {
          void handleLiveEvent(event);
        },
        onClose: () => {
          state.liveSocketConnected = false;
          startRoomPolling();
          state.connectionState = "offline";
          state.syncMessage = "Live room feed disconnected. Using snapshot refresh.";
          render();
        },
        onError: () => {
          state.liveSocketConnected = false;
          startRoomPolling();
          state.connectionState = "error";
          state.syncMessage = "Live room feed hit an error. Using snapshot refresh.";
          render();
        }
      }
    );
  } catch (error) {
    state.connectionState = "error";
    state.syncMessage = error instanceof Error ? error.message : "Failed to load the room snapshot.";
    render();
  }
}

async function loadAvailableRooms() {
  if (!state.sessionToken.trim()) {
    state.connectionState = "error";
    state.syncMessage = "Discord sign-in has not completed yet.";
    render();
    return;
  }
  state.connectionState = "connecting";
  state.syncMessage = "Loading available rooms...";
  render();
  try {
    const rooms = await fetchRooms({
      baseUrl: state.baseUrl,
      sessionToken: state.sessionToken
    });
    state.rooms = rooms.map((room) => cloneSnapshot(room));
    state.connectionState = "connected";
    state.snapshot = null;
    state.roomCode = "";
    state.syncMessage = state.rooms.length
      ? "Select a room or create a new one."
      : "No visible rooms yet. Create one to get started.";
    render();
  } catch (error) {
    state.connectionState = "error";
    state.syncMessage = error instanceof Error ? error.message : "Failed to load available rooms.";
    render();
  }
}

function scheduleAuthPoll(requestId: string, delayMs = 1200) {
  cancelAuthPolling();
  state.authPollHandle = window.setTimeout(() => {
    void pollDesktopAuthRequest(requestId);
  }, delayMs);
}

async function handleDesktopAuthStatus(status: DesktopAuthRequestStatusResponse) {
  if (status.status === "pending") {
    state.connectionState = "connecting";
    state.syncMessage = `Waiting for Discord sign-in to complete for ${status.device_name || deviceName}...`;
    render();
    scheduleAuthPoll(status.request_id);
    return;
  }

  if (status.status === "expired") {
    clearDesktopAuthState();
    state.connectionState = "error";
    state.syncMessage = "Desktop sign-in request expired. Start the sign-in flow again.";
    render();
    return;
  }

  if (status.status === "complete" && status.session_token) {
    clearDesktopAuthState();
    state.sessionToken = status.session_token;
    state.authViewerId = status.viewer?.id?.trim() || "";
    state.authViewerName = status.viewer?.username?.trim() || "Discord User";
    state.connectionState = "connected";
    state.syncMessage = `Signed in as ${state.authViewerName}. Loading available rooms...`;
    render();
    await loadAvailableRooms();
    return;
  }

  clearDesktopAuthState();
  state.connectionState = "error";
  state.syncMessage = "Desktop sign-in returned an unexpected status.";
  render();
}

async function pollDesktopAuthRequest(requestId: string) {
  try {
    const status = await fetchDesktopAuthRequest(state.baseUrl, requestId);
    await handleDesktopAuthStatus(status);
  } catch (error) {
    clearDesktopAuthState();
    state.connectionState = "error";
    state.syncMessage = error instanceof Error ? error.message : "Failed to complete desktop sign-in.";
    render();
  }
}

async function startDiscordSignIn() {
  clearDesktopAuthState();
  closeSocket();
  state.snapshot = null;
  state.rooms = [];
  state.roomCode = "";
  state.sessionToken = "";
  state.createFormOpen = false;
  state.connectionState = "connecting";
  state.syncMessage = "Creating desktop sign-in request...";
  render();
  try {
    const response = await createDesktopAuthRequest(state.baseUrl, deviceName);
    state.authRequestId = response.request_id;
    state.authExpiresAtUtc = response.expires_at_utc;
    state.syncMessage = `Desktop sign-in request created. Finish Discord login in the browser before ${formatTime(response.expires_at_utc)}.`;
    render();
    await openExternalUrl(response.verify_url);
    scheduleAuthPoll(response.request_id, 600);
  } catch (error) {
    clearDesktopAuthState();
    state.connectionState = "error";
    state.syncMessage = error instanceof Error ? error.message : "Failed to start Discord sign-in.";
    render();
  }
}

async function submitSquareAction(squareId: string, actionType: "goal.complete" | "goal.clear" | "goal.star.add" | "goal.star.remove") {
  if (!state.sessionToken.trim() || !state.roomCode.trim() || isMockMode()) {
    return;
  }
  if (state.pendingSquareIds.has(squareId)) {
    return;
  }
  state.pendingSquareIds.add(squareId);
  state.pendingActions += 1;
  try {
    const response = await sendBoardAction(
      {
        baseUrl: state.baseUrl,
        roomCode: state.roomCode,
        sessionToken: state.sessionToken
      },
      squareId,
      actionType
    );
    if (!response.accepted || !response.snapshot) {
      throw new Error(response.message || response.error_code || "Action was rejected.");
    }
    applySnapshot(response.snapshot, response.duplicate ? "Duplicate action ignored cleanly." : `${actionType} applied.`);
  } catch (error) {
    state.syncMessage = error instanceof Error ? error.message : "Action failed.";
    try {
      await refreshCurrentRoomSnapshot("Room state refreshed after action failure.");
    } catch {
      render();
    }
  } finally {
    state.pendingSquareIds.delete(squareId);
    state.pendingActions = Math.max(0, state.pendingActions - 1);
  }
}

async function submitChatMessage(form: HTMLFormElement) {
  const input = form.querySelector<HTMLInputElement>('input[name="chat_message"]');
  const message = input?.value.trim() ?? "";
  if (!message || !state.sessionToken.trim() || !state.roomCode.trim() || isMockMode() || state.pendingChat) {
    return;
  }
  state.pendingChat = true;
  try {
    const response = await sendChatMessage(
      {
        baseUrl: state.baseUrl,
        roomCode: state.roomCode,
        sessionToken: state.sessionToken
      },
      message
    );
    if (!response.accepted || !response.snapshot) {
      throw new Error(response.message || response.error_code || "Chat was rejected.");
    }
    state.chatDraft = "";
    state.chatInputFocused = true;
    state.chatSelectionStart = 0;
    state.chatSelectionEnd = 0;
    state.forceRoomFeedScrollBottom = true;
    state.skipTransientCaptureOnce = true;
    applySnapshot(response.snapshot, "Chat message sent.");
  } catch (error) {
    state.syncMessage = error instanceof Error ? error.message : "Failed to send chat.";
    render();
  } finally {
    state.pendingChat = false;
  }
}

async function submitCreateRoom(form: HTMLFormElement) {
  if (!state.sessionToken.trim()) {
    return;
  }
  const formData = new FormData(form);
  state.connectionState = "connecting";
  state.syncMessage = "Creating room...";
  render();
  try {
    const response = await createRoom(
      {
        baseUrl: state.baseUrl,
        sessionToken: state.sessionToken
      },
      {
        variant: String(formData.get("variant") || "classic"),
        board_size: Number(formData.get("board_size") || "7"),
        practice_mode: String(formData.get("practice_mode") || "singles"),
        game_type: String(formData.get("game_type") || "mpr"),
        algorithm: String(formData.get("algorithm") || "random"),
        visibility: String(formData.get("visibility") || "private")
      }
    );
    state.createFormOpen = false;
    upsertRoom(response.snapshot);
    await connectToLiveRoom(response.snapshot.room.room_code);
  } catch (error) {
    state.connectionState = "error";
    state.syncMessage = error instanceof Error ? error.message : "Failed to create room.";
    render();
  }
}

async function submitRoomMutation(
  action: () => Promise<{ accepted: boolean; snapshot?: RoomSnapshot; message?: string; error_code?: string; duplicate?: boolean }>,
  successMessage: string
) {
  if (!state.sessionToken.trim() || !state.roomCode.trim()) {
    return;
  }
  try {
    const response = await action();
    if (!response.accepted || !response.snapshot) {
      throw new Error(response.message || response.error_code || "Room action was rejected.");
    }
    applySnapshot(response.snapshot, response.duplicate ? "Duplicate action ignored cleanly." : successMessage);
  } catch (error) {
    state.syncMessage = error instanceof Error ? error.message : "Room action failed.";
    render();
  }
}

function renderSignInPanel() {
  return `
    <section class="tool-card auth-card">
      <span class="section-kicker">Discord Access</span>
      <h1>Prime Bingo</h1>
      <div class="auth-actions">
        <button type="button" class="action-button action-button-primary" id="sign-in-button">
          ${state.authRequestId ? "Restart sign-in" : "Sign in with Discord"}
        </button>
      </div>
      ${state.authRequestId ? `<p class="muted auth-meta">Request ${escapeHtml(state.authRequestId)} expires at ${escapeHtml(formatTime(state.authExpiresAtUtc))}.</p>` : `<p class="muted auth-meta">No desktop session is active.</p>`}
      <div class="connection-badge ${connectionTone()}">
        <span class="connection-dot"></span>
        <span>${escapeHtml(state.connectionState.toUpperCase())}</span>
      </div>
      <p class="sync-line">${escapeHtml(state.syncMessage)}</p>
    </section>
  `;
}

function renderCreateRoomForm() {
  return `
    <form id="create-room-form" class="create-room-form">
      <label>
        <span>Variant</span>
        <select name="variant" data-create-variant>
          ${VARIANT_OPTIONS.map((option) => `<option value="${option.value}">${escapeHtml(option.label)}</option>`).join("")}
        </select>
      </label>
      <label>
        <span>Practice mode</span>
        <select name="practice_mode" data-create-practice-mode>
          ${PRACTICE_MODE_OPTIONS.map((option) => `<option value="${option.value}">${escapeHtml(option.label)}</option>`).join("")}
        </select>
      </label>
      <label data-central-board-size hidden>
        <span>Board size</span>
        <select name="board_size">
          ${CENTRAL_DYNAMO_BOARD_SIZE_OPTIONS.map((size) => `<option value="${size}" ${size === 7 ? "selected" : ""}>${size}x${size}</option>`).join("")}
        </select>
      </label>
      <label>
        <span>Game</span>
        <select name="game_type">
          ${GAME_OPTIONS.map((option) => `<option value="${option.value}">${escapeHtml(option.label)}</option>`).join("")}
        </select>
      </label>
      <label>
        <span>Algorithm</span>
        <select name="algorithm">
          ${ALGORITHM_OPTIONS.map((option) => `<option value="${option.value}">${escapeHtml(option.label)}</option>`).join("")}
        </select>
      </label>
      <label>
        <span>Visibility</span>
        <select name="visibility">
          <option value="private" selected>Private</option>
          <option value="public">Public</option>
        </select>
      </label>
      <div class="empty-copy" data-central-helper hidden>Central Dynamo is fixed 2v2 team mode with opposite-corner starts on a shared board.</div>
      <div class="create-room-actions">
        <button type="submit" class="action-button action-button-primary">Create room</button>
        <button type="button" class="action-button action-button-ghost" id="cancel-create-room">Cancel</button>
      </div>
    </form>
  `;
}

function renderUserSettingsPanel() {
  return `
    <form id="user-settings-form" class="user-settings-form">
      <label>
        <span>User color</span>
        <div class="user-color-row">
          <input
            id="user-color-input"
            type="text"
            name="user_color_hex"
            inputmode="text"
            maxlength="7"
            value="${escapeHtml(state.userColorDraft)}"
            placeholder="#4BCEA2"
            spellcheck="false"
            autocomplete="off"
          >
          <span
            class="user-color-swatch"
            id="user-color-swatch"
            style="background:${escapeHtml(normalizeHexColor(state.userColorDraft) ?? state.userColorHex)};"
            aria-hidden="true"
          ></span>
        </div>
      </label>
      <div class="create-room-actions">
        <button type="submit" class="action-button action-button-primary">Save settings</button>
        <button type="button" class="action-button action-button-ghost" id="close-settings-button">Close</button>
        <button type="button" class="action-button action-button-secondary" id="clear-session-button">Logout</button>
      </div>
    </form>
  `;
}

function renderRoomBrowser() {
  return `
    <section class="tool-card browser-card">
      <div class="browser-header">
        <div>
          <span class="section-kicker">Available Rooms</span>
          <h1>Room Browser</h1>
          <p class="muted auth-meta">Signed in as ${escapeHtml(state.authViewerName || "Discord User")}.</p>
        </div>
        <div class="browser-actions">
          <button type="button" class="action-button action-button-primary" id="toggle-create-room">
            ${state.createFormOpen ? "Close create" : "Create room"}
          </button>
          <button type="button" class="action-button action-button-secondary" id="refresh-rooms-button">Refresh rooms</button>
          <button type="button" class="action-button action-button-ghost" id="toggle-settings-button">
            ${state.settingsOpen ? "Close settings" : "User settings"}
          </button>
        </div>
      </div>
      ${state.createFormOpen ? renderCreateRoomForm() : ""}
      ${state.settingsOpen ? renderUserSettingsPanel() : ""}
      <div class="connection-badge ${connectionTone()}">
        <span class="connection-dot"></span>
        <span>${escapeHtml(state.connectionState.toUpperCase())}</span>
      </div>
      <p class="sync-line">${escapeHtml(state.syncMessage)}</p>
      <div class="room-browser-list">
        ${state.rooms.length
          ? state.rooms
              .map((room) => {
                const joinedEntrants =
                  room.entrants?.filter((entrant) => Boolean(entrant.discord_user_id)) ??
                  room.participants
                    .filter((participant) => participant.discord_user_id)
                    .map((participant) => ({
                      display_name: participant.display_name,
                      team_name: participant.team_name
                    }));
                const participantSummary = joinedEntrants.length
                  ? joinedEntrants
                      .map((entrant) => entrant.team_name || entrant.display_name || "Joined racer")
                      .join(" · ")
                  : "No racers joined yet";
                return `
                  <button type="button" class="room-card" data-room-code="${room.room.room_code}">
                    <div class="room-card-head">
                      <strong>${escapeHtml(room.room.room_code)}</strong>
                      <span class="room-state-pill">${escapeHtml(room.room.state.toUpperCase())}</span>
                    </div>
                    <p>${escapeHtml(participantSummary)}</p>
                    <span class="room-meta">${escapeHtml(room.room.room_type)} · ${escapeHtml(formatPracticeModeLabel(room.room.practice_mode))} · ${escapeHtml(room.room.visibility)} · v${room.room.version}</span>
                  </button>
                `;
              })
              .join("")
          : `<p class="empty-copy">No visible rooms yet. Create one to get started.</p>`}
      </div>
    </section>
  `;
}

function renderMaskedBoardMatrix(boardSize: number) {
  const cells: string[] = [];
  for (let row = 0; row < boardSize; row += 1) {
    cells.push(`<span class="board-axis-label board-axis-label-y" aria-hidden="true">${row + 1}</span>`);
    for (let column = 0; column < boardSize; column += 1) {
      cells.push(`<article class="masked-cell">Hidden</article>`);
    }
  }

  return `
    <div class="board-matrix board-matrix-size-${boardSize}" style="--board-columns:${boardSize};">
      <span class="board-axis-corner" aria-hidden="true"></span>
      ${Array.from({ length: boardSize }, (_, index) => `<span class="board-axis-label board-axis-label-x" aria-hidden="true">${index + 1}</span>`).join("")}
      ${cells.join("")}
    </div>
  `;
}

function renderBoardSquare(
  snapshot: RoomSnapshot,
  square: BoardSquare,
  options: {
    central: boolean;
    fillMode: "single" | "team";
    p1Fill: string;
    p2Fill: string;
    p1Star: string;
    p2Star: string;
  }
) {
  const { central, fillMode, p1Fill, p2Fill, p1Star, p2Star } = options;
  const overlays = central
    ? `${square.claimed_by_slot === "p1" ? `<span class="square-fill square-fill-full" style="--fill:${p1Fill};"></span>` : ""}
       ${square.claimed_by_slot === "p2" ? `<span class="square-fill square-fill-full" style="--fill:${p2Fill};"></span>` : ""}
       ${square.p1_starred ? `<span class="square-star square-star-p1" style="--star:${p1Star};">&#9733;</span>` : ""}
       ${square.p2_starred ? `<span class="square-star square-star-p2" style="--star:${p2Star};">&#9733;</span>` : ""}`
    : fillMode === "single"
      ? `${square.p1_completed_at_utc ? `<span class="square-fill" style="--fill:${p1Fill};"></span>` : ""}
         ${square.p1_starred ? `<span class="square-star square-star-p1" style="--star:${p1Star};">&#9733;</span>` : ""}`
      : `${square.p1_completed_at_utc ? `<span class="square-fill square-fill-p1" style="--fill:${p1Fill};"></span>` : ""}
         ${square.p2_completed_at_utc ? `<span class="square-fill square-fill-p2" style="--fill:${p2Fill};"></span>` : ""}
         ${square.p1_starred ? `<span class="square-star square-star-p1" style="--star:${p1Star};">&#9733;</span>` : ""}
         ${square.p2_starred ? `<span class="square-star square-star-p2" style="--star:${p2Star};">&#9733;</span>` : ""}`;

  return `
    <button
      class="board-square ${square.hidden ? "board-square-hidden" : "board-square-revealed"}"
      data-square-id="${escapeHtml(square.square_id)}"
      type="button"
      ${snapshot.permissions.can_act_on_board && !isMockMode() ? "" : "disabled"}
      ${square.difficulty_color && !square.hidden ? `style="--difficulty:${square.difficulty_color};"` : ""}
    >
      ${overlays}
      <span class="square-text">${escapeHtml(square.hidden ? "Hidden" : square.goal_text)}</span>
    </button>
  `;
}

function renderActiveBoardMatrix(
  snapshot: RoomSnapshot,
  boardSize: number,
  options: {
    central: boolean;
    fillMode: "single" | "team";
    p1Fill: string;
    p2Fill: string;
    p1Star: string;
    p2Star: string;
  }
) {
  const boardByPosition = new Map(snapshot.board.map((square) => [`${square.row_index}:${square.column_index}`, square]));
  const cells: string[] = [];

  for (let row = 0; row < boardSize; row += 1) {
    cells.push(`<span class="board-axis-label board-axis-label-y" aria-hidden="true">${row + 1}</span>`);
    for (let column = 0; column < boardSize; column += 1) {
      const square = boardByPosition.get(`${row}:${column}`);
      if (square) {
        cells.push(renderBoardSquare(snapshot, square, options));
      } else {
        cells.push(`<article class="masked-cell">Hidden</article>`);
      }
    }
  }

  return `
    <div class="board-matrix board-matrix-size-${boardSize}" style="--board-columns:${boardSize};">
      <span class="board-axis-corner" aria-hidden="true"></span>
      ${Array.from({ length: boardSize }, (_, index) => `<span class="board-axis-label board-axis-label-x" aria-hidden="true">${index + 1}</span>`).join("")}
      ${cells.join("")}
    </div>
  `;
}

function renderBoardStage() {
  const snapshot = currentSnapshot();
  if (!snapshot) {
    return `
      <section class="stage-card board-stage board-stage-empty">
        <div class="lock-copy">
          <span class="section-kicker">Room Board</span>
          <h2>Select a room or create a new one</h2>
        </div>
      </section>
    `;
  }

  const boardSize = currentBoardSize();
  const central = snapshot.room.variant === "central_dynamo";
  const stageClass = central ? " board-stage-central-dynamo" : "";

  if (!snapshot.board_visible) {
    return `
      <section class="stage-card board-stage board-stage-locked${stageClass}">
        <div class="board-head board-head-browser">
          <div>
            <span class="section-kicker">Board State</span>
            <h2>${snapshot.room.state === "countdown" ? "Board locked until the countdown ends" : "Board hidden until racers are ready"}</h2>
            <p>${snapshot.room.start_at_utc ? `Reveal at ${escapeHtml(formatLocalDateTime(snapshot.room.start_at_utc))}` : "Waiting for racers to join and ready up."}</p>
          </div>
          <button type="button" class="action-button action-button-ghost board-back-button" id="back-to-browser-button">Back</button>
        </div>
        <div class="countdown-banner" ${snapshot.room.start_at_utc ? `data-bingo-start="${snapshot.room.start_at_utc}"` : ""}>
          <div class="countdown-copy">Board reveal</div>
          <div class="countdown-value" data-bingo-countdown>${snapshot.room.start_at_utc ? escapeHtml(formatLocalDateTime(snapshot.room.start_at_utc)) : "Waiting for racers"}</div>
        </div>
        ${renderMaskedBoardMatrix(boardSize)}
      </section>
    `;
  }

  const [p1, p2] = snapshot.participants;
  const fillMode = central ? "team" : snapshot.board_fill_mode || (snapshot.room.practice_mode === "team" ? "team" : "single");
  const p1Fill = p1 ? participantCompletionColor(p1) : "#f76007";
  const p2Fill = p2 ? participantCompletionColor(p2) : "#3bec94";
  const p1Star = p1 ? participantStarColor(p1) : "#ffd166";
  const p2Star = p2 ? participantStarColor(p2) : "#7fdbff";
  return `
    <section class="stage-card board-stage${stageClass}">
      <div class="board-head">
        <div>
          <span class="section-kicker">Active Room</span>
          <h2>${escapeHtml(snapshot.room.room_code)}</h2>
          <p>${escapeHtml(snapshot.room.room_type)} · ${escapeHtml(formatPracticeModeLabel(snapshot.room.practice_mode))} · ${escapeHtml(snapshot.room.game_type.toUpperCase())} · ${escapeHtml(snapshot.room.generation_algorithm.toUpperCase())}</p>
        </div>
        <div class="board-head-actions">
          <button type="button" class="action-button action-button-ghost board-back-button" id="back-to-browser-button">Back</button>
          <div class="board-score">
            <article>
              <span>${central ? "P1 Claims" : (fillMode === "team" ? "P1" : "Board")}</span>
              <strong>${central ? snapshot.connection_status?.claimed_by_slot?.p1 ?? 0 : snapshot.score.p1_points}</strong>
            </article>
            ${fillMode === "team" ? `
            <article>
              <span>${central ? "P2 Claims" : "P2"}</span>
              <strong>${central ? snapshot.connection_status?.claimed_by_slot?.p2 ?? 0 : snapshot.score.p2_points}</strong>
            </article>
            ` : ""}
          </div>
        </div>
      </div>
      ${renderActiveBoardMatrix(snapshot, boardSize, {
        central,
        fillMode,
        p1Fill,
        p2Fill,
        p1Star,
        p2Star
      })}
    </section>
  `;
}

function renderParticipants() {
  const entrants = currentJoinedEntrants();
  if (!entrants.length) {
    return "";
  }
  return `
    <section class="tool-card team-card">
      <span class="section-kicker">Participants</span>
      <div class="team-list">
        ${entrants
          .map(
            (entrant) => `
              <article class="team-panel">
                <div class="team-head">
                  ${entrant.slot ? `<span class="slot-mark">${escapeHtml(entrant.slot.toUpperCase())}</span>` : ""}
                  <div>
                    <h3>${escapeHtml(entrant.team_name || entrant.display_name || "Joined racer")}</h3>
                    ${entrant.team_name && entrant.display_name ? `<p>${escapeHtml(entrant.display_name)}</p>` : ""}
                    ${entrant.result_status === "done"
                      ? `<p class="muted small">Done${entrant.result_at_utc ? ` at ${escapeHtml(formatLocalDateTime(entrant.result_at_utc))}` : ""}</p>`
                      : entrant.result_status === "forfeit"
                        ? `<p class="muted small">Forfeit${entrant.result_at_utc ? ` at ${escapeHtml(formatLocalDateTime(entrant.result_at_utc))}` : ""}</p>`
                        : ""}
                  </div>
                </div>
                <div class="team-foot">
                  <span>${
                    entrant.result_status === "done"
                      ? "Done"
                      : entrant.result_status === "forfeit"
                        ? "Forfeit"
                        : entrant.ready
                          ? "Ready"
                          : "Joined"
                  }</span>
                </div>
              </article>
            `
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderRoomActions() {
  const snapshot = currentSnapshot();
  if (!snapshot || isMockMode()) {
    return "";
  }
  const central = snapshot.room.variant === "central_dynamo";
  const viewerEntrant = currentViewerEntrant();
  const canJoinRoom = Boolean(snapshot.permissions.can_join_room);
  const canLeaveRoom = Boolean(snapshot.permissions.can_leave_room);
  const canReadyRoom = Boolean(snapshot.permissions.can_ready_room);
  const canManageRoom = Boolean(snapshot.permissions.can_manage_room);
  const canEditTeamName = Boolean(snapshot.permissions.can_edit_team_name);
  const canReportDone = Boolean(snapshot.permissions.can_report_done);
  const canReportForfeit = Boolean(snapshot.permissions.can_report_forfeit);

  if (!canJoinRoom && !canLeaveRoom && !canReadyRoom && !canManageRoom && !canReportDone && !canReportForfeit && !canEditTeamName && !(central && snapshot.join_targets?.length)) {
    return "";
  }

  return `
    <section class="tool-card">
      <div class="panel-heading-inline">
        <span class="section-kicker">Room Actions</span>
        <span class="room-meta">${escapeHtml(snapshot.room.state.toUpperCase())}</span>
      </div>
      <div class="browser-actions room-actions-list">
        ${
          canJoinRoom && !snapshot.viewer_joined
            ? `<button type="button" class="action-button action-button-primary" data-room-action="join">Join</button>`
            : ""
        }
        ${
          central && !snapshot.viewer_joined
            ? (snapshot.join_targets || [])
                .map(
                  (target) => `
                    <button
                      type="button"
                      class="action-button ${target.occupied ? "action-button-ghost" : "action-button-primary"}"
                      data-room-action="join-target"
                      data-board-id="${escapeHtml(target.board_id)}"
                      data-slot="${escapeHtml(target.slot)}"
                      ${target.occupied ? "disabled" : ""}
                    >${escapeHtml(target.label)}${target.occupied_by ? ` - ${escapeHtml(target.occupied_by)}` : ""}</button>
                  `
                )
                .join("")
            : ""
        }
        ${
          canLeaveRoom
            ? `<button type="button" class="action-button action-button-ghost" data-room-action="leave">Leave room</button>`
            : ""
        }
        ${
          canReadyRoom
            ? `<button type="button" class="action-button action-button-primary" data-room-action="ready" data-room-ready="${viewerEntrant?.ready ? "0" : "1"}">${viewerEntrant?.ready ? "Unready" : "Ready"}</button>`
            : ""
        }
        ${
          canReportDone
            ? `
              <button type="button" class="action-button action-button-primary" data-room-action="result" data-room-result="done">Done</button>
            `
            : ""
        }
        ${
          canReportForfeit
            ? `<button type="button" class="action-button action-button-secondary" data-room-action="result" data-room-result="forfeit">Forfeit</button>`
            : ""
        }
        ${
          canManageRoom && snapshot.room.state !== "active" && snapshot.room.state !== "finished"
            ? `<button type="button" class="action-button action-button-secondary" data-room-action="start">Start room</button>`
            : ""
        }
        ${
          canManageRoom && snapshot.room.state !== "finished"
            ? `<button type="button" class="action-button action-button-secondary" data-room-action="finish">Finish room</button>`
            : ""
        }
      </div>
      ${
        canEditTeamName
          ? `
            <form id="team-name-form" class="user-settings-form room-team-form">
              <label>
                <span>Team name</span>
                <input
                  id="team-name-input"
                  type="text"
                  name="team_name"
                  maxlength="64"
                  value="${escapeHtml(state.teamNameDraft || snapshot.viewer_team_name || "")}"
                  placeholder="Team name"
                  autocomplete="off"
                >
              </label>
              <div class="create-room-actions">
                <button type="submit" class="action-button action-button-primary">Save team name</button>
                <button type="button" class="action-button action-button-secondary" data-room-action="generate-team-name">Generate</button>
              </div>
            </form>
          `
          : ""
      }
    </section>
  `;
}

function renderScoredLines() {
  const snapshot = currentSnapshot();
  if (!snapshot) {
    return "";
  }
  if (snapshot.room.variant === "central_dynamo") {
    const connection = snapshot.connection_status;
    return `
      <section class="tool-card">
        <div class="panel-heading-inline">
          <span class="section-kicker">Connection</span>
          <span class="room-meta">${connection?.connected ? "Connected" : "Searching"}</span>
        </div>
        <p class="empty-copy">Revealed: ${connection?.revealed_count ?? 0}</p>
        <p class="empty-copy">P1 claims: ${connection?.claimed_by_slot?.p1 ?? 0}</p>
        <p class="empty-copy">P2 claims: ${connection?.claimed_by_slot?.p2 ?? 0}</p>
      </section>
    `;
  }
  return `
    <section class="tool-card">
      <div class="panel-heading-inline">
        <span class="section-kicker">Scored Lines</span>
        <span class="room-meta">${snapshot.score.awarded_lines.length}</span>
      </div>
      ${snapshot.score.awarded_lines.length
        ? `
          <div class="line-list">
            ${snapshot.score.awarded_lines
              .map(
                (line) => `
                  <article class="line-card">
                    <div>
                      <strong>${escapeHtml(line.display_label)}</strong>
                      <p>${escapeHtml(line.awarded_to_slot.toUpperCase())} scored this line first.</p>
                    </div>
                    <span>${escapeHtml(formatTime(line.awarded_at_utc))}</span>
                  </article>
                `
              )
              .join("")}
          </div>
        `
        : `<p class="empty-copy">No lines scored yet.</p>`}
    </section>
  `;
}

function renderControls() {
  if (!hasLoadedRoom()) {
    return "";
  }
  if (isCentralDynamo()) {
    return `
      <section class="tool-card">
        <span class="section-kicker">Controls</span>
        <div class="control-list">
          <span><strong>Click</strong> claim</span>
          <span><strong>Shift + click</strong> star</span>
          <span><strong>Shift + right click</strong> unstar</span>
        </div>
      </section>
    `;
  }
  return `
    <section class="tool-card">
      <span class="section-kicker">Controls</span>
      <div class="control-list">
        <span><strong>Click</strong> complete</span>
        <span><strong>Right click</strong> clear</span>
        <span><strong>Shift + click</strong> star</span>
        <span><strong>Shift + right click</strong> unstar</span>
      </div>
    </section>
  `;
}

function renderTimerCard() {
  const snapshot = currentSnapshot();
  if (!snapshot) {
    return "";
  }
  const stateLabel =
    snapshot.room.state === "finished"
      ? "Finished"
      : snapshot.room.state === "active"
        ? "Race in progress"
        : snapshot.room.state === "countdown"
          ? "Countdown running"
          : "Waiting for racers";
  const display =
    snapshot.room.state === "finished"
      ? "Final"
      : snapshot.room.state === "active"
        ? "0:00:00"
        : snapshot.room.state === "countdown"
          ? "Countdown"
          : "Waiting";

  return `
    <section
      class="tool-card timer-card"
      ${snapshot.room.start_at_utc ? `data-bingo-timer-start="${snapshot.room.start_at_utc}"` : ""}
      ${snapshot.room.finished_at_utc ? `data-bingo-timer-finish="${snapshot.room.finished_at_utc}"` : ""}
    >
      <div class="timer-display" data-bingo-race-timer>${display}</div>
      <p class="timer-label">${escapeHtml(stateLabel)}</p>
    </section>
  `;
}

function renderRoomFeed() {
  const snapshot = currentSnapshot();
  if (!snapshot) {
    return "";
  }
  return `
    <section class="tool-card feed-panel">
      <div class="panel-heading-inline">
        <span class="section-kicker">Room Feed</span>
        <span class="room-meta">${escapeHtml(snapshot.room.state.toUpperCase())}</span>
      </div>
      <div class="room-feed-list">
        ${snapshot.room_feed.length
          ? snapshot.room_feed
              .map((item) => {
                const accentColor = feedAccentColor(item);
                return `
                <article
                  class="feed-entry ${item.kind === "chat" ? "feed-entry-chat" : ""} ${accentColor ? "feed-entry-user" : ""}"
                  style="${accentColor ? `--feed-accent:${accentColor};` : ""}"
                >
                  <div class="feed-entry-meta">
                    <strong>${escapeHtml(feedActorLabel(item))}</strong>
                    ${item.occurred_at_utc ? `<time class="muted" datetime="${escapeHtml(item.occurred_at_utc)}">${escapeHtml(formatLocalDateTime(item.occurred_at_utc))}</time>` : ""}
                  </div>
                  ${item.kind === "chat"
                    ? `<p>${escapeHtml(item.body ?? "")}</p>`
                    : `<span>${escapeHtml(item.summary ?? "")}</span>`}
                </article>
              `;
              })
              .join("")
          : `<p class="empty-copy">No room activity yet.</p>`}
      </div>
      ${snapshot.permissions.can_send_chat && !isMockMode()
        ? `
          <form id="chat-form" class="chat-form">
            <input name="chat_message" placeholder="Send a room message..." value="${escapeHtml(state.chatDraft)}" />
            <button type="submit" class="action-button action-button-primary" ${state.pendingChat ? "disabled" : ""}>Send</button>
          </form>
        `
        : ""}
    </section>
  `;
}

function captureTransientUiState() {
  const feedList = app.querySelector<HTMLElement>(".room-feed-list");
  if (feedList) {
    const distanceFromBottom = feedList.scrollHeight - feedList.clientHeight - feedList.scrollTop;
    state.roomFeedScrollTop = feedList.scrollTop;
    state.roomFeedStickBottom = distanceFromBottom <= 24;
  }

  const chatInput = app.querySelector<HTMLInputElement>('input[name="chat_message"]');
  if (chatInput) {
    state.chatDraft = chatInput.value;
    state.chatInputFocused = document.activeElement === chatInput;
    state.chatSelectionStart = chatInput.selectionStart ?? chatInput.value.length;
    state.chatSelectionEnd = chatInput.selectionEnd ?? chatInput.value.length;
  } else {
    state.chatInputFocused = false;
  }
}

function restoreTransientUiState() {
  const feedList = app.querySelector<HTMLElement>(".room-feed-list");
  if (feedList) {
    if (state.forceRoomFeedScrollBottom || state.roomFeedStickBottom) {
      feedList.scrollTop = feedList.scrollHeight;
    } else {
      feedList.scrollTop = state.roomFeedScrollTop;
    }
  }
  state.forceRoomFeedScrollBottom = false;

  const chatInput = app.querySelector<HTMLInputElement>('input[name="chat_message"]');
  if (chatInput) {
    chatInput.value = state.chatDraft;
    if (state.chatInputFocused) {
      chatInput.focus();
      const selectionStart = Math.min(state.chatSelectionStart, chatInput.value.length);
      const selectionEnd = Math.min(state.chatSelectionEnd, chatInput.value.length);
      chatInput.setSelectionRange(selectionStart, selectionEnd);
    }
  }
}

function renderAuthenticatedBrowserView() {
  return `
    <div class="desktop-shell">
      <main class="desktop-layout is-browser-mode">
        <aside class="layout-column browser-column">
          ${renderRoomBrowser()}
        </aside>
        <section class="layout-column stage-column">
          ${renderBoardStage()}
        </section>
      </main>
    </div>
  `;
}

function renderRoomView() {
  const centralClass = isCentralDynamo() ? " is-room-mode-central-dynamo" : "";
  return `
    <div class="desktop-shell">
      <main class="desktop-layout is-room-mode${centralClass}">
        <section class="layout-column stage-column">
          ${renderBoardStage()}
          ${renderControls()}
        </section>
        <aside class="layout-column feed-column">
          ${renderTimerCard()}
          ${renderRoomActions()}
          ${renderParticipants()}
          ${renderRoomFeed()}
          ${renderScoredLines()}
        </aside>
      </main>
    </div>
  `;
}

function renderAuthView() {
  return `
    <div class="desktop-shell">
      <main class="desktop-layout is-auth-mode">
        <aside class="layout-column auth-column">
          ${renderSignInPanel()}
        </aside>
        <section class="layout-column stage-column">
          ${renderBoardStage()}
        </section>
      </main>
    </div>
  `;
}

function bindVisualTimers() {
  clearVisualTimer();
  const countdownHost = app.querySelector<HTMLElement>("[data-bingo-start]");
  const countdownLabel = app.querySelector<HTMLElement>("[data-bingo-countdown]");
  const timerDisplay = app.querySelector<HTMLElement>("[data-bingo-race-timer]");
  const timerHost = timerDisplay?.closest<HTMLElement>("[data-bingo-timer-start]");
  const startValue = timerHost?.getAttribute("data-bingo-timer-start");
  const finishValue = timerHost?.getAttribute("data-bingo-timer-finish");

  if (!countdownHost && !timerDisplay) {
    return;
  }

  const updateVisuals = () => {
    if (countdownHost && countdownLabel) {
      const targetValue = countdownHost.getAttribute("data-bingo-start");
      if (targetValue) {
        const target = new Date(targetValue);
        const remainingMs = target.getTime() - Date.now();
        if (remainingMs <= 0) {
          countdownLabel.textContent = "0:00 until reveal";
        } else {
          const totalSeconds = Math.floor(remainingMs / 1000);
          const minutes = Math.floor(totalSeconds / 60);
          const seconds = totalSeconds % 60;
          countdownLabel.textContent = `${minutes}:${String(seconds).padStart(2, "0")} until reveal`;
        }
      }
    }

    if (timerDisplay && startValue) {
      const startAt = new Date(startValue);
      const finishAt = finishValue ? new Date(finishValue) : null;
      const endAt = finishAt || new Date();
      const elapsed = Math.max(0, Math.floor((endAt.getTime() - startAt.getTime()) / 1000));
      timerDisplay.textContent = formatDuration(elapsed);
    }
  };

  updateVisuals();
  state.visualTimerHandle = window.setInterval(updateVisuals, 1000);
}

function render() {
  clearVisualTimer();
  if (!state.skipTransientCaptureOnce) {
    captureTransientUiState();
  }
  if (hasLoadedRoom()) {
    app.innerHTML = renderRoomView();
  } else if (isBrowserMode()) {
    app.innerHTML = renderAuthenticatedBrowserView();
  } else {
    app.innerHTML = renderAuthView();
  }
  state.skipTransientCaptureOnce = false;
  restoreTransientUiState();

  app.querySelectorAll<HTMLButtonElement>(".board-square").forEach((button) => {
    button.addEventListener("click", (event) => {
      const squareId = button.dataset.squareId;
      if (!squareId || state.pendingSquareIds.has(squareId)) {
        return;
      }
      const actionType = event.shiftKey ? "goal.star.add" : "goal.complete";
      void submitSquareAction(squareId, actionType);
    });
    button.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      const squareId = button.dataset.squareId;
      if (!squareId || state.pendingSquareIds.has(squareId)) {
        return;
      }
      const actionType = event.shiftKey ? "goal.star.remove" : isCentralDynamo() ? null : "goal.clear";
      if (!actionType) {
        return;
      }
      void submitSquareAction(squareId, actionType);
    });
  });

  app.querySelector<HTMLButtonElement>("#sign-in-button")?.addEventListener("click", () => {
    state.baseUrl = PRODUCTION_BASE_URL;
    void startDiscordSignIn();
  });

  app.querySelector<HTMLButtonElement>("#toggle-create-room")?.addEventListener("click", () => {
    state.createFormOpen = !state.createFormOpen;
    if (state.createFormOpen) {
      state.settingsOpen = false;
    }
    render();
  });

  app.querySelector<HTMLButtonElement>("#cancel-create-room")?.addEventListener("click", () => {
    state.createFormOpen = false;
    render();
  });

  app.querySelector<HTMLButtonElement>("#toggle-settings-button")?.addEventListener("click", () => {
    state.settingsOpen = !state.settingsOpen;
    state.userColorDraft = state.userColorHex;
    if (state.settingsOpen) {
      state.createFormOpen = false;
    }
    render();
  });

  app.querySelector<HTMLButtonElement>("#close-settings-button")?.addEventListener("click", () => {
    state.settingsOpen = false;
    state.userColorDraft = state.userColorHex;
    render();
  });

  app.querySelector<HTMLFormElement>("#create-room-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!(form instanceof HTMLFormElement)) {
      return;
    }
    void submitCreateRoom(form);
  });

  const createVariantSelect = app.querySelector<HTMLSelectElement>("[data-create-variant]");
  const createPracticeMode = app.querySelector<HTMLSelectElement>("[data-create-practice-mode]");
  const createBoardSize = app.querySelector<HTMLElement>("[data-central-board-size]");
  const createHelper = app.querySelector<HTMLElement>("[data-central-helper]");
  const syncCreateVariantUi = () => {
    const isCentral = createVariantSelect?.value === "central_dynamo";
    if (createPracticeMode) {
      createPracticeMode.closest("label")?.toggleAttribute("hidden", Boolean(isCentral));
      if (isCentral) {
        createPracticeMode.value = "team";
      }
    }
    if (createBoardSize) {
      createBoardSize.toggleAttribute("hidden", !isCentral);
    }
    if (createHelper) {
      createHelper.toggleAttribute("hidden", !isCentral);
    }
  };
  createVariantSelect?.addEventListener("change", syncCreateVariantUi);
  syncCreateVariantUi();

  app.querySelector<HTMLInputElement>("#user-color-input")?.addEventListener("input", (event) => {
    const input = event.currentTarget;
    if (!(input instanceof HTMLInputElement)) {
      return;
    }
    state.userColorDraft = input.value;
    const swatch = app.querySelector<HTMLElement>("#user-color-swatch");
    const normalized = normalizeHexColor(input.value);
    if (swatch && normalized) {
      swatch.style.background = normalized;
    }
  });

  app.querySelector<HTMLFormElement>("#user-settings-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!(form instanceof HTMLFormElement)) {
      return;
    }
    const formData = new FormData(form);
    const normalized = normalizeHexColor(String(formData.get("user_color_hex") || ""));
    if (!normalized) {
      state.syncMessage = "User color must be a valid 3 or 6 digit hex value.";
      render();
      return;
    }
    try {
      if (state.sessionToken.trim() && !isMockMode()) {
        await saveViewerSettings(
          {
            baseUrl: state.baseUrl,
            sessionToken: state.sessionToken
          },
          { user_color_hex: normalized }
        );
      }
      storeUserColor(normalized);
      state.userColorDraft = normalized;
      state.settingsOpen = false;
      if (state.sessionToken.trim() && state.roomCode.trim() && !isMockMode()) {
        const snapshot = await fetchSnapshot({
          baseUrl: state.baseUrl,
          roomCode: state.roomCode,
          sessionToken: state.sessionToken
        });
        applySnapshot(snapshot, "User color updated.");
        return;
      }
      state.syncMessage = "User color updated.";
      render();
    } catch (error) {
      state.syncMessage = error instanceof Error ? error.message : "Failed to save user color.";
      render();
    }
  });

  app.querySelector<HTMLButtonElement>("#clear-session-button")?.addEventListener("click", () => {
    clearDesktopSession();
  });

  app.querySelectorAll<HTMLButtonElement>("[data-room-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.roomAction;
      if (!action) {
        return;
      }

      if (action === "join") {
        void submitRoomMutation(
          () =>
            joinRoomGeneric({
              baseUrl: state.baseUrl,
              roomCode: state.roomCode,
              sessionToken: state.sessionToken
            }),
          "Joined the room."
        );
        return;
      }

      if (action === "join-target") {
        const boardId = button.dataset.boardId;
        const slot = button.dataset.slot;
        if (!boardId || (slot !== "p1" && slot !== "p2")) {
          return;
        }
        void submitRoomMutation(
          () =>
            joinRoomTarget(
              {
                baseUrl: state.baseUrl,
                roomCode: state.roomCode,
                sessionToken: state.sessionToken
              },
              { board_id: boardId, slot }
            ),
          `Joined ${slot.toUpperCase()}.`
        );
        return;
      }

      if (action === "leave") {
        void submitRoomMutation(
          () =>
            leaveRoom({
              baseUrl: state.baseUrl,
              roomCode: state.roomCode,
              sessionToken: state.sessionToken
            }),
          "Left the room."
        );
        return;
      }

      if (action === "ready") {
        const desiredReady = button.dataset.roomReady === "1";
        void submitRoomMutation(
          () =>
            setReady(
              {
                baseUrl: state.baseUrl,
                roomCode: state.roomCode,
                sessionToken: state.sessionToken
              },
              desiredReady
            ),
          desiredReady ? "Marked ready." : "Marked unready."
        );
        return;
      }

      if (action === "result") {
        const result = button.dataset.roomResult;
        if (result === "done" || result === "forfeit") {
          void submitRoomMutation(
            () =>
              reportRoomResult(
                {
                  baseUrl: state.baseUrl,
                  roomCode: state.roomCode,
                  sessionToken: state.sessionToken
                },
                result
              ),
            result === "done" ? "Reported done." : "Reported forfeit."
          );
        }
        return;
      }

      if (action === "start") {
        void submitRoomMutation(
          () =>
            startRoom({
              baseUrl: state.baseUrl,
              roomCode: state.roomCode,
              sessionToken: state.sessionToken
            }),
          "Room started."
        );
        return;
      }

      if (action === "finish") {
        void submitRoomMutation(
          () =>
            finishRoom({
              baseUrl: state.baseUrl,
              roomCode: state.roomCode,
              sessionToken: state.sessionToken
            }),
          "Room finished."
        );
        return;
      }

      if (action === "generate-team-name") {
        void submitRoomMutation(
          () =>
            updateTeamName(
              {
                baseUrl: state.baseUrl,
                roomCode: state.roomCode,
                sessionToken: state.sessionToken
              },
              { action: "generate" }
            ),
          "Generated team name."
        );
      }
    });
  });

  app.querySelector<HTMLButtonElement>("#refresh-rooms-button")?.addEventListener("click", () => {
    if (state.connectionState === "mock") {
      setMockPreview();
      return;
    }
    void loadAvailableRooms();
  });

  app.querySelectorAll<HTMLButtonElement>(".room-card").forEach((button) => {
    button.addEventListener("click", () => {
      const roomCode = button.dataset.roomCode;
      if (!roomCode) {
        return;
      }
      if (state.connectionState === "mock") {
        const room = state.rooms.find((entry) => entry.room.room_code === roomCode);
        if (room) {
          applySnapshot(cloneSnapshot(room), "Mock room switched.");
        }
        return;
      }
      void connectToLiveRoom(roomCode);
    });
  });

  app.querySelector<HTMLButtonElement>("#back-to-browser-button")?.addEventListener("click", () => {
    leaveRoomView();
    void loadAvailableRooms();
  });

  app.querySelector<HTMLFormElement>("#chat-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!(form instanceof HTMLFormElement)) {
      return;
    }
    void submitChatMessage(form);
  });

  app.querySelector<HTMLInputElement>('input[name="chat_message"]')?.addEventListener("input", (event) => {
    const input = event.currentTarget;
    if (!(input instanceof HTMLInputElement)) {
      return;
    }
    state.chatDraft = input.value;
  });

  app.querySelector<HTMLInputElement>("#team-name-input")?.addEventListener("input", (event) => {
    const input = event.currentTarget;
    if (!(input instanceof HTMLInputElement)) {
      return;
    }
    state.teamNameDraft = input.value;
  });

  app.querySelector<HTMLFormElement>("#team-name-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!(form instanceof HTMLFormElement)) {
      return;
    }
    const formData = new FormData(form);
    const teamName = String(formData.get("team_name") || "").trim();
    if (!teamName) {
      state.syncMessage = "Team name is required.";
      render();
      return;
    }
    void submitRoomMutation(
      () =>
        updateTeamName(
          {
            baseUrl: state.baseUrl,
            roomCode: state.roomCode,
            sessionToken: state.sessionToken
          },
          { action: "set", team_name: teamName }
        ),
      "Team name updated."
    );
  });

  bindVisualTimers();
}

render();
