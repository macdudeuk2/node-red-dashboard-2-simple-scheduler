<template>
  <div class="simple-scheduler">
    <div class="scheduler-header">
      <h3>{{ nodeName }}</h3>
      <button @click="openAddDialog" class="btn-primary">+ Add Schedule</button>
    </div>

    <div v-if="schedules.length === 0" class="empty-state">
      <p>No schedules configured yet</p>
    </div>

    <div v-else class="schedule-list">
      <div v-for="schedule in schedules" :key="schedule.id" class="schedule-item">
        <div class="schedule-info">
          <div class="schedule-name">{{ schedule.name }}</div>
          <div class="schedule-details">
            <span class="schedule-type">{{ getScheduleTypeLabel(schedule.type) }}</span>
            <span class="schedule-time">{{ getScheduleDetails(schedule) }}</span>
          </div>
        </div>
        
        <div class="schedule-actions">
          <button 
            v-if="schedule.type === 'duration'" 
            @click="triggerSchedule(schedule.id)" 
            class="btn-icon btn-trigger" 
            title="Trigger Now"
          >
            ▶️
          </button>
          
          <label class="toggle-switch">
            <input 
              type="checkbox" 
              :checked="schedule.enabled" 
              @change="toggleSchedule(schedule.id)"
            />
            <span class="slider"></span>
          </label>
          
          <button @click="editSchedule(schedule)" class="btn-icon" title="Edit">
            ✏️
          </button>
          
          <button @click="copySchedule(schedule)" class="btn-icon" title="Copy">
            📋
          </button>
          
          <button @click="deleteSchedule(schedule.id)" class="btn-icon btn-delete" title="Delete">
            🗑️
          </button>
        </div>
      </div>
    </div>

    <!-- Add/Edit Dialog - Teleported to body to escape stacking context -->
    <Teleport to="body">
      <div v-if="showAddDialog" class="dialog-overlay" @mousedown.self="closeDialog">
        <div class="dialog-content">
        <div class="dialog-header">
          <h3>{{ editingSchedule ? 'Edit Schedule' : 'Add Schedule' }}</h3>
          <button @click="closeDialog" class="btn-close">×</button>
        </div>

        <div class="dialog-body">
          <div class="form-group">
            <label>Name *</label>
            <input 
              v-model="formData.name" 
              type="text" 
              placeholder="Schedule name"
              required
            />
          </div>

          <div class="form-group">
            <label>Type *</label>
            <select v-model="formData.type" @change="onTypeChange">
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="once">One-time</option>
              <option value="timespan">Timespan</option>
              <option value="duration">Duration</option>
            </select>
          </div>

          <!-- One-time: Date picker -->
          <div v-if="formData.type === 'once'" class="form-group">
            <label>Date & Time *</label>
            <input 
              v-model="formData.date" 
              type="datetime-local"
              required
            />
          </div>

          <!-- Daily: Time picker -->
          <div v-if="formData.type === 'daily'" class="form-group">
            <label>Time *</label>
            <input 
              v-model="formData.time" 
              type="time"
              required
            />
          </div>

          <!-- Weekly: Day selector + Start/End Times -->
          <div v-if="formData.type === 'weekly'">
            <div class="form-group">
              <label>Days *</label>
              <div class="day-selector">
                <label v-for="day in daysOfWeek" :key="day.value" class="day-checkbox">
                  <input 
                    type="checkbox" 
                    :value="day.value" 
                    v-model="formData.days"
                  />
                  {{ day.label }}
                </label>
              </div>
            </div>
            <div class="form-group">
              <label>Start Time *</label>
              <input 
                v-model="formData.startTime" 
                type="time"
                required
              />
            </div>
            <div class="form-group">
              <label>End Time *</label>
              <input 
                v-model="formData.endTime" 
                type="time"
                required
              />
            </div>
          </div>

          <!-- Timespan: Start and End time -->
          <div v-if="formData.type === 'timespan'">
            <div class="form-group">
              <label>Start Time *</label>
              <input 
                v-model="formData.startTime" 
                type="time"
                required
              />
            </div>
            <div class="form-group">
              <label>End Time *</label>
              <input 
                v-model="formData.endTime" 
                type="time"
                required
              />
            </div>
          </div>

          <!-- Duration: Minutes -->
          <div v-if="formData.type === 'duration'" class="form-group">
            <label>Duration (minutes) *</label>
            <input 
              v-model.number="formData.durationMinutes" 
              type="number"
              min="1"
              required
            />
            <p class="help-text">Duration schedules are triggered manually or by other schedules.</p>
          </div>

          <!-- Payloads -->
          <div class="form-group">
            <label>{{ formData.type === 'timespan' || formData.type === 'duration' || formData.type === 'weekly' ? 'Payload On (when schedule starts) *' : 'Payload *' }}</label>
            <div class="payload-input-group">
              <select v-model="formData.payloadOnType" class="payload-type-select">
                <option v-for="type in payloadTypes" :key="type.value" :value="type.value">
                  {{ type.label }}
                </option>
              </select>
              <input 
                v-model="formData.payloadOn" 
                type="text"
                :placeholder="getPayloadPlaceholder(formData.payloadOnType)"
                class="payload-value-input"
              />
            </div>
            <p class="help-text">{{ getPayloadHelpText(formData.payloadOnType) }}</p>
          </div>

          <!-- Show Payload Off for timespan, duration, and weekly schedules -->
          <div v-if="formData.type === 'timespan' || formData.type === 'duration' || formData.type === 'weekly'" class="form-group">
            <label>Payload Off (when schedule ends)</label>
            <div class="payload-input-group">
              <select v-model="formData.payloadOffType" class="payload-type-select">
                <option v-for="type in payloadTypes" :key="type.value" :value="type.value">
                  {{ type.label }}
                </option>
              </select>
              <input 
                v-model="formData.payloadOff" 
                type="text"
                :placeholder="getPayloadPlaceholder(formData.payloadOffType)"
                class="payload-value-input"
              />
            </div>
            <p class="help-text">{{ getPayloadHelpText(formData.payloadOffType) }}</p>
          </div>

          <div class="form-group">
            <label>
              <input 
                type="checkbox" 
                v-model="formData.enabled"
              />
              Enable schedule
            </label>
          </div>
        </div>

        <div class="dialog-footer">
          <button @click="closeDialog" class="btn-secondary">Cancel</button>
          <button @click="saveSchedule" class="btn-primary">Save</button>
        </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script>
