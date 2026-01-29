
/**
 * 倉儲月結管理系統 - 後端核心腳本 (v12.0 欄位精準隔離版 - 移除維修帳目類別)
 */

var CATEGORIES = ["進貨", "用料", "建置", "維修"];
var MASTER_PASSWORD = "Jumbo.net";

// 基礎欄位：所有類別共有
var COMMON_FIELDS = [
  { header: "id", keys: ["id", "ID", "編號"] },
  { header: "date", keys: ["date", "日期", "單據日期"] },
  { header: "type", keys: ["type", "類別", "紀錄類別"] },
  { header: "materialName", keys: ["materialName", "料件名稱", "維修零件/主體"] },
  { header: "materialNumber", keys: ["materialNumber", "料件編號", "料件編號(PN)"] },
  { header: "機台編號", keys: ["機台編號", "machineNumber", "機台 ID"] },
  { header: "quantity", keys: ["quantity", "數量"] },
  { header: "unitPrice", keys: ["unitPrice", "單價", "維修單價", "費用"] },
  { header: "total", keys: ["total", "總額", "維修總額", "小計", "結算總額"] },
  { header: "note", keys: ["note", "備註"] },
  { header: "機台種類", keys: ["機台種類", "machineCategory"] },
  { header: "操作人員", keys: ["操作人員", "operator"] }
];

// 核銷專用欄位 (進貨、用料、建置使用)
var ACCOUNT_FIELDS = [
  { header: "帳目類別", keys: ["帳目類別", "accountCategory"] }
];

// 進貨專用欄位
var INBOUND_FIELDS = [
  { header: "是否收貨", keys: ["是否收貨", "isReceived"] }
];

// 維修與設備專用追蹤欄位
var REPAIR_FIELDS = [
  { header: "sn", keys: ["sn", "序號", "設備序號(SN)"] },
  { header: "故障原因", keys: ["故障原因", "faultReason"] },
  { header: "是否報廢", keys: ["是否報廢", "isScrapped"] },
  { header: "送修日期", keys: ["送修日期", "sentDate"] },
  { header: "完修日期", keys: ["完修日期", "repairDate"] },
  { header: "上機日期", keys: ["上機日期", "installDate"] }
];

function ensureHeaders(sheet, sheetName) {
  var lastCol = sheet.getLastColumn();
  var currentHeaders = [];
  if (lastCol > 0) {
    currentHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h) { 
      return String(h).trim(); 
    });
  }
  
  var targetFields = COMMON_FIELDS.slice();
  
  // 根據工作表性質分配欄位
  if (sheetName !== "維修") {
    targetFields = targetFields.concat(ACCOUNT_FIELDS);
    if (sheetName === "進貨") {
      targetFields = targetFields.concat(INBOUND_FIELDS);
    }
  } else {
    targetFields = targetFields.concat(REPAIR_FIELDS);
  }

  var missingHeaders = [];
  targetFields.forEach(function(field) {
    var found = currentHeaders.some(function(h) {
      return h === field.header || field.keys.indexOf(h) !== -1;
    });
    if (!found) {
      missingHeaders.push(field.header);
    }
  });

  if (missingHeaders.length > 0) {
    sheet.getRange(1, Math.max(1, lastCol + 1), 1, missingHeaders.length).setValues([missingHeaders]);
    SpreadsheetApp.flush();
  }
}

