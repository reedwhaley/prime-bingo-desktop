import type { RoomSnapshot } from "./types";

const baseGoals = [
  "Kill 10 Beetles",
  "Defeat Sheegoth",
  "Collect Gravity Suit",
  "Defeat 4 Chozo Ghosts",
  "Obtain Scan Dash",
  "All 4 Ammo Stations",
  "Collect Thermal Visor",
  "Defeat Thardus",
  "Collect Power Bomb Expansion at Frigate",
  "Collect Wavebuster",
  "Clear Main Plaza Ice Temple Puzzle",
  "Collect 50% Item Percentage",
  "Defeat Meta Ridley",
  "Collect Plasma Beam",
  "Collect 170 Missiles",
  "Visit Phendrana's Edge",
  "Collect 8 Energy Tanks",
  "Defeat 2 Elite Pirates",
  "Collect Space Jump Boots",
  "Visit Hall of the Elders",
  "Defeat Flaahgra",
  "Collect Phazon Suit",
  "Defeat Omega Pirate",
  "Obtain X-Ray Visor",
  "Finish Artifact Temple Check"
];

export const mockSnapshot: RoomSnapshot = {
  room: {
    room_id: "room_local_preview",
    room_code: "MPR-BINGO-39DD4A",
    room_type: "practice",
    practice_mode: "singles",
    state: "active",
    visibility: "private",
    game_type: "mpr",
    board_format: "5x5",
    generation_algorithm: "srlv5",
    start_at_utc: "2026-05-27T19:00:00Z",
    activated_at_utc: "2026-05-27T19:00:00Z",
    finished_at_utc: null,
    version: 79
  },
  rules: {
    diagonals_count: true,
    allow_clear: true,
    allow_star: true,
    allow_chat: true,
    board_hidden_until_active: true,
    auto_countdown_after_both_ready: true,
    countdown_seconds: 15
  },
  viewer_slot: "p1",
  viewer_joined: true,
  viewer_team_name: "Alpha Route",
  board_fill_mode: "single",
  participants: [
    {
      player_id: "mpr-bingo-39dd4a-p1",
      slot: "p1",
      discord_user_id: "user-1",
      display_name: "Reed",
      team_name: "Alpha Route",
      completion_color: "#f76007",
      star_color: "#ffd166",
      joined_at_utc: "2026-05-27T18:55:00Z",
      connected: true,
      ready: true,
      result_status: "",
      result_at_utc: null
    },
    {
      player_id: "mpr-bingo-39dd4a-p2",
      slot: "p2",
      discord_user_id: "user-2",
      display_name: "Naii",
      team_name: "Beta Route",
      completion_color: "#3bec94",
      star_color: "#7fdbff",
      joined_at_utc: "2026-05-27T18:55:14Z",
      connected: true,
      ready: true,
      result_status: "",
      result_at_utc: null
    }
  ],
  entrants: [
    {
      discord_user_id: "user-1",
      display_name: "Reed",
      team_name: "Alpha Route",
      slot: "p1",
      joined_at_utc: "2026-05-27T18:55:00Z",
      ready: true,
      result_status: "",
      result_at_utc: null
    },
    {
      discord_user_id: "user-2",
      display_name: "Naii",
      team_name: "Beta Route",
      slot: "p2",
      joined_at_utc: "2026-05-27T18:55:14Z",
      ready: true,
      result_status: "",
      result_at_utc: null
    }
  ],
  board_visible: true,
  board: baseGoals.map((goal_text, index) => ({
    square_id: `sq-${Math.floor(index / 5)}-${index % 5}`,
    goal_id: `goal-${index + 1}`,
    goal_text,
    row_index: Math.floor(index / 5),
    column_index: index % 5,
    p1_completed_at_utc: index < 5 || index === 9 ? "2026-05-27T19:07:00Z" : null,
    p2_completed_at_utc: [2, 3, 4, 7, 9, 14].includes(index) ? "2026-05-27T19:09:00Z" : null,
    p1_starred: [1, 10, 18].includes(index),
    p2_starred: [3, 7, 14].includes(index),
    counter_value: null
  })),
  score: {
    p1_points: 1,
    p2_points: 0,
    awarded_lines: [
      {
        line_type: "row",
        line_index: 0,
        display_label: "Row 1",
        awarded_to_slot: "p1",
        awarded_at_utc: "2026-05-27T19:07:04Z"
      }
    ]
  },
  room_feed: [
    {
      kind: "activity",
      id: "evt-1",
      actor_slot: "p1",
      actor_name: "Reed",
      summary: "completed Row 1.",
      occurred_at_utc: "2026-05-27T19:07:04Z"
    },
    {
      kind: "activity",
      id: "evt-2",
      actor_slot: "p2",
      actor_name: "Naii",
      summary: "completed Defeat 4 Chozo Ghosts.",
      occurred_at_utc: "2026-05-27T19:06:32Z"
    },
    {
      kind: "chat",
      id: "chat-1",
      actor_slot: "p1",
      actor_name: "Reed",
      body: "Top row is mine. I am routing into Sheegoth and Gravity.",
      occurred_at_utc: "2026-05-27T19:01:12Z"
    }
  ],
  activity_feed: [
    {
      id: "evt-1",
      type: "line.awarded",
      actor_slot: "p1",
      actor_name: "Reed",
      summary: "completed Row 1.",
      occurred_at_utc: "2026-05-27T19:07:04Z"
    },
    {
      id: "evt-2",
      type: "square.completed",
      actor_slot: "p2",
      actor_name: "Naii",
      summary: "completed Defeat 4 Chozo Ghosts.",
      occurred_at_utc: "2026-05-27T19:06:32Z"
    },
    {
      id: "evt-3",
      type: "room.activated",
      actor_slot: null,
      actor_name: "System",
      summary: "The bingo board has been revealed.",
      occurred_at_utc: "2026-05-27T19:00:00Z"
    }
  ],
  chat_messages: [
    {
      message_id: "chat-1",
      sender_display_name: "Reed",
      sender_slot: "p1",
      sender_role: "participant",
      body: "Top row is mine. I am routing into Sheegoth and Gravity.",
      sent_at_utc: "2026-05-27T19:01:12Z"
    },
    {
      message_id: "chat-2",
      sender_display_name: "Naii",
      sender_slot: "p2",
      sender_role: "participant",
      body: "I am setting up the lower-right half for later columns.",
      sent_at_utc: "2026-05-27T19:02:21Z"
    }
  ],
  permissions: {
    can_manage_room: false,
    can_send_chat: true,
    can_act_on_board: true,
    can_join_room: false,
    can_leave_room: false,
    can_ready_room: false,
    can_edit_team_name: false
  }
};

