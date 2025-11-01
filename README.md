# Simple Scheduler for Node-RED Dashboard 2.0

A simple, reliable scheduler node for Node-RED Dashboard 2.0 with an easy-to-use interface.

## Features

- ✅ **Daily schedules** - Trigger at a specific time each day
- ✅ **Weekly schedules** - Trigger on selected days with start/end times
- ✅ **One-time schedules** - Trigger once at a specific date/time
- ✅ **Timespan schedules** - Activate from start time to end time
- ✅ **Duration schedules** - Run for a specified duration with manual trigger button
- ✅ **Typed payloads** - String, number, boolean, or JSON payloads
- ✅ **Persistence** - Schedules persist across Node-RED restarts (file or context store)
- ✅ **Timezone support** - DST-aware scheduling with configurable timezone

## Installation

### From GitHub

```bash
cd ~/.node-red
npm install macdudeuk2/node-red-dashboard-2-simple-scheduler
```

Then restart Node-RED.

### From Local Directory

For development or testing:

```bash
cd ~/.node-red
npm install /path/to/node-red-simple-scheduler
```

Then restart Node-RED.

## Usage

1. Drag the **scheduler** node from the palette onto your flow
2. Configure the node:
   - Select a Dashboard 2.0 group
   - Optionally set a timezone
   - Choose persistence method (context or file)
3. Deploy your flow
4. Open the Dashboard and manage schedules via the UI

## Schedule Types

### Daily
Triggers at the same time every day. Sends the configured payload at the specified time.

**Example:** Turn on lights at 7:00 AM every day.

### Weekly
Triggers on selected days of the week with optional start and end times. When start/end times are configured, it sends an "on" payload at the start time and an "off" payload at the end time on the selected days.

**Example:** Office hours - turn on Monday-Friday at 9:00 AM, turn off at 5:00 PM.

### One-time
Triggers once at a specific date and time, then automatically disables.

**Example:** Reminder for a specific appointment.

### Timespan
Sends an "on" payload at the start time and an "off" payload at the end time, every day. Useful for daily recurring periods.

**Example:** Garden lights on at sunset (6:00 PM), off at midnight.

### Duration
Manually triggered schedules that run for a specified number of minutes. These schedules display a green play button (▶️) in the UI for manual triggering. When triggered, they immediately send the "on" payload, then automatically send the "off" payload after the specified duration.

**Example:** Water plants for 30 minutes - click the trigger button to start.

## Payload Types

The scheduler supports multiple payload types for both "on" and "off" events:

- **String** - Text values (e.g., `"hello"`, `"active"`)
- **Number** - Numeric values (e.g., `100`, `3.14`)
- **Boolean** - True/false values (e.g., `true`, `false`)
- **JSON** - Complex objects or arrays (e.g., `{"temp": 22, "mode": "heat"}`)

Each schedule can have different payload types for its "on" and "off" events.

## UI Controls

Each schedule in the dashboard has the following controls:

- **▶️ Trigger** (duration schedules only) - Manually start the schedule
- **Toggle Switch** - Enable/disable the schedule
- **✏️ Edit** - Modify the schedule settings
- **📋 Copy** - Duplicate the schedule with a new name
- **🗑️ Delete** - Remove the schedule

## Disabling Active Schedules

When you disable a schedule that is currently active (e.g., a duration or timespan schedule that has sent its "on" payload but not yet sent its "off" payload):

- The "off" payload is **sent immediately**
- All pending timers are cancelled
- Future runs are prevented

This ensures that devices/systems controlled by the schedule are always returned to their "off" state when disabled, preventing anything from being left in an active state.

**Example:** If you trigger a 60-minute duration schedule and disable it after 10 minutes, the "off" payload is sent immediately (you don't have to wait the remaining 50 minutes).

## Output

The node sends messages when schedules activate:

- `msg.payload`: The configured payload (typed according to payload type)
- `msg.topic`: The schedule name
- `msg.schedule`: Schedule details object
  - `id`: Schedule ID
  - `name`: Schedule name
  - `type`: Schedule type (daily, weekly, once, timespan, duration)
  - `event`: Event type (`start` or `end`)

## Persistence

Schedules can be persisted using two methods:

1. **File System** (default) - Schedules saved to `~/.node-red/scheduler-[node-id].json`
2. **Context Store** - Schedules saved to Node-RED context (specify store name)

Schedules are automatically loaded when Node-RED starts.

## Timezone Handling

The scheduler uses timezone-aware date handling with automatic DST (Daylight Saving Time) transitions. Configure the timezone in the node settings (defaults to system timezone).

## License

MIT


