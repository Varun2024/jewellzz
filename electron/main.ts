import { app, BrowserWindow, ipcMain, protocol } from 'electron';
import path from 'node:path';
import { openDb, closeDb } from './db';
import { registerIpc } from './ipc';
import { startBackupScheduler, stopBackupScheduler } from './backup';
import { registerPhotoProtocol } from './photos';

// Register photo:// as a privileged, standard, secure custom protocol so <img> loads work.
protocol.registerSchemesAsPrivileged([
  { scheme: 'photo', privileges: { standard: true, secure: true, supportFetchAPI: true, bypassCSP: true } },
]);

const isDev = process.env.NODE_ENV === 'development';

async function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#f7f7f7',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  win.once('ready-to-show', () => win.show());

  if (isDev) {
    await win.loadURL('http://localhost:5173');
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    await win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(async () => {
  openDb();
  registerPhotoProtocol();
  registerIpc(ipcMain);
  startBackupScheduler();
  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  stopBackupScheduler();
  closeDb();
  if (process.platform !== 'darwin') app.quit();
});
