export type PlayerSlot = "p1" | "p2";
export type BingoVariant = "classic" | "central_dynamo";

export type RoomState = "draft" | "waiting" | "countdown" | "active" | "paused" | "finished" | "archived";

export type Participant = {
  player_id: string;
  slot: PlayerSlot;
  discord_user_id: string;
  display_name: string;
  team_name: string;
  completion_color: string;
  star_color: string;
  joined_at_utc: string | null;
  connected: boolean;
  ready?: boolean;
  result_status?: string;
  result_at_utc?: string | null;
};

export type Entrant = {
  discord_user_id: string;
  display_name: string;
  team_name: string;
  slot: string;
  board_id?: string;
  joined_at_utc: string | null;
  ready: boolean;
  result_status: string;
  result_at_utc: string | null;
};

export type BoardSquare = {
  square_id: string;
  goal_id: string;
  goal_text: string;
  row_index: number;
  column_index: number;
  difficulty?: string | null;
  difficulty_tier?: string | null;
  difficulty_color?: string | null;
  revealed?: boolean;
  hidden?: boolean;
  is_start?: boolean;
  claimed_by_slot?: PlayerSlot | null;
  claimed_at_utc?: string | null;
  completed_by_slot?: PlayerSlot | null;
  completed_at_utc?: string | null;
  p1_completed_at_utc: string | null;
  p2_completed_at_utc: string | null;
  p1_starred: boolean;
  p2_starred: boolean;
  counter_value: number | null;
  counter?: { target: number; step: number } | null;
  p1_counter_value?: number;
  p2_counter_value?: number;
};

export type AwardedLine = {
  line_type: "row" | "column" | "diagonal";
  line_index: number;
  display_label: string;
  awarded_to_slot: PlayerSlot;
  awarded_at_utc: string;
};

export type ActivityEntry = {
  id: string;
  type: string;
  actor_slot: string | null;
  actor_name: string;
  summary: string;
  occurred_at_utc?: string;
};

export type ChatMessage = {
  message_id: string;
  sender_display_name: string;
  sender_slot: string | null;
  sender_role: string;
  body: string;
  sent_at_utc: string;
};

export type RoomFeedEntry = {
  kind: "activity" | "chat";
  id: string;
  actor_slot: string | null;
  actor_name: string;
  actor_color?: string;
  occurred_at_utc: string | null;
  summary?: string;
  body?: string;
};

export type RoomSnapshot = {
  room: {
    room_id: string;
    room_code: string;
    room_type: string;
    variant?: BingoVariant;
    board_size?: number;
    practice_mode?: string;
    state: RoomState;
    visibility: string;
    game_type: string;
    board_format: string;
    generation_algorithm: string;
    fog_of_war?: boolean;
    show_actual_goal_to_opponents?: boolean;
    start_at_utc: string | null;
    activated_at_utc: string | null;
    finished_at_utc: string | null;
    version: number;
  };
  rules: {
    diagonals_count: boolean;
    allow_clear: boolean;
    allow_star: boolean;
    allow_chat: boolean;
    board_hidden_until_active: boolean;
    auto_countdown_after_both_ready?: boolean;
    countdown_seconds?: number;
    board_size?: number;
    win_condition?: string;
    fog_of_war?: boolean;
    show_actual_goal_to_opponents?: boolean;
    allow_player_unclaim?: boolean;
    allow_staff_unclaim?: boolean;
  };
  viewer_slot: PlayerSlot | null;
  viewer_joined?: boolean;
  viewer_team_name?: string;
  viewer_board_id?: string;
  board_fill_mode?: "single" | "team";
  participants: Participant[];
  entrants?: Entrant[];
  board_visible: boolean;
  board: BoardSquare[];
  base_board?: BoardSquare[];
  join_targets?: {
    board_id: string;
    slot: PlayerSlot;
    team_name: string;
    label: string;
    occupied: boolean;
    occupied_by?: string;
  }[];
  connection_status?: {
    connected: boolean;
    revealed_count: number;
    claimed_total: number;
    claimed_by_slot: Record<PlayerSlot, number>;
    completed_total?: number;
    completed_by_slot?: Record<PlayerSlot, number>;
  } | null;
  winner?: {
    board_id: string;
    team_name: string;
    reason: string;
    occurred_at_utc: string;
  } | null;
  score: {
    p1_points: number;
    p2_points: number;
    awarded_lines: AwardedLine[];
  };
  room_feed: RoomFeedEntry[];
  activity_feed: ActivityEntry[];
  chat_messages: ChatMessage[];
  permissions: {
    can_manage_room: boolean;
    can_view_board_dvr?: boolean;
    can_send_chat: boolean;
    can_act_on_board: boolean;
    can_join_room?: boolean;
    can_leave_room?: boolean;
    can_ready_room?: boolean;
    can_edit_team_name?: boolean;
    can_report_done?: boolean;
    can_report_forfeit?: boolean;
    can_reroll_room?: boolean;
  };
};

export type LiveEvent = {
  type: string;
  version: number;
  payload: Record<string, unknown>;
  event_id?: string;
  actor_slot?: string;
  actor_color?: string;
  actor_name?: string;
  summary?: string;
  occurred_at_utc?: string;
};

export type EventResponse = {
  accepted: boolean;
  duplicate?: boolean;
  event_id?: string;
  room_code?: string;
  version?: number;
  events?: LiveEvent[];
  snapshot?: RoomSnapshot;
  error_code?: string;
  message?: string;
};

export type RoomListResponse = {
  rooms: RoomSnapshot[];
};

export type CreateRoomResponse = {
  accepted: boolean;
  room_code: string;
  version: number;
  snapshot: RoomSnapshot;
};

export type DesktopAuthRequestCreateResponse = {
  accepted: boolean;
  request_id: string;
  device_name: string;
  expires_at_utc: string;
  verify_url: string;
};

export type DesktopAuthRequestStatusResponse = {
  accepted: boolean;
  request_id: string;
  status: "pending" | "complete" | "expired";
  device_name: string;
  expires_at_utc: string;
  approved_at_utc: string | null;
  viewer: {
    id?: string;
    username?: string;
    role_labels?: string[];
  } | null;
  session_expires_at_utc: string | null;
  session_token?: string;
};

export type ViewerSettingsResponse = {
  accepted: boolean;
  settings: {
    discord_user_id: string;
    user_color_hex: string;
    updated_at_utc?: string;
  };
};
