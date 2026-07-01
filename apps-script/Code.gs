// ====== CONFIGURACIÓN ======
const IMAGES_FOLDER_ID = "1MA9alXqGRzyIUVvUKsD4AXvVNL-oON39";
const STICKERS_FOLDER_ID = "1EkBDvBfzUdIJwiyawa5F4TD0aMpunaz-";

const SHEET_MEMORIES = "Memories";
const SHEET_ELEMENTS = "PageElements";
const SHEET_CONFIG = "AlbumConfig";
// ===========================

function doGet(e) {
  const action = e.parameter.action;

  if (action === 'getStickers') {
    return handleGetStickers();
  } else if (action === 'getPageElements') {
    return handleGetPageElements(e.parameter.memoryId);
  } else if (action === 'getAlbumConfig') {
    return handleGetAlbumConfig();
  } else if (action === 'getFullAlbum') {
    return handleGetFullAlbum();
  } else {
    return handleGetMemories();
  }
}

function handleGetFullAlbum() {
  try {
    const configSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_CONFIG);
    const configData = configSheet.getDataRange().getValues();
    const configHeaders = configData[0];
    const configRow = configData[1] || [];
    const config = {};
    for (let j = 0; j < configHeaders.length; j++) {
      config[configHeaders[j]] = configRow[j] !== undefined ? configRow[j] : "";
    }

    const memorySheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_MEMORIES);
    const memoryData = memorySheet.getDataRange().getValues();
    const memoryHeaders = memoryData[0];
    const memories = [];
    for (let i = 1; i < memoryData.length; i++) {
      let row = memoryData[i];
      if (!row[0]) continue;
      let mem = {};
      for (let j = 0; j < memoryHeaders.length; j++) {
        mem[memoryHeaders[j]] = row[j];
      }
      memories.push(mem);
    }

    return jsonResponse({ success: true, config, memories });
  } catch (error) {
    return jsonResponse({ success: false, error: error.toString() });
  }
}

function handleGetAlbumConfig() {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_CONFIG);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const configRow = data[1] || [];
    const config = {};
    for (let j = 0; j < headers.length; j++) {
      config[headers[j]] = configRow[j] !== undefined ? configRow[j] : "";
    }
    return jsonResponse({ success: true, config });
  } catch (error) {
    return jsonResponse({ success: false, error: error.toString() });
  }
}

function handleGetStickers() {
  try {
    const folder = DriveApp.getFolderById(STICKERS_FOLDER_ID);
    const files = folder.getFiles();
    const stickers = [];
    while (files.hasNext()) {
      let file = files.next();
      stickers.push({
        id: file.getId(),
        name: file.getName(),
        url: "https://drive.google.com/thumbnail?id=" + file.getId() + "&sz=w1000"
      });
    }
    return jsonResponse({ success: true, stickers });
  } catch (error) {
    return jsonResponse({ success: false, error: error.toString() });
  }
}

function handleGetMemories() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_MEMORIES);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const memories = [];
  for (let i = 1; i < data.length; i++) {
    let row = data[i];
    if (!row[0]) continue;
    let mem = {};
    for (let j = 0; j < headers.length; j++) {
      mem[headers[j]] = row[j];
    }
    memories.push(mem);
  }
  return jsonResponse({ success: true, memories });
}

function handleGetPageElements(memoryId) {
  if (!memoryId) return jsonResponse({ success: false, error: 'Missing memoryId' });

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ELEMENTS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const elements = [];

  for (let i = 1; i < data.length; i++) {
    let row = data[i];
    if (row[1] == memoryId) {
      let el = {};
      for (let j = 0; j < headers.length; j++) {
        el[headers[j]] = row[j];
      }
      elements.push(el);
    }
  }
  return jsonResponse({ success: true, elements });
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action || 'saveMemory';

    if (action === 'savePageElements') {
      return handleSavePageElements(body.memoryId, body.elements);
    } else if (action === 'saveConfig') {
      return handleSaveConfig(body.config || body);
    } else if (action === 'saveMemory') {
      return handleSaveMemory(body);
    } else {
      return handleSaveMemory(body);
    }
  } catch (error) {
    return jsonResponse({ success: false, error: error.toString() });
  }
}

// NUEVA: Guardar configuración del álbum
function handleSaveConfig(config) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_CONFIG);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const row = [];

    for (let j = 0; j < headers.length; j++) {
      const key = headers[j];
      row.push(config[key] !== undefined ? config[key] : (data[1] ? data[1][j] : ""));
    }

    if (data.length > 1) {
      sheet.getRange(2, 1, 1, headers.length).setValues([row]);
    } else {
      sheet.appendRow(row);
    }

    return jsonResponse({ success: true });
  } catch (error) {
    return jsonResponse({ success: false, error: error.toString() });
  }
}

function handleSavePageElements(memoryId, elements) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ELEMENTS);
  const data = sheet.getDataRange().getValues();

  for (let i = data.length - 1; i >= 1; i--) {
    if (data[i][1] == memoryId) {
      sheet.deleteRow(i + 1);
    }
  }

  if (elements && elements.length > 0) {
    elements.forEach(el => {
      sheet.appendRow([
        el.id,
        el.memoryId,
        el.type,
        el.content,
        el.x,
        el.y,
        el.scale,
        el.rotation,
        el.color || '',
        el.zIndex || 1,
        el.font || '',
        el.locked !== undefined ? el.locked : false,
        el.visible !== undefined ? el.visible : true
      ]);
    });
  }

  return jsonResponse({ success: true });
}

function handleSaveMemory(body) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_MEMORIES);
  const folder = DriveApp.getFolderById(IMAGES_FOLDER_ID);

  let photoUrl = body.photo || "";
  if (body.photoBase64) {
    let photoBlob = Utilities.newBlob(
      Utilities.base64Decode(body.photoBase64.split(",")[1]),
      'image/jpeg',
      'photo_' + body.id + '.jpg'
    );
    let photoFile = folder.createFile(photoBlob);
    photoFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    photoUrl = "https://drive.google.com/thumbnail?id=" + photoFile.getId() + "&sz=w1000";
  }

  let drawingUrl = "";
  if (body.drawingBase64) {
    let drawingBlob = Utilities.newBlob(
      Utilities.base64Decode(body.drawingBase64.split(",")[1]),
      'image/png',
      'draw_' + body.id + '.png'
    );
    let drawingFile = folder.createFile(drawingBlob);
    drawingFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    drawingUrl = "https://drive.google.com/thumbnail?id=" + drawingFile.getId() + "&sz=w1000";
  }

  sheet.appendRow([
    body.id,
    body.date,
    body.description,
    body.caption,
    body.signature || '',
    photoUrl,
    drawingUrl,
    body.rotation || 0
  ]);

  return jsonResponse({ success: true });
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
