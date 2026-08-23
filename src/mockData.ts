import primeGoalsJson from "./data/bingo/prime-goals.json";
import echoesGoalsJson from "./data/bingo/echoes-goal-list.json";
import type { BoardSquare, RoomSnapshot } from "./types";

type GoalRecord = {
  name?: string;
  difficulty?: number | string;
  tags?: string[] | { line?: string[]; board?: string[] };
  counter?: { target?: number; step?: number };
};

type GoalFile = GoalRecord[] | { goals?: GoalRecord[] };

type MockSnapshotOverrides =
  Omit<Partial<RoomSnapshot>, "room" | "rules" | "permissions"> & {
    room?: Partial<RoomSnapshot["room"]>;
    rules?: Partial<RoomSnapshot["rules"]>;
    permissions?: Partial<RoomSnapshot["permissions"]>;
  };

const BOARD_SIZE = 5;
const BOARD_GOAL_COUNT = BOARD_SIZE * BOARD_SIZE;
type MockGoal = { text: string; counter: { target: number; step: number } | null };

function inferGoalCounter(name: string, counter?: GoalRecord["counter"]): MockGoal["counter"] {
  const explicitTarget = Number(counter?.target ?? 0);
  const explicitStep = Number(counter?.step ?? 0);
  if (explicitTarget > 0 && explicitStep > 0) {
    return { target: explicitTarget, step: Math.min(explicitTarget, explicitStep) };
  }

  const quantityMatch = /(?:^|[^A-Za-z0-9])(\d+)(?![A-Za-z])/.exec(name);
  if (!quantityMatch) return null;
  const target = Number(quantityMatch[1]);
  if (!Number.isFinite(target) || target <= 0) return null;
  const step = /\b(?:light|dark)\s+ammo\b/i.test(name)
    ? 20
    : target >= 20 && /\bmissiles?\b/i.test(name)
      ? 5
      : 1;
  return { target, step: Math.min(target, step) };
}

function extractGoalPool(goalFile: GoalFile): GoalRecord[] {
  return Array.isArray(goalFile) ? goalFile : goalFile.goals ?? [];
}

const primeGoals = extractGoalPool(primeGoalsJson as GoalFile);
const echoesGoals = extractGoalPool(echoesGoalsJson as GoalFile);

function normalizeGoalPool(goals: GoalRecord[]) {
  return goals.filter((goal): goal is Required<Pick<GoalRecord, "name">> & GoalRecord => typeof goal?.name === "string" && goal.name.trim().length > 0);
}

function mergeGoalPools(...pools: GoalRecord[][]) {
  const merged: GoalRecord[] = [];
  const seenNames = new Set<string>();
  for (const pool of pools) {
    for (const goal of normalizeGoalPool(pool)) {
      const name = goal.name.trim();
      if (seenNames.has(name)) {
        continue;
      }
      seenNames.add(name);
      merged.push(goal);
    }
  }
  return merged;
}

function sampleGoals(pool: GoalRecord[], count = BOARD_GOAL_COUNT): MockGoal[] {
  const normalized = normalizeGoalPool(pool);
  return Array.from({ length: count }, (_, index) => {
    const goal = normalized[index % normalized.length];
    const text = goal?.name.trim() || `Goal ${index + 1}`;
    return { text, counter: inferGoalCounter(text, goal?.counter) };
  });
}

function buildBoard(
  goals: MockGoal[],
  options: {
    p1Completed?: number[];
    p2Completed?: number[];
    p1Starred?: number[];
    p2Starred?: number[];
  } = {}
): BoardSquare[] {
  const p1Completed = new Set(options.p1Completed ?? []);
  const p2Completed = new Set(options.p2Completed ?? []);
  const p1Starred = new Set(options.p1Starred ?? []);
  const p2Starred = new Set(options.p2Starred ?? []);
  return goals.map((goal, index) => ({
    square_id: `sq-${Math.floor(index / BOARD_SIZE)}-${index % BOARD_SIZE}`,
    goal_id: `goal-${index + 1}`,
    goal_text: goal.text,
    row_index: Math.floor(index / BOARD_SIZE),
    column_index: index % BOARD_SIZE,
    p1_completed_at_utc: p1Completed.has(index) ? "2026-05-27T19:07:00Z" : null,
    p2_completed_at_utc: p2Completed.has(index) ? "2026-05-27T19:09:00Z" : null,
    p1_starred: p1Starred.has(index),
    p2_starred: p2Starred.has(index),
    counter_value: null,
    counter: goal.counter,
    p1_counter_value: 0,
    p2_counter_value: 0
  }));
}

