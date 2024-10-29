// config.js
export default {
    API_URL: 'https://your-server-url.com/api',
    ENDPOINTS: {
      feedback: '/feedback',
      analytics: '/analytics'
    },
    STORAGE_KEYS: {
      feedbackHistory: 'feedbackHistory'
    },
    EMOTIONS: {
      understand: {
        emoji: '😊',
        text: '이해했어요'
      },
      question: {
        emoji: '❓',
        text: '질문있어요'
      },
      confused: {
        emoji: '😐',
        text: '어려워요'
      },
      repeat: {
        emoji: '🔄',
        text: '다시 설명해주세요'
      }
    },
    MAX_HISTORY_ITEMS: 50,
    FEEDBACK_SYNC_INTERVAL: 30000
  };