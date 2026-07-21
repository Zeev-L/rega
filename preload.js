const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('rega', {
  getData: () => ipcRenderer.invoke('data:get'),
  save: (next) => ipcRenderer.invoke('data:save', next),
  pickImage: () => ipcRenderer.invoke('image:pick'),
  action: (section, gratitudeText) => ipcRenderer.invoke('moment:action', { section, gratitudeText }),
  snooze: () => ipcRenderer.invoke('moment:snooze'),
  closeMoment: () => ipcRenderer.invoke('moment:close'),
  sendSummary: () => ipcRenderer.invoke('summary:send'),
  openEditor: (sec) => ipcRenderer.invoke('open:editor', sec),
  exportContent: () => ipcRenderer.invoke('content:export'),
  importContent: () => ipcRenderer.invoke('content:import')
});
