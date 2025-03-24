const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const Store = require('electron-store');

// Initialize the data store
const store = new Store();

let mainWindow;

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    }
  });

  // Load the index.html file
  mainWindow.loadFile('index.html');

  // Create application menu
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Entry',
          accelerator: 'CmdOrCtrl+N',
          click() {
            mainWindow.webContents.send('new-entry');
          }
        },
        { type: 'separator' },
        {
          label: 'Exit',
          accelerator: 'CmdOrCtrl+Q',
          click() {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'toggledevtools' },
        { type: 'separator' },
        { role: 'resetzoom' },
        { role: 'zoomin' },
        { role: 'zoomout' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// When Electron has finished initialization
app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// IPC handlers for journal operations
ipcMain.handle('save-entry', async (event, entry) => {
  const entries = store.get('journal-entries', []);
  
  if (entry.id) {
    // Update existing entry
    const index = entries.findIndex(e => e.id === entry.id);
    if (index !== -1) {
      entries[index] = entry;
    }
  } else {
    // Create new entry
    entry.id = Date.now().toString();
    entry.createdAt = new Date().toISOString();
    entries.push(entry);
  }
  
  entry.updatedAt = new Date().toISOString();
  store.set('journal-entries', entries);
  return entry;
});

ipcMain.handle('get-entries', async () => {
  return store.get('journal-entries', []);
});

ipcMain.handle('get-entry', async (event, id) => {
  const entries = store.get('journal-entries', []);
  return entries.find(entry => entry.id === id);
});

ipcMain.handle('delete-entry', async (event, id) => {
  const entries = store.get('journal-entries', []);
  const updatedEntries = entries.filter(entry => entry.id !== id);
  store.set('journal-entries', updatedEntries);
  return true;
});

// AI analysis with Ollama
ipcMain.handle('analyze-journal', async (event, text) => {
  try {
    const { default: ollama } = await import('ollama');
    
    const response = await ollama.chat({
      model: 'llama3',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful journal analysis assistant. Analyze the journal entry and provide insights.'
        },
        {
          role: 'user',
          content: `Please analyze this journal entry and provide insights: ${text}`
        }
      ]
    });
    
    return response.message.content;
  } catch (error) {
    console.error('Error analyzing journal with Ollama:', error);
    return 'Error connecting to Ollama. Make sure Ollama is running locally.';
  }
}); 