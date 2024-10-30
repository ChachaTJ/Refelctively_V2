// sidepanel.js
import CONFIG from './config.js';

class FeedbackPanel {
  constructor() {
    this.selectedEmoji = null;
    this.isOnline = false;  // 온라인 상태 추적
    this.initializeElements();
    this.attachEventListeners();
    this.loadFeedbackHistory();
    this.setupOnlineStatus();
    this.setupMessageListener();
  }

  initializeElements() {
    this.emojiButtons = document.querySelectorAll('.emoji-button');
    this.feedbackInput = document.querySelector('.feedback-input');
    this.sendButton = document.querySelector('#send-feedback');
    this.feedbackList = document.querySelector('#feedback-list');
    this.statusIndicator = document.querySelector('.status-indicator');
    this.offlineBanner = document.querySelector('.offline-banner');
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'updateHistory') {
        this.loadFeedbackHistory();
      }
    });
  }

  attachEventListeners() {
    // 이모지 버튼 이벤트
    this.emojiButtons.forEach(button => {
      button.addEventListener('click', () => {
        this.emojiButtons.forEach(b => b.classList.remove('active'));
        button.classList.add('active');
        this.selectedEmoji = button.dataset.mood;
      });
    });

    // 피드백 전송 이벤트
    this.sendButton.addEventListener('click', () => {
      this.sendFeedback();
    });

    // 엔터 키로 전송
    this.feedbackInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendFeedback();
      }
    });
  }

  setupOnlineStatus() {
    const updateOnlineStatus = () => {
      this.isOnline = navigator.onLine;
      if (this.isOnline) {
        this.offlineBanner.style.display = 'none';
        this.statusIndicator.classList.remove('offline');
        this.statusIndicator.textContent = '수업 중';
        this.sendButton.textContent = '피드백 보내기';
      } else {
        this.offlineBanner.style.display = 'flex';
        this.statusIndicator.classList.add('offline');
        this.statusIndicator.textContent = '오프라인 모드';
        this.sendButton.textContent = '피드백 저장하기';
      }
    };

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    updateOnlineStatus();
  }

  async sendFeedback() {
    if (!this.selectedEmoji) {
      this.showNotification('피드백 이모지를 선택해주세요.', 'error');
      return;
    }

    const feedback = {
      type: this.selectedEmoji,
      emoji: CONFIG.EMOTIONS[this.selectedEmoji].emoji,
      text: this.feedbackInput.value.trim(),
      timestamp: new Date().toISOString(),
      pending: true  // 모든 피드백을 일단 pending 상태로 저장
    };

    try {
      // 로컬 스토리지에 저장
      await this.saveFeedbackLocally(feedback);
      
      this.resetUI();
      this.showNotification(
        this.isOnline ? '피드백이 저장되었습니다.' : '피드백이 오프라인에 저장되었습니다.',
        'success'
      );
      this.loadFeedbackHistory();
    } catch (error) {
      console.error('Failed to save feedback:', error);
      this.showNotification('피드백 저장에 실패했습니다.', 'error');
    }
  }

  async saveFeedbackLocally(feedback) {
    try {
      const { feedbackHistory = [] } = await chrome.storage.local.get('feedbackHistory');
      feedbackHistory.unshift(feedback);

      // 최대 50개까지만 저장
      while (feedbackHistory.length > 50) {
        feedbackHistory.pop();
      }

      await chrome.storage.local.set({ feedbackHistory });
    } catch (error) {
      console.error('Error saving to local storage:', error);
      throw new Error('Failed to save feedback locally');
    }
  }

  async loadFeedbackHistory() {
    try {
      const { feedbackHistory = [] } = await chrome.storage.local.get('feedbackHistory');
      this.feedbackList.innerHTML = '';
      
      feedbackHistory.forEach(feedback => {
        const item = this.createFeedbackElement(feedback);
        this.feedbackList.appendChild(item);
      });
    } catch (error) {
      console.error('Failed to load feedback history:', error);
      this.showNotification('피드백 기록을 불러오는데 실패했습니다.', 'error');
    }
  }

  createFeedbackElement(feedback) {
    const template = document.getElementById('feedback-item-template');
    const element = template.content.cloneNode(true);
    const item = element.querySelector('.feedback-item');
    
    const emoji = item.querySelector('.feedback-emoji');
    const time = item.querySelector('.feedback-time');
    const text = item.querySelector('.feedback-text');
    
    emoji.textContent = feedback.emoji;
    
    // 시간 포맷팅
    const feedbackDate = new Date(feedback.timestamp);
    const timeString = feedbackDate.toLocaleTimeString('ko-KR', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
    
    time.textContent = `${timeString} ${feedback.pending ? '(저장됨)' : ''}`;
    
    if (feedback.text) {
      text.textContent = feedback.text;
    } else {
      text.remove();
    }
    
    return item;
  }

  resetUI() {
    this.selectedEmoji = null;
    this.emojiButtons.forEach(b => b.classList.remove('active'));
    this.feedbackInput.value = '';
  }

  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, 3000);
  }
}

// 초기화
document.addEventListener('DOMContentLoaded', () => {
  new FeedbackPanel();
});