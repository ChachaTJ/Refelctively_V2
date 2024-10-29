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

// History 섹션 요소 생성
function createHistorySection() {
  const historySection = document.createElement('div');
  historySection.className = 'side-panel-section';
  historySection.innerHTML = `
      <div class="section-title">History</div>
      <div id="historyContent"></div>
  `;
  
  // History 섹션을 DOM에 추가
  document.querySelector('#app').appendChild(historySection);
  
  // 초기 히스토리 로드
  loadHistory();
}

// 히스토리 로드 및 표시
function loadHistory() {
  chrome.storage.local.get(['captions'], function(result) {
      const historyContent = document.querySelector('#historyContent');
      const captions = result.captions || [];
      
      if (captions.length === 0) {
          historyContent.innerHTML = `
              <div class="empty-history">
                  No captions saved yet
              </div>
          `;
          return;
      }
      
      // 최신 캡션이 위로 오도록 정렬
      const sortedCaptions = [...captions].reverse();
      
      historyContent.innerHTML = sortedCaptions.map((caption, index) => `
          <div class="history-item" data-index="${index}">
              <div class="history-timestamp">
                  ${new Date(caption.timestamp).toLocaleString()}
              </div>
              <div class="history-content">
                  ${caption.content}
              </div>
              <div class="history-actions">
                  <button class="btn-copy">Copy</button>
                  <button class="btn-delete">Delete</button>
              </div>
          </div>
      `).join('');
      
      // 이벤트 리스너 추가
      addHistoryEventListeners();
  });
}

// 히스토리 항목 이벤트 리스너
function addHistoryEventListeners() {
  // 복사 버튼
  document.querySelectorAll('.btn-copy').forEach(button => {
      button.addEventListener('click', function() {
          const content = this.parentElement.previousElementSibling.textContent;
          navigator.clipboard.writeText(content.trim()).then(() => {
              button.textContent = 'Copied!';
              setTimeout(() => {
                  button.textContent = 'Copy';
              }, 2000);
          });
      });
  });
  
  // 삭제 버튼
  document.querySelectorAll('.btn-delete').forEach(button => {
      button.addEventListener('click', function() {
          const item = this.closest('.history-item');
          const index = parseInt(item.dataset.index);
          
          chrome.storage.local.get(['captions'], function(result) {
              const captions = result.captions || [];
              captions.splice(captions.length - 1 - index, 1);
              
              chrome.storage.local.set({ captions }, function() {
                  loadHistory(); // 히스토리 새로고침
              });
          });
      });
  });
}

// DOMContentLoaded 이벤트에서 History 섹션 초기화
document.addEventListener('DOMContentLoaded', function() {
  createHistorySection();
  
  // 스토리지 변경 감지하여 자동 업데이트
  chrome.storage.onChanged.addListener(function(changes, namespace) {
      if (namespace === 'local' && changes.captions) {
          loadHistory();
      }
  });
});

// 초기화
document.addEventListener('DOMContentLoaded', () => {
  new FeedbackPanel();
});