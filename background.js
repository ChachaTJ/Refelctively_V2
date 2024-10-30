// background.js
import CONFIG from './config.js';

// 패널 상태를 storage에서 가져오거나 설정하는 함수
async function getPanelState() {
  const result = await chrome.storage.local.get('panelState');
  return result.panelState || false;
}

async function setPanelState(isOpen) {
  await chrome.storage.local.set({ panelState: isOpen });
}

// 피드백 툴바 토글 함수
async function toggleFeedbackToolbar() {
  try {
    const isOpen = await getPanelState();

    if (!isOpen) {
      // 툴바가 닫혀있을 때 열기
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab.id) {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['contentScript.js']
        });
      }
      await setPanelState(true);
    } else {
      // 툴바가 열려있을 때 닫기
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab.id) {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            const toolbar = document.getElementById('feedback-toolbar');
            if (toolbar) {
              toolbar.remove();
            }
          }
        });
      }
      await setPanelState(false);
    }
  } catch (error) {
    console.error('Error handling toggleFeedbackToolbar:', error);
  }
}

// 단축키 명령어 리스너
chrome.commands.onCommand.addListener(async (command) => {
  if (command === "toggle-sidepanel") {
    try {
      const isOpen = await getPanelState();
      
      if (!isOpen) {
        // 패널이 닫혀있을 때 열기
        await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
        await chrome.sidePanel.setOptions({
          path: 'sidepanel.html',
          enabled: true
        });
        await setPanelState(true);
      } else {
        // 패널이 열려있을 때 닫기
        await chrome.sidePanel.setOptions({ enabled: false });
        await setPanelState(false);
      }
    } catch (error) {
      console.error('Error handling command:', error);
    }
  }
});

// 확장프로그램 아이콘 클릭 리스너
chrome.action.onClicked.addListener(async () => {
  try {
    const isOpen = await getPanelState();
    
    if (!isOpen) {
      await chrome.sidePanel.setOptions({
        path: 'sidepanel.html',
        enabled: true
      });
      await setPanelState(true);
    } else {
      await chrome.sidePanel.setOptions({ enabled: false });
      await setPanelState(false);
    }
  } catch (error) {
    console.error('Error handling click:', error);
  }
});

// 초기 설정
chrome.runtime.onInstalled.addListener(async () => {
  try {
    // 초기 상태 설정
    await setPanelState(false);
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
    await chrome.sidePanel.setOptions({ 
      enabled: false,
      path: 'sidepanel.html'
    });
    
    // 로컬 스토리지 초기화
    await chrome.storage.local.set({ 
      [CONFIG.STORAGE_KEYS.feedbackHistory]: [] 
    });
  } catch (error) {
    console.error('Error in onInstalled:', error);
  }
});

// 오프라인 피드백 동기화 처리
let syncInterval = null;

chrome.runtime.onStartup.addListener(() => {
  startSyncInterval();
});

function startSyncInterval() {
  if (syncInterval) return;
  
  syncInterval = setInterval(async () => {
    try {
      const { feedbackHistory } = await chrome.storage.local.get(
        CONFIG.STORAGE_KEYS.feedbackHistory
      );
      
      const pendingFeedback = feedbackHistory.filter(f => f.pending);
      if (pendingFeedback.length === 0) return;
      
      for (const feedback of pendingFeedback) {
        try {
          await sendFeedbackToServer(feedback);
          
          // 성공적으로 전송된 피드백 제거
          const updatedHistory = feedbackHistory.filter(f => f !== feedback);
          await chrome.storage.local.set({ 
            [CONFIG.STORAGE_KEYS.feedbackHistory]: updatedHistory 
          });
        } catch (error) {
          console.error('Failed to sync feedback:', error);
        }
      }
    } catch (error) {
      console.error('Sync interval error:', error);
    }
  }, CONFIG.FEEDBACK_SYNC_INTERVAL);
}

async function sendFeedbackToServer(feedback) {
  const response = await fetch(`${CONFIG.API_URL}${CONFIG.ENDPOINTS.feedback}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(feedback)
  });
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  return await response.json();
}

// 확장프로그램 종료 시 인터벌 정리
chrome.runtime.onSuspend.addListener(() => {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
});

// 사이드패널이 닫힐 때 상태 업데이트
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'sidepanel') {
    port.onDisconnect.addListener(async () => {
      await setPanelState(false);
      await chrome.sidePanel.setOptions({ enabled: false });
    });
  }
});

// 탭 변경 시 패널 상태 확인 및 유지
chrome.tabs.onActivated.addListener(async () => {
  try {
    const isOpen = await getPanelState();
    await chrome.sidePanel.setOptions({
      enabled: isOpen,
      path: isOpen ? 'sidepanel.html' : ''
    });
  } catch (error) {
    console.error('Error in tab change:', error);
  }
});

// Background Script에서 메시지 수신
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.type === 'sendFeedback') {
    try {
      // 피드백 로컬 스토리지에 저장
      await saveFeedbackToLocalStorage(message.feedback);

      // Side Panel에 히스토리 갱신 요청
      try {
        await chrome.runtime.sendMessage({ type: 'updateHistory' });
      } catch (err) {
        console.log('Side panel not available:', err);
      }

      sendResponse({ success: true });
    } catch (error) {
      console.error('Failed to save feedback:', error);
      sendResponse({ success: false, error: error.message });
    }
    return true; // 비동기 응답을 위해 true 반환
  }
});

// 피드백을 로컬 스토리지에 저장하는 함수
async function saveFeedbackToLocalStorage(feedback) {
  try {
    const { feedbackHistory = [] } = await chrome.storage.local.get('feedbackHistory');
    
    // 새 피드백을 배열의 시작에 추가
    feedbackHistory.unshift({
      ...feedback,
      pending: true
    });

    // 최대 50개까지만 유지
    if (feedbackHistory.length > 50) {
      feedbackHistory.pop();
    }

    await chrome.storage.local.set({ feedbackHistory });
    return true;
  } catch (error) {
    console.error('Error saving feedback:', error);
    throw error;
  }
}