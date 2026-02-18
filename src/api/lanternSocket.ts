import { Channel, Socket } from 'phoenix'

type ProjectsChangedListener = () => void

const TOPIC = 'project:lobby'

let socket: Socket | null = null
let channel: Channel | null = null
const listeners = new Set<ProjectsChangedListener>()

function socketUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return `${protocol}://${window.location.host}/lantern-ws/socket`
}

function notifyListeners() {
  for (const listener of listeners) {
    try {
      listener()
    } catch {
      // Listener failures should not tear down socket fanout.
    }
  }
}

function wireChannelEvents(c: Channel) {
  c.on('projects_changed', () => notifyListeners())
  c.on('project_updated', () => notifyListeners())
  c.on('status_change', () => notifyListeners())
}

export function connectLantern(): void {
  if (channel) return

  if (!socket) {
    socket = new Socket(socketUrl(), {
      reconnectAfterMs: (tries: number) => [1000, 2000, 5000, 10000][Math.min(Math.max(tries - 1, 0), 3)],
    })
    socket.connect()
  }

  channel = socket.channel(TOPIC, {})
  wireChannelEvents(channel)

  channel
    .join()
    .receive('ok', () => {
      notifyListeners()
    })
    .receive('error', () => {
      // Fallback polling remains active in ToolList.
    })
}

export function onProjectsChanged(listener: ProjectsChangedListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function disconnectLantern(): void {
  if (channel) {
    channel.leave()
    channel = null
  }
  if (socket) {
    socket.disconnect()
    socket = null
  }
}