function doGet(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var allData = [];
  CATEGORIES.forEach(function(cat) {
    var sheet = ss.getSheetByName(cat);
    if (sheet) {
      var data = sheet.getDataRange().getValues();
      if (data.length > 1) {
        var headers = data[0].map(function(h) { return String(h).trim(); });
        for (var i = 1; i < data.length; i++) {
          var row = data[i];
          var obj = {};
          headers.forEach(function(h, idx) { obj[h] = row[idx]; });
          obj["id"] = obj["id"] || obj["ID"] || obj["編號"] || row[0];
          obj["type"] = cat;
          allData.push(obj);
        }
      }
    }
  });
  return ContentService.createTextOutput(JSON.stringify(allData)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var params = JSON.parse(e.postData.contents);
    var action = params.action;
    var payload = params.data || {};
    if (action === 'login') {
      if (payload.password === MASTER_PASSWORD) return ContentService.createTextOutput(JSON.stringify({result: "ok", authorized: true})).setMimeType(ContentService.MimeType.JSON);
      return ContentService.createTextOutput(JSON.stringify({result: "error", authorized: false, message: "密碼不正確"})).setMimeType(ContentService.MimeType.JSON);
    }
    var type = params.type; 
    var id = String(params.id).trim();
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(type);
    if (!sheet) {
      sheet = ss.insertSheet(type);
      var initialHeaders = COMMON_FIELDS.map(function(f) { return f.header; });
      if (type !== "維修") {
        initialHeaders = initialHeaders.concat(ACCOUNT_FIELDS.map(function(f) { return f.header; }));
        if (type === "進貨") initialHeaders = initialHeaders.concat(INBOUND_FIELDS.map(function(f) { return f.header; }));
      } else {
        initialHeaders = initialHeaders.concat(REPAIR_FIELDS.map(function(f) { return f.header; }));
      }
      sheet.appendRow(initialHeaders);
    }
    ensureHeaders(sheet, type);
    var currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    var allFieldDefinitions = COMMON_FIELDS.concat(ACCOUNT_FIELDS).concat(INBOUND_FIELDS).concat(REPAIR_FIELDS);
    
    var rowData = currentHeaders.map(function(h) {
      var headerText = String(h).trim();
      var matchedField = allFieldDefinitions.find(function(f) { return f.header === headerText || f.keys.indexOf(headerText) !== -1; });
      if (matchedField) {
        // 嚴格隔離邏輯
        if (type === "維修") {
          // 維修工作表：不填寫帳目類別與收貨狀態
          if (ACCOUNT_FIELDS.some(function(f) { return f.header === matchedField.header; })) return "";
          if (INBOUND_FIELDS.some(function(f) { return f.header === matchedField.header; })) return "";
        } else {
          // 非維修工作表：不填寫維修專用欄位
          if (REPAIR_FIELDS.some(function(f) { return f.header === matchedField.header; })) return "";
          // 只有進貨才填寫收貨狀態
          if (type !== "進貨" && INBOUND_FIELDS.some(function(f) { return f.header === matchedField.header; })) return "";
        }

        for (var j = 0; j < matchedField.keys.length; j++) {
          var key = matchedField.keys[j];
          var val = payload[key];
          if (val !== undefined && val !== null) {
            if (["quantity", "unitPrice", "total"].indexOf(matchedField.header) !== -1) return Number(val) || 0;
            if (["是否報廢", "是否收貨"].indexOf(matchedField.header) !== -1) return !!val;
            return val;
          }
        }
      }
      if (headerText.toLowerCase() === "id") return id;
      if (headerText.toLowerCase() === "type") return type;
      return "";
    });
    if (action === 'insert') sheet.appendRow(rowData);
    else if (action === 'update') {
      var values = sheet.getDataRange().getValues();
      var rowIdx = -1;
      for (var i = 1; i < values.length; i++) { if (String(values[i][0]).trim() === id) { rowIdx = i + 1; break; } }
      if (rowIdx !== -1) sheet.getRange(rowIdx, 1, 1, rowData.length).setValues([rowData]);
      else sheet.appendRow(rowData);
    } else if (action === 'delete') {
      CATEGORIES.forEach(function(cat) {
        var s = ss.getSheetByName(cat);
        if (s) {
          var v = s.getDataRange().getValues();
          for (var i = v.length - 1; i >= 1; i--) { if (String(v[i][0]).trim() === id) s.deleteRow(i + 1); }
        }
      });
    }
    return ContentService.createTextOutput(JSON.stringify({result: "ok"})).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({result: "error", message: err.toString()})).setMimeType(ContentService.MimeType.JSON);
  }
}
