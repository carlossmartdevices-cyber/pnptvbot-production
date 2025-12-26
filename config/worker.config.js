module.exports = {
  // Número de workers a iniciar
  workerCount: parseInt(process.env.WORKER_COUNT || '4', 10),

  // Configuración de la cola de mensajes (debe coincidir con agent.config.js)
  queue: {
    host: process.env.QUEUE_HOST || 'localhost',
    port: process.env.QUEUE_PORT || 6379,
    password: process.env.QUEUE_PASSWORD || '',
  },

  // Tareas asignadas a los workers
  tasks: {
    processPayment: true,
    sendNotification: true,
    updateSubscription: true,
  },

  // Configuración de logs para workers
  logs: {
    level: process.env.WORKER_LOG_LEVEL || 'info',
    file: process.env.WORKER_LOG_FILE || 'worker.log',
  },
};
