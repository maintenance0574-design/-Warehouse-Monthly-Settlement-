
/**
 * 倉儲月結管理系統 - 後端核心腳本 (v6.0 動態欄位偵測版)
 * 解決問題：確保「故障原因」、「送修日期」等欄位能精準對應，不受欄位順序影響。
 */

var CATEGORIES = ["進貨", "用料", "建置", "維修"];

// 欄位對照表：[試算表標題關鍵字, 可能的資料鍵值]
var FIELD_MAP = [
  { header: "id", keys: ["id"] },
  { header: "date", keys: ["date"] },
  { header: "type", keys: ["type"] },
  { header: "materialName", keys: ["materialName", "materialname"] },
  { header: "materialNumber", keys: ["materialNumber", "materialnumber"] },
  { header: "機台編號", keys: ["機台編號", "machineNumber", "machinenumber"] },
  { header: "quantity", keys: ["quantity"] },
  { header: "unitPrice", keys: ["unitPrice", "unitprice"] },
  { header: "total", keys: ["total"] },
  { header: "note", keys: ["note"] },
  { header: "機台種類", keys: ["機台種類", "machineCategory", "machinecategory"] },
  { header: "帳目類別", keys: ["帳目類別", "accountCategory", "accountcategory"] },
  { header: "操作人員", keys: ["操作人員", "operator"] },
  { header: "sn", keys: ["sn"] },
  { header: "故障原因", keys: ["故障原因", "faultReason", "faultreason"] },
  { header: "送修日期", keys: ["送修日期", "sentDate", "sentdate"] },
  { header: "完修日期", keys: ["完修日期", "repairDate", "repairdate"] },
  { header: "上機日期", keys: ["上機日期", "installDate", "installdate"] }
];

function doGet(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var allData = [];
  
  CATEGORIES.forEach(function(cat) {
    var sheet = ss.getSheetByName(cat);
    if (sheet) {
      var data = sheet.getDataRange().getValues();
      if (data.length > 1) {
        var headers = data[0];
        for (var i = 1; i < data.length; i++) {
          var row = data[i];
          var obj = {};
          headers.forEach(function(h, idx) {
            obj[String(h).trim()] = row[idx];
          });
          obj["id"] = obj["id"] || row[0];
          obj["type"] = cat;
          allData.push(obj);
        }
      }
    }
  });

  return ContentService.createTextOutput(JSON.stringify(allData))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var params = JSON.parse(e.postData.contents);
    var action = params.action;
    var type = params.type; 
    var id = String(params.id).trim();
    var payload = params.data || {};

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(type);
    
    // 如果工作表不存在則建立 (使用預設順序)
    if (!sheet) {
      sheet = ss.insertSheet(type);
      var defaultHeaders = FIELD_MAP.map(function(f) { return f.header; });
      sheet.appendRow(defaultHeaders);
    }

    // 獲取目前工作表的標題順序
    var currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    // 構建一行資料
    var rowData = currentHeaders.map(function(h) {
      var headerText = String(h).trim();
      
      // 根據 FIELD_MAP 尋找 payload 中對應的資料
      for (var i = 0; i < FIELD_MAP.length; i++) {
        var field = FIELD_MAP[i];
        if (field.header === headerText) {
          for (var j = 0; j < field.keys.length; j++) {
            var val = payload[field.keys[j]];
            if (val !== undefined && val !== null) return val;
          }
        }
      }
      // 特別處理 ID 和 Type 如果 FIELD_MAP 沒對到
      if (headerText.toLowerCase() === "id") return id;
      if (headerText.toLowerCase() === "type") return type;
      
      return "";
    });

    if (action === 'insert') {
      sheet.appendRow(rowData);
    } else if (action === 'update') {
      var values = sheet.getDataRange().getValues();
      var rowIdx = -1;
      for (var i = 1; i < values.length; i++) {
        if (String(values[i][0]).trim() === id) { rowIdx = i + 1; break; }
      }
      if (rowIdx !== -1) {
        sheet.getRange(rowIdx, 1, 1, rowData.length).setValues([rowData]);
      } else {
        sheet.appendRow(rowData);
      }
    } else if (action === 'delete') {
      CATEGORIES.forEach(function(cat) {
        var s = ss.getSheetByName(cat);
        if (s) {
          var v = s.getDataRange().getValues();
          for (var i = v.length - 1; i >= 1; i--) {
            if (String(v[i][0]).trim() === id) s.deleteRow(i + 1);
          }
        }
      });
    }

    return ContentService.createTextOutput(JSON.stringify({result: "ok"}))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({result: "error", message: err.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