export default {
  name: 'SimpleScheduler',
  inject: {
    $socket: {
      default: null
    }
  },
  props: {
    id: {
      type: String,
      required: true
    },
    props: {
      type: Object,
      default: () => ({})
    },
    state: {
      type: Object,
      default: () => ({})
    }
  },
  computed: {
    socket() {
      // Access injected socket
      return this.$socket
    },
    nodeName() {
      // Get node name from props, fallback to "Schedules"
      return (this.props && this.props.name) || 'Schedules'
    }
  },
  data() {
    return {
      schedules: [],
      showAddDialog: false,
      editingSchedule: null,
      formData: {
        id: null,
        name: '',
        type: 'daily',
        date: null,
        time: '09:00',
        days: [],
        startTime: '09:00',
        endTime: '17:00',
        durationMinutes: 60,
        payloadOn: 'true',
        payloadOnType: 'bool',  // string, num, bool, json
        payloadOff: 'false',
        payloadOffType: 'bool',
        enabled: true
      },
      payloadTypes: [
        { value: 'str', label: 'string' },
        { value: 'num', label: 'number' },
        { value: 'bool', label: 'boolean' },
        { value: 'json', label: 'JSON' }
      ],
      daysOfWeek: [
        { value: 'sunday', label: 'Sunday' },
        { value: 'monday', label: 'Monday' },
        { value: 'tuesday', label: 'Tuesday' },
        { value: 'wednesday', label: 'Wednesday' },
        { value: 'thursday', label: 'Thursday' },
        { value: 'friday', label: 'Friday' },
        { value: 'saturday', label: 'Saturday' }
      ]
    }
  },
  mounted() {
    // Listen for schedule updates from Node-RED
    if (this.socket) {
      // Listen for messages sent to this widget
      this.socket.on('msg-input:' + this.id, (msg) => {
        if (msg.payload && msg.payload.command === 'schedules-updated') {
          this.schedules = msg.payload.schedules || []
        }
      })
      
      // Listen for widget load event
      this.socket.on('widget-load:' + this.id, (msg) => {
        if (msg && msg.payload && msg.payload.command === 'schedules-updated') {
          this.schedules = msg.payload.schedules || []
        }
      })
      
      // Listen for connection/reconnection events (e.g., after deploy)
      this.socket.on('connect', () => {
        this.requestSchedules()
      })
    }
    
    // Request initial schedules
    this.requestSchedules()
  },
  beforeUnmount() {
    // Clean up listeners
    if (this.socket) {
      this.socket.off('msg-input:' + this.id)
      this.socket.off('widget-load:' + this.id)
    }
  },
  methods: {
    requestSchedules() {
      // Send via socket to Node-RED
      if (this.socket) {
        this.socket.emit('widget-action', this.id, {
          action: 'list',
          payload: null
        })
      }
    },
    getScheduleTypeLabel(type) {
      const labels = {
        once: 'One-time',
        daily: 'Daily',
        weekly: 'Weekly',
        timespan: 'Timespan',
        duration: 'Duration'
      }
      return labels[type] || type
    },
    getScheduleDetails(schedule) {
      switch (schedule.type) {
        case 'once':
          return new Date(schedule.date).toLocaleString()
        case 'daily':
          return `Every day at ${schedule.time}`
        case 'weekly':
          const dayNames = schedule.days.map(d => 
            this.daysOfWeek.find(day => day.value === d)?.label || d
          ).join(', ')
          // Show time or timespan depending on what's configured
          if (schedule.startTime && schedule.endTime) {
            return `${dayNames}: ${schedule.startTime} - ${schedule.endTime}`
          } else {
            return `${dayNames} at ${schedule.time || schedule.startTime || '09:00'}`
          }
        
        case 'timespan':
          return `${schedule.startTime} - ${schedule.endTime}`
        case 'duration':
          return `${schedule.durationMinutes} minutes`
        default:
          return ''
      }
    },
    onTypeChange() {
      // Reset form data when type changes
      this.formData.days = []
      this.formData.time = '09:00'
      this.formData.startTime = '09:00'
      this.formData.endTime = '17:00'
      this.formData.durationMinutes = 60
    },
    toggleSchedule(scheduleId) {
      const schedule = this.schedules.find(s => s.id === scheduleId)
      if (schedule) {
        const action = schedule.enabled ? 'disable' : 'enable'
        if (this.socket) {
          this.socket.emit('widget-action', this.id, {
            action: action,
            payload: scheduleId
          })
        }
      }
    },
    editSchedule(schedule) {
      this.editingSchedule = schedule
      this.formData = { 
        ...schedule,
        // Ensure payload types exist (default to 'bool' if not present for old schedules)
        payloadOnType: schedule.payloadOnType || 'bool',
        payloadOffType: schedule.payloadOffType || 'bool'
      }
      // Convert date to datetime-local format
      if (schedule.date) {
        const date = new Date(schedule.date)
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        const hours = String(date.getHours()).padStart(2, '0')
        const minutes = String(date.getMinutes()).padStart(2, '0')
        this.formData.date = `${year}-${month}-${day}T${hours}:${minutes}`
      }
      this.showAddDialog = true
    },
    copySchedule(schedule) {
      const copy = {
        ...schedule,
        id: null,
        name: schedule.name + ' (Copy)',
        // Ensure payload types exist
        payloadOnType: schedule.payloadOnType || 'bool',
        payloadOffType: schedule.payloadOffType || 'bool'
      }
      this.formData = copy
      this.editingSchedule = null
      this.showAddDialog = true
    },
    deleteSchedule(scheduleId) {
      if (confirm('Are you sure you want to delete this schedule?')) {
        if (this.socket) {
          this.socket.emit('widget-action', this.id, {
            action: 'remove',
            payload: scheduleId
          })
        }
      }
    },
    triggerSchedule(scheduleId) {
      if (this.socket) {
        this.socket.emit('widget-action', this.id, {
          action: 'trigger',
          payload: scheduleId
        })
      }
    },
    saveSchedule() {
      // Validate form
      if (!this.formData.name) {
        alert('Please enter a schedule name')
        return
      }

      // Validate required fields based on schedule type
      if (this.formData.type === 'once' && !this.formData.date) {
        alert('Please select a date and time for the one-time schedule')
        return
      }

      if (this.formData.type === 'weekly' && this.formData.days.length === 0) {
        alert('Please select at least one day for the weekly schedule')
        return
      }
      
      // Validate payload On
      if (!this.validatePayload(this.formData.payloadOn, this.formData.payloadOnType)) {
        alert(`Invalid Payload On for type "${this.formData.payloadOnType}"`)
        return
      }
      
      // Validate payload Off (if applicable)
      if ((this.formData.type === 'timespan' || this.formData.type === 'duration' || this.formData.type === 'weekly') && 
          !this.validatePayload(this.formData.payloadOff, this.formData.payloadOffType)) {
        alert(`Invalid Payload Off for type "${this.formData.payloadOffType}"`)
        return
      }

      // Prepare schedule data
      const schedule = {
        ...this.formData
      }

      // Convert datetime-local to ISO string for one-time events
      if (schedule.type === 'once' && schedule.date) {
        schedule.date = new Date(schedule.date).toISOString()
      }

      // Generate ID if new schedule
      if (!schedule.id) {
        schedule.id = 'schedule-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9)
      }

      // Send to Node-RED via socket
      if (this.socket) {
        this.socket.emit('widget-action', this.id, {
          action: this.editingSchedule ? 'update' : 'add',
          payload: schedule
        })
      }

      this.closeDialog()
    },
    getPayloadPlaceholder(type) {
      const placeholders = {
        str: '"text"',
        num: '123',
        bool: 'true',
        json: '{"key":"value"}'
      }
      return placeholders[type] || ''
    },
    getPayloadHelpText(type) {
      const helpTexts = {
        str: 'String value (quotes optional)',
        num: 'Number value (e.g., 123, 45.67)',
        bool: 'Boolean: true or false',
        json: 'JSON object or array: {"key":"value"} or [1,2,3]'
      }
      return helpTexts[type] || ''
    },
    validatePayload(value, type) {
      if (!value && value !== 0 && value !== false) return false
      
      if (type === 'num') {
        return !isNaN(value)
      } else if (type === 'bool') {
        return value === 'true' || value === 'false' || value === true || value === false
      } else if (type === 'json') {
        try {
          JSON.parse(value)
          return true
        } catch (e) {
          return false
        }
      }
      return true // string always valid
    },
    closeDialog() {
      this.showAddDialog = false
      this.editingSchedule = null
      this.formData = {
        id: null,
        name: '',
        type: 'daily',
        date: null,
        time: '09:00',
        days: [],
        startTime: '09:00',
        endTime: '17:00',
        durationMinutes: 60,
        payloadOn: 'true',
        payloadOnType: 'bool',
        payloadOff: 'false',
        payloadOffType: 'bool',
        enabled: true
      }
    },
    openAddDialog() {
      this.editingSchedule = null
      this.showAddDialog = true
    }
  }
}
</script>

