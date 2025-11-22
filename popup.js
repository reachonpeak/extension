document.addEventListener('DOMContentLoaded', () => {
  const startBtn = document.getElementById('startBtn');
  const excludeInput = document.getElementById('excludeInput');
  const excludeTagsContainer = document.getElementById('excludeTags');
  let excludeList = [];

  // Load settings from storage
  chrome.storage.local.get(['settings', 'isRunning', 'bookedCount'], (result) => {
    if (result.settings) {
      document.getElementById('refreshMs').value = result.settings.refreshMs;
      document.getElementById('randomizerMs').value = result.settings.randomizerMs;
      document.getElementById('minPayout').value = result.settings.minPayout;
      document.getElementById('minRate').value = result.settings.minRate;
      document.getElementById('maxStops').value = result.settings.maxStops;
      document.getElementById('rangeMin').value = result.settings.rangeMin;
      document.getElementById('rangeMax').value = result.settings.rangeMax;
      document.getElementById('autoBook').checked = result.settings.autoBook;
      document.getElementById('bookLimit').value = result.settings.bookLimit;
      excludeList = result.settings.excludeList || [];
      renderTags();
    }
    
    if (result.bookedCount) {
        document.getElementById('bookedCount').innerText = result.bookedCount;
    }

    updateButtonState(result.isRunning);
  });

  // Handle Exclude Tags
  excludeInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && excludeInput.value.trim() !== '') {
      const val = excludeInput.value.trim().toUpperCase();
      if (!excludeList.includes(val)) {
        excludeList.push(val);
        renderTags();
      }
      excludeInput.value = '';
    }
  });

  function renderTags() {
    excludeTagsContainer.innerHTML = '';
    excludeList.forEach(tag => {
      const tagEl = document.createElement('div');
      tagEl.className = 'tag';
      tagEl.innerHTML = `${tag} <span data-val="${tag}">×</span>`;
      excludeTagsContainer.appendChild(tagEl);
      
      tagEl.querySelector('span').addEventListener('click', (e) => {
        excludeList = excludeList.filter(t => t !== e.target.dataset.val);
        renderTags();
      });
    });
  }

  // Save and Start/Stop
  startBtn.addEventListener('click', () => {
    chrome.storage.local.get('isRunning', (result) => {
      const isRunning = !result.isRunning;
      
      const settings = {
        refreshMs: parseInt(document.getElementById('refreshMs').value),
        randomizerMs: parseInt(document.getElementById('randomizerMs').value),
        minPayout: parseInt(document.getElementById('minPayout').value),
        minRate: parseFloat(document.getElementById('minRate').value),
        maxStops: parseInt(document.getElementById('maxStops').value),
        rangeMin: parseInt(document.getElementById('rangeMin').value),
        rangeMax: parseInt(document.getElementById('rangeMax').value),
        autoBook: document.getElementById('autoBook').checked,
        bookLimit: parseInt(document.getElementById('bookLimit').value),
        excludeList: excludeList
      };

      chrome.storage.local.set({ 
        settings: settings, 
        isRunning: isRunning,
        bookedCount: isRunning ? 0 : (result.bookedCount || 0) // Reset count on start
      }, () => {
        updateButtonState(isRunning);
        // Send message to active tab to toggle script immediately
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            if(tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: isRunning ? "start" : "stop", 
                    settings: settings
                });
            }
        });
      });
    });
  });

  function updateButtonState(running) {
    if (running) {
      startBtn.textContent = "STOP";
      startBtn.classList.add('stop');
    } else {
      startBtn.textContent = "START";
      startBtn.classList.remove('stop');
    }
  }

  // Update booked limit display when input changes
  document.getElementById('bookLimit').addEventListener('input', (e) => {
      document.getElementById('bookedLimitDisplay').innerText = e.target.value;
  });
});