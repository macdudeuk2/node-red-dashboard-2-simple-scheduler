const version = '1.0.0'
const packageName = 'node-red-dashboard-2-ui-scheduler'

/* eslint-disable no-unused-vars */
const fs = require('fs')
const path = require('path')
// Timezone support - using TZDate from @date-fns/tz
const { TZDate } = require('@date-fns/tz')
const { 
  addMinutes, 
  addHours, 
  addDays, 
  addWeeks, 
  addMonths,
  setHours,
  setMinutes,
  setSeconds,
  setMilliseconds,
  isBefore,
  isAfter,
  isEqual,
  parseISO,
  format,
  startOfDay,
  startOfWeek,
  startOfMonth,
  differenceInMinutes,
  differenceInMilliseconds
} = require('date-fns')

/**
 * Simple Scheduler Node for Node-RED Dashboard 2.0
 * 
 * Features:
 * - Daily, Weekly, One-time, Timespan, and Duration schedules
 * - Custom payloads for on/off events
 * - Persistence (context or file system)
 * - Timezone support
 */

/**
 * Calculate next occurrence for a schedule
 */
function calculateNextOccurrence(schedule, timezone, now) {
  const tzNow = new TZDate(now, timezone)
  const todayStart = startOfDay(tzNow)
  
  switch (schedule.type) {
    case 'once': {
      const scheduleDate = parseISO(schedule.date)
      const tzScheduleDate = new TZDate(scheduleDate, timezone)
      if (isBefore(tzScheduleDate, tzNow)) {
        return null // Already passed
      }
      return tzScheduleDate
    }
    
    case 'daily': {
      const [hours, minutes] = schedule.time.split(':').map(Number)
      let nextDate = setHours(setMinutes(todayStart, minutes), hours)
      if (isBefore(nextDate, tzNow)) {
        nextDate = addDays(nextDate, 1)
      }
      return nextDate
    }
    
    case 'weekly': {
      // Weekly schedules can have either a single time or start/end times (timespan behavior)
      const hasTimespan = schedule.startTime && schedule.endTime
      const [hours, minutes] = hasTimespan 
        ? schedule.startTime.split(':').map(Number)
        : (schedule.time || schedule.startTime || '09:00').split(':').map(Number)
        
      const dayMap = {
        sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
        thursday: 4, friday: 5, saturday: 6
      }
      
      const targetDays = schedule.days.map(d => dayMap[d]).sort((a, b) => a - b)
      const currentDay = tzNow.getDay()
      
      // Find next matching day
      let daysToAdd = null
      for (const targetDay of targetDays) {
        if (targetDay > currentDay) {
          daysToAdd = targetDay - currentDay
          break
        } else if (targetDay === currentDay) {
          // Check if time has passed today
          const todayTime = setHours(setMinutes(todayStart, minutes), hours)
          if (isAfter(todayTime, tzNow)) {
            daysToAdd = 0
            break
          }
        }
      }
      
      // If no day found this week, use first day of next week
      if (daysToAdd === null) {
        daysToAdd = 7 - currentDay + targetDays[0]
      }
      
      let nextDate = addDays(todayStart, daysToAdd)
      nextDate = setHours(setMinutes(nextDate, minutes), hours)
      return nextDate
    }
    
    case 'timespan': {
      const [startHours, startMinutes] = schedule.startTime.split(':').map(Number)
      const [endHours, endMinutes] = schedule.endTime.split(':').map(Number)
      
      let start = setHours(setMinutes(todayStart, startMinutes), startHours)
      let end = setHours(setMinutes(todayStart, endMinutes), endHours)
      
      // Handle overnight timespan
      if (isBefore(end, start)) {
        end = addDays(end, 1)
      }
      
      // If we're currently in the timespan, return now
      if (isAfter(tzNow, start) && isBefore(tzNow, end)) {
        return tzNow
      }
      
      // If start time hasn't passed today, use today
      if (isBefore(start, tzNow) || isEqual(start, tzNow)) {
        // Start time passed, check if we should use tomorrow
        start = addDays(start, 1)
      }
      
      return start
    }
    
    case 'duration':
      // Duration schedules are triggered manually
      return null
    
    default:
      return null
  }
}