const mprGoals = sampleGoals(primeGoals);
const mp2rGoals = sampleGoals(echoesGoals);
const mpcgrGoals = sampleGoals(mergeGoalPools(primeGoals, echoesGoals));

function createSnapshot(overrides: MockSnapshotOverrides): RoomSnapshot {
  const { room, rules, permissions, ...rest } = overrides;
  return {
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
      version: 79,
      ...(room ?? {})
    },
    rules: {
      diagonals_count: true,
      allow_clear: true,
      allow_star: true,
      allow_chat: true,
      board_hidden_until_active: true,
      auto_countdown_after_both_ready: true,
      countdown_seconds: 15,
      ...(rules ?? {})
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
    board: buildBoard(mprGoals, {
      p1Completed: [0, 1, 2, 3, 4, 9],
      p2Completed: [2, 3, 4, 7, 9, 14],
      p1Starred: [1, 10, 18],
      p2Starred: [3, 7, 14]
    }),
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
        summary: "completed the fourth square.",
        occurred_at_utc: "2026-05-27T19:06:32Z"
      },
      {
        kind: "chat",
        id: "chat-1",
        actor_slot: "p1",
        actor_name: "Reed",
        body: "Top row is mine. I am routing into the early goals.",
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
        summary: "completed the fourth square.",
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
        body: "Top row is mine. I am routing into the early goals.",
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
      can_edit_team_name: false,
      ...(permissions ?? {})
    },
    ...rest
  };
}

export const mockSnapshot: RoomSnapshot = createSnapshot({});

const mockMp2rSnapshot: RoomSnapshot = createSnapshot({
  room: {
    room_id: "room_local_preview_mp2r",
    room_code: "MP2R-BINGO-10B55F",
    game_type: "mp2r",
    generation_algorithm: "random",
    version: 64
  },
  board: buildBoard(mp2rGoals, {
    p1Completed: [0, 5, 10],
    p2Completed: [20, 21, 22],
    p1Starred: [6, 12],
    p2Starred: [18]
  }),
  score: {
    p1_points: 0,
    p2_points: 0,
    awarded_lines: []
  }
});

const mockMpcgrSnapshot: RoomSnapshot = createSnapshot({
  room: {
    room_id: "room_local_preview_mpcgr",
    room_code: "MPCGR-BINGO-58E770",
    game_type: "mpcgr",
    generation_algorithm: "isaac",
    version: 91
  },
  board: buildBoard(mpcgrGoals, {
    p1Completed: [0, 1, 2, 6],
    p2Completed: [12, 17, 22],
    p1Starred: [8],
    p2Starred: [14, 19]
  }),
  score: {
    p1_points: 0,
    p2_points: 0,
    awarded_lines: []
  },
  room_feed: [
    {
      kind: "activity",
      id: "evt-cross-1",
      actor_slot: null,
      actor_name: "System",
      summary: "Crossgame preview loaded from merged MPR + MP2R goal pools.",
      occurred_at_utc: "2026-05-27T19:00:00Z"
    }
  ]
});

const mockWaitingSnapshot: RoomSnapshot = createSnapshot({
  room: {
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
    can_manage_room: false,
    can_send_chat: true,
    can_act_on_board: false,
    can_join_room: false,
    can_leave_room: true,
    can_ready_room: true,
    can_edit_team_name: true
  }
});

export const mockRooms: RoomSnapshot[] = [
  mockSnapshot,
  mockMp2rSnapshot,
  mockMpcgrSnapshot,
  mockWaitingSnapshot
];