export const mockRooms: RoomSnapshot[] = [
  mockSnapshot,
  {
    ...structuredClone(mockSnapshot),
    room: {
      ...structuredClone(mockSnapshot.room),
      room_id: "room_local_preview_waiting",
      room_code: "MPR-BINGO-7F2K1A",
      practice_mode: "team",
    state: "countdown",
      start_at_utc: "2026-05-27T19:15:00Z",
      activated_at_utc: null,
      version: 43
    },
    board_visible: false,
    viewer_team_name: "Alpha Route",
    board_fill_mode: "team",
    board: [],
    score: {
      p1_points: 0,
      p2_points: 0,
      awarded_lines: []
    },
    room_feed: [
      {
        kind: "activity",
        id: "evt-countdown-1",
        actor_slot: null,
        actor_name: "System",
        summary: "Countdown started. Board reveal is pending.",
        occurred_at_utc: "2026-05-27T19:14:45Z"
      }
    ],
    activity_feed: [
      {
        id: "evt-countdown-1",
        type: "room.countdown_started",
        actor_slot: null,
        actor_name: "System",
        summary: "Countdown started. Board reveal is pending.",
        occurred_at_utc: "2026-05-27T19:14:45Z"
      }
    ],
    chat_messages: [],
    permissions: {
      ...structuredClone(mockSnapshot.permissions),
      can_act_on_board: false,
      can_join_room: false,
      can_leave_room: true,
      can_ready_room: true,
      can_edit_team_name: true
    }
  }
];