/**
 * Check if current time is within a timespan
 */
function isInTimespan(schedule, timezone, now) {
  if (schedule.type !== 'timespan') return false
  
  const tzNow = new TZDate(now, timezone)
  const todayStart = startOfDay(tzNow)
  
  const [startHours, startMinutes] = schedule.startTime.split(':').map(Number)
  const [endHours, endMinutes] = schedule.endTime.split(':').map(Number)
  
  let start = setHours(setMinutes(todayStart, startMinutes), startHours)
  let end = setHours(setMinutes(todayStart, endMinutes), endHours)
  
  // Handle overnight timespan
  if (isBefore(end, start)) {
    end = addDays(end, 1)
  }
  
  return isAfter(tzNow, start) && isBefore(tzNow, end)
}

/**
 * Main Node Definition
 */
module.exports = function (RED) {
  function SimpleSchedulerNode (config) {
    RED.nodes.createNode(this, config)
    
    const node = this
    node.name = config.name || 'Simple Scheduler'
    
    // Get the Dashboard 2.0 group this widget belongs to
    const group = RED.nodes.getNode(config.group)
    
    node.timezone = config.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
    node.persistence = config.persistence || 'context' // 'context' or 'file'
    node.contextStore = config.contextStore || 'default'
    
    // Schedule storage
    node.schedules = []
    node.timers = {}
    
    // Load schedules from persistence
    node.loadSchedules = function (callback) {
      if (node.persistence === 'context') {
        node.context().get('schedules', node.contextStore, (err, schedules) => {
          if (!err && schedules && Array.isArray(schedules)) {
            node.schedules = schedules
          } else {
            node.schedules = []
          }
          if (callback) callback()
        })
      } else if (node.persistence === 'file') {
        const filePath = path.join(RED.settings.userDir, 'scheduler-' + node.id + '.json')
        if (fs.existsSync(filePath)) {
          try {
            const data = fs.readFileSync(filePath, 'utf8')
            node.schedules = JSON.parse(data)
          } catch (err) {
            node.error('Error loading schedules from file: ' + err.message)
            node.schedules = []
          }
        } else {
          node.schedules = []
        }
        if (callback) callback()
      }
    }
    
    // Save schedules to persistence
    node.saveSchedules = function () {
      try {
        if (node.persistence === 'context') {
          node.context().set('schedules', node.schedules, node.contextStore)
        } else if (node.persistence === 'file') {
          const filePath = path.join(RED.settings.userDir, 'scheduler-' + node.id + '.json')
          fs.writeFileSync(filePath, JSON.stringify(node.schedules, null, 2), 'utf8')
        }
      } catch (err) {
        node.error('Error saving schedules: ' + err.message)
      }
    }
    
    // Schedule an event
    node.scheduleEvent = function (schedule) {
      if (!schedule.enabled) return
      
      const nextTime = calculateNextOccurrence(schedule, node.timezone, new Date())
      
      if (!nextTime) return
      
      const delay = differenceInMilliseconds(nextTime, new Date())
      
      if (delay > 0) {
        const timerId = setTimeout(() => {
          node.triggerSchedule(schedule, 'start')
          
          // Reschedule for next occurrence (except one-time)
          if (schedule.type !== 'once') {
            node.scheduleEvent(schedule)
          }
        }, delay)
        
        node.timers[schedule.id] = timerId
        
        // For timespan schedules, also schedule the end event
        if (schedule.type === 'timespan') {
          const tzNow = new TZDate(new Date(), node.timezone)
          const todayStart = startOfDay(tzNow)
          
          const [endHours, endMinutes] = schedule.endTime.split(':').map(Number)
          let end = setHours(setMinutes(todayStart, endMinutes), endHours)
          
          const [startHours, startMinutes] = schedule.startTime.split(':').map(Number)
          let start = setHours(setMinutes(todayStart, startMinutes), startHours)
          
          if (isBefore(end, start)) {
            end = addDays(end, 1)
          }
          
          const endDelay = differenceInMilliseconds(end, new Date())
          
          if (endDelay > 0) {
            setTimeout(() => {
              node.triggerSchedule(schedule, 'end')
            }, endDelay)
          }
        }
      }
    }
    
    // Trigger a schedule
    node.triggerSchedule = function (schedule, event) {
      let rawPayload = event === 'start' ? schedule.payloadOn : schedule.payloadOff
      let payloadType = event === 'start' ? schedule.payloadOnType : schedule.payloadOffType
      
      // Convert payload based on type
      let payload = rawPayload
      if (payloadType === 'num') {
        payload = Number(rawPayload)
      } else if (payloadType === 'bool') {
        if (rawPayload === 'true' || rawPayload === true) {
          payload = true
        } else if (rawPayload === 'false' || rawPayload === false) {
          payload = false
        }
      } else if (payloadType === 'json') {
        try {
          payload = JSON.parse(rawPayload)
        } catch (e) {
          node.error('Invalid JSON payload: ' + rawPayload)
          payload = rawPayload
        }
      } else {
        // String type - remove quotes if present
        payload = String(rawPayload)
        if (payload.startsWith('"') && payload.endsWith('"')) {
          payload = payload.slice(1, -1)
        }
      }
      
      const msg = {
        payload: payload,
        topic: schedule.name,
        schedule: {
          id: schedule.id,
          name: schedule.name,
          type: schedule.type,
          event: event
        }
      }
      
      node.send(msg)
      
      // For duration schedules, schedule the end event
      if (schedule.type === 'duration' && event === 'start') {
        setTimeout(() => {
          node.triggerSchedule(schedule, 'end')
        }, schedule.durationMinutes * 60 * 1000)
      }
      
      // For weekly schedules with timespan, schedule the end event
      if (schedule.type === 'weekly' && schedule.startTime && schedule.endTime && event === 'start') {
        const tzNow = new TZDate(new Date(), node.timezone)
        const todayStart = startOfDay(tzNow)
        
        const [endHours, endMinutes] = schedule.endTime.split(':').map(Number)
        let end = setHours(setMinutes(todayStart, endMinutes), endHours)
        
        const [startHours, startMinutes] = schedule.startTime.split(':').map(Number)
        let start = setHours(setMinutes(todayStart, startMinutes), startHours)
        
        if (isBefore(end, start)) {
          end = addDays(end, 1)
        }
        
        const endDelay = differenceInMilliseconds(end, new Date())
        
        if (endDelay > 0) {
          setTimeout(() => {
            node.triggerSchedule(schedule, 'end')
          }, endDelay)
        }
      }
    }
    
    // Start all schedules
    node.startAllSchedules = function () {
      node.schedules.forEach(schedule => {
        if (schedule.enabled) {
          node.scheduleEvent(schedule)
        }
      })
    }
    
    // Stop all schedules
    node.stopAllSchedules = function () {
      Object.values(node.timers).forEach(timer => clearTimeout(timer))
      node.timers = {}
    }
    
    // Initialize - load schedules then start them
    node.loadSchedules(() => {
      node.startAllSchedules()
    })
    
    // Handle input messages (from UI or programmatic control)
    node.on('input', function (msg) {
      // Dashboard 2.0 widgets send messages via input
      // Check if this is a widget action message
      if (msg.ui_update || msg.action) {
        const action = msg.action || msg.ui_update?.action
        const payload = msg.payload || msg.ui_update?.payload
        
        if (action === 'add' || action === 'update') {
          try {
            const schedule = payload
            if (!schedule.id) {
              schedule.id = 'schedule-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9)
            }
            
            if (!schedule.name) {
              node.error('Schedule name is required')
              return
            }
            
            const index = node.schedules.findIndex(s => s.id === schedule.id)
            if (index >= 0) {
              node.stopAllSchedules()
              node.schedules[index] = schedule
            } else {
              node.schedules.push(schedule)
            }
            
            node.saveSchedules()
            node.startAllSchedules()
            
            // Send status update to UI
            node.send([null, {
              payload: {
                command: 'schedules-updated',
                schedules: node.schedules
              }
            }])
          } catch (err) {
            node.error('Error adding/updating schedule: ' + err.message)
          }
        } else if (action === 'remove' || action === 'delete') {
          try {
            const scheduleId = payload
            node.stopAllSchedules()
            node.schedules = node.schedules.filter(s => s.id !== scheduleId)
            node.saveSchedules()
            node.startAllSchedules()
            
            node.send([null, {
              payload: {
                command: 'schedules-updated',
                schedules: node.schedules
              }
            }])
          } catch (err) {
            node.error('Error removing schedule: ' + err.message)
          }
        } else if (action === 'list') {
          node.send([null, {
            payload: {
              command: 'schedules-updated',
              schedules: node.schedules
            }
          }])
        } else if (action === 'enable' || action === 'disable') {
          try {
            const scheduleId = payload
            const schedule = node.schedules.find(s => s.id === scheduleId)
            if (schedule) {
              schedule.enabled = (action === 'enable')
              node.saveSchedules()
              node.stopAllSchedules()
              node.startAllSchedules()
              
              node.send([null, {
                payload: {
                  command: 'schedules-updated',
                  schedules: node.schedules
                }
              }])
            }
          } catch (err) {
            node.error('Error toggling schedule: ' + err.message)
          }
        } else if (action === 'trigger') {
          const scheduleId = payload
          const schedule = node.schedules.find(s => s.id === scheduleId)
          if (schedule) {
            node.triggerSchedule(schedule, 'start')
          }
        }
        return
      }
      
      // Handle regular input messages (programmatic control)
      const command = msg.topic || msg.command
      
      if (command === 'add' || command === 'update') {
        try {
          const schedule = msg.payload
          if (!schedule.id) {
            schedule.id = 'schedule-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9)
          }
          
          // Validate schedule
          if (!schedule.name) {
            node.error('Schedule name is required')
            return
          }
          
          const index = node.schedules.findIndex(s => s.id === schedule.id)
          if (index >= 0) {
            node.stopAllSchedules()
            node.schedules[index] = schedule
          } else {
            node.schedules.push(schedule)
          }
          
          node.saveSchedules()
          node.startAllSchedules()
          
          // Send status update to UI
          node.send([null, {
            payload: {
              command: 'schedules-updated',
              schedules: node.schedules
            }
          }])
        } catch (err) {
          node.error('Error adding/updating schedule: ' + err.message)
        }
      } else if (command === 'remove' || command === 'delete') {
        try {
          const scheduleId = msg.payload
          node.stopAllSchedules()
          node.schedules = node.schedules.filter(s => s.id !== scheduleId)
          node.saveSchedules()
          node.startAllSchedules()
          
          node.send([null, {
            payload: {
              command: 'schedules-updated',
              schedules: node.schedules
            }
          }])
        } catch (err) {
          node.error('Error removing schedule: ' + err.message)
        }
      } else if (command === 'list') {
        node.send([null, {
          payload: {
            command: 'schedules-updated',
            schedules: node.schedules
          }
        }])
      } else if (command === 'enable' || command === 'disable') {
        try {
          const scheduleId = msg.payload
          const schedule = node.schedules.find(s => s.id === scheduleId)
          if (schedule) {
            schedule.enabled = (command === 'enable')
            node.saveSchedules()
            node.stopAllSchedules()
            node.startAllSchedules()
            
            node.send([null, {
              payload: {
                command: 'schedules-updated',
                schedules: node.schedules
              }
            }])
          }
        } catch (err) {
          node.error('Error toggling schedule: ' + err.message)
        }
      } else if (command === 'trigger') {
        const scheduleId = msg.payload
        const schedule = node.schedules.find(s => s.id === scheduleId)
        if (schedule) {
          node.triggerSchedule(schedule, 'start')
        }
      }
    })
    
    // Register widget with Dashboard 2.0
    if (group) {
      const evts = {
        onSocket: {
          'widget-action': function (conn, id, msg) {
            // Handle socket events from the UI
            if (id === node.id && msg && msg.action) {
              const inputMsg = {
                action: msg.action,
                payload: msg.payload
              }
              
              // Process the action directly here, passing the connection for response
              handleWidgetAction(inputMsg, conn, id)
            }
          }
        }
      }
      // Pass node name to widget
      const widgetConfig = {
        ...config,
        name: node.name
      }
      group.register(node, widgetConfig, evts)
    } else {
      node.error('No group configured')
    }
    
    // Function to handle widget actions
    function handleWidgetAction(msg, conn, widgetId) {
      const action = msg.action
      const payload = msg.payload
      
      if (action === 'list') {
        // Send current schedules to UI via socket
        const response = {
          payload: {
            command: 'schedules-updated',
            schedules: node.schedules
          }
        }
        if (conn && widgetId) {
          conn.emit('msg-input:' + widgetId, response)
        }
      } else if (action === 'add' || action === 'update') {
        try {
          const schedule = payload
          if (!schedule.id) {
            schedule.id = 'schedule-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9)
          }
          
          if (!schedule.name) {
            node.error('Schedule name is required')
            return
          }
          
          const index = node.schedules.findIndex(s => s.id === schedule.id)
          if (index >= 0) {
            node.stopAllSchedules()
            node.schedules[index] = schedule
          } else {
            node.schedules.push(schedule)
          }
          
          node.saveSchedules()
          node.startAllSchedules()
          
          // Send updated schedules to UI via socket
          const response = {
            payload: {
              command: 'schedules-updated',
              schedules: node.schedules
            }
          }
          if (conn && widgetId) {
            conn.emit('msg-input:' + widgetId, response)
          }
        } catch (err) {
          node.error('Error adding/updating schedule: ' + err.message)
        }
      } else if (action === 'remove') {
        try {
          const scheduleId = payload
          node.stopAllSchedules()
          node.schedules = node.schedules.filter(s => s.id !== scheduleId)
          node.saveSchedules()
          node.startAllSchedules()
          
          const response = {
            payload: {
              command: 'schedules-updated',
              schedules: node.schedules
            }
          }
          if (conn && widgetId) {
            conn.emit('msg-input:' + widgetId, response)
          }
          node.send([null, response])
        } catch (err) {
          node.error('Error removing schedule: ' + err.message)
        }
      } else if (action === 'enable' || action === 'disable') {
        try {
          const scheduleId = payload
          const schedule = node.schedules.find(s => s.id === scheduleId)
          if (schedule) {
            schedule.enabled = (action === 'enable')
            node.saveSchedules()
            node.stopAllSchedules()
            node.startAllSchedules()
            
            const response = {
              payload: {
                command: 'schedules-updated',
                schedules: node.schedules
              }
            }
            if (conn && widgetId) {
              conn.emit('msg-input:' + widgetId, response)
            }
            node.send([null, response])
          }
        } catch (err) {
          node.error('Error toggling schedule: ' + err.message)
        }
      } else if (action === 'trigger') {
        const scheduleId = payload
        const schedule = node.schedules.find(s => s.id === scheduleId)
        if (schedule) {
          node.triggerSchedule(schedule, 'start')
        }
      }
    }
    
    // Handle close
    node.on('close', function () {
      node.stopAllSchedules()
    })
  }
  
  RED.nodes.registerType('ui-scheduler', SimpleSchedulerNode)
}

