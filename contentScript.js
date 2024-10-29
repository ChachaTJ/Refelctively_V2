// contentScript.js
(function() {
  if (window.hasOwnProperty('engageliContentScriptLoaded')) {
    return;
  }
  window.engageliContentScriptLoaded = true;

  // 스타일 추가
  function addStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .engageli-popup {
        position: fixed;
        bottom: 80px;
        right: 20px;
        width: 300px;
        background: white;
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        z-index: 9999;
        padding: 16px;
        display: none;
        font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      }

      .engageli-popup-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
      }

      .engageli-popup-title {
        font-size: 14px;
        font-weight: 600;
        color: #1F2937;
      }

      .engageli-popup-close {
        background: none;
        border: none;
        color: #6B7280;
        cursor: pointer;
        padding: 4px;
        font-size: 18px;
      }

      .engageli-emoji-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 8px;
        margin-bottom: 12px;
      }

      .engageli-emoji-button {
        display: flex;
        align-items: center;
        padding: 8px 12px;
        background: #F8F9FA;
        border: 1px solid #E5E7EB;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .engageli-emoji-button:hover {
        border-color: #0066FF;
        background: rgba(0, 102, 255, 0.05);
      }

      .engageli-emoji-button.active {
        background: rgba(0, 102, 255, 0.1);
        border-color: #0066FF;
      }

      .engageli-emoji-button span {
        margin-left: 8px;
        font-size: 14px;
        color: #6B7280;
      }

      .engageli-input {
        width: 100%;
        padding: 8px 12px;
        background: #F8F9FA;
        border: 1px solid #E5E7EB;
        border-radius: 8px;
        font-family: inherit;
        font-size: 14px;
        resize: vertical;
        min-height: 60px;
        margin-bottom: 12px;
      }

      .engageli-input:focus {
        outline: none;
        border-color: #0066FF;
        box-shadow: 0 0 0 2px rgba(0, 102, 255, 0.1);
      }

      .engageli-send-button {
        width: 100%;
        padding: 8px 16px;
        background: #0066FF;
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: background 0.2s;
      }

      .engageli-send-button:hover {
        background: #0052CC;
      }
    `;
    document.head.appendChild(style);
  }

  function createPopup() {
    const popup = document.createElement('div');
    popup.className = 'engageli-popup';
    popup.innerHTML = `
      <div class="engageli-popup-header">
        <div class="engageli-popup-title">피드백 보내기</div>
        <button class="engageli-popup-close" aria-label="닫기">✕</button>
      </div>
      <div class="engageli-emoji-grid">
        <button class="engageli-emoji-button" data-mood="understand">
          😊 <span>Understood</span>
        </button>
        <button class="engageli-emoji-button" data-mood="question">
          ❓ <span>Question</span>
        </button>
        <button class="engageli-emoji-button" data-mood="confused">
          😐 <span>Confused</span>
        </button>
        <button class="engageli-emoji-button" data-mood="repeat">
          🔄 <span>Repeat</span>
        </button>
      </div>
      <textarea
        class="engageli-input"
        placeholder="추가 피드백이 있다면 입력해주세요 (선택사항)"
        maxlength="500"
      ></textarea>
      <button class="engageli-send-button">피드백 보내기</button>
    `;

    document.body.appendChild(popup);
    
    // 이벤트 리스너 추가
    const closeBtn = popup.querySelector('.engageli-popup-close');
    closeBtn.addEventListener('click', () => {
      popup.style.display = 'none';
    });

    // 이모지 버튼 이벤트
    const emojiButtons = popup.querySelectorAll('.engageli-emoji-button');
    let selectedEmoji = null;

    emojiButtons.forEach(button => {
      button.addEventListener('click', () => {
        emojiButtons.forEach(b => b.classList.remove('active'));
        button.classList.add('active');
        selectedEmoji = button.dataset.mood;
      });
    });

    // 전송 버튼 이벤트
    const sendButton = popup.querySelector('.engageli-send-button');
    const textarea = popup.querySelector('.engageli-input');

    sendButton.addEventListener('click', async () => {
      if (!selectedEmoji) {
        alert('이모지를 선택해주세요.');
        return;
      }

      const feedback = {
        type: selectedEmoji,
        text: textarea.value.trim(),
        timestamp: new Date().toISOString(),
        emoji: getEmojiForType(selectedEmoji),
        pending: true
      };

      // Background Script로 메시지 전송
      chrome.runtime.sendMessage({ 
        type: 'sendFeedback', 
        feedback 
      }, (response) => {
        if (response?.success) {
          console.log('Feedback sent and saved successfully.');
          
          // UI 초기화 및 팝업 닫기
          textarea.value = '';
          selectedEmoji = null;
          emojiButtons.forEach(b => b.classList.remove('active'));
          popup.style.display = 'none';
        }
      });

      if (selectedEmoji === 'confused' || selectedEmoji === 'repeat') {
        const reactionButton = document.querySelector('[data-testid="reaction-button"]');
        if (reactionButton) {
          reactionButton.click();
          setTimeout(() => {
            const heartButton = document.querySelector('[aria-label="Purple heart"]');
            if (heartButton) {
              heartButton.click();
            }
          }, 500);
        }
      }
    });

    // 외부 클릭 시 닫기
    document.addEventListener('click', (e) => {
      if (!popup.contains(e.target) && 
          !document.getElementById('engageli-understand-button').contains(e.target)) {
        popup.style.display = 'none';
      }
    });

    return popup;
  }

  function getEmojiForType(type) {
    const emojiMap = {
      understand: '😊',
      question: '❓',
      confused: '😐',
      repeat: '🔄'
    };
    return emojiMap[type] || '❔';
  }

  function createUnderstandButton() {
    const existingButton = document.getElementById('engageli-understand-button');
    if (existingButton) {
      existingButton.remove();
    }

    const chatButton = document.querySelector('#open-chat-button');
    if (!chatButton) return;

    const button = document.createElement('button');
    button.id = 'engageli-understand-button';
    button.className = chatButton.className;
    button.setAttribute('aria-label', 'Feedback');

    const boxDiv = document.createElement('div');
    boxDiv.className = 'MuiBox-root css-1tdgbex';

    const span = document.createElement('span');
    span.className = 'MuiBadge-root css-1rzb3uu';
    span.setAttribute('aria-hidden', 'true');

    const emoji = document.createElement('div');
    emoji.style.fontSize = '28px';
    emoji.textContent = '🤔';

    const text = document.createElement('p');
    text.className = 'MuiTypography-root MuiTypography-body2 jss618 css-1tllh4l';
    text.textContent = 'Feedback';

    span.appendChild(emoji);
    boxDiv.appendChild(span);
    boxDiv.appendChild(text);
    button.appendChild(boxDiv);

    // 클릭 이벤트
    let popup = document.querySelector('.engageli-popup');
    button.addEventListener('click', () => {
      if (!popup) {
        popup = createPopup();
      }
      popup.style.display = popup.style.display === 'none' ? 'block' : 'none';
    });

    chatButton.parentNode.insertBefore(button, chatButton.nextSibling);
  }

  //1-1. 캡션 찾기 
  function findLatestNote() {
    // note- 로 시작하는 id를 가진 모든 요소 찾기
    const notes = document.querySelectorAll('[id^="note-"]');
    if (notes.length === 0) return null;

    // note-id의 숫자 부분을 추출하여 가장 큰 값을 찾음
    let latestNote = null;
    let maxId = -1;

    notes.forEach(note => {
        const idNumber = parseInt(note.id.replace('note-', ''));
        if (idNumber > maxId) {
            maxId = idNumber;
            latestNote = note;
        }
    });

    return latestNote;
}

function findCaptionNoteAndClass() {
    // 모든 노트 가져오기
    const notes = document.querySelectorAll('[id^="note-"]');
    
    for (const note of notes) {
        // 노트 내의 모든 div 찾기
        const allDivs = note.getElementsByTagName('div');
        
        // 각 div를 순회하면서 'Recent Captions:' 텍스트를 포함한 div 찾기
        for (const div of allDivs) {
            if (div.textContent?.includes('Recent Captions:')) {
                // 찾은 div의 클래스명 반환
                return {
                    note: note,
                    className: div.className
                };
            }
        }
    }
    
    return null;
}

// 2-1. 캡션 가져오기 함수
function getCaptions() {
  // 로딩 표시
  const loadingModal = document.createElement('div');
  loadingModal.className = 'caption-modal';
  loadingModal.innerHTML = `
      <div style="text-align: center;">
          <p>캡션을 가져오는 중...</p>
          <div style="margin: 10px 0;">⏳</div>
      </div>
  `;
  
  const loadingBackdrop = document.createElement('div');
  loadingBackdrop.className = 'caption-modal-backdrop';
  
  document.body.appendChild(loadingBackdrop);
  document.body.appendChild(loadingModal);

  // 1. 노트 버튼 클릭
  const notesButton = document.querySelector('#open-notes-button');
  if (notesButton) {
      notesButton.click();
      
      // 2. 잠시 대기 후 캡션 버튼 클릭
      setTimeout(() => {
          const captionsButton = document.querySelector('#notes-take-captions-rewind');
          if (captionsButton) {
              captionsButton.click();
              
              // 3. 캡션 내용 가져오기 (대기 시간 증가)
              setTimeout(() => {
                  // 캡션 클래스 찾기
                  const captionInfo = findCaptionNoteAndClass();
                  
                  if (!captionInfo) {
                      document.body.removeChild(loadingModal);
                      document.body.removeChild(loadingBackdrop);
                      createModal('캡션을 찾을 수 없습니다. 잠시 후 다시 시도해주세요.');
                      return;
                  }

                  // 로딩 모달 제거
                  document.body.removeChild(loadingModal);
                  document.body.removeChild(loadingBackdrop);

                  const content = captionInfo.note.querySelector(`.${captionInfo.className}`).textContent.trim();
                  createModal(content);
                  
                  // 디버깅용 로그
                  console.log('캡션 클래스:', captionInfo.className);
                  console.log('캡션 노트 ID:', captionInfo.note.id);
              }, 3000); // 캡션 로딩 대기 시간 3초
          }
      }, 1000); // 노트 패널 로딩 대기 시간 1초
  }
}

  // 모달 스타일 정의
  const modalStyles = `
  .caption-modal {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      z-index: 10001;
      max-width: 80%;
      max-height: 80vh;
      overflow-y: auto;
  }
  .caption-modal-content {
      margin-bottom: 15px;
      white-space: pre-wrap;
      line-height: 1.5;
  }
  .caption-modal-close {
      position: absolute;
      top: 10px;
      right: 10px;
      background: none;
      border: none;
      font-size: 20px;
      cursor: pointer;
      padding: 5px;
  }
  .caption-modal-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.5);
      z-index: 10000;
  }
  .caption-modal-buttons {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
  }
  .caption-modal button {
      padding: 8px 16px;
      border-radius: 4px;
      border: 1px solid #ccc;
      background: white;
      cursor: pointer;
  }
  .caption-modal button:hover {
      background: #f0f0f0;
  }
  `;
  
  // 스타일 추가
  const styleSheet = document.createElement('style');
  styleSheet.textContent = modalStyles;
  document.head.appendChild(styleSheet);
  
  // 모달 생성 함수
  function createModal(content) {
  const backdrop = document.createElement('div');
  backdrop.className = 'caption-modal-backdrop';
  
  const modal = document.createElement('div');
  modal.className = 'caption-modal';
  modal.innerHTML = `
      <button class="caption-modal-close">&times;</button>
      <div class="caption-modal-content">${content}</div>
      <div class="caption-modal-buttons">
          <button class="copy-button">복사하기</button>
          <button class="close-button">닫기</button>
      </div>
  `;
  
  document.body.appendChild(backdrop);
  document.body.appendChild(modal);
  
  // 닫기 버튼 이벤트
  const closeModal = () => {
      document.body.removeChild(backdrop);
      document.body.removeChild(modal);
  };
  
  modal.querySelector('.caption-modal-close').onclick = closeModal;
  modal.querySelector('.close-button').onclick = closeModal;
  backdrop.onclick = closeModal;
  
  // 복사 버튼 이벤트
  modal.querySelector('.copy-button').onclick = () => {
      navigator.clipboard.writeText(content).then(() => {
          alert('클립보드에 복사되었습니다!');
      }).catch(err => {
          console.error('복사 실패:', err);
      });
  };
  }
  
// 키보드 단축키 이벤트 리스너
document.addEventListener('keydown', function(event) {
if (event.altKey && event.key === 'c') {
    getCaptions();
}
});

// 버튼 생성 및 추가
const createCaptionButton = () => {
const button = document.createElement('button');
button.innerHTML = '📝';
button.style.cssText = `
    position: fixed;
    right: 20px;
    top: 150px;
    z-index: 10000;
    padding: 8px;
    font-size: 20px;
    cursor: pointer;
    background: white;
    border: 1px solid #ccc;
    border-radius: 4px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
`;

button.addEventListener('click', getCaptions);
document.body.appendChild(button);
};

// 페이지 로드 완료 후 버튼 추가
if (document.readyState === 'complete') {
createCaptionButton();
} else {
window.addEventListener('load', createCaptionButton);
}

  // 초기화 코드
  addStyles();
  createUnderstandButton();

  // MutationObserver 설정
  const observer = new MutationObserver((mutations) => {
    if (!document.getElementById('engageli-understand-button')) {
      createUnderstandButton();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
})();