<style scoped>
.simple-scheduler {
  font-family: system-ui, -apple-system, sans-serif;
  padding: 16px;
}

.scheduler-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.scheduler-header h3 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: #666;
}

.schedule-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.schedule-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #f5f5f5;
  border-radius: 8px;
  border: 1px solid #e0e0e0;
}

.schedule-info {
  flex: 1;
}

.schedule-name {
  font-weight: 600;
  font-size: 16px;
  margin-bottom: 4px;
}

.schedule-details {
  font-size: 14px;
  color: #666;
}

.schedule-type {
  display: inline-block;
  padding: 2px 8px;
  background: #e3f2fd;
  color: #1976d2;
  border-radius: 4px;
  margin-right: 8px;
  font-size: 12px;
}

.schedule-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-primary {
  background: #1976d2;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
}

.btn-primary:hover {
  background: #1565c0;
}

.btn-secondary {
  background: #e0e0e0;
  color: #333;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
}

.btn-secondary:hover {
  background: #d0d0d0;
}

.toggle-switch {
  position: relative;
  display: inline-block;
  width: 50px;
  height: 24px;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #ccc;
  transition: 0.3s;
  border-radius: 24px;
}

.slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: 0.3s;
  border-radius: 50%;
}

input:checked + .slider {
  background-color: #4caf50;
}

input:checked + .slider:before {
  transform: translateX(26px);
}

.btn-icon {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 18px;
  padding: 4px 8px;
}

.btn-icon:hover {
  opacity: 0.7;
}

.btn-delete {
  color: #dc3545;
}

.btn-trigger {
  color: #28a745;
  font-size: 1.1em;
}

.btn-trigger:hover {
  color: #218838;
  transform: scale(1.2);
}

.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999999;
}

.dialog-content {
  background: white;
  border-radius: 8px;
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #ddd;
}

.dialog-header h3 {
  margin: 0;
  font-size: 18px;
}

.btn-close {
  background: none;
  border: none;
  font-size: 28px;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  line-height: 1;
}

.dialog-body {
  padding: 16px;
}

.dialog-footer {
  padding: 16px;
  border-top: 1px solid #ddd;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 4px;
  font-weight: 500;
  font-size: 14px;
}

.form-group input[type="text"],
.form-group input[type="time"],
.form-group input[type="number"],
.form-group input[type="datetime-local"],
.form-group select {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  box-sizing: border-box;
}

.day-selector {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.day-checkbox {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  background: #f5f5f5;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.day-checkbox input[type="checkbox"] {
  cursor: pointer;
}

.help-text {
  font-size: 12px;
  color: #666;
  margin: 4px 0 0 0;
}

.payload-input-group {
  display: flex;
  gap: 8px;
  align-items: center;
}

.payload-type-select {
  min-width: 100px;
  max-width: 100px;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  box-sizing: border-box;
  flex-shrink: 0;
}

.payload-value-input {
  flex: 1;
  min-width: 0;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  box-sizing: border-box;
}
</style>

