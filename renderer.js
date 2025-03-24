const { ipcRenderer } = require('electron');
const { marked } = require('marked');

// DOM Elements
const entriesList = document.getElementById('entries-list');
const entryTitle = document.getElementById('entry-title');
const entryContent = document.getElementById('entry-content');
const entryDate = document.getElementById('entry-date');
const newEntryBtn = document.getElementById('new-entry-btn');
const saveBtn = document.getElementById('save-btn');
const analyzeBtn = document.getElementById('analyze-btn');
const analysisContainer = document.getElementById('analysis-container');
const analysisContent = document.getElementById('analysis-content');
const closeAnalysisBtn = document.getElementById('close-analysis-btn');

// Current entry being edited
let currentEntry = null;

// Load entries when the app starts
loadEntries();

// Event listeners
newEntryBtn.addEventListener('click', createNewEntry);
saveBtn.addEventListener('click', saveEntry);
analyzeBtn.addEventListener('click', analyzeEntry);
closeAnalysisBtn.addEventListener('click', () => {
  analysisContainer.classList.add('hidden');
});

// Listen for new entry command from the menu
ipcRenderer.on('new-entry', createNewEntry);

// Functions
async function loadEntries() {
  const entries = await ipcRenderer.invoke('get-entries');
  renderEntriesList(entries);
}

function renderEntriesList(entries) {
  entriesList.innerHTML = '';
  
  // Sort entries by updatedAt date (newest first)
  entries.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  
  entries.forEach(entry => {
    const entryElement = document.createElement('div');
    entryElement.className = 'entry-item';
    if (currentEntry && entry.id === currentEntry.id) {
      entryElement.classList.add('selected');
    }
    
    const title = entry.title || 'Untitled';
    const date = new Date(entry.updatedAt).toLocaleDateString();
    const preview = entry.content.substring(0, 60) + (entry.content.length > 60 ? '...' : '');
    
    entryElement.innerHTML = `
      <h3>${title}</h3>
      <p>${date}</p>
      <p>${preview}</p>
    `;
    
    entryElement.addEventListener('click', () => loadEntry(entry.id));
    entriesList.appendChild(entryElement);
  });
}

async function loadEntry(id) {
  currentEntry = await ipcRenderer.invoke('get-entry', id);
  
  if (currentEntry) {
    entryTitle.value = currentEntry.title || '';
    entryContent.value = currentEntry.content || '';
    
    const date = new Date(currentEntry.updatedAt).toLocaleString();
    entryDate.textContent = `Last updated: ${date}`;
    
    // Update selected entry in the list
    document.querySelectorAll('.entry-item').forEach(item => {
      item.classList.remove('selected');
    });
    
    const selectedItem = Array.from(document.querySelectorAll('.entry-item')).find(
      item => item.querySelector('h3').textContent === (currentEntry.title || 'Untitled')
    );
    
    if (selectedItem) {
      selectedItem.classList.add('selected');
    }
    
    // Hide analysis container when loading a new entry
    analysisContainer.classList.add('hidden');
  }
}

function createNewEntry() {
  currentEntry = null;
  entryTitle.value = '';
  entryContent.value = '';
  entryDate.textContent = 'New entry';
  
  // Remove selected class from all entries
  document.querySelectorAll('.entry-item').forEach(item => {
    item.classList.remove('selected');
  });
  
  // Hide analysis container for new entry
  analysisContainer.classList.add('hidden');
}

async function saveEntry() {
  const title = entryTitle.value.trim();
  const content = entryContent.value.trim();
  
  if (!content) {
    alert('Please write something in your journal entry.');
    return;
  }
  
  const entry = {
    id: currentEntry ? currentEntry.id : null,
    title: title || 'Untitled',
    content,
    createdAt: currentEntry ? currentEntry.createdAt : null
  };
  
  const savedEntry = await ipcRenderer.invoke('save-entry', entry);
  currentEntry = savedEntry;
  
  const date = new Date(currentEntry.updatedAt).toLocaleString();
  entryDate.textContent = `Last updated: ${date}`;
  
  // Refresh the entries list
  loadEntries();
}

async function analyzeEntry() {
  const content = entryContent.value.trim();
  
  if (!content) {
    alert('Please write something in your journal entry before analyzing.');
    return;
  }
  
  analyzeBtn.disabled = true;
  analyzeBtn.textContent = 'Analyzing...';
  
  try {
    const analysis = await ipcRenderer.invoke('analyze-journal', content);
    analysisContent.innerHTML = marked.parse(analysis);
    analysisContainer.classList.remove('hidden');
  } catch (error) {
    alert('Error analyzing journal entry. Make sure Ollama is running.');
    console.error(error);
  } finally {
    analyzeBtn.disabled = false;
    analyzeBtn.textContent = 'Analyze with AI';
  }
} 