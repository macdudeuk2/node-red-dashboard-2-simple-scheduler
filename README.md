# Simple Scheduler for Node-RED Dashboard 2.0

A simple, reliable scheduler node for Node-RED Dashboard 2.0 with an easy-to-use interface.

## Features

- ✅ **Daily schedules** - Trigger at a specific time each day
- ✅ **Weekly schedules** - Trigger on selected days at a specific time
- ✅ **One-time schedules** - Trigger once at a specific date/time
- ✅ **Timespan schedules** - Activate from start time to end time
- ✅ **Duration schedules** - Run for a specified number of minutes
- ✅ **Custom payloads** - Set different payloads for start and end events
- ✅ **Persistence** - Schedules persist across Node-RED restarts
- ✅ **Timezone support** - Configure timezone per node

## Installation

See [INSTALL.md](INSTALL.md) for detailed installation instructions.

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
Triggers at the same time every day.

### Weekly
Triggers on selected days of the week at a specific time.

### One-time
Triggers once at a specific date and time.

### Timespan
Sends an "on" payload at the start time and an "off" payload at the end time. Useful for turning things on for a period each day.

### Duration
Runs for a specified number of minutes when manually triggered.

## Outputs

The node has two outputs:

1. **Schedule triggers** - Sends messages when schedules activate
   - `msg.payload`: The configured payload
   - `msg.topic`: The schedule name
   - `msg.schedule`: Schedule details (id, name, type, event)

2. **Status updates** - Sends the current schedule list when changed

## License

MIT